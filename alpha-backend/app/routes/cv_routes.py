"""CV Routes - Consolidated CV API endpoints.

Handles ALL CV operations: upload, processing, listing, and management.
Single responsibility: CV document management through REST API.
"""

import logging
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, File, HTTPException, Form, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel
from app.services.parsing_service import get_parsing_service
from app.services.llm_service import get_llm_service
from app.services.embedding_service import get_embedding_service
from app.utils.qdrant_utils import get_qdrant_utils, get_decompressed_content
from app.services.s3_storage import get_s3_storage_service
# at top of the file
import mimetypes
import shutil
from io import BytesIO

STORAGE_DIR = os.getenv("CV_UPLOAD_DIR", "/data/uploads/cv")
os.makedirs(STORAGE_DIR, exist_ok=True)
logger = logging.getLogger(__name__)
router = APIRouter()

# Constants
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg']


class StandardizeCVRequest(BaseModel):
    cv_text: str
    cv_filename: str = "cv.txt"


class NoteRequest(BaseModel):
    note: str
    hr_user: str  # HR user who created the note


def _now_iso() -> str:
    return datetime.utcnow().isoformat()

# ----------------------------
# CV Upload Progress Tracking
# ----------------------------

# Global progress tracking for CV uploads (in production, use Redis)
_cv_upload_progress = {}

@router.get("/cv-upload-progress/{cv_id}")
async def get_cv_upload_progress(cv_id: str):
    """
    Get real-time progress of CV upload processing.
    """
    try:
        progress = _cv_upload_progress.get(cv_id, {})
        return JSONResponse({
            "cv_id": cv_id,
            "status": progress.get("status", "not_found"),
            "progress_percent": progress.get("progress_percent", 0),
            "current_step": progress.get("current_step", ""),
            "filename": progress.get("filename", ""),
            "start_time": progress.get("start_time"),
            "estimated_completion": progress.get("estimated_completion"),
            "processing_stats": progress.get("processing_stats", {})
        })
    except Exception as e:
        logger.error(f"❌ Failed to get CV upload progress: {e}")
        raise HTTPException(status_code=500, detail=f"Progress tracking error: {str(e)}")

def update_cv_upload_progress(cv_id: str, **kwargs):
    """Update CV upload progress."""
    if cv_id not in _cv_upload_progress:
        _cv_upload_progress[cv_id] = {}
    _cv_upload_progress[cv_id].update(kwargs)

# ----------------------------
# Optimized CV Processing Functions
# ----------------------------

async def process_cv_async(cv_data: dict) -> dict:
    """
    Process CV asynchronously with parallel operations.
    This function handles the heavy processing without blocking the main thread.
    """
    try:
        cv_id = cv_data["cv_id"]
        extracted_text = cv_data["extracted_text"]
        filename = cv_data["filename"]
        raw_content = cv_data["raw_content"]
        extracted_pii = cv_data["extracted_pii"]
        
        # Initialize progress tracking
        import time
        start_time = time.time()
        update_cv_upload_progress(cv_id,
            status="processing",
            filename=filename,
            start_time=start_time,
            progress_percent=0,
            current_step="Starting processing..."
        )
        
        logger.info(f"🔄 Starting async CV processing for {cv_id}")
        
        # Parallel processing: LLM + Embeddings simultaneously
        import asyncio
        from app.services.llm_service import get_llm_service
        from app.services.embedding_service import get_embedding_service
        
        llm = get_llm_service()
        emb_service = get_embedding_service()
        
        # Create tasks for parallel processing using thread pool
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        async def standardize_cv():
            # Run LLM processing in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as executor:
                return await loop.run_in_executor(executor, llm.standardize_cv, extracted_text, filename)
        
        async def generate_embeddings():
            # We need the standardized data first, so this will be sequential
            standardized = await standardize_cv()
            # Run embedding generation in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as executor:
                embeddings = await loop.run_in_executor(executor, emb_service.generate_document_embeddings, standardized)
                return embeddings, standardized
        
        # Update progress
        update_cv_upload_progress(cv_id,
            progress_percent=25,
            current_step="Generating embeddings and standardizing data..."
        )
        
        # Process in parallel where possible
        doc_embeddings, standardized = await generate_embeddings()
        
        # Update progress
        update_cv_upload_progress(cv_id,
            progress_percent=50,
            current_step="Merging PII data..."
        )
        
        # Merge PII data
        if "contact_info" not in standardized:
            standardized["contact_info"] = {}
        
        if extracted_pii.get("email") and len(extracted_pii["email"]) > 0:
            standardized["contact_info"]["email"] = extracted_pii["email"][0]
        if extracted_pii.get("phone") and len(extracted_pii["phone"]) > 0:
            standardized["contact_info"]["phone"] = extracted_pii["phone"][0]
        
        # Update progress
        update_cv_upload_progress(cv_id,
            progress_percent=75,
            current_step="Storing data in database..."
        )
        
        # Store in Qdrant (parallel operations)
        qdrant = get_qdrant_utils()
        
        # Prepare structured data with job application info if applicable
        structured_payload = {
            "structured_info": standardized
        }
        
        # Add job application specific data if this is a job application
        if cv_data.get("is_job_application", False):
            structured_payload.update({
                "is_job_application": True,
                "job_id": cv_data.get("job_id"),
                "applicant_name": cv_data.get("applicant_name"),
                "applicant_email": cv_data.get("applicant_email"),
                "applicant_phone": cv_data.get("applicant_phone"),
                "cover_letter": cv_data.get("cover_letter"),
                "expected_salary": cv_data.get("expected_salary"),
                "years_of_experience": cv_data.get("years_of_experience"),
                "experience_warning": cv_data.get("experience_warning"),
                "application_date": _now_iso(),
                "application_status": "processed",
                "cv_filename": cv_data.get("filename")  # Preserve original filename for downloads
            })
        
        # Create storage tasks (run in thread pool to avoid blocking)
        async def store_document():
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as executor:
                return await loop.run_in_executor(executor, qdrant.store_document,
                    cv_id, "cv", filename, cv_data.get("file_ext", ".txt").lstrip("."),
                    raw_content, _now_iso(), cv_data.get("persisted_path"), cv_data.get("mime_type", "text/plain")
                )
        
        async def store_structured():
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as executor:
                return await loop.run_in_executor(executor, qdrant.store_structured_data,
                    cv_id, "cv", structured_payload
                )
        
        async def store_embeddings():
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as executor:
                return await loop.run_in_executor(executor, qdrant.store_embeddings_exact,
                    cv_id, "cv", doc_embeddings
                )
        
        # Execute storage operations in parallel
        await asyncio.gather(
            store_document(),
            store_structured(),
            store_embeddings()
        )
        
        # Handle job application linking if this is a job application
        if cv_data.get("is_job_application", False):
            try:
                # Link application to job
                application_data = {
                    "applicant_name": cv_data.get("applicant_name"),
                    "applicant_email": cv_data.get("applicant_email"),
                    "applicant_phone": cv_data.get("applicant_phone"),
                    "cover_letter": cv_data.get("cover_letter"),
                    "expected_salary": cv_data.get("expected_salary"),
                    "years_of_experience": cv_data.get("years_of_experience"),
                    "experience_warning": cv_data.get("experience_warning"),
                    "public_token": cv_data.get("public_token"),
                    "job_title": cv_data.get("job_title", "Position"),
                    "company_name": cv_data.get("company_name", "Alpha Data Recruitment"),
                    "application_date": _now_iso(),
                    "application_status": "processed"
                }
                
                qdrant.link_application_to_job(
                    cv_id, cv_data.get("job_id"), application_data, 
                    filename, _now_iso()
                )
                
                logger.info(f"✅ Job application linked for {cv_id}")
            except Exception as e:
                logger.error(f"❌ Failed to link job application for {cv_id}: {e}")
        
        # Mark as completed
        processing_stats = {
            "text_length": len(extracted_text),
            "skills_count": len(standardized.get("skills_sentences", standardized.get("skills", []))),
            "responsibilities_count": len(standardized.get("responsibility_sentences", standardized.get("responsibilities", []))),
            "embeddings_generated": 32,
            "pii_extracted": {
                "emails": len(extracted_pii.get("email", [])),
                "phones": len(extracted_pii.get("phone", []))
            }
        }
        
        update_cv_upload_progress(cv_id,
            status="completed",
            progress_percent=100,
            current_step="Processing completed successfully!",
            estimated_completion=time.time(),
            processing_stats=processing_stats
        )
        
        logger.info(f"✅ Async CV processing completed for {cv_id}")
        
        return {
            "cv_id": cv_id,
            "standardized": standardized,
            "processing_stats": processing_stats
        }
        
    except Exception as e:
        logger.error(f"❌ Async CV processing failed for {cv_data.get('cv_id', 'unknown')}: {e}")
        raise e


@router.post("/upload-cv")
async def upload_cv(
    file: Optional[UploadFile] = File(None),
    cv_text: Optional[str] = Form(None),
    background_processing: bool = Form(False)
) -> JSONResponse:
    try:
        logger.info("---------- CV UPLOAD START ----------")
        parsing_service = get_parsing_service()
        raw_content = ""
        extracted_text = ""
        filename = "text_input.txt"
        file_ext = ".txt"
        persisted_path: Optional[str] = None
        extracted_pii = {"email": [], "phone": []}  # Initialize PII container
        
        if file:
            logger.info(f"Processing CV file upload: {file.filename}")
            if not file.filename:
                raise HTTPException(status_code=400, detail="No filename provided")
            file_ext = os.path.splitext(file.filename)[1].lower()
            if file_ext not in SUPPORTED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {file_ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
                )
            # size check
            file.file.seek(0, 2)
            size = file.file.tell()
            file.file.seek(0)
            if size > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail=f"File too large: {size} bytes (max: {MAX_FILE_SIZE})")
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                shutil.copyfileobj(file.file, tmp)
                tmp_path = tmp.name
            try:
                parsed = parsing_service.process_document(tmp_path, "cv")
                raw_content = parsed["raw_text"]
                extracted_text = parsed["clean_text"]
                filename = file.filename
                # Get PII from parsed document
                extracted_pii = parsed.get("extracted_pii", {"email": [], "phone": []})
            finally:
                # leave tmp for now; we may copy it into our storage folder below
                pass
        elif cv_text:
            logger.info("Processing CV text input")
            cleaned, extracted_pii = parsing_service.remove_pii_data(cv_text.strip())
            raw_content = cv_text.strip()
            extracted_text = cleaned
            filename = "text_input.txt"
            if len(extracted_text) < 50:
                raise HTTPException(status_code=400, detail="CV text too short (minimum 50 characters required)")
        else:
            raise HTTPException(status_code=400, detail="Either file upload or cv_text must be provided")
        
        logger.info(f"✅ Text ready -> length={len(extracted_text)} (pii removed)")
        logger.info(f"📋 Extracted PII -> emails: {len(extracted_pii.get('email', []))}, phones: {len(extracted_pii.get('phone', []))}")
        
        # Generate CV ID early
        cv_id = str(uuid.uuid4())
        
        if background_processing:
            # OPTIMIZED: Background processing for better performance
            logger.info("🚀 Starting background CV processing...")
            
            # Prepare CV data for async processing
            cv_data = {
                "cv_id": cv_id,
                "extracted_text": extracted_text,
                "filename": filename,
                "raw_content": raw_content,
                "extracted_pii": extracted_pii,
                "file_ext": file_ext,
                "persisted_path": None,  # Will be set below
                "mime_type": mimetypes.guess_type(filename)[0] or "application/octet-stream"
            }
            
            # Store file in S3
            s3_service = get_s3_storage_service()
            try:
                if file:
                    # Upload to S3
                    s3_uri = s3_service.upload_file(tmp_path, cv_id, "cv", file_ext)
                    cv_data["persisted_path"] = s3_uri
                    cv_data["storage_type"] = "s3"
                    # cleanup tmp
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass
                else:
                    # Save text to temp file then upload to S3
                    dest_filename = f"{cv_id}.txt"
                    dest_path = os.path.join("/tmp", dest_filename)
                    with open(dest_path, "w", encoding="utf-8") as f:
                        f.write(raw_content or extracted_text or "")
                    s3_uri = s3_service.upload_file(dest_path, cv_id, "cv", ".txt")
                    cv_data["persisted_path"] = s3_uri
                    cv_data["storage_type"] = "s3"
                    # cleanup tmp
                    try:
                        os.unlink(dest_path)
                    except Exception:
                        pass
            except Exception as e:
                logger.warning(f"⚠️ Failed to persist original file to S3: {e}")
            
            # Start background processing
            import asyncio
            asyncio.create_task(process_cv_async(cv_data))
            
            return JSONResponse({
                "status": "success",
                "message": f"CV '{filename}' queued for background processing",
                "cv_id": cv_id,
                "filename": filename,
                "processing_mode": "background",
                "estimated_completion": "2-5 minutes"
            })
        
        # SYNCHRONOUS PROCESSING: Original logic for immediate results
        logger.info("---------- STEP 1: LLM STANDARDIZATION ----------")
        llm = get_llm_service()
        standardized = llm.standardize_cv(extracted_text, filename)
        
        # Merge extracted PII into standardized data
        logger.info("---------- STEP 1b: MERGING PII ----------")
        if "contact_info" not in standardized:
            standardized["contact_info"] = {}
        
        if extracted_pii.get("email") and len(extracted_pii["email"]) > 0:
            standardized["contact_info"]["email"] = extracted_pii["email"][0]
            logger.info(f"✅ Added email to contact_info: {standardized['contact_info']['email']}")
        if extracted_pii.get("phone") and len(extracted_pii["phone"]) > 0:
            standardized["contact_info"]["phone"] = extracted_pii["phone"][0]
            logger.info(f"✅ Added phone to contact_info: {standardized['contact_info']['phone']}")
        
        # ---- EXACT embeddings (32 vectors) ----
        logger.info("---------- STEP 2: EMBEDDING GENERATION (32 vectors) ----------")
        emb_service = get_embedding_service()
        doc_embeddings = emb_service.generate_document_embeddings(standardized)
        
        # ---- Store across Qdrant collections ----
        logger.info("---------- STEP 3: DATABASE STORAGE ----------")
        qdrant = get_qdrant_utils()
        
        # Persist the original file to S3
        s3_service = get_s3_storage_service()
        try:
            if file:
                # Upload to S3
                persisted_path = s3_service.upload_file(tmp_path, cv_id, "cv", file_ext)
                # cleanup tmp
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
            else:
                # save text to temp file then upload to S3
                dest_filename = f"{cv_id}.txt"
                dest_path = os.path.join("/tmp", dest_filename)
                with open(dest_path, "w", encoding="utf-8") as f:
                    f.write(raw_content or extracted_text or "")
                persisted_path = s3_service.upload_file(dest_path, cv_id, "cv", ".txt")
                # cleanup tmp
                try:
                    os.unlink(dest_path)
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"⚠️ Failed to persist original file to S3: {e}")
            persisted_path = None
        
        mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        
        # 3a) Raw doc (+ file_path)
        qdrant.store_document(
            doc_id=cv_id,
            doc_type="cv",
            filename=filename,
            file_format=file_ext.lstrip("."),
            raw_content=raw_content,
            upload_date=_now_iso(),
            file_path=persisted_path,          # 👈 store the path
            mime_type=mime_type                 # 👈 store the mime
        )
        
        # 3b) Structured JSON
        qdrant.store_structured_data(
            doc_id=cv_id,
            doc_type="cv",
            structured_data={
                "structured_info": standardized
            }
        )
        
        # 3c) EXACT embeddings
        qdrant.store_embeddings_exact(
            doc_id=cv_id,
            doc_type="cv",
            embeddings_data=doc_embeddings
        )
        
        logger.info(f"✅ CV processed and stored: {cv_id}")
        
        return JSONResponse({
            "status": "success",
            "message": f"CV '{filename}' processed successfully",
            "cv_id": cv_id,
            "filename": filename,
            "standardized_data": standardized,
            "processing_stats": {
                "text_length": len(extracted_text),
                "skills_count": len(standardized.get("skills_sentences", standardized.get("skills", []))),
                "responsibilities_count": len(standardized.get("responsibility_sentences", standardized.get("responsibilities", []))),
                "embeddings_generated": 32,
                "pii_extracted": {
                    "emails": len(extracted_pii.get("email", [])),
                    "phones": len(extracted_pii.get("phone", []))
                }
            }
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CV upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"CV processing failed: {e}")


@router.get("/cvs")
async def list_cvs() -> JSONResponse:
    """
    List all processed CVs with metadata.
    Reads from cv_structured (for structured_info) and cv_documents (for filename/upload_date).
    """
    try:
        qdrant = get_qdrant_utils()

        # Structured rows
        all_structured = []
        offset = None
        while True:
            points, next_offset = qdrant.client.scroll(
                collection_name="cv_structured",
                limit=200,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            all_structured.extend(points)
            if not next_offset:
                break
            offset = next_offset
        # Suggestion: could extract into helper function to DRY Qdrant pagination

        # Documents map id -> payload
        docs_map: Dict[str, Dict[str, Any]] = {}
        offset = None
        while True:
            points, next_offset = qdrant.client.scroll(
                collection_name="cv_documents",
                limit=200,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            for p in points:
                payload = p.payload or {}
                docs_map[payload.get("id") or str(p.id)] = payload
            if not next_offset:
                break
            offset = next_offset
        # Suggestion: could extract into helper function to DRY Qdrant pagination

        enhanced = []
        for p in all_structured:
            payload = p.payload or {}
            doc_id = str(p.id)
            structured = payload.get("structured_info", {})
            doc_meta = docs_map.get(doc_id, {})

            skills = structured.get("skills_sentences", structured.get("skills", []))
            resps = structured.get("responsibility_sentences", structured.get("responsibilities", []))

            # Clean up filename - extract just the filename from path
            filename = doc_meta.get("filename", "Unknown")
            if filename and "/" in filename:
                filename = filename.split("/")[-1]  # Get just the filename, not the full path
            
            enhanced.append({
                "id": doc_id,
                "filename": filename,
                "upload_date": doc_meta.get("upload_date", "Unknown"),
                "full_name": structured.get("contact_info", {}).get("name") or structured.get("full_name", "Not specified"),
                "job_title": structured.get("job_title", "Not specified"),
                "years_of_experience": structured.get("years_of_experience", structured.get("experience_years", "Not specified")),
                "skills_count": len(skills),
                "responsibilities_count": len(resps),
                "has_structured_data": True,
                "category": structured.get("category", "General")
            })

        enhanced.sort(key=lambda x: x.get("upload_date", ""), reverse=True)

        return JSONResponse({"status": "success", "count": len(enhanced), "cvs": enhanced})

    except Exception as e:
        logger.error(f"❌ Failed to list CVs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list CVs: {e}")


@router.get("/categories")
async def get_categories():
    """
    Get all CV categories with their counts.
    """
    try:
        qdrant = get_qdrant_utils()
        categories = qdrant.get_categories_with_counts()
        return JSONResponse(content={"categories": categories})
    except Exception as e:
        logger.error(f"❌ Failed to get categories: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get categories: {str(e)}")

@router.get("/cvs/category/{category}")
async def get_cvs_by_category(category: str):
    """
    Get all CVs in a specific category.
    """
    try:
        qdrant = get_qdrant_utils()
        cvs = qdrant.list_cvs_by_category(category)
        return JSONResponse(content={"cvs": cvs, "category": category, "count": len(cvs)})
    except Exception as e:
        logger.error(f"❌ Failed to get CVs by category {category}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get CVs by category: {str(e)}")


@router.get("/{cv_id}")
async def get_cv_details(cv_id: str) -> JSONResponse:
    """
    Get details for a specific CV.
    Combines cv_structured + cv_documents + cv_embeddings stats.
    Also handles job application CVs (stored with application_id as document_id).
    """
    try:
        logger.info(f"🔍 Starting get_cv_details for CV: {cv_id}")
        qdrant = get_qdrant_utils()

        # Structured data
        s = qdrant.client.retrieve("cv_structured", ids=[cv_id], with_payload=True, with_vectors=False)
        if not s:
            logger.error(f"❌ CV not found in cv_structured collection: {cv_id}")
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        structured_payload = s[0].payload or {}
        logger.info(f"✅ Found CV in cv_structured: {cv_id}, payload keys: {list(structured_payload.keys())}")
        
        # Check if this is a job application CV (has is_job_application flag)
        is_job_application = structured_payload.get("is_job_application", False)
        logger.info(f"🔍 CV {cv_id} is_job_application: {is_job_application}")
        
        if is_job_application:
            # For job applications, the structured data is still nested under structured_info
            # but we also have application-specific fields in the main payload
            structured = structured_payload.get("structured_info", structured_payload)
        else:
            # For regular CVs, structured data is nested under structured_info
            structured = structured_payload.get("structured_info", structured_payload)

        # Doc meta
        d = qdrant.client.retrieve("cv_documents", ids=[cv_id], with_payload=True, with_vectors=False)
        doc_meta = (d[0].payload if d else {}) or {}

        # Embedding info - handle both optimized and legacy storage
        try:
            # Try optimized single-point retrieval first
            emb_point = qdrant.client.retrieve(
                collection_name="cv_embeddings",
                ids=[cv_id],
                with_payload=True,
                with_vectors=False
            )
            
            if emb_point and len(emb_point) > 0:
                payload = emb_point[0].payload
                if payload and "vector_structure" in payload:
                    # Optimized storage - single point with vector_structure
                    vector_structure = payload["vector_structure"]
                    skills_count = len(vector_structure.get("skill_vectors", []))
                    resp_count = len(vector_structure.get("responsibility_vectors", []))
                    has_title = len(vector_structure.get("job_title_vector", [])) > 0
                    has_exp = len(vector_structure.get("experience_vector", [])) > 0
                    # Get dimension from first skill vector if available
                    dim = len(vector_structure.get("skill_vectors", [[]])[0]) if vector_structure.get("skill_vectors") else 0
                else:
                    # Legacy storage - multiple points
                    emb_points, _ = qdrant.client.scroll(
                        collection_name="cv_embeddings",
                        scroll_filter={"must": [{"key": "id", "match": {"value": cv_id}}]},
                        limit=100,
                        with_payload=True,
                        with_vectors=True
                    )
                    skills_count = len([p for p in emb_points if (p.payload or {}).get("vector_type") == "skill"])
                    resp_count = len([p for p in emb_points if (p.payload or {}).get("vector_type") == "responsibility"])
                    has_title = any((p.payload or {}).get("vector_type") == "job_title" for p in emb_points)
                    has_exp = any((p.payload or {}).get("vector_type") == "experience" for p in emb_points)
                    dim = 0
                    for p in emb_points:
                        if isinstance(p.vector, list):
                            dim = len(p.vector)
                            break
            else:
                # No embeddings found
                skills_count = resp_count = 0
                has_title = has_exp = False
                dim = 0
        except Exception as e:
            logger.warning(f"⚠️ Failed to get embeddings info for {cv_id}: {e}")
            skills_count = resp_count = 0
            has_title = has_exp = False
            dim = 0

        # Handle both old and new data structures
        skills = structured.get("skills_sentences", structured.get("skills", []))
        responsibilities = structured.get("responsibility_sentences", structured.get("responsibilities", []))

        # Create optimized structured_info without duplicates
        optimized_structured = structured.copy()
        # Remove duplicate skills and responsibilities from structured_info
        # Frontend should use candidate.skills and candidate.responsibilities instead
        if "skills" in optimized_structured:
            del optimized_structured["skills"]
        if "responsibilities" in optimized_structured:
            del optimized_structured["responsibilities"]

        response = {
            "id": cv_id,
            "filename": doc_meta.get("filename", "Unknown"),
            "upload_date": doc_meta.get("upload_date", "Unknown"),
            "document_type": "cv",
            "is_job_application": is_job_application,
            "candidate": {
                "full_name": structured.get("contact_info", {}).get("name") or structured.get("full_name", "Not specified"),
                "job_title": structured.get("job_title", "Not specified"),
                "years_of_experience": structured.get("years_of_experience", structured.get("experience_years", "Not specified")),
                "skills": skills,
                "responsibilities": responsibilities,
                "skills_count": len(skills),
                "responsibilities_count": len(responsibilities),
                "contact_info": structured.get("contact_info", {})
            },
            "embeddings_info": {
                "skills_embeddings": skills_count,
                "responsibilities_embeddings": resp_count,
                "has_title_embedding": has_title,
                "has_experience_embedding": has_exp,
                "embedding_dimension": dim,
            },
            "structured_info": optimized_structured,
            "processing_metadata": structured.get("processing_metadata", {})
        }

        # Add job application specific data if this is a job application
        if is_job_application:
            response["job_application"] = {
                "job_id": structured_payload.get("job_id"),
                "applicant_name": structured_payload.get("applicant_name"),
                "applicant_email": structured_payload.get("applicant_email"),
                "applicant_phone": structured_payload.get("applicant_phone"),
                "application_date": structured_payload.get("application_date"),
                "application_status": structured_payload.get("application_status"),
                "cover_letter": structured_payload.get("cover_letter"),
                "cv_filename": structured_payload.get("cv_filename"),
                "expected_salary": structured_payload.get("expected_salary"),
                "years_of_experience": structured_payload.get("years_of_experience")
            }

        return JSONResponse({"status": "success", "cv": response})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get CV details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get CV details: {e}")


@router.delete("/{cv_id}")
async def delete_cv(cv_id: str) -> JSONResponse:
    """
    Delete a CV and all associated data across:
      - cv_documents
      - cv_structured
      - cv_embeddings (all vectors with document_id == cv_id)
      - S3 file storage
    """
    try:
        qdrant = get_qdrant_utils()

        # Check existence and get file info
        s = qdrant.client.retrieve("cv_structured", ids=[cv_id], with_payload=True)
        if not s:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        
        doc_payload = (qdrant.client.retrieve("cv_documents", ids=[cv_id], with_payload=True) or [{}])[0].payload
        filename = doc_payload.get("filename", cv_id)
        file_path = doc_payload.get("file_path", "")
        
        # Delete from S3 if stored there
        if file_path and file_path.startswith('s3://'):
            try:
                s3_service = get_s3_storage_service()
                file_ext = os.path.splitext(filename)[1] or '.pdf'
                s3_service.delete_file(cv_id, "cv", file_ext)
                logger.info(f"✅ Deleted CV file from S3: {cv_id}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to delete CV from S3: {e}")

        # Delete embedding points
        emb_points, _ = qdrant.client.scroll(
            collection_name="cv_embeddings",
            scroll_filter={"must": [{"key": "id", "match": {"value": cv_id}}]},
            limit=1000,
            with_payload=False,
            with_vectors=False
        )
        emb_ids = [str(p.id) for p in emb_points]
        if emb_ids:
            qdrant.client.delete(collection_name="cv_embeddings", points_selector=emb_ids)

        # Delete structured + document
        qdrant.client.delete(collection_name="cv_structured", points_selector=[cv_id])
        qdrant.client.delete(collection_name="cv_documents", points_selector=[cv_id])

        return JSONResponse({
            "status": "success",
            "message": f"CV '{filename}' deleted successfully",
            "deleted_cv_id": cv_id
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete CV: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete CV: {e}")


@router.post("/{cv_id}/reprocess")
async def reprocess_cv(cv_id: str) -> JSONResponse:
    """
    Reprocess an existing CV with updated prompts/embeddings.
    """
    try:
        qdrant = get_qdrant_utils()

        # Get original raw content
        doc = qdrant.client.retrieve("cv_documents", ids=[cv_id], with_payload=True)
        if not doc:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        filename = doc[0].payload.get("filename", "reprocessed_cv.txt")
        raw_content = get_decompressed_content(doc[0].payload)

        if not raw_content:
            raise HTTPException(status_code=400, detail="No stored raw content to reprocess")

        # Standardize again
        llm = get_llm_service()
        standardized = llm.standardize_cv(raw_content, filename)

        # New embeddings (32)
        emb_service = get_embedding_service()
        doc_embeddings = emb_service.generate_document_embeddings(standardized)

        # Replace structured
        qdrant.store_structured_data(cv_id, "cv", {
            "structured_info": standardized
        })

        # Remove old embeddings and store new ones
        emb_points, _ = qdrant.client.scroll(
            collection_name="cv_embeddings",
            scroll_filter={"must": [{"key": "id", "match": {"value": cv_id}}]},
            limit=2000,
            with_payload=False,
            with_vectors=False
        )
        old_ids = [str(p.id) for p in emb_points]
        if old_ids:
            qdrant.client.delete(collection_name="cv_embeddings", points_selector=old_ids)

        qdrant.store_embeddings_exact(cv_id, "cv", doc_embeddings)

        return JSONResponse({
            "status": "success",
            "message": f"CV '{filename}' reprocessed successfully",
            "cv_id": cv_id,
            "updated_data": standardized,
            "processing_stats": {
                "skills_count": len(standardized.get("skills_sentences", standardized.get("skills", []))),
                "responsibilities_count": len(standardized.get("responsibility_sentences", standardized.get("responsibilities", []))),
                "embeddings_generated": 32
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CV reprocessing failed: {e}")
        raise HTTPException(status_code=500, detail=f"CV reprocessing failed: {e}")


@router.get("/{cv_id}/embeddings")
async def get_cv_embeddings_info(cv_id: str) -> JSONResponse:
    """
    Get detailed embeddings information for a CV from cv_embeddings.
    """
    try:
        qdrant = get_qdrant_utils()

        # Verify CV exists
        s = qdrant.client.retrieve("cv_structured", ids=[cv_id], with_payload=True)
        if not s:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")

        # Try optimized single-point retrieval first
        try:
            emb_point = qdrant.client.retrieve(
                collection_name="cv_embeddings",
                ids=[cv_id],
                with_payload=True,
                with_vectors=False
            )
            
            info = {
                "cv_id": cv_id,
                "embeddings_found": False,
                "skills": {"count": 0, "embedding_dimension": 0},
                "responsibilities": {"count": 0, "embedding_dimension": 0},
                "title_embedding": False,
                "experience_embedding": False,
                "total_embeddings": 0
            }
            
            if emb_point and len(emb_point) > 0:
                payload = emb_point[0].payload
                if payload and "vector_structure" in payload:
                    # Optimized storage - single point with vector_structure
                    vector_structure = payload["vector_structure"]
                    info["embeddings_found"] = True
                    info["skills"]["count"] = len(vector_structure.get("skill_vectors", []))
                    info["responsibilities"]["count"] = len(vector_structure.get("responsibility_vectors", []))
                    info["title_embedding"] = len(vector_structure.get("job_title_vector", [])) > 0
                    info["experience_embedding"] = len(vector_structure.get("experience_vector", [])) > 0
                    
                    # Get dimensions from first vectors if available
                    if vector_structure.get("skill_vectors"):
                        info["skills"]["embedding_dimension"] = len(vector_structure["skill_vectors"][0])
                    if vector_structure.get("responsibility_vectors"):
                        info["responsibilities"]["embedding_dimension"] = len(vector_structure["responsibility_vectors"][0])
                else:
                    # Legacy storage - multiple points
                    points, _ = qdrant.client.scroll(
                        collection_name="cv_embeddings",
                        scroll_filter={"must": [{"key": "id", "match": {"value": cv_id}}]},
                        limit=2000,
                        with_payload=True,
                        with_vectors=True
                    )
                    
                    info["embeddings_found"] = bool(points)
                    
                    for p in points:
                        pld = p.payload or {}
                        vtype = pld.get("vector_type")
                        if vtype == "skill":
                            info["skills"]["count"] += 1
                            if isinstance(p.vector, list) and not info["skills"]["embedding_dimension"]:
                                info["skills"]["embedding_dimension"] = len(p.vector)
                        elif vtype == "responsibility":
                            info["responsibilities"]["count"] += 1
                            if isinstance(p.vector, list) and not info["responsibilities"]["embedding_dimension"]:
                                info["responsibilities"]["embedding_dimension"] = len(p.vector)
                        elif vtype == "job_title":
                            info["title_embedding"] = True
                        elif vtype == "experience":
                            info["experience_embedding"] = True

            info["total_embeddings"] = info["skills"]["count"] + info["responsibilities"]["count"] + int(info["title_embedding"]) + int(info["experience_embedding"])
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to get embeddings info for {cv_id}: {e}")
            info = {
                "cv_id": cv_id,
                "embeddings_found": False,
                "skills": {"count": 0, "embedding_dimension": 0},
                "responsibilities": {"count": 0, "embedding_dimension": 0},
                "title_embedding": False,
                "experience_embedding": False,
                "total_embeddings": 0
            }

        return JSONResponse({"status": "success", "embeddings_info": info})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get CV embeddings info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get CV embeddings info: {e}")


@router.post("/standardize-cv")
async def standardize_cv_text(request: StandardizeCVRequest) -> JSONResponse:
    try:
        if not request.cv_text or not request.cv_text.strip():
            raise HTTPException(status_code=400, detail="CV text cannot be empty")
        if len(request.cv_text) > 50000:
            raise HTTPException(status_code=400, detail="CV text too long (max 50KB)")
        
        # Extract PII before sending to LLM
        parsing_service = get_parsing_service()
        clean_text, extracted_pii = parsing_service.remove_pii_data(request.cv_text.strip())
        
        # Send clean text to LLM
        llm = get_llm_service()
        standardized = llm.standardize_cv(clean_text, request.cv_filename)
        
        # Add extracted PII to standardized data
        standardized["extracted_pii"] = extracted_pii
        
        # Override contact_info with extracted PII
        if "contact_info" not in standardized:
            standardized["contact_info"] = {}
        if extracted_pii.get("email") and len(extracted_pii["email"]) > 0:
            standardized["contact_info"]["email"] = extracted_pii["email"][0]
            logger.info(f"✅ Added email to contact_info: {standardized['contact_info']['email']}")
        if extracted_pii.get("phone") and len(extracted_pii["phone"]) > 0:
            standardized["contact_info"]["phone"] = extracted_pii["phone"][0]
            logger.info(f"✅ Added phone to contact_info: {standardized['contact_info']['phone']}")
        
        # Also store PII at top level for backward compatibility
        if extracted_pii.get("email") and len(extracted_pii["email"]) > 0:
            standardized["email"] = extracted_pii["email"][0]
        if extracted_pii.get("phone") and len(extracted_pii["phone"]) > 0:
            standardized["phone"] = extracted_pii["phone"][0]
        
        # Generate embeddings for stats
        emb_service = get_embedding_service()
        doc_embeddings = emb_service.generate_document_embeddings(standardized)
        dims = len(doc_embeddings["skill_vectors"][0]) if doc_embeddings["skill_vectors"] else 0
        
        return JSONResponse({
            "status": "success",
            "message": f"CV '{request.cv_filename}' standardized successfully",
            "filename": request.cv_filename,
            "standardized_data": standardized,
            "processing_stats": {
                "input_text_length": len(request.cv_text),
                "skills_count": len(standardized.get("skills_sentences", standardized.get("skills", []))),
                "responsibilities_count": len(standardized.get("responsibility_sentences", standardized.get("responsibilities", []))),
                "embeddings_info": {
                    "skills_count": len(doc_embeddings["skill_vectors"]),
                    "responsibilities_count": len(doc_embeddings["responsibility_vectors"]),
                    "vector_dimension": dims
                },
                "pii_extracted": {
                    "emails": len(extracted_pii.get("email", [])),
                    "phones": len(extracted_pii.get("phone", []))
                }
            }
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CV text standardization failed: {e}")
        raise HTTPException(status_code=500, detail=f"CV standardization failed: {e}")
@router.get("/{cv_id}/download")
async def download_cv(cv_id: str):
    """
    Download the original uploaded CV file.
    Falls back to a .txt export of raw_content if the file_path is missing.
    Also handles job application CVs (stored with application_id as document_id).
    """
    q = get_qdrant_utils().client
    res = q.retrieve("cv_documents", ids=[cv_id], with_payload=True, with_vectors=False)
    if not res:
        raise HTTPException(status_code=404, detail="CV not found")

    payload = res[0].payload or {}
    filepath = payload.get("file_path") or payload.get("filepath")
    filename = payload.get("filename", f"{cv_id}.dat")
    
    # For job applications, use a more descriptive filename if available
    if not filepath and not payload.get("raw_content"):
        # Check if this is a job application by looking at structured data
        structured_res = q.retrieve("cv_structured", ids=[cv_id], with_payload=True, with_vectors=False)
        if structured_res and structured_res[0].payload:
            structured_payload = structured_res[0].payload
            if structured_payload.get("is_job_application"):
                applicant_name = structured_payload.get("applicant_name", "Applicant")
                cv_filename = structured_payload.get("cv_filename", "cv.pdf")
                filename = f"{applicant_name}_{cv_filename}"

    # Check if file is in S3
    if filepath and filepath.startswith('s3://'):
        # File is stored in S3 - stream it through backend (avoids CORS)
        s3_service = get_s3_storage_service()
        file_ext = os.path.splitext(filename)[1] or '.pdf'
        
        try:
            import tempfile
            # Download from S3 to temp file using the ACTUAL S3 path from database
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                tmp_path = tmp.name
            
            # Extract bucket and key from S3 URI
            # filepath = "s3://bucket-name/cvs/file-id.pdf"
            s3_parts = filepath.replace('s3://', '').split('/', 1)
            bucket_name = s3_parts[0]
            s3_key = s3_parts[1] if len(s3_parts) > 1 else f"cvs/{cv_id}{file_ext}"
            
            logger.info(f"📥 Downloading from S3: {bucket_name}/{s3_key}")
            
            # Download using boto3 directly with actual path
            s3_service.s3_client.download_file(bucket_name, s3_key, tmp_path)
            
            # Determine MIME type
            mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            
            # Stream file to user
            def cleanup():
                try:
                    os.unlink(tmp_path)
                except:
                    pass
            
            response = FileResponse(
                tmp_path,
                media_type=mime_type,
                filename=filename,
                background=None
            )
            # Cleanup temp file after sending
            import atexit
            atexit.register(cleanup)
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to download from S3: {e}")
            # Final fallback to raw_content
            raw = get_decompressed_content(payload)
            if raw:
                logger.info(f"✅ Final fallback to raw_content for {cv_id}")
                bytes_io = BytesIO(raw.encode("utf-8"))
                fallback_filename = f"{os.path.splitext(filename)[0]}.txt"
                headers = {"Content-Disposition": f'attachment; filename="{fallback_filename}"'}
                return StreamingResponse(bytes_io, media_type="text/plain; charset=utf-8", headers=headers)
            raise HTTPException(status_code=500, detail="Failed to download file")
    
    # Serve the persisted file if we have it (legacy local storage)
    elif filepath and os.path.exists(filepath):
        # Get the original filename from structured data if available
        original_filename = filename
        structured_res = q.retrieve("cv_structured", ids=[cv_id], with_payload=True, with_vectors=False)
        if structured_res and structured_res[0].payload:
            structured_payload = structured_res[0].payload
            if structured_payload.get("is_job_application"):
                # Use the original CV filename for job applications
                cv_filename = structured_payload.get("cv_filename")
                if cv_filename:
                    original_filename = cv_filename
            else:
                # For regular CVs, use the filename from structured data
                structured_filename = structured_payload.get("filename")
                if structured_filename:
                    original_filename = structured_filename
        
        # Determine MIME type
        mime_type = payload.get("mime_type") or mimetypes.guess_type(filepath)[0] or "application/octet-stream"
        
        return FileResponse(
            filepath, 
            media_type=mime_type, 
            filename=original_filename
        )

    # Fallback: stream raw_content as a .txt download (helps older records)
    raw = get_decompressed_content(payload)
    if raw:
        # Try to preserve original filename extension if available
        fallback_filename = filename
        structured_res = q.retrieve("cv_structured", ids=[cv_id], with_payload=True, with_vectors=False)
        if structured_res and structured_res[0].payload:
            structured_payload = structured_res[0].payload
            if structured_payload.get("is_job_application"):
                cv_filename = structured_payload.get("cv_filename")
                if cv_filename:
                    # Keep original extension if it's a text-based format, otherwise convert to .txt
                    original_ext = os.path.splitext(cv_filename)[1].lower()
                    if original_ext in ['.txt', '.md']:
                        fallback_filename = cv_filename
                    else:
                        fallback_filename = f"{os.path.splitext(cv_filename)[0]}.txt"
            else:
                structured_filename = structured_payload.get("filename")
                if structured_filename:
                    original_ext = os.path.splitext(structured_filename)[1].lower()
                    if original_ext in ['.txt', '.md']:
                        fallback_filename = structured_filename
                    else:
                        fallback_filename = f"{os.path.splitext(structured_filename)[0]}.txt"
        
        bytes_io = BytesIO(raw.encode("utf-8"))
        headers = {
            "Content-Disposition": f'attachment; filename="{fallback_filename}"'
        }
        return StreamingResponse(bytes_io, media_type="text/plain; charset=utf-8", headers=headers)

    raise HTTPException(status_code=404, detail="File not found on server")


# ----------------------------
# Note Management APIs
# ----------------------------

@router.post("/{cv_id}/note")
async def add_or_update_note(cv_id: str, request: NoteRequest) -> JSONResponse:
    """
    Add or update a note for a specific CV.
    Notes are stored in the cv_structured collection under the 'hr_notes' field.
    """
    try:
        logger.info(f"📝 Adding/updating note for CV: {cv_id}")
        qdrant = get_qdrant_utils()
        
        # Check if CV exists
        s = qdrant.client.retrieve("cv_structured", ids=[cv_id], with_payload=True, with_vectors=False)
        if not s:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        
        # Get current structured data
        current_payload = s[0].payload or {}
        structured_info = current_payload.get("structured_info", {})
        
        # IMPORTANT: Preserve job application metadata at root level
        # This ensures job posting links remain intact
        is_job_application = current_payload.get("is_job_application", False)
        job_posting_id = current_payload.get("job_posting_id")
        applicant_email = current_payload.get("applicant_email")
        application_id = current_payload.get("application_id")
        cv_filename = current_payload.get("cv_filename")
        
        # Add/update note
        if "hr_notes" not in structured_info:
            structured_info["hr_notes"] = []
        
        # Check if note already exists for this HR user
        existing_note_index = None
        for i, note in enumerate(structured_info["hr_notes"]):
            if note.get("hr_user") == request.hr_user:
                existing_note_index = i
                break
        
        note_data = {
            "note": request.note,
            "hr_user": request.hr_user,
            "created_at": _now_iso(),
            "updated_at": _now_iso()
        }
        
        if existing_note_index is not None:
            # Update existing note
            structured_info["hr_notes"][existing_note_index] = note_data
            logger.info(f"✅ Updated note for CV {cv_id} by HR user {request.hr_user}")
        else:
            # Add new note
            structured_info["hr_notes"].append(note_data)
            logger.info(f"✅ Added new note for CV {cv_id} by HR user {request.hr_user}")
        
        # Build updated payload - PRESERVE all job application metadata
        updated_payload = {
            **current_payload,
            "structured_info": structured_info
        }
        
        # Explicitly preserve job application fields to ensure they're not lost
        if is_job_application:
            updated_payload["is_job_application"] = is_job_application
            if job_posting_id:
                updated_payload["job_posting_id"] = job_posting_id
            if applicant_email:
                updated_payload["applicant_email"] = applicant_email
            if application_id:
                updated_payload["application_id"] = application_id
            if cv_filename:
                updated_payload["cv_filename"] = cv_filename
            
            logger.info(f"✅ Preserved job application link: job_posting_id={job_posting_id}")
        
        # Store updated data
        qdrant.store_structured_data(cv_id, "cv", updated_payload)
        
        return JSONResponse({
            "status": "success",
            "message": "Note added/updated successfully",
            "cv_id": cv_id,
            "note": note_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to add/update note for CV {cv_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add/update note: {e}")


@router.get("/{cv_id}/note")
async def get_cv_note(cv_id: str) -> JSONResponse:
    """
    Get all notes for a specific CV.
    """
    try:
        logger.info(f"📖 Getting notes for CV: {cv_id}")
        qdrant = get_qdrant_utils()
        
        # Get CV structured data
        s = qdrant.client.retrieve("cv_structured", ids=[cv_id], with_payload=True, with_vectors=False)
        if not s:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        
        structured_info = s[0].payload.get("structured_info", {})
        notes = structured_info.get("hr_notes", [])
        
        return JSONResponse({
            "status": "success",
            "cv_id": cv_id,
            "notes": notes,
            "notes_count": len(notes)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get notes for CV {cv_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get notes: {e}")


@router.delete("/{cv_id}/note/{hr_user}")
async def delete_cv_note(cv_id: str, hr_user: str) -> JSONResponse:
    """
    Delete a note for a specific CV by HR user.
    """
    try:
        logger.info(f"🗑️ Deleting note for CV: {cv_id} by HR user: {hr_user}")
        qdrant = get_qdrant_utils()
        
        # Check if CV exists
        s = qdrant.client.retrieve("cv_structured", ids=[cv_id], with_payload=True, with_vectors=False)
        if not s:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        
        # Get current structured data
        current_payload = s[0].payload or {}
        structured_info = current_payload.get("structured_info", {})
        
        # IMPORTANT: Preserve job application metadata at root level
        # This ensures job posting links remain intact
        is_job_application = current_payload.get("is_job_application", False)
        job_posting_id = current_payload.get("job_posting_id")
        applicant_email = current_payload.get("applicant_email")
        application_id = current_payload.get("application_id")
        cv_filename = current_payload.get("cv_filename")
        
        # Remove note for this HR user
        if "hr_notes" in structured_info:
            original_count = len(structured_info["hr_notes"])
            structured_info["hr_notes"] = [
                note for note in structured_info["hr_notes"] 
                if note.get("hr_user") != hr_user
            ]
            
            if len(structured_info["hr_notes"]) == original_count:
                raise HTTPException(status_code=404, detail=f"No note found for HR user: {hr_user}")
        
        # Build updated payload - PRESERVE all job application metadata
        updated_payload = {
            **current_payload,
            "structured_info": structured_info
        }
        
        # Explicitly preserve job application fields to ensure they're not lost
        if is_job_application:
            updated_payload["is_job_application"] = is_job_application
            if job_posting_id:
                updated_payload["job_posting_id"] = job_posting_id
            if applicant_email:
                updated_payload["applicant_email"] = applicant_email
            if application_id:
                updated_payload["application_id"] = application_id
            if cv_filename:
                updated_payload["cv_filename"] = cv_filename
            
            logger.info(f"✅ Preserved job application link: job_posting_id={job_posting_id}")
        
        # Store updated data
        qdrant.store_structured_data(cv_id, "cv", updated_payload)
        
        logger.info(f"✅ Deleted note for CV {cv_id} by HR user {hr_user}")
        
        return JSONResponse({
            "status": "success",
            "message": "Note deleted successfully",
            "cv_id": cv_id,
            "hr_user": hr_user
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete note for CV {cv_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete note: {e}")


@router.get("/notes/all")
async def get_all_cvs_with_notes() -> JSONResponse:
    """
    Get all CVs that have notes, with their note information.
    This is used for the Notes tab in the frontend.
    """
    try:
        logger.info("📋 Getting all CVs with notes")
        qdrant = get_qdrant_utils()
        
        # Get all CVs with structured data
        all_cvs = []
        offset = None
        
        while True:
            points, next_offset = qdrant.client.scroll(
                collection_name="cv_structured",
                limit=200,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            
            for point in points:
                payload = point.payload or {}
                structured_info = payload.get("structured_info", {})
                notes = structured_info.get("hr_notes", [])
                
                if notes:  # Only include CVs that have notes
                    # Get document metadata for filename and upload date
                    doc_meta = {}
                    try:
                        doc_result = qdrant.client.retrieve("cv_documents", ids=[str(point.id)], with_payload=True, with_vectors=False)
                        if doc_result:
                            doc_meta = doc_result[0].payload or {}
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to get document metadata for CV {point.id}: {e}")
                    
                    # Clean up filename
                    filename = doc_meta.get("filename", "Unknown")
                    if filename and "/" in filename:
                        filename = filename.split("/")[-1]
                    
                    cv_data = {
                        "cv_id": str(point.id),
                        "filename": filename,
                        "upload_date": doc_meta.get("upload_date", "Unknown"),
                        "full_name": structured_info.get("contact_info", {}).get("name") or structured_info.get("full_name", "Not specified"),
                        "job_title": structured_info.get("job_title", "Not specified"),
                        "years_of_experience": structured_info.get("years_of_experience", structured_info.get("experience_years", "Not specified")),
                        "notes": notes,
                        "notes_count": len(notes),
                        "latest_note": max(notes, key=lambda x: x.get("updated_at", x.get("created_at", ""))) if notes else None
                    }
                    all_cvs.append(cv_data)
            
            if not next_offset:
                break
            offset = next_offset
        
        # Sort by latest note date
        all_cvs.sort(key=lambda x: x["latest_note"]["updated_at"] if x["latest_note"] else "", reverse=True)
        
        return JSONResponse({
            "status": "success",
            "cvs_with_notes": all_cvs,
            "total_count": len(all_cvs)
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get CVs with notes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get CVs with notes: {e}")


# ------------------------------
# Batch Notes Summary Endpoint
# ------------------------------

class NotesSummaryRequest(BaseModel):
    cv_ids: List[str]


@router.post("/notes/summary")
async def get_notes_summary(payload: NotesSummaryRequest) -> JSONResponse:
    """
    Return a lightweight notes summary for a batch of CV IDs.
    For each cv_id: { cv_id, has_notes, notes_count, latest_note }
    - Optimized for UI lists (e.g., matching results) to avoid N per-CV note calls
    - Does NOT include full notes array
    """
    try:
        if not payload.cv_ids:
            return JSONResponse({
                "status": "success",
                "summaries": [],
                "count": 0
            })

        # Deduplicate while preserving order
        seen = set()
        ordered_ids: List[str] = []
        for cv_id in payload.cv_ids:
            if cv_id and cv_id not in seen:
                seen.add(cv_id)
                ordered_ids.append(cv_id)

        qdrant = get_qdrant_utils()

        # Prepare defaults for all requested IDs
        summaries_map: Dict[str, Dict[str, Any]] = {
            cv_id: {
                "cv_id": cv_id,
                "has_notes": False,
                "notes_count": 0,
                "latest_note": None,
            }
            for cv_id in ordered_ids
        }

        # Qdrant retrieve supports multiple IDs; chunk for safety
        CHUNK_SIZE = 256
        for i in range(0, len(ordered_ids), CHUNK_SIZE):
            chunk = ordered_ids[i:i + CHUNK_SIZE]
            try:
                results = qdrant.client.retrieve(
                    "cv_structured",
                    ids=chunk,
                    with_payload=True,
                    with_vectors=False,
                )
            except Exception as e:
                logger.warning(f"⚠️ Failed to retrieve notes summary chunk {i}-{i+len(chunk)}: {e}")
                continue

            for point in results or []:
                try:
                    payload = point.payload or {}
                    structured_info = payload.get("structured_info", {})
                    notes = structured_info.get("hr_notes", []) or []

                    summary = summaries_map.get(str(point.id))
                    # Some deployments may store UUIDs as strings; ensure both lookups
                    if summary is None:
                        summary = summaries_map.get(point.id)  # type: ignore[index]

                    if summary is not None:
                        summary["has_notes"] = len(notes) > 0
                        summary["notes_count"] = len(notes)
                        if notes:
                            latest_note = max(
                                notes,
                                key=lambda x: x.get("updated_at", x.get("created_at", ""))
                            )
                            summary["latest_note"] = latest_note
                except Exception as inner_e:
                    logger.warning(f"⚠️ Failed to process summary for point {getattr(point, 'id', 'unknown')}: {inner_e}")

        # Preserve original order in response
        summaries_list = [summaries_map[cid] for cid in ordered_ids]

        return JSONResponse({
            "status": "success",
            "summaries": summaries_list,
            "count": len(summaries_list)
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get notes summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get notes summary: {e}")
