"""
Enhanced Careers Service for Viral Traffic
==========================================

Async processing service designed to handle massive job application loads
without blocking the main API thread.
"""

import asyncio
import logging
import time
import uuid
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

async def process_job_application_async(application_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a job application asynchronously
    This function handles the heavy lifting of CV processing without blocking
    """
    start_time = time.time()
    
    try:
        logger.info(f"🔄 Starting async processing for application {application_data.get('application_id', 'unknown')}")
        
        # Extract application details
        public_token = application_data["public_token"]
        applicant_name = application_data["applicant_name"]
        applicant_email = application_data["applicant_email"]
        applicant_phone = application_data.get("applicant_phone")
        cover_letter = application_data.get("cover_letter")
        cv_file_path = application_data["cv_file_path"]
        application_id = application_data["application_id"]
        
        # Import services (avoid circular imports)
        from app.services.parsing_service import get_parsing_service
        from app.services.llm_service import get_llm_service
        from app.services.embedding_service import get_embedding_service
        from app.utils.qdrant_utils import get_qdrant_utils
        
        # Initialize services
        parsing_service = get_parsing_service()
        llm_service = get_llm_service()
        embedding_service = get_embedding_service()
        qdrant = get_qdrant_utils()
        
        # Step 1: Get job posting details
        logger.info(f"📋 Fetching job details for token: {public_token}")
        job_posting = await asyncio.to_thread(qdrant.get_job_posting_by_token, public_token)
        
        if not job_posting:
            raise Exception(f"Job posting not found for token: {public_token}")
        
        # Step 2: Process CV file (handle S3 paths)
        logger.info(f"📄 Processing CV file: {cv_file_path}")
        
        # Check if file is in S3 or local
        temp_file_path = None
        try:
            if cv_file_path and cv_file_path.startswith('s3://'):
                # Download from S3 to temp file for processing
                logger.info(f"📥 Downloading CV from S3 for processing: {cv_file_path}")
                from app.services.s3_storage import get_s3_storage_service
                import tempfile
                import os
                
                # Extract file extension from filename or default to .pdf
                file_ext = os.path.splitext(application_data.get("cv_filename", ".pdf"))[1] or ".pdf"
                
                with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                    temp_file_path = tmp.name
                
                # Download from S3
                s3_service = get_s3_storage_service()
                s3_service.download_file(application_data["application_id"], "cv", file_ext, temp_file_path)
                
                # Parse the downloaded file
                parsed = await asyncio.to_thread(parsing_service.process_document, temp_file_path, "cv")
                cv_raw_text = parsed["clean_text"]
                extracted_pii = parsed["extracted_pii"]
                
                # Cleanup temp file
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                    
            else:
                # Local file (legacy or fallback)
                parsed = await asyncio.to_thread(parsing_service.process_document, cv_file_path, "cv")
                cv_raw_text = parsed["clean_text"]
                extracted_pii = parsed["extracted_pii"]
                
        except Exception as e:
            logger.error(f"❌ Failed to parse CV file {cv_file_path}: {e}")
            # Cleanup temp file if it exists
            if temp_file_path:
                try:
                    import os
                    os.unlink(temp_file_path)
                except:
                    pass
            raise Exception(f"Failed to process CV: {str(e)}")
        
        # Generate CV standardized data using LLM
        cv_standardized = await asyncio.to_thread(llm_service.standardize_cv, cv_raw_text, application_data.get("cv_filename", "application.pdf"))
        
        # Merge extracted PII into standardized data
        logger.info("---------- MERGING PII ----------")
        # Ensure contact_info exists in standardized data
        if "contact_info" not in cv_standardized:
            cv_standardized["contact_info"] = {}
        
        # Add extracted PII to contact_info
        if extracted_pii.get("email") and len(extracted_pii["email"]) > 0:
            cv_standardized["contact_info"]["email"] = extracted_pii["email"][0]
            logger.info(f"✅ Added email to contact_info: {cv_standardized['contact_info']['email']}")
        if extracted_pii.get("phone") and len(extracted_pii["phone"]) > 0:
            cv_standardized["contact_info"]["phone"] = extracted_pii["phone"][0]
            logger.info(f"✅ Added phone to contact_info: {cv_standardized['contact_info']['phone']}")
        
        # Also store PII at top level for backward compatibility
        if extracted_pii.get("email") and len(extracted_pii["email"]) > 0:
            cv_standardized["email"] = extracted_pii["email"][0]
        if extracted_pii.get("phone") and len(extracted_pii["phone"]) > 0:
            cv_standardized["phone"] = extracted_pii["phone"][0]
        
        # Generate CV embeddings
        cv_embeddings = await asyncio.to_thread(embedding_service.generate_document_embeddings, cv_standardized)
        
        # Step 3: Store CV in database
        logger.info(f"💾 Storing CV data in database")
        
        # Generate CV ID for the stored CV document
        cv_id = str(uuid.uuid4())
        logger.info(f"📝 Generated CV ID: {cv_id} for application: {application_id}")
        
        # Store raw CV document
        await asyncio.to_thread(
            qdrant.store_document,
            cv_id, "cv", cv_file_path,
            "application/octet-stream",
            cv_raw_text, 
            time.strftime("%Y-%m-%dT%H:%M:%S"),
            file_path=cv_file_path
        )
        
        # Store structured CV data
        cv_structured_payload = cv_standardized.copy()
        cv_structured_payload.update({
            "name": applicant_name,
            "email": applicant_email,
            "document_type": "cv",
            "expected_salary": application_data.get("expected_salary"),
            "years_of_experience": application_data.get("years_of_experience"),
            "experience_warning": application_data.get("experience_warning"),
            "is_job_application": True,
            "cv_filename": application_data.get("cv_filename")  # Preserve original filename for downloads
        })
        
        await asyncio.to_thread(
            qdrant.store_structured_data,
            cv_id, "cv", cv_structured_payload
        )
        
        # Store CV embeddings
        await asyncio.to_thread(
            qdrant.store_embeddings_exact,
            cv_id, "cv", cv_embeddings
        )
        
        # Step 4: Store application record (NO matching here).
        # Matching should run only when the user clicks "Match" in the UI.
        logger.info(f"📝 Storing application record")
        
        # Store application in CV collection with job reference
        application_metadata = {
            "application_id": application_id,
            "job_posting_id": job_posting["id"],  # UI display job posting
            "job_token": public_token,
            "applicant_name": applicant_name,
            "applicant_email": applicant_email,
            "applicant_phone": applicant_phone,
            "cover_letter": cover_letter,
            "expected_salary": application_data.get("expected_salary"),
            "years_of_experience": application_data.get("years_of_experience"),
            "experience_warning": application_data.get("experience_warning"),
            "application_status": "submitted",
            "submitted_at": time.time(),
            "document_type": "job_application"
        }
        
        # Link application to job posting
        await asyncio.to_thread(
            qdrant.link_application_to_job,
            cv_id, job_posting["id"], application_metadata, 
            cv_file_path, time.strftime("%Y-%m-%dT%H:%M:%S")
        )
        
        # Step 6 (removed): Confirmation emails are disabled/removed.
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Return success result
        result = {
            "success": True,
            "application_id": application_id,
            "cv_id": cv_id,
            "processing_time": processing_time,
            "message": f"Thank you, {applicant_name}! Your application has been processed successfully.",
            "next_steps": "We'll review your application and contact you if there's a match."
        }
        
        logger.info(f"✅ Application {application_id} processed successfully in {processing_time:.2f}s")
        return result
        
    except Exception as e:
        processing_time = time.time() - start_time
        error_msg = str(e)
        
        logger.error(f"❌ Application processing failed after {processing_time:.2f}s: {error_msg}")
        
        # Return error result
        return {
            "success": False,
            "application_id": application_data.get("application_id", "unknown"),
            "error": error_msg,
            "processing_time": processing_time,
            "message": "We're sorry, but there was an issue processing your application. Please try again later.",
            "next_steps": "If the problem persists, please contact our support team."
        }

async def get_application_processing_stats() -> Dict[str, Any]:
    """Get statistics about application processing"""
    try:
        from app.services.enhanced_job_queue import get_enterprise_job_queue
        
        job_queue = await get_enterprise_job_queue()
        stats = job_queue.get_system_metrics()
        
        return {
            "queue_stats": stats,
            "system_health": {
                "queue_healthy": stats["performance_metrics"]["memory_utilization"] < 80,
                "workers_healthy": stats["worker_metrics"]["worker_utilization"] > 20,
                "processing_healthy": stats["queue_metrics"]["success_rate"] > 80,
                "circuit_breaker_healthy": not stats["circuit_breaker"]["is_open"]
            },
            "recommendations": _get_system_recommendations(stats)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get processing stats: {str(e)}")
        return {
            "error": str(e),
            "system_health": {
                "queue_healthy": False,
                "workers_healthy": False,
                "processing_healthy": False,
                "circuit_breaker_healthy": False
            }
        }

def _get_system_recommendations(stats: Dict[str, Any]) -> List[str]:
    """Generate system recommendations based on current stats"""
    recommendations = []
    
    # Memory recommendations
    memory_util = stats["performance_metrics"]["memory_utilization"]
    if memory_util > 85:
        recommendations.append("🔴 CRITICAL: Memory usage very high - consider scaling infrastructure")
    elif memory_util > 70:
        recommendations.append("🟡 WARNING: Memory usage high - monitor closely")
    
    # Queue recommendations
    queue_size = stats["queue_metrics"]["current_queue_size"]
    if queue_size > 1000:
        recommendations.append("🔴 CRITICAL: Very large queue - consider adding more workers")
    elif queue_size > 500:
        recommendations.append("🟡 WARNING: Large queue detected")
    
    # Success rate recommendations
    success_rate = stats["queue_metrics"]["success_rate"]
    if success_rate < 80:
        recommendations.append("🔴 CRITICAL: Low success rate - investigate errors")
    elif success_rate < 90:
        recommendations.append("🟡 WARNING: Success rate could be improved")
    
    # Worker recommendations
    worker_util = stats["worker_metrics"]["worker_utilization"]
    if worker_util > 95:
        recommendations.append("🟡 High worker utilization - consider auto-scaling")
    elif worker_util < 30:
        recommendations.append("ℹ️ Low worker utilization - system running efficiently")
    
    if not recommendations:
        recommendations.append("✅ System running optimally")
    
    return recommendations
