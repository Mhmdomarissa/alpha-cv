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
import os
from app.schemas.careers import (
    JobPostingCreate,
    JobPostingResponse, 
    PublicJobView, 
    JobApplicationRequest,
    JobApplicationResponse,
    JobApplicationSummary,
    JobPostingSummary,
    JobPostingUpdate,
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
        # Update this to include inactive jobs
        job_data = qdrant.get_job_posting_by_token(public_token, include_inactive=True)
        
        if not job_data:
            logger.warning(f"❌ Job posting not found for token: {public_token[:8]}...")
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        # Debug logging
        logger.info(f"🔍 Job data received: {job_data}")
        logger.info(f"🔍 Job data keys: {list(job_data.keys()) if job_data else 'None'}")
        if job_data and 'job_title' in job_data:
            logger.info(f"🔍 Job title from merged data: {job_data['job_title']}")
        
        # The job_data from get_job_posting_by_token already contains merged data
        # Use the merged data directly since it already contains the structured information
        
        # Extract data from the merged job_data
        # Check both direct job_title and structured_info.job_title
        job_title = job_data.get("job_title") or job_data.get("structured_info", {}).get("job_title", "Position Available")
        job_location = job_data.get("location", "") or job_data.get("job_location", "")
        job_summary = job_data.get("job_summary", "") or job_data.get("summary", "") or "Job description not available"
        experience_required = job_data.get("years_of_experience", "Not specified")
        
        # Convert experience to string if it's a number
        if isinstance(experience_required, (int, float)):
            experience_required = f"{experience_required} years"
        
        # Get requirements and responsibilities from the merged data
        requirements = job_data.get("skills_sentences", []) or job_data.get("skills", [])
        responsibilities = job_data.get("responsibility_sentences", []) or job_data.get("responsibilities", [])
        
        public_job = PublicJobView(
            job_id=job_data["id"],
            job_title=job_title,
            job_location=job_location,
            company_name=job_data.get("company_name", "Our Company"),
            job_description=job_summary,  # Use updated summary or fall back to original
            upload_date=job_data.get("created_date", job_data.get("upload_date", _now_iso())),
            requirements=requirements[:10],  # Limit to top 10 for display
            responsibilities=responsibilities[:10],  # Limit to top 10 for display
            experience_required=str(experience_required),
            is_active=job_data.get("is_active", True)  # This will now show the actual status
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
    6. Also store in cv_* collections for main database view
    7. Return confirmation
    """
    try:
        logger.info(f"📋 Application received for job token: {public_token[:8]}... from {applicant_name}")
        
        # 1. Verify job exists and is active
        qdrant = get_qdrant_utils()
        job_data = qdrant.get_job_posting_by_token(public_token, include_inactive=True)
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
        cv_id = str(uuid.uuid4())  # Create a separate ID for the CV collection
        
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
            # Get PII extracted from CV
            extracted_pii = parsed.get("extracted_pii", {"email": [], "phone": []})
        finally:
            # Clean up temporary file
            os.unlink(tmp_path)
        
        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Could not extract sufficient text from CV. Please check the file format.")
        
        # Process with LLM service
        llm_service = get_llm_service()
        llm_result = llm_service.standardize_cv(extracted_text, cv_file.filename)
        
        # Update contact_info with application form data (prioritize form data over extracted PII)
        if "contact_info" not in llm_result:
            llm_result["contact_info"] = {}
        
        # Always use the application form data for contact information
        llm_result["contact_info"]["name"] = applicant_name
        llm_result["contact_info"]["email"] = applicant_email
        if applicant_phone:
            llm_result["contact_info"]["phone"] = applicant_phone
        
        # Also update the name field if it exists
        if "name" in llm_result:
            llm_result["name"] = applicant_name
            
        logger.info(f"✅ Updated contact info with application data: {applicant_name}, {applicant_email}")
        
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
        
        # 5. Store in existing CV collections (reuse existing infrastructure)
        success_steps = []
        
        # Store raw document in CV collection
        success_steps.append(
            qdrant.store_document(
                application_id, "cv", cv_file.filename,
                cv_file.content_type or "application/octet-stream",
                extracted_text, _now_iso()
            )
        )
        
        # Store structured data in CV collection (with updated contact info)
        cv_structured_payload = {
            **llm_result,  # Include all LLM processed data (with updated contact info)
            "document_id": application_id,
            "document_type": "cv"
        }
        
        # Ensure contact_info exists and includes application form data
        if "contact_info" not in cv_structured_payload:
            cv_structured_payload["contact_info"] = {}
        
        # Prioritize application form data over extracted PII
        cv_structured_payload["contact_info"]["name"] = applicant_name
        cv_structured_payload["contact_info"]["email"] = applicant_email
        if applicant_phone:
            cv_structured_payload["contact_info"]["phone"] = applicant_phone
        
        # Also update the name field if it exists
        if "name" in cv_structured_payload:
            cv_structured_payload["name"] = applicant_name
            
        success_steps.append(
            qdrant.store_structured_data(application_id, "cv", cv_structured_payload)
        )
        
        # Store embeddings in CV collection
        success_steps.append(
            qdrant.store_embeddings_exact(application_id, "cv", embeddings_data)
        )
        
        # Link application to job
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
    company_name: Optional[str] = Form(None),
    additional_info: Optional[str] = Form(None),
    # Form data fields for manual job posting
    job_title: Optional[str] = Form(None),
    job_location: Optional[str] = Form(None),
    job_summary: Optional[str] = Form(None),
    key_responsibilities: Optional[str] = Form(None),
    qualifications: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
    # Add authentication here when ready: current_user = Depends(require_hr_user)
) -> JobPostingResponse:
    """
    HR endpoint: Upload job description → create public link
    
    Pipeline:
    1. Validate file upload (if provided) or form data
    2. Extract text using parsing service (if file) or use form data
    3. Process with LLM service (extract title, requirements, etc.) or use form data
    4. Generate public access token
    5. Store in job_postings_* collections
    6. Also store in jd_* collections for main database view
    7. Return public link
    """
    try:
        # Check if we have file or form data
        has_file = file is not None and file.filename
        has_form_data = any([job_title, job_location, job_summary, key_responsibilities, qualifications])
        
        if not has_file and not has_form_data:
            raise HTTPException(status_code=400, detail="Either file upload or form data must be provided")
        
        if has_file:
            logger.info(f"💼 HR job posting upload: {file.filename}")
            # 1. Validate file
            validate_file_upload(file)
        
        job_id = str(uuid.uuid4())
        jd_id = str(uuid.uuid4())  # Create a separate ID for the JD collection
        public_token = generate_public_token()
        
        # 2. Process data (file or form)
        if has_file:
            # Extract text from file
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
            final_job_title = "Position Available"
            if llm_result:
                # Check both direct job_title and structured_info.job_title
                final_job_title = llm_result.get("job_title") or llm_result.get("structured_info", {}).get("job_title", final_job_title)
        else:
            # Use form data directly
            logger.info(f"💼 HR job posting from form data: {job_title}")
            
            # Create structured data from form inputs
            llm_result = {
                "doc_type": "job_description",
                "job_title": job_title or "Position Available",
                "years_of_experience": None,
                "job_category": None,
                "seniority_level": None,
                "role_family": None,
                "skills_sentences": [qual for qual in (qualifications or "").split('\n') if qual.strip()][:20],
                "responsibility_sentences": [resp for resp in (key_responsibilities or "").split('\n') if resp.strip()][:10],
                "structured_info": {
                    "job_title": job_title or "Position Available",
                    "location": job_location or "",
                    "job_location": job_location or "",
                    "job_summary": job_summary or "",
                    "summary": job_summary or "",
                    "responsibilities": [resp for resp in (key_responsibilities or "").split('\n') if resp.strip()],
                    "skills": [qual for qual in (qualifications or "").split('\n') if qual.strip()]
                }
            }
            
            # Use form data for text content
            extracted_text = f"{job_title or 'Position Available'}\n\n{job_summary or ''}\n\nResponsibilities:\n{key_responsibilities or ''}\n\nQualifications:\n{qualifications or ''}"
            raw_content = extracted_text
            final_job_title = job_title or "Position Available"
        
        # 4. Generate embeddings
        embedding_service = get_embedding_service()
        embeddings_data = embedding_service.generate_document_embeddings(llm_result)
        
        # 5. Store in existing JD collections (reuse existing infrastructure)
        qdrant = get_qdrant_utils()
        success_steps = []
        
        # Store raw document in JD collection
        filename = file.filename if has_file else f"job_posting_{job_id}.txt"
        content_type = file.content_type if has_file else "text/plain"
        
        success_steps.append(
            qdrant.store_document(
                job_id, "jd", filename,
                content_type,
                extracted_text, _now_iso()
            )
        )
        
        # Store structured data in JD collection
        jd_structured_payload = {
            **llm_result,
            "document_id": job_id,
            "document_type": "jd"
        }
        success_steps.append(
            qdrant.store_structured_data(job_id, "jd", jd_structured_payload)
        )
        
        # Store embeddings in JD collection
        success_steps.append(
            qdrant.store_embeddings_exact(job_id, "jd", embeddings_data)
        )
        
        # 6. Store job posting metadata for careers functionality
        success_steps.append(
            qdrant.store_job_posting_metadata(
                job_id, public_token, company_name, additional_info
            )
        )
        
        if not all(success_steps):
            logger.error(f"❌ Failed to store job posting {job_id} - some steps failed: {success_steps}")
            raise HTTPException(status_code=500, detail="Failed to create job posting. Please try again.")
        
        # 7. Build public link
        # In production, use proper domain from config
        base_url = os.getenv("FRONTEND_URL", "http://alphacv.alphadatarecruitment.ae")
        public_link = f"{base_url}/careers/jobs/{public_token}"
        
        logger.info(f"✅ Job posting created: {job_id} with public link")
        
        return JobPostingResponse(
            job_id=job_id,
            public_link=public_link,
            public_token=public_token,
            job_title=final_job_title,
            upload_date=_now_iso(),
            filename=filename,
            is_active=True,
            company_name=company_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to post job: {e}")
        raise HTTPException(status_code=500, detail="Failed to create job posting. Please try again later.")
@router.post("/admin/jobs/post-manual", response_model=JobPostingResponse)
async def post_job_manual(
    job_title: str = Form(..., min_length=1, max_length=200),
    job_location: Optional[str] = Form(None),
    job_summary: Optional[str] = Form(None),
    key_responsibilities: Optional[str] = Form(None),
    qualifications: Optional[str] = Form(None),
    company_name: Optional[str] = Form(None),
    additional_info: Optional[str] = Form(None)
    # Add authentication here when ready: current_user = Depends(require_hr_user)
) -> JobPostingResponse:
    """
    HR endpoint: Create job posting manually with form data
    
    Pipeline:
    1. Validate form data
    2. Create structured text content from form inputs
    3. Process with LLM service (extract title, requirements, etc.)
    4. Generate public access token
    5. Store in job_postings_* collections only (not jd_documents)
    6. Return public link
    """
    try:
        logger.info(f"💼 Manual job posting creation: {job_title}")
        
        # 1. Validate required fields
        if not job_title.strip():
            raise HTTPException(status_code=400, detail="Job title is required")
        
        job_id = str(uuid.uuid4())
        public_token = generate_public_token()
        
        # 2. Create structured text content from form inputs
        # This simulates what would be extracted from a document
        structured_text = f"""
Job Title: {job_title}

Location: {job_location or 'Not specified'}

Job Summary:
{job_summary or 'No summary provided'}

Key Responsibilities:
{key_responsibilities or 'No responsibilities specified'}

Qualifications & Requirements:
{qualifications or 'No qualifications specified'}

Additional Information:
{additional_info or 'No additional information'}
        """.strip()
        
        # 3. Process with LLM service to extract structured data
        llm_service = get_llm_service()
        llm_result = llm_service.standardize_jd(structured_text, f"manual_job_{job_id}.txt")
        
        # Extract job title for response
        final_job_title = job_title
        if llm_result and llm_result.get("job_title"):
            # Use LLM extracted title if available, otherwise use form title
            final_job_title = llm_result.get("job_title")
        
        # 4. Generate embeddings
        embedding_service = get_embedding_service()
        embeddings_data = embedding_service.generate_document_embeddings(llm_result)
        
        # 5. Store in job_postings collections only (not jd_documents)
        qdrant = get_qdrant_utils()
        success_steps = []
        
        # Store raw document in jd_documents collection (reuse existing infrastructure)
        success_steps.append(
            qdrant.store_document(
                job_id, "jd", f"manual_job_{job_id}.txt",
                "text/plain",
                structured_text, _now_iso()
            )
        )
        
        # Store structured data in jd_structured collection (reuse existing infrastructure)
        jd_structured_payload = {
            **llm_result,
            "document_id": job_id,
            "document_type": "jd"
        }
        success_steps.append(
            qdrant.store_structured_data(job_id, "jd", jd_structured_payload)
        )
        
        # Store embeddings in jd_embeddings collection (reuse existing infrastructure)
        success_steps.append(
            qdrant.store_embeddings_exact(job_id, "jd", embeddings_data)
        )
        
        # 6. Store job posting metadata for careers functionality
        success_steps.append(
            qdrant.store_job_posting_metadata(
                job_id, public_token, company_name, additional_info
            )
        )
        
        if not all(success_steps):
            logger.error(f"❌ Failed to store manual job posting {job_id} - some steps failed: {success_steps}")
            raise HTTPException(status_code=500, detail="Failed to create job posting. Please try again.")
        
        # 7. Build public link
        base_url = os.getenv("FRONTEND_URL", "http://alphacv.alphadatarecruitment.ae")
        public_link = f"{base_url}/careers/jobs/{public_token}"
        
        logger.info(f"✅ Manual job posting created: {job_id} with public link")
        
        return JobPostingResponse(
            job_id=job_id,
            public_link=public_link,
            public_token=public_token,
            job_title=final_job_title,
            upload_date=_now_iso(),
            filename=f"manual_job_{job_id}.txt",
            is_active=True,
            company_name=company_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to create manual job posting: {e}")
        raise HTTPException(status_code=500, detail="Failed to create job posting. Please try again later.")

@router.post("/admin/jobs/{job_id}/fix-token")
async def fix_job_token(job_id: str):
    """
    Manually fix the public_token for a specific job
    """
    try:
        qdrant = get_qdrant_utils()
        
        # Generate new token
        new_token = generate_public_token()
        
        # Update the job
        success = qdrant.update_job_posting_public_token(job_id, new_token)
        
        if success:
            logger.info(f"✅ Manually fixed public_token for job {job_id}: {new_token[:8]}...")
            return {
                "success": True,
                "job_id": job_id,
                "public_token": new_token,
                "public_link": f"http://localhost:3001/careers/jobs/{new_token}"
            }
        else:
            logger.error(f"❌ Failed to fix public_token for job {job_id}")
            raise HTTPException(status_code=500, detail="Failed to fix job token")
            
    except Exception as e:
        logger.error(f"❌ Error fixing job token {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fix job token")

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
        
        # Sort by upload_date (newest first) before processing
        job_postings.sort(key=lambda x: x.get("upload_date", x.get("created_date", x.get("stored_at", ""))), reverse=True)
        
        summaries = []
        for job in job_postings:
            # Debug logging for public_token
            logger.info(f"🔍 Job {job.get('id', 'N/A')} - Public Token: {job.get('public_token', 'MISSING')}")
            
            # Fix missing public_token for existing jobs
            if not job.get("public_token") or job.get("public_token") == "unknown":
                logger.warning(f"⚠️ Job {job.get('id')} missing public_token, generating new one")
                new_token = generate_public_token()
                # Update the job metadata with the new token
                success = qdrant.update_job_posting_public_token(job["id"], new_token)
                if success:
                    job["public_token"] = new_token
                    logger.info(f"✅ Generated new public_token for job {job.get('id')}: {new_token[:8]}...")
                else:
                    logger.error(f"❌ Failed to update public_token for job {job.get('id')}")
                    # Still set the token in memory for this request
                    job["public_token"] = new_token
            
            # Get application count for this job
            applications = qdrant.get_applications_for_job(job["id"])
            
            # Extract job details from merged job data (already contains both metadata and structured data)
            job_title = "Position Available"
            job_location = ""
            job_summary = ""
            key_responsibilities = ""
            qualifications = ""
            
            # The job data is already merged from get_all_job_postings, so we can extract directly
            structured_info = job.get("structured_info", {})
            
            # Check both direct job_title and structured_info.job_title
            job_title = job.get("job_title") or structured_info.get("job_title", job_title)
            job_location = structured_info.get("location", "") or structured_info.get("job_location", "")
            job_summary = structured_info.get("job_summary", "") or structured_info.get("summary", "")
            
            # Convert responsibilities list to text
            responsibilities_list = structured_info.get("responsibilities", [])
            if responsibilities_list and isinstance(responsibilities_list, list):
                key_responsibilities = "\n".join(responsibilities_list)
            
            # Convert skills/requirements list to text
            skills_list = structured_info.get("skills", []) or structured_info.get("requirements", [])
            if skills_list and isinstance(skills_list, list):
                qualifications = "\n".join(skills_list)
            
            summary = JobPostingSummary(
                job_id=job["id"],
                job_title=job_title,
                job_location=job_location,
                job_summary=job_summary,
                key_responsibilities=key_responsibilities,
                qualifications=qualifications,
                company_name=job.get("company_name"),
                upload_date=job.get("created_date", job.get("upload_date", _now_iso())),
                filename=job.get("filename", "job_description.pdf"),
                is_active=job.get("is_active", True),
                application_count=len(applications),
                public_token=job.get("public_token") or "unknown"
            )
            summaries.append(summary)
        
        logger.info(f"✅ Found {len(summaries)} job postings")
        return summaries
        
    except Exception as e:
        logger.error(f"❌ Failed to list job postings: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job postings")

@router.get("/admin/jobs/{job_id}/edit-data", response_model=dict)
async def get_job_for_edit(job_id: str) -> dict:
    """Get job data for editing"""
    try:
        logger.info(f"📝 Getting job data for editing: {job_id}")
        
        qdrant = get_qdrant_utils()
        
        # Verify job exists
        job_data = qdrant.get_job_posting_by_id(job_id)
        if not job_data:
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        # Get structured data
        client = qdrant.client
        structured_data = None
        try:
            res = client.retrieve("job_postings_structured", ids=[job_id], with_payload=True, with_vectors=False)
            if res:
                structured_data = res[0].payload
        except Exception as e:
            logger.warning(f"Could not retrieve structured data for job {job_id}: {e}")
            structured_data = None
        
        # Extract job details from structured data
        job_title = ""
        job_location = ""
        job_summary = ""
        key_responsibilities = ""
        qualifications = ""
        company_name = job_data.get("company_name", "")
        
        if structured_data:
            structured_info = structured_data.get("structured_info", {})
            # Check both direct job_title and structured_info.job_title
            job_title = structured_data.get("job_title") or structured_info.get("job_title", "")
            job_location = structured_info.get("location", "") or structured_info.get("job_location", "")
            job_summary = structured_info.get("job_summary", "") or structured_info.get("summary", "")
            
            # Convert responsibilities list to text
            responsibilities_list = structured_info.get("responsibilities", [])
            if responsibilities_list and isinstance(responsibilities_list, list):
                key_responsibilities = "\n".join(responsibilities_list)
            
            # Convert skills/requirements list to text
            skills_list = structured_info.get("skills", []) or structured_info.get("requirements", [])
            if skills_list and isinstance(skills_list, list):
                qualifications = "\n".join(skills_list)
        
        return {
            "job_title": job_title,
            "job_location": job_location,
            "job_summary": job_summary,
            "key_responsibilities": key_responsibilities,
            "qualifications": qualifications,
            "company_name": company_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get job data for editing: {e}")
        raise HTTPException(status_code=500, detail="Failed to get job data for editing")

@router.patch("/admin/jobs/{job_id}/update", response_model=dict)
async def update_job_posting(
    job_id: str,
    update_data: JobPostingUpdate
    # Add authentication: current_user = Depends(require_hr_user)
) -> dict:
    """Update job posting details in job_postings_structured collection"""
    try:
        logger.info(f"🔄 Updating job posting {job_id} with new data")
        
        qdrant = get_qdrant_utils()
        
        # Verify job exists
        job_data = qdrant.get_job_posting_by_id(job_id)
        if not job_data:
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        # Get current structured data
        client = qdrant.client
        current_structured = None
        try:
            res = client.retrieve("job_postings_structured", ids=[job_id], with_payload=True, with_vectors=False)
            if res:
                current_structured = res[0].payload
        except Exception as e:
            logger.warning(f"Could not retrieve current structured data for job {job_id}: {e}")
            current_structured = {}
        
        if not current_structured:
            current_structured = {}
        
        # Update structured_info with new data
        structured_info = current_structured.get("structured_info", {})
        
        # Update fields if provided
        if update_data.job_title is not None:
            structured_info["job_title"] = update_data.job_title
        if update_data.job_location is not None:
            structured_info["location"] = update_data.job_location
            structured_info["job_location"] = update_data.job_location
        if update_data.job_summary is not None:
            structured_info["job_summary"] = update_data.job_summary
            structured_info["summary"] = update_data.job_summary
        if update_data.key_responsibilities is not None:
            # Convert text to list format for consistency
            responsibilities_list = [line.strip() for line in update_data.key_responsibilities.split('\n') if line.strip()]
            structured_info["responsibilities"] = responsibilities_list
        if update_data.qualifications is not None:
            # Convert text to list format for consistency
            skills_list = [line.strip() for line in update_data.qualifications.split('\n') if line.strip()]
            structured_info["skills"] = skills_list
        
        # Update top-level fields
        if update_data.company_name is not None:
            current_structured["company_name"] = update_data.company_name
        if update_data.additional_info is not None:
            current_structured["additional_info"] = update_data.additional_info
        
        # Update the structured_info in the payload
        current_structured["structured_info"] = structured_info
        
        # Store updated structured data
        success = qdrant.store_structured_data(job_id, "job_postings", current_structured)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update job posting data")
        
        logger.info(f"✅ Job posting {job_id} updated successfully")
        
        return {
            "success": True,
            "job_id": job_id,
            "message": "Job posting updated successfully",
            "updated_fields": [k for k, v in update_data.dict().items() if v is not None]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to update job posting: {e}")
        raise HTTPException(status_code=500, detail="Failed to update job posting")

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
            "upload_date": job_data.get("created_date", job_data.get("upload_date", _now_iso()))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get job info: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job information")

@router.put("/admin/jobs/{job_id}", response_model=JobPostingResponse)
async def update_job_posting(
    job_id: str,
    company_name: Optional[str] = Form(None),
    additional_info: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None)
    # Add authentication here when ready: current_user = Depends(require_hr_user)
) -> JobPostingResponse:
    """
    Update job posting metadata (company_name, additional_info, status)
    """
    try:
        logger.info(f"📝 Updating job posting: {job_id}")
        
        qdrant = get_qdrant_utils()
        
        # Check if job exists
        job_data = qdrant.get_job_posting_by_id(job_id)
        if not job_data:
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        # Update job posting metadata
        success = qdrant.update_job_posting(
            job_id, company_name, additional_info, is_active
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update job posting")
        
        # Get updated job data
        updated_job_data = qdrant.get_job_posting_by_id(job_id)
        
        logger.info(f"✅ Job posting {job_id} updated successfully")
        
        return JobPostingResponse(
            job_id=job_id,
            public_link=f"/careers/jobs/{updated_job_data['public_token']}",
            public_token=updated_job_data["public_token"],
            job_title=updated_job_data.get("job_title", "Position"),
            upload_date=updated_job_data.get("created_date", _now_iso()),
            filename=updated_job_data.get("filename", "job_description.pdf"),
            is_active=updated_job_data.get("is_active", True),
            company_name=updated_job_data.get("company_name")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to update job posting: {e}")
        raise HTTPException(status_code=500, detail="Failed to update job posting. Please try again later.")