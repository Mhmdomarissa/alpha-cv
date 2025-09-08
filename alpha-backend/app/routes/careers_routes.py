"""
Careers Routes - Public Job Postings & Applications
Handles:
  - HR job posting creation (authenticated)
  - Public job viewing (no auth required)
  - Public job applications (no auth required)
  - Admin management of job postings and applications
"""

import logging
import secrets
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.requests import Request

from app.schemas.careers import (
    JobPostingCreate,
    JobPostingResponse, 
    PublicJobView, 
    JobApplicationRequest,
    JobApplicationResponse,
    JobApplicationSummary,
    JobPostingSummary,
    JobStatusUpdate,
    ApplicationStatusUpdate,
    JobMatchingRequest,
    JobMatchingResponse,
    CareersHealthResponse
)
from app.services.parsing_service import get_parsing_service
from app.services.llm_service import get_llm_service  
from app.services.embedding_service import get_embedding_service
from app.utils.qdrant_utils import get_qdrant_utils

logger = logging.getLogger(__name__)
router = APIRouter()

# Constants
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt']

def generate_public_token() -> str:
    """Generate secure random token for public job links"""
    return secrets.token_urlsafe(32)

def validate_file_upload(file: UploadFile) -> None:
    """Validate uploaded file meets requirements"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    # Check file extension
    file_ext = '.' + file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if file_ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type {file_ext} not supported. Supported types: {SUPPORTED_EXTENSIONS}"
        )
    
    # Note: File size validation happens during read if needed
    logger.info(f"✅ File validation passed: {file.filename}")

def _now_iso() -> str:
    """Get current timestamp in ISO format"""
    return datetime.utcnow().isoformat()

# ==================== PUBLIC ENDPOINTS (No Authentication) ====================

@router.get("/jobs/{public_token}", response_model=PublicJobView)
async def get_public_job(public_token: str) -> PublicJobView:
    """
    Public endpoint: View job posting (no authentication required)
    
    This endpoint must be accessible to anyone with the link.
    Returns structured job information for display to candidates.
    """
    try:
        logger.info(f"📄 Public job request for token: {public_token[:8]}...")
        
        qdrant = get_qdrant_utils()
        job_data = qdrant.get_job_posting_by_token(public_token)
        
        if not job_data:
            logger.warning(f"❌ Job posting not found for token: {public_token[:8]}...")
            raise HTTPException(status_code=404, detail="Job posting not found or no longer active")
        
        # Get structured data if available
        client = qdrant.client
        structured_data = None
        try:
            res = client.retrieve("job_postings_structured", ids=[job_data["id"]], with_payload=True, with_vectors=False)
            if res:
                structured_data = res[0].payload
        except Exception as e:
            logger.warning(f"Could not retrieve structured data for job {job_data['id']}: {e}")
            structured_data = None
        
        # Extract requirements and responsibilities from structured data
        requirements = []
        responsibilities = []
        job_title = "Position Available"
        experience_required = "Not specified"
        
        if structured_data:
            structured_info = structured_data.get("structured_info", {})
            requirements = structured_info.get("skills", []) or structured_info.get("requirements", [])
            responsibilities = structured_info.get("responsibilities", []) or structured_info.get("duties", [])
            job_title = structured_info.get("job_title", job_title)
            experience_required = structured_info.get("years_of_experience", experience_required)
            if isinstance(experience_required, (int, float)):
                experience_required = f"{experience_required} years"
        
        public_job = PublicJobView(
            job_id=job_data["id"],
            job_title=job_title,
            company_name=job_data.get("company_name", "Our Company"),
            job_description=job_data["raw_content"],
            upload_date=job_data["upload_date"],
            requirements=requirements[:10],  # Limit to top 10 for display
            responsibilities=responsibilities[:10],  # Limit to top 10 for display
            experience_required=str(experience_required),
            is_active=job_data.get("is_active", True)
        )
        
        logger.info(f"✅ Returning public job: {job_title}")
        return public_job
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get public job: {e}")
        raise HTTPException(status_code=500, detail="Failed to load job posting")

@router.post("/jobs/{public_token}/apply", response_model=JobApplicationResponse)
async def apply_to_job(
    public_token: str,
    applicant_name: str = Form(..., min_length=2, max_length=100),
    applicant_email: str = Form(...),
    applicant_phone: Optional[str] = Form(None),
    cover_letter: Optional[str] = Form(None),
    cv_file: UploadFile = File(...)
) -> JobApplicationResponse:
    """
    Public endpoint: Submit application (no authentication required)
    
    Pipeline:
    1. Validate job exists and is active
    2. Validate application data and CV file
    3. Process CV through existing pipeline (parsing → LLM → embeddings)
    4. Link application to specific job
    5. Store in applications_* collections
    6. Return confirmation
    """
    try:
        logger.info(f"📋 Application received for job token: {public_token[:8]}... from {applicant_name}")
        
        # 1. Verify job exists and is active
        qdrant = get_qdrant_utils()
        job_data = qdrant.get_job_posting_by_token(public_token)
        if not job_data:
            raise HTTPException(status_code=404, detail="Job posting not found or no longer active")
            
        if not job_data.get("is_active", True):
            raise HTTPException(status_code=400, detail="This job posting is no longer accepting applications")
        
        # 2. Validate CV file
        validate_file_upload(cv_file)
        
        # Basic email validation
        if "@" not in applicant_email or "." not in applicant_email:
            raise HTTPException(status_code=400, detail="Please provide a valid email address")
        
        application_id = str(uuid.uuid4())
        
        # 3. Process CV through existing pipeline
        logger.info(f"🔄 Processing CV for application {application_id}")
        
        # Read file content
        file_content = await cv_file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB")
        
        # Extract text using parsing service
        import tempfile
        import os
        
        # Get file extension for temp file
        file_ext = '.' + cv_file.filename.split('.')[-1].lower() if '.' in cv_file.filename else '.txt'
        
        # Save to temporary file for parsing
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        
        try:
            parsing_service = get_parsing_service()
            parsed = parsing_service.process_document(tmp_path, "cv")
            extracted_text = parsed["clean_text"]
            raw_content = parsed["raw_text"]
        finally:
            # Clean up temporary file
            os.unlink(tmp_path)
        
        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Could not extract sufficient text from CV. Please check the file format.")
        
        # Process with LLM service
        llm_service = get_llm_service()
        llm_result = llm_service.standardize_cv(extracted_text, cv_file.filename)
        
        # Generate embeddings
        embedding_service = get_embedding_service()
        embeddings_data = embedding_service.generate_document_embeddings(llm_result)
        
        # 4. Store application data
        application_data = {
            "applicant_name": applicant_name,
            "applicant_email": applicant_email,
            "applicant_phone": applicant_phone,
            "cover_letter": cover_letter,
            "public_token": public_token,
            "job_title": job_data.get("job_title", "Position"),
            "company_name": job_data.get("company_name", "Our Company")
        }
        
        # Store in applications collections following the 3-collection pattern
        success_steps = []
        
        # Step 1: Store raw CV document
        success_steps.append(
            qdrant.store_document(
                application_id, "applications", cv_file.filename, 
                cv_file.content_type or "application/octet-stream",
                extracted_text,  # Store extracted text as raw content
                _now_iso()
            )
        )
        
        # Step 2: Store structured data
        structured_payload = {
            **llm_result,  # Include all LLM processed data
            **application_data,  # Include application metadata
            "application_id": application_id,
            "document_type": "application"
        }
        success_steps.append(
            qdrant.store_structured_data(application_id, "applications", structured_payload)
        )
        
        # Step 3: Store embeddings (exactly 32 vectors)
        success_steps.append(
            qdrant.store_embeddings_exact(application_id, "applications", embeddings_data)
        )
        
        # Step 4: Link application to job
        success_steps.append(
            qdrant.link_application_to_job(
                application_id, job_data["id"], application_data, 
                cv_file.filename, _now_iso()
            )
        )
        
        # Verify all steps succeeded
        if not all(success_steps):
            logger.error(f"❌ Failed to store application {application_id} - some steps failed: {success_steps}")
            raise HTTPException(status_code=500, detail="Failed to process application. Please try again.")
            
        logger.info(f"✅ Application {application_id} successfully processed and stored")
        
        return JobApplicationResponse(
            success=True,
            application_id=application_id,
            message=f"Thank you, {applicant_name}! Your application has been submitted successfully.",
            next_steps="We will review your CV and contact you if there's a match for this position."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to process application: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit application. Please try again later.")

# ==================== HR/ADMIN ENDPOINTS (May require authentication later) ====================

@router.post("/admin/jobs/post", response_model=JobPostingResponse)
async def post_job(
    file: UploadFile = File(...),
    company_name: Optional[str] = Form(None),
    additional_info: Optional[str] = Form(None)
    # Add authentication here when ready: current_user = Depends(require_hr_user)
) -> JobPostingResponse:
    """
    HR endpoint: Upload job description → create public link
    
    Pipeline:
    1. Validate file upload
    2. Extract text using parsing service
    3. Process with LLM service (extract title, requirements, etc.)
    4. Generate public access token
    5. Store in job_postings_* collections
    6. Return public link
    """
    try:
        logger.info(f"💼 HR job posting upload: {file.filename}")
        
        # 1. Validate file
        validate_file_upload(file)
        
        job_id = str(uuid.uuid4())
        public_token = generate_public_token()
        
        # 2. Extract text from file
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB")
        
        import tempfile
        import shutil
        import os
        
        # Get file extension for temp file
        file_ext = '.' + file.filename.split('.')[-1].lower() if '.' in file.filename else '.txt'
        
        # Save to temporary file for parsing
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        
        try:
            parsing_service = get_parsing_service()
            parsed = parsing_service.process_document(tmp_path, "jd")
            extracted_text = parsed["clean_text"]
            raw_content = parsed["raw_text"]
        finally:
            # Clean up temporary file
            os.unlink(tmp_path)
        
        if not extracted_text or len(extracted_text.strip()) < 100:
            raise HTTPException(status_code=400, detail="Could not extract sufficient text from job description. Please check the file format.")
        
        # 3. Process with LLM service to extract structured data
        llm_service = get_llm_service()
        llm_result = llm_service.standardize_jd(extracted_text, file.filename)
        
        # Extract job title for response
        job_title = "Position Available"
        if llm_result and "structured_info" in llm_result:
            job_title = llm_result["structured_info"].get("job_title", job_title)
        
        # 4. Generate embeddings
        embedding_service = get_embedding_service()
        embeddings_data = embedding_service.generate_document_embeddings(llm_result)
        
        # 5. Store in job_postings collections
        qdrant = get_qdrant_utils()
        success_steps = []
        
        # Store raw document with public token
        success_steps.append(
            qdrant.store_job_posting(
                job_id, file.filename, extracted_text,
                file.content_type or "application/octet-stream",
                public_token, company_name
            )
        )
        
        # Store structured data
        structured_payload = {
            **llm_result,
            "job_id": job_id,
            "company_name": company_name,
            "additional_info": additional_info,
            "document_type": "job_posting"
        }
        success_steps.append(
            qdrant.store_structured_data(job_id, "job_postings", structured_payload)
        )
        
        # Store embeddings
        success_steps.append(
            qdrant.store_embeddings_exact(job_id, "job_postings", embeddings_data)
        )
        
        if not all(success_steps):
            logger.error(f"❌ Failed to store job posting {job_id} - some steps failed: {success_steps}")
            raise HTTPException(status_code=500, detail="Failed to create job posting. Please try again.")
        
        # 6. Build public link
        # In production, use proper domain from config
        base_url = "http://localhost:8000"  # TODO: Get from config/environment
        public_link = f"{base_url}/api/careers/jobs/{public_token}"
        
        logger.info(f"✅ Job posting created: {job_id} with public link")
        
        return JobPostingResponse(
            job_id=job_id,
            public_link=public_link,
            job_title=job_title,
            upload_date=_now_iso(),
            filename=file.filename,
            is_active=True,
            company_name=company_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to post job: {e}")
        raise HTTPException(status_code=500, detail="Failed to create job posting. Please try again later.")

@router.get("/admin/jobs", response_model=List[JobPostingSummary])
async def list_job_postings(
    include_inactive: bool = False
    # Add authentication: current_user = Depends(require_hr_user)
) -> List[JobPostingSummary]:
    """List all job postings for HR dashboard"""
    try:
        logger.info(f"📋 Listing job postings (include_inactive: {include_inactive})")
        
        qdrant = get_qdrant_utils()
        job_postings = qdrant.get_all_job_postings(include_inactive)
        
        summaries = []
        for job in job_postings:
            # Get application count for this job
            applications = qdrant.get_applications_for_job(job["id"])
            
            # Get structured data for job title
            client = qdrant.client
            structured_data = None
            try:
                res = client.retrieve("job_postings_structured", ids=[job["id"]], with_payload=True, with_vectors=False)
                if res:
                    structured_data = res[0].payload
            except Exception:
                structured_data = None
            job_title = "Position Available"
            if structured_data:
                job_title = structured_data.get("structured_info", {}).get("job_title", job_title)
            
            summary = JobPostingSummary(
                job_id=job["id"],
                job_title=job_title,
                company_name=job.get("company_name"),
                upload_date=job["upload_date"],
                filename=job["filename"],
                is_active=job.get("is_active", True),
                application_count=len(applications),
                public_token=job["public_token"]
            )
            summaries.append(summary)
        
        logger.info(f"✅ Found {len(summaries)} job postings")
        return summaries
        
    except Exception as e:
        logger.error(f"❌ Failed to list job postings: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job postings")

@router.patch("/admin/jobs/{job_id}/status", response_model=dict)
async def toggle_job_status(
    job_id: str, 
    status_update: JobStatusUpdate
    # Add authentication: current_user = Depends(require_hr_user)
) -> dict:
    """Activate/deactivate job postings"""
    try:
        logger.info(f"🔄 Updating job {job_id} status to: {status_update.is_active}")
        
        qdrant = get_qdrant_utils()
        success = qdrant.update_job_posting_status(job_id, status_update.is_active)
        
        if not success:
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        return {
            "success": True,
            "job_id": job_id,
            "is_active": status_update.is_active,
            "message": f"Job posting {'activated' if status_update.is_active else 'deactivated'} successfully",
            "reason": status_update.reason
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to update job status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update job status")

@router.get("/admin/jobs/{job_id}/applications", response_model=List[JobApplicationSummary])
async def get_job_applications(
    job_id: str
    # Add authentication: current_user = Depends(require_hr_user)
) -> List[JobApplicationSummary]:
    """Get all applications for a specific job"""
    try:
        logger.info(f"📋 Getting applications for job: {job_id}")
        
        qdrant = get_qdrant_utils()
        
        # Verify job exists
        job_data = qdrant.get_job_posting_by_id(job_id)
        if not job_data:
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        # Get applications
        applications = qdrant.get_applications_for_job(job_id)
        
        summaries = []
        for app in applications:
            summary = JobApplicationSummary(
                application_id=app["id"],
                job_id=job_id,
                applicant_name=app.get("applicant_name", "Unknown"),
                applicant_email=app.get("applicant_email", "unknown@email.com"),
                application_date=app.get("application_date", "Unknown"),
                cv_filename=app.get("cv_filename", "unknown.pdf"),
                match_score=None,  # TODO: Calculate match score if needed
                status=app.get("status", "pending")
            )
            summaries.append(summary)
        
        logger.info(f"✅ Found {len(summaries)} applications for job {job_id}")
        return summaries
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get job applications: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve applications")

@router.get("/admin/health", response_model=CareersHealthResponse)
async def careers_health_check() -> CareersHealthResponse:
    """Health check endpoint for careers functionality"""
    try:
        qdrant = get_qdrant_utils()
        stats = qdrant.get_careers_stats()
        
        status = "healthy"
        if stats.get("error") or any(
            col_status.get("status") == "unhealthy" 
            for col_status in stats.get("collections_status", {}).values()
        ):
            status = "degraded"
        
        return CareersHealthResponse(
            status=status,
            job_postings_count=stats.get("job_postings_count", 0),
            applications_count=stats.get("applications_count", 0),
            active_jobs_count=stats.get("active_jobs_count", 0),
            collections_status=stats.get("collections_status", {})
        )
        
    except Exception as e:
        logger.error(f"❌ Careers health check failed: {e}")
        return CareersHealthResponse(
            status="unhealthy",
            job_postings_count=0,
            applications_count=0,
            active_jobs_count=0,
            collections_status={"error": str(e)}
        )

# ==================== UTILITY ENDPOINTS ====================

@router.get("/jobs/{public_token}/info")
async def get_job_info(public_token: str) -> dict:
    """Get basic job info without full details (for previews, etc.)"""
    try:
        qdrant = get_qdrant_utils()
        job_data = qdrant.get_job_posting_by_token(public_token)
        
        if not job_data:
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        return {
            "job_id": job_data["id"],
            "is_active": job_data.get("is_active", True),
            "company_name": job_data.get("company_name", "Our Company"),
            "upload_date": job_data["upload_date"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get job info: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job information")
