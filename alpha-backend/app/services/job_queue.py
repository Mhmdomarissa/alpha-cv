"""
Background Job Queue for Heavy CV Processing
Processes applications asynchronously to prevent blocking
"""
import asyncio
import logging
import uuid
from typing import Dict, Any, Optional
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class JobStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class JobResult:
    job_id: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: int = 0  # 0-100

class ApplicationJobQueue:
    def __init__(self, max_workers: int = 5):
        self.max_workers = max_workers
        self.jobs: Dict[str, JobResult] = {}
        self.queue = asyncio.Queue()
        self.workers_started = False
        self.workers = []
        
    async def start_workers(self):
        """Start background worker tasks"""
        if self.workers_started:
            return
            
        logger.info(f"🔄 Starting {self.max_workers} application processing workers")
        for i in range(self.max_workers):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self.workers.append(worker)
        self.workers_started = True
    
    async def stop_workers(self):
        """Stop all workers gracefully"""
        if not self.workers_started:
            return
            
        logger.info("🛑 Stopping application processing workers")
        for worker in self.workers:
            worker.cancel()
        
        await asyncio.gather(*self.workers, return_exceptions=True)
        self.workers = []
        self.workers_started = False
    
    async def submit_application(self, application_data: Dict[str, Any]) -> str:
        """Submit application for background processing"""
        job_id = str(uuid.uuid4())
        
        # Create job record
        job = JobResult(
            job_id=job_id,
            status=JobStatus.PENDING,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self.jobs[job_id] = job
        
        # Add to queue
        await self.queue.put({
            "job_id": job_id,
            "data": application_data
        })
        
        logger.info(f"📝 Queued application job {job_id}. Queue size: {self.queue.qsize()}")
        return job_id
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status and result"""
        job = self.jobs.get(job_id)
        if not job:
            return None
        
        return {
            "job_id": job.job_id,
            "status": job.status.value,
            "created_at": job.created_at.isoformat(),
            "updated_at": job.updated_at.isoformat(),
            "progress": job.progress,
            "result": job.result,
            "error": job.error
        }
    
    async def _worker(self, worker_name: str):
        """Background worker that processes queued applications"""
        logger.info(f"👷 Started worker {worker_name}")
        
        while True:
            try:
                # Get job from queue (wait up to 1 second)
                job_item = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                job_id = job_item["job_id"]
                application_data = job_item["data"]
                
                logger.info(f"🔄 {worker_name} processing application {job_id}")
                
                # Update job status
                self.jobs[job_id].status = JobStatus.PROCESSING
                self.jobs[job_id].updated_at = datetime.utcnow()
                self.jobs[job_id].progress = 10
                
                # Process application
                result = await self._process_application(job_id, application_data)
                
                # Update job with result
                self.jobs[job_id].status = JobStatus.COMPLETED
                self.jobs[job_id].result = result
                self.jobs[job_id].progress = 100
                self.jobs[job_id].updated_at = datetime.utcnow()
                
                logger.info(f"✅ {worker_name} completed application {job_id}")
                
            except asyncio.TimeoutError:
                # No jobs in queue, continue waiting
                continue
            except asyncio.CancelledError:
                logger.info(f"🛑 Worker {worker_name} cancelled")
                break
            except Exception as e:
                if 'job_id' in locals():
                    # Mark job as failed
                    self.jobs[job_id].status = JobStatus.FAILED
                    self.jobs[job_id].error = str(e)
                    self.jobs[job_id].updated_at = datetime.utcnow()
                    logger.error(f"❌ {worker_name} failed to process {job_id}: {e}")
                else:
                    logger.error(f"❌ {worker_name} error: {e}")
    
    async def _process_application(self, job_id: str, application_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process application with progress updates"""
        from app.services.parsing_service import get_parsing_service
        from app.services.llm_service import get_llm_service
        from app.services.embedding_service import get_embedding_service
        from app.utils.qdrant_utils import get_qdrant_utils
        import tempfile
        import os
        
        try:
            # Step 1: Parse CV (20% progress)
            self.jobs[job_id].progress = 20
            
            cv_content = application_data["cv_content"]
            cv_filename = application_data["cv_filename"]
            
            # Create temp file
            file_ext = os.path.splitext(cv_filename)[1].lower() or '.pdf'
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                tmp.write(cv_content)
                tmp_path = tmp.name
            
            try:
                parsing_service = get_parsing_service()
                parsed = parsing_service.process_document(tmp_path, "cv")
                extracted_text = parsed["clean_text"]
            finally:
                os.unlink(tmp_path)
            
            # Step 2: LLM Processing (50% progress)
            self.jobs[job_id].progress = 50
            
            llm_service = get_llm_service()
            llm_result = llm_service.standardize_cv(extracted_text, cv_filename)
            
            # Update contact info with form data
            if "contact_info" not in llm_result:
                llm_result["contact_info"] = {}
            llm_result["contact_info"]["name"] = application_data["applicant_name"]
            llm_result["contact_info"]["email"] = application_data["applicant_email"]
            if application_data.get("applicant_phone"):
                llm_result["contact_info"]["phone"] = application_data["applicant_phone"]
            
            # Step 3: Generate Embeddings (70% progress)
            self.jobs[job_id].progress = 70
            
            embedding_service = get_embedding_service()
            embeddings_data = embedding_service.generate_document_embeddings(llm_result)
            
            # Step 4: Store in Database (90% progress)
            self.jobs[job_id].progress = 90
            
            qdrant = get_qdrant_utils()
            application_id = application_data["application_id"]
            
            # Store in CV collections
            success_steps = []
            
            # Store document
            success_steps.append(
                qdrant.store_document(
                    application_id, "cv", cv_filename,
                    application_data.get("content_type", "application/octet-stream"),
                    extracted_text, datetime.utcnow().isoformat(),
                    file_path=application_data.get("file_path")
                )
            )
            
            # Store structured data
            cv_structured_payload = {
                **llm_result,
                "document_id": application_id,
                "document_type": "cv"
            }
            success_steps.append(
                qdrant.store_structured_data(application_id, "cv", cv_structured_payload)
            )
            
            # Store embeddings
            success_steps.append(
                qdrant.store_embeddings_exact(application_id, "cv", embeddings_data)
            )
            
            # Link to job
            if application_data.get("job_data"):
                success_steps.append(
                    qdrant.link_application_to_job(
                        application_id, 
                        application_data["job_data"]["id"],
                        {
                            "applicant_name": application_data["applicant_name"],
                            "applicant_email": application_data["applicant_email"],
                            "applicant_phone": application_data.get("applicant_phone"),
                            "cover_letter": application_data.get("cover_letter"),
                            "public_token": application_data["job_data"].get("public_token"),
                            "job_title": application_data["job_data"].get("job_title", "Position"),
                            "company_name": application_data["job_data"].get("company_name", "Company")
                        },
                        cv_filename,
                        datetime.utcnow().isoformat()
                    )
                )
            
            if not all(success_steps):
                raise Exception("Failed to store application data")
            
            return {
                "application_id": application_id,
                "success": True,
                "message": f"Application processed successfully for {application_data['applicant_name']}"
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to process application {job_id}: {e}")
            raise

# Global job queue instance
job_queue = ApplicationJobQueue(max_workers=5)

async def get_job_queue():
    """Get the global job queue instance"""
    if not job_queue.workers_started:
        await job_queue.start_workers()
    return job_queue
