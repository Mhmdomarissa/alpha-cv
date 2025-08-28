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
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.parsing_service import get_parsing_service
from app.services.llm_service import get_llm_service
from app.services.embedding_service import get_embedding_service
from app.utils.qdrant_utils import get_qdrant_utils

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


@router.post("/upload-cv")
async def upload_cv(
    file: Optional[UploadFile] = File(None),
    cv_text: Optional[str] = Form(None)
) -> JSONResponse:
    """
    Upload and process CV file or text.
    Pipeline: validate -> extract -> PII removal -> LLM standardization -> EXACT embeddings (32) -> store across 3 collections.
    Collections used:
      - cv_documents       (raw document + metadata)
      - cv_structured      (standardized JSON)
      - cv_embeddings      (exactly 32 vectors)
    """
    try:
        logger.info("---------- CV UPLOAD START ----------")

        parsing_service = get_parsing_service()

        # ---- Input & extraction ----
        raw_content = ""
        extracted_text = ""
        filename = "text_input.txt"
        file_ext = ".txt"

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

            import tempfile, shutil
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                shutil.copyfileobj(file.file, tmp)
                tmp_path = tmp.name

            try:
                parsed = parsing_service.process_document(tmp_path, "cv")
                raw_content = parsed["raw_text"]
                extracted_text = parsed["clean_text"]
                filename = file.filename
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

        elif cv_text:
            logger.info("Processing CV text input")
            cleaned, _pii = parsing_service.remove_pii_data(cv_text.strip())
            raw_content = cv_text.strip()
            extracted_text = cleaned
            filename = "text_input.txt"

            if len(extracted_text) < 50:
                raise HTTPException(status_code=400, detail="CV text too short (minimum 50 characters required)")
        else:
            raise HTTPException(status_code=400, detail="Either file upload or cv_text must be provided")

        logger.info(f"✅ Text ready -> length={len(extracted_text)} (pii removed)")

        # ---- LLM standardization ----
        logger.info("---------- STEP 1: LLM STANDARDIZATION ----------")
        llm = get_llm_service()
        standardized = llm.standardize_cv(extracted_text, filename)

        # ---- EXACT embeddings (32 vectors) ----
        logger.info("---------- STEP 2: EMBEDDING GENERATION (32 vectors) ----------")
        emb_service = get_embedding_service()
        doc_embeddings = emb_service.generate_document_embeddings(standardized)
        # Contains:
        #   skill_vectors[20], responsibility_vectors[10], experience_vector[1], job_title_vector[1]
        #   plus: skills, responsibilities, experience_years, job_title

        # ---- Store across Qdrant collections ----
        logger.info("---------- STEP 3: DATABASE STORAGE ----------")
        qdrant = get_qdrant_utils()
        cv_id = str(uuid.uuid4())

        # 3a) Raw doc
        qdrant.store_document(
            doc_id=cv_id,
            doc_type="cv",
            filename=filename,
            file_format=file_ext.lstrip("."),
            raw_content=raw_content,
            upload_date=_now_iso()
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
                "embeddings_generated": 32
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


@router.get("/cv/{cv_id}")
async def get_cv_details(cv_id: str) -> JSONResponse:
    """
    Get details for a specific CV.
    Combines cv_structured + cv_documents + cv_embeddings stats.
    """
    try:
        qdrant = get_qdrant_utils()

        # Structured data
        s = qdrant.client.retrieve("cv_structured", ids=[cv_id], with_payload=True, with_vectors=False)
        if not s:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        structured_payload = s[0].payload or {}
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
            "candidate": {
                "full_name": structured.get("contact_info", {}).get("name") or structured.get("full_name", "Not specified"),
                "job_title": structured.get("job_title", "Not specified"),
                "years_of_experience": structured.get("experience_years", structured.get("years_of_experience", "Not specified")),
                "skills": structured.get("skills", []),
                "responsibilities": responsibilities,
                "skills_count": len(structured.get("skills", [])),
                "responsibilities_count": len(responsibilities)
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

        return JSONResponse({"status": "success", "cv": response})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get CV details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get CV details: {e}")


@router.delete("/cv/{cv_id}")
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


@router.post("/cv/{cv_id}/reprocess")
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


@router.get("/cv/{cv_id}/embeddings")
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
    """
    Standardize CV text using LLM without storing to database.
    Also returns dimensions/counts of the embeddings that WOULD be generated.
    """
    try:
        if not request.cv_text or not request.cv_text.strip():
            raise HTTPException(status_code=400, detail="CV text cannot be empty")
        if len(request.cv_text) > 50000:
            raise HTTPException(status_code=400, detail="CV text too long (max 50KB)")

        llm = get_llm_service()
        standardized = llm.standardize_cv(request.cv_text, request.cv_filename)

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
                }
            }
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CV text standardization failed: {e}")
        raise HTTPException(status_code=500, detail=f"CV standardization failed: {e}")
