"""
CV Routes - Consolidated CV API endpoints
Handles ALL CV operations: upload, processing, listing, and management.
Single responsibility: CV document management through REST API.
"""

import logging
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse,FileResponse, StreamingResponse
from pydantic import BaseModel
from app.services.parsing_service import get_parsing_service
from app.services.llm_service import get_llm_service
from app.services.embedding_service import get_embedding_service
from app.utils.qdrant_utils import get_qdrant_utils
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
    """Update CV upload progress"""
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
            "document_id": cv_id,
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
                "application_status": "processed"
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
            "skills_count": len(standardized.get("skills", [])),
            "responsibilities_count": len(standardized.get("responsibilities", [])),
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
            
            # Store file immediately
            try:
                if file:
                    dest_filename = f"{cv_id}{file_ext}"
                    dest_path = os.path.join(STORAGE_DIR, dest_filename)
                    shutil.copyfile(tmp_path, dest_path)
                    cv_data["persisted_path"] = dest_path
                    # cleanup tmp
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass
                else:
                    dest_filename = f"{cv_id}.txt"
                    dest_path = os.path.join(STORAGE_DIR, dest_filename)
                    with open(dest_path, "w", encoding="utf-8") as f:
                        f.write(raw_content or extracted_text or "")
                    cv_data["persisted_path"] = dest_path
            except Exception as e:
                logger.warning(f"⚠️ Failed to persist original file: {e}")
            
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
        
        # Persist the original file (or synthesize a .txt if text input)
        try:
            if file:
                # name by cv_id to avoid collisions
                dest_filename = f"{cv_id}{file_ext}"
                dest_path = os.path.join(STORAGE_DIR, dest_filename)
                shutil.copyfile(tmp_path, dest_path)
                persisted_path = dest_path
                # cleanup tmp
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
            else:
                # save text as a .txt so it can be downloaded later
                dest_filename = f"{cv_id}.txt"
                dest_path = os.path.join(STORAGE_DIR, dest_filename)
                with open(dest_path, "w", encoding="utf-8") as f:
                    f.write(raw_content or extracted_text or "")
                persisted_path = dest_path
        except Exception as e:
            logger.warning(f"⚠️ Failed to persist original file: {e}")
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
                "document_id": cv_id,
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
                "skills_count": len(standardized.get("skills", [])),
                "responsibilities_count": len(standardized.get("responsibilities", [])),
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

        enhanced = []
        for p in all_structured:
            payload = p.payload or {}
            doc_id = payload.get("id") or payload.get("document_id") or str(p.id)
            structured = payload.get("structured_info", {})
            doc_meta = docs_map.get(doc_id, {})

            skills = structured.get("skills", [])
            resps = structured.get("responsibilities", structured.get("responsibility_sentences", []))

            enhanced.append({
                "id": doc_id,
                "filename": doc_meta.get("filename", "Unknown"),
                "upload_date": doc_meta.get("upload_date", "Unknown"),
                "full_name": structured.get("contact_info", {}).get("name") or structured.get("full_name", "Not specified"),
                "job_title": structured.get("job_title", "Not specified"),
                "years_of_experience": structured.get("experience_years", structured.get("years_of_experience", "Not specified")),
                "skills_count": len(skills),
                "skills": skills,
                "responsibilities_count": len(resps),
                "text_length": len(doc_meta.get("raw_content", "")),
                "has_structured_data": True
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

        # Embedding points
        emb_points, _ = qdrant.client.scroll(
            collection_name="cv_embeddings",
            scroll_filter={"must": [{"key": "document_id", "match": {"value": cv_id}}]},
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

        responsibilities = structured.get("responsibilities", structured.get("responsibility_sentences", []))

        response = {
            "id": cv_id,
            "filename": doc_meta.get("filename", "Unknown"),
            "upload_date": doc_meta.get("upload_date", "Unknown"),
            "document_type": "cv",
            "is_job_application": is_job_application,
            "candidate": {
                "full_name": structured.get("contact_info", {}).get("name") or structured.get("full_name", "Not specified"),
                "job_title": structured.get("job_title", "Not specified"),
                "years_of_experience": structured.get("experience_years", structured.get("years_of_experience", "Not specified")),
                "skills": structured.get("skills", []),
                "responsibilities": responsibilities,
                "skills_count": len(structured.get("skills", [])),
                "responsibilities_count": len(responsibilities),
                "contact_info": structured.get("contact_info", {})
            },
            "text_info": {
                "extracted_text_length": len(doc_meta.get("raw_content", "")),
                "extracted_text_preview": (doc_meta.get("raw_content", "")[:500] + "...") if len(doc_meta.get("raw_content", "")) > 500 else doc_meta.get("raw_content", "")
            },
            "embeddings_info": {
                "skills_embeddings": skills_count,
                "responsibilities_embeddings": resp_count,
                "has_title_embedding": has_title,
                "has_experience_embedding": has_exp,
                "embedding_dimension": dim,
            },
            "structured_info": structured,
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
    """
    try:
        qdrant = get_qdrant_utils()

        # Check existence
        s = qdrant.client.retrieve("cv_structured", ids=[cv_id], with_payload=True)
        if not s:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        filename = (qdrant.client.retrieve("cv_documents", ids=[cv_id], with_payload=True) or [{}])[0].payload.get("filename", cv_id)

        # Delete embedding points
        emb_points, _ = qdrant.client.scroll(
            collection_name="cv_embeddings",
            scroll_filter={"must": [{"key": "document_id", "match": {"value": cv_id}}]},
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
        raw_content = doc[0].payload.get("raw_content", "")

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
            "document_id": cv_id,
            "structured_info": standardized
        })

        # Remove old embeddings and store new ones
        emb_points, _ = qdrant.client.scroll(
            collection_name="cv_embeddings",
            scroll_filter={"must": [{"key": "document_id", "match": {"value": cv_id}}]},
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
                "skills_count": len(standardized.get("skills", [])),
                "responsibilities_count": len(standardized.get("responsibilities", [])),
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

        # Pull embedding points
        points, _ = qdrant.client.scroll(
            collection_name="cv_embeddings",
            scroll_filter={"must": [{"key": "document_id", "match": {"value": cv_id}}]},
            limit=2000,
            with_payload=True,
            with_vectors=True
        )

        info = {
            "cv_id": cv_id,
            "embeddings_found": bool(points),
            "skills": {"count": 0, "embedding_dimension": 0},
            "responsibilities": {"count": 0, "embedding_dimension": 0},
            "title_embedding": False,
            "experience_embedding": False,
            "total_embeddings": 0
        }

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
                "skills_count": len(standardized.get("skills", [])),
                "responsibilities_count": len(standardized.get("responsibilities", [])),
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

    # Serve the persisted file if we have it
    if filepath and os.path.exists(filepath):
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
    raw = payload.get("raw_content")
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
