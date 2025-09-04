"""
JD Routes - Consolidated Job Description API endpoints
Handles ALL Job Description operations: upload, processing, listing, and management.
Single responsibility: Job Description document management through REST API.
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


# Request models for text-based processing
class StandardizeJDRequest(BaseModel):
    jd_text: str
    jd_filename: str = "jd.txt"


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


@router.post("/upload-jd")
async def upload_jd(
    file: Optional[UploadFile] = File(None),
    jd_text: Optional[str] = Form(None)
) -> JSONResponse:
    """
    Upload and process Job Description file or text.
    Pipeline: validate -> extract -> PII removal -> LLM standardization -> EXACT embeddings (32) -> store across 3 collections.
    Collections used:
      - jd_documents       (raw document + metadata)
      - jd_structured      (standardized JSON)
      - jd_embeddings      (exactly 32 vectors)
    """
    try:
        logger.info("---------- JD UPLOAD START ----------")

        parsing_service = get_parsing_service()

        # ---- Step 0: Determine input & extract text ----
        raw_content = ""
        extracted_text = ""
        filename = "text_input.txt"
        file_ext = ".txt"

        if file:
            logger.info(f"Processing JD file upload: {file.filename}")

            # Validate file
            if not file.filename:
                raise HTTPException(status_code=400, detail="No filename provided")

            file_ext = os.path.splitext(file.filename)[1].lower()
            if file_ext not in SUPPORTED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {file_ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
                )

            # Size check
            file.file.seek(0, 2)
            size = file.file.tell()
            file.file.seek(0)
            if size > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail=f"File too large: {size} bytes (max: {MAX_FILE_SIZE})")

            # Save to tmp and process
            import tempfile, shutil
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                shutil.copyfileobj(file.file, tmp)
                tmp_path = tmp.name

            try:
                parsed = parsing_service.process_document(tmp_path, "jd")
                raw_content = parsed["raw_text"]
                extracted_text = parsed["clean_text"]
                filename = file.filename
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

        elif jd_text:
            logger.info("Processing JD text input")
            cleaned, _pii = parsing_service.remove_pii_data(jd_text.strip())
            raw_content = jd_text.strip()
            extracted_text = cleaned
            filename = "text_input.txt"

            if len(extracted_text) < 50:
                raise HTTPException(status_code=400, detail="JD text too short (minimum 50 characters required)")
        else:
            raise HTTPException(status_code=400, detail="Either file upload or jd_text must be provided")

        logger.info(f"✅ Text ready -> length={len(extracted_text)} (pii removed)")

        # ---- Step 1: LLM standardization ----
        logger.info("---------- STEP 1: LLM STANDARDIZATION ----------")
        llm = get_llm_service()
        standardized = llm.standardize_jd(extracted_text, filename)

        # ---- Step 2: EXACT embeddings (32 vectors) ----
        logger.info("---------- STEP 2: EMBEDDING GENERATION (32 vectors) ----------")
        emb_service = get_embedding_service()
        doc_embeddings = emb_service.generate_document_embeddings(standardized)
        # doc_embeddings contains:
        #   skill_vectors[20], responsibility_vectors[10], experience_vector[1], job_title_vector[1]
        #   plus: skills, responsibilities, experience_years, job_title

        # ---- Step 3: Store across Qdrant collections ----
        logger.info("---------- STEP 3: DATABASE STORAGE ----------")
        qdrant = get_qdrant_utils()
        jd_id = str(uuid.uuid4())

        # 3a) Raw doc
        qdrant.store_document(
            doc_id=jd_id,
            doc_type="jd",
            filename=filename,
            file_format=file_ext.lstrip("."),
            raw_content=raw_content,
            upload_date=_now_iso()
        )

        # 3b) Structured
        qdrant.store_structured_data(
            doc_id=jd_id,
            doc_type="jd",
            structured_data={
                "document_id": jd_id,
                "structured_info": standardized
            }
        )

        # 3c) EXACT embeddings
        qdrant.store_embeddings_exact(
            doc_id=jd_id,
            doc_type="jd",
            embeddings_data=doc_embeddings
        )

        logger.info(f"✅ JD processed and stored: {jd_id}")

        return JSONResponse({
            "status": "success",
            "message": f"Job Description '{filename}' processed successfully",
            "jd_id": jd_id,
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
        logger.error(f"❌ JD upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"JD processing failed: {e}")


@router.get("/jds")
async def list_jds() -> JSONResponse:
    """
    List all processed JDs with metadata.
    Reads from jd_structured (for structured_info) and jd_documents (for filename/upload_date).
    """
    try:
        qdrant = get_qdrant_utils()

        # Pull structured rows
        all_structured = []
        offset = None
        while True:
            points, next_offset = qdrant.client.scroll(
                collection_name="jd_structured",
                limit=200,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            all_structured.extend(points)
            if not next_offset:
                break
            offset = next_offset

        # Pull document metadata to map (id -> doc payload)
        docs_map: Dict[str, Dict[str, Any]] = {}
        offset = None
        while True:
            points, next_offset = qdrant.client.scroll(
                collection_name="jd_documents",
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
                "job_title": structured.get("job_title", "Not specified"),
                "years_of_experience": structured.get("experience_years", structured.get("years_of_experience", "Not specified")),
                "skills_count": len(skills),
                "skills": skills,
                "responsibilities_count": len(resps),
                "text_length": len(doc_meta.get("raw_content", "")),
                "has_structured_data": True
            })

        # Sort newest first when possible
        enhanced.sort(key=lambda x: x.get("upload_date", ""), reverse=True)

        return JSONResponse({"status": "success", "count": len(enhanced), "jds": enhanced})

    except Exception as e:
        logger.error(f"❌ Failed to list JDs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list JDs: {e}")


@router.get("/jd/{jd_id}")
async def get_jd_details(jd_id: str) -> JSONResponse:
    """
    Get details for a specific JD.
    Combines jd_structured + jd_documents + jd_embeddings stats.
    """
    try:
        qdrant = get_qdrant_utils()

        # Structured data
        s = qdrant.client.retrieve("jd_structured", ids=[jd_id], with_payload=True, with_vectors=False)
        if not s:
            raise HTTPException(status_code=404, detail=f"JD not found: {jd_id}")
        structured_payload = s[0].payload or {}
        structured = structured_payload.get("structured_info", structured_payload)

        # Doc meta
        d = qdrant.client.retrieve("jd_documents", ids=[jd_id], with_payload=True, with_vectors=False)
        doc_meta = (d[0].payload if d else {}) or {}

        # Embeddings info
        emb_points, _ = qdrant.client.scroll(
            collection_name="jd_embeddings",
            scroll_filter={"must": [{"key": "document_id", "match": {"value": jd_id}}]},
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
            "id": jd_id,
            "filename": doc_meta.get("filename", "Unknown"),
            "upload_date": doc_meta.get("upload_date", "Unknown"),
            "document_type": "jd",
            "job_requirements": {
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

        return JSONResponse({"status": "success", "jd": response})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get JD details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get JD details: {e}")


@router.delete("/jd/{jd_id}")
async def delete_jd(jd_id: str) -> JSONResponse:
    """
    Delete a JD and all associated data across:
      - jd_documents
      - jd_structured
      - jd_embeddings (all vectors with document_id == jd_id)
    """
    try:
        qdrant = get_qdrant_utils()

        # Check existence
        s = qdrant.client.retrieve("jd_structured", ids=[jd_id], with_payload=True)
        if not s:
            raise HTTPException(status_code=404, detail=f"JD not found: {jd_id}")
        filename = (qdrant.client.retrieve("jd_documents", ids=[jd_id], with_payload=True) or [{}])[0].payload.get("filename", jd_id)

        # Delete embeddings points by collecting their ids
        emb_points, _ = qdrant.client.scroll(
            collection_name="jd_embeddings",
            scroll_filter={"must": [{"key": "document_id", "match": {"value": jd_id}}]},
            limit=1000,
            with_payload=False,
            with_vectors=False
        )
        emb_ids = [str(p.id) for p in emb_points]
        if emb_ids:
            qdrant.client.delete(collection_name="jd_embeddings", points_selector=emb_ids)

        # Delete structured + documents
        qdrant.client.delete(collection_name="jd_structured", points_selector=[jd_id])
        qdrant.client.delete(collection_name="jd_documents", points_selector=[jd_id])

        return JSONResponse({
            "status": "success",
            "message": f"Job Description '{filename}' deleted successfully",
            "deleted_jd_id": jd_id
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete JD: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete JD: {e}")


@router.post("/jd/{jd_id}/reprocess")
async def reprocess_jd(jd_id: str) -> JSONResponse:
    """
    Reprocess an existing JD with updated prompts/embeddings.
    """
    try:
        qdrant = get_qdrant_utils()

        # Get original raw content
        doc = qdrant.client.retrieve("jd_documents", ids=[jd_id], with_payload=True)
        if not doc:
            raise HTTPException(status_code=404, detail=f"JD not found: {jd_id}")
        filename = doc[0].payload.get("filename", "reprocessed_jd.txt")
        raw_content = doc[0].payload.get("raw_content", "")

        if not raw_content:
            raise HTTPException(status_code=400, detail="No stored raw content to reprocess")

        # Standardize again
        llm = get_llm_service()
        standardized = llm.standardize_jd(raw_content, filename)

        # New embeddings (32)
        emb_service = get_embedding_service()
        doc_embeddings = emb_service.generate_document_embeddings(standardized)

        # Replace structured
        qdrant.store_structured_data(jd_id, "jd", {
            "document_id": jd_id,
            "structured_info": standardized
        })

        # Remove old embeddings and store new ones
        emb_points, _ = qdrant.client.scroll(
            collection_name="jd_embeddings",
            scroll_filter={"must": [{"key": "document_id", "match": {"value": jd_id}}]},
            limit=2000,
            with_payload=False,
            with_vectors=False
        )
        old_ids = [str(p.id) for p in emb_points]
        if old_ids:
            qdrant.client.delete(collection_name="jd_embeddings", points_selector=old_ids)

        qdrant.store_embeddings_exact(jd_id, "jd", doc_embeddings)

        return JSONResponse({
            "status": "success",
            "message": f"Job Description '{filename}' reprocessed successfully",
            "jd_id": jd_id,
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
        logger.error(f"❌ JD reprocessing failed: {e}")
        raise HTTPException(status_code=500, detail=f"JD reprocessing failed: {e}")


@router.get("/jd/{jd_id}/embeddings")
async def get_jd_embeddings_info(jd_id: str) -> JSONResponse:
    """
    Get detailed embeddings information for a Job Description from jd_embeddings.
    """
    try:
        qdrant = get_qdrant_utils()

        # Verify JD exists
        s = qdrant.client.retrieve("jd_structured", ids=[jd_id], with_payload=True)
        if not s:
            raise HTTPException(status_code=404, detail=f"JD not found: {jd_id}")

        # Pull embedding points
        points, _ = qdrant.client.scroll(
            collection_name="jd_embeddings",
            scroll_filter={"must": [{"key": "document_id", "match": {"value": jd_id}}]},
            limit=2000,
            with_payload=True,
            with_vectors=True
        )

        info = {
            "jd_id": jd_id,
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
        logger.error(f"❌ Failed to get JD embeddings info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get JD embeddings info: {e}")


@router.post("/standardize-jd")
async def standardize_jd_text(request: StandardizeJDRequest) -> JSONResponse:
    """
    Standardize JD text using LLM without storing to database.
    Also returns dimensions/counts of the embeddings that WOULD be generated.
    """
    try:
        if not request.jd_text or not request.jd_text.strip():
            raise HTTPException(status_code=400, detail="JD text cannot be empty")
        if len(request.jd_text) > 50000:
            raise HTTPException(status_code=400, detail="JD text too long (max 50KB)")

        llm = get_llm_service()
        standardized = llm.standardize_jd(request.jd_text, request.jd_filename)

        emb_service = get_embedding_service()
        doc_embeddings = emb_service.generate_document_embeddings(standardized)

        dims = len(doc_embeddings["skill_vectors"][0]) if doc_embeddings["skill_vectors"] else 0
        return JSONResponse({
            "status": "success",
            "message": f"JD '{request.jd_filename}' standardized successfully",
            "filename": request.jd_filename,
            "standardized_data": standardized,
            "processing_stats": {
                "input_text_length": len(request.jd_text),
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
        logger.error(f"❌ JD text standardization failed: {e}")
        raise HTTPException(status_code=500, detail=f"JD standardization failed: {e}")