"""
CV Routes - Consolidated CV-related API endpoints
Handles ALL CV operations: upload, processing, listing, and management.
Single responsibility: CV document management through REST API.
"""

import logging
import os
import uuid
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
class StandardizeCVRequest(BaseModel):
    cv_text: str
    cv_filename: str = "cv.txt"

@router.post("/upload-cv")
async def upload_cv(file: UploadFile = File(..., description="CV file to upload")) -> JSONResponse:
    """
    Upload and process CV file.
    Complete pipeline: file validation -> text extraction -> LLM standardization -> embedding generation -> storage.
    """
    # Store filename and file info immediately to avoid binary data in logs
    filename = file.filename
    content_type = file.content_type
    
    try:
        logger.info(f"📄 Processing CV upload: {filename}")
        
        # Validate file
        if not filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        file_ext = os.path.splitext(filename)[1].lower()
        if file_ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
            )
        
        # Read file content into memory first
        try:
            # Ensure we're at the beginning of the file
            await file.seek(0)
            file_content = await file.read()
            file_size = len(file_content)
            logger.info(f"📁 Successfully read file: {filename}, size: {file_size} bytes")
        except Exception as e:
            logger.error(f"❌ Failed to read uploaded file: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large: {file_size} bytes (max: {MAX_FILE_SIZE})"
            )
        
        # Save file temporarily for processing
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            tmp_file.write(file_content)
            tmp_file_path = tmp_file.name
        
        try:
            # Step 1: Extract text from document
            logger.info("🔍 Step 1: Extracting text from CV")
            parsing_service = get_parsing_service()
            parsed_result = parsing_service.process_document(tmp_file_path, "cv")
            
            # Step 2: Standardize with LLM
            logger.info("🧠 Step 2: Standardizing CV with LLM")
            llm_service = get_llm_service()
            standardized_data = llm_service.standardize_cv(
                parsed_result["clean_text"], 
                filename
            )
            
            # Step 3: Generate embeddings
            logger.info("🔥 Step 3: Generating embeddings")
            embedding_service = get_embedding_service()
            
            embeddings = {}
            # Skills embeddings
            if standardized_data.get("skills"):
                embeddings["skills"] = embedding_service.generate_skill_embeddings(
                    standardized_data["skills"]
                )
            
            # Responsibilities embeddings
            if standardized_data.get("responsibilities"):
                embeddings["responsibilities"] = embedding_service.generate_responsibility_embeddings(
                    standardized_data["responsibilities"]
                )
            
            # Title embedding
            if standardized_data.get("job_title") and standardized_data["job_title"] != "Not specified":
                embeddings["title"] = embedding_service.generate_single_embedding(
                    standardized_data["job_title"]
                )
            
            # Experience embedding
            experience = standardized_data.get("experience_years", "")
            if experience and experience != "Not specified":
                embeddings["experience"] = embedding_service.generate_single_embedding(experience)
            
            # Step 4: Store in database
            logger.info("💾 Step 4: Storing in database")
            cv_id = str(uuid.uuid4())
            qdrant_utils = get_qdrant_utils()
            
            cv_data = {
                "filename": filename,
                "extracted_text": parsed_result["raw_text"],
                "structured_info": standardized_data
            }
            
            stored_cv_id = qdrant_utils.store_cv_embeddings(cv_id, embeddings, cv_data)
            
            logger.info(f"✅ CV processed successfully: {stored_cv_id}")
            
            return JSONResponse({
                "status": "success",
                "message": f"CV '{filename}' processed successfully",
                "cv_id": stored_cv_id,
                "filename": filename,
                "standardized_data": standardized_data,
                "processing_stats": {
                    "file_size": file_size,
                    "text_length": len(parsed_result["clean_text"]),
                    "skills_count": len(standardized_data.get("skills", [])),
                    "responsibilities_count": len(standardized_data.get("responsibilities", [])),
                    "embeddings_generated": len(embeddings)
                }
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CV upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CV processing failed: {str(e)}")

@router.get("/cvs")
async def list_cvs() -> JSONResponse:
    """
    List all processed CVs in the database.
    Returns comprehensive metadata for each CV.
    """
    try:
        logger.info("📋 Listing all CVs")
        
        qdrant_utils = get_qdrant_utils()
        cvs = qdrant_utils.list_documents("cv")
        
        # Enhance CV data with additional metadata
        enhanced_cvs = []
        for cv in cvs:
            enhanced_cv = {
                "id": cv["id"],
                "filename": cv["filename"],
                "upload_date": cv["upload_date"],
                "full_name": cv.get("full_name", "Not specified"),
                "email": cv.get("email", "Not specified"),
                "phone": cv.get("phone", "Not specified"),
                "job_title": cv.get("job_title", "Not specified"),
                "years_of_experience": cv.get("years_of_experience", "Not specified"),
                "skills_count": len(cv.get("skills", [])),
                "skills": cv.get("skills", []),
                "text_length": len(cv.get("extracted_text", "")),
                "has_structured_data": bool(cv.get("structured_info"))
            }
            enhanced_cvs.append(enhanced_cv)
        
        # Sort by upload date (newest first)
        enhanced_cvs.sort(key=lambda x: x["upload_date"], reverse=True)
        
        logger.info(f"📋 Found {len(enhanced_cvs)} CVs")
        
        return JSONResponse({
            "status": "success",
            "count": len(enhanced_cvs),
            "cvs": enhanced_cvs
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to list CVs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list CVs: {str(e)}")

@router.get("/cv/{cv_id}")
async def get_cv_details(cv_id: str) -> JSONResponse:
    """
    Get detailed information about a specific CV.
    Includes structured data, embeddings info, and processing metadata.
    """
    try:
        logger.info(f"🔍 Getting details for CV: {cv_id}")
        
        qdrant_utils = get_qdrant_utils()
        cv_data = qdrant_utils.retrieve_document(cv_id, "cv")
        
        if not cv_data:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        
        # Get embeddings info
        embeddings = qdrant_utils.retrieve_embeddings(cv_id, "cv")
        embeddings_info = {}
        
        if embeddings:
            embeddings_info = {
                "skills_embeddings": len(embeddings.get("skills", {})),
                "responsibilities_embeddings": len(embeddings.get("responsibilities", {})),
                "has_title_embedding": "title" in embeddings,
                "has_experience_embedding": "experience" in embeddings
            }
        
        # Structure response
        response_data = {
            "id": cv_id,
            "filename": cv_data.get("filename", "Unknown"),
            "upload_date": cv_data.get("upload_date", "Unknown"),
            "document_type": cv_data.get("document_type", "cv"),
            "personal_info": {
                "full_name": cv_data.get("full_name", "Not specified"),
                "email": cv_data.get("email", "Not specified"),
                "phone": cv_data.get("phone", "Not specified")
            },
            "professional_info": {
                "job_title": cv_data.get("job_title", "Not specified"),
                "years_of_experience": cv_data.get("years_of_experience", "Not specified"),
                "skills": cv_data.get("skills", []),
                "responsibilities": cv_data.get("responsibilities", [])
            },
            "text_info": {
                "extracted_text_length": len(cv_data.get("extracted_text", "")),
                "extracted_text_preview": cv_data.get("extracted_text", "")[:500] + "..." if len(cv_data.get("extracted_text", "")) > 500 else cv_data.get("extracted_text", "")
            },
            "embeddings_info": embeddings_info,
            "structured_info": cv_data.get("structured_info", {}),
            "processing_metadata": cv_data.get("structured_info", {}).get("processing_metadata", {})
        }
        
        logger.info(f"✅ Retrieved CV details: {cv_id}")
        
        return JSONResponse({
            "status": "success",
            "cv": response_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get CV details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get CV details: {str(e)}")

@router.delete("/cv/{cv_id}")
async def delete_cv(cv_id: str) -> JSONResponse:
    """
    Delete a CV and all its associated data.
    Removes from all collections: main document, skills, and responsibilities.
    """
    try:
        logger.info(f"🗑️ Deleting CV: {cv_id}")
        
        qdrant_utils = get_qdrant_utils()
        
        # Check if CV exists
        cv_data = qdrant_utils.retrieve_document(cv_id, "cv")
        if not cv_data:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        
        # Delete CV and all associated embeddings
        success = qdrant_utils.delete_document(cv_id, "cv")
        
        if success:
            logger.info(f"✅ CV deleted successfully: {cv_id}")
            
            return JSONResponse({
                "status": "success",
                "message": f"CV '{cv_data.get('filename', cv_id)}' deleted successfully",
                "deleted_cv_id": cv_id
            })
        else:
            raise HTTPException(status_code=500, detail="Failed to delete CV")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete CV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete CV: {str(e)}")

@router.post("/cv/{cv_id}/reprocess")
async def reprocess_cv(cv_id: str) -> JSONResponse:
    """
    Reprocess an existing CV with updated algorithms.
    Useful when LLM prompts or embedding models are updated.
    """
    try:
        logger.info(f"🔄 Reprocessing CV: {cv_id}")
        
        qdrant_utils = get_qdrant_utils()
        
        # Get existing CV data
        cv_data = qdrant_utils.retrieve_document(cv_id, "cv")
        if not cv_data:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        
        # Get original extracted text
        original_text = cv_data.get("extracted_text", "")
        if not original_text:
            raise HTTPException(status_code=400, detail="No extracted text found for reprocessing")
        
        filename = cv_data.get("filename", "reprocessed_cv.txt")
        
        # Step 1: Re-standardize with current LLM
        logger.info("🧠 Re-standardizing with current LLM")
        llm_service = get_llm_service()
        standardized_data = llm_service.standardize_cv(original_text, filename)
        
        # Step 2: Re-generate embeddings
        logger.info("🔥 Re-generating embeddings")
        embedding_service = get_embedding_service()
        
        embeddings = {}
        # Skills embeddings
        if standardized_data.get("skills"):
            embeddings["skills"] = embedding_service.generate_skill_embeddings(
                standardized_data["skills"]
            )
        
        # Responsibilities embeddings
        if standardized_data.get("responsibilities"):
            embeddings["responsibilities"] = embedding_service.generate_responsibility_embeddings(
                standardized_data["responsibilities"]
            )
        
        # Title embedding
        if standardized_data.get("job_title") and standardized_data["job_title"] != "Not specified":
            embeddings["title"] = embedding_service.generate_single_embedding(
                standardized_data["job_title"]
            )
        
        # Experience embedding
        experience = standardized_data.get("experience_years", "")
        if experience and experience != "Not specified":
            embeddings["experience"] = embedding_service.generate_single_embedding(experience)
        
        # Step 3: Update in database
        logger.info("💾 Updating in database")
        updated_cv_data = {
            "filename": filename,
            "extracted_text": original_text,
            "structured_info": standardized_data
        }
        
        # Delete old data first
        qdrant_utils.delete_document(cv_id, "cv")
        
        # Store updated data with same ID
        qdrant_utils.store_cv_embeddings(cv_id, embeddings, updated_cv_data)
        
        logger.info(f"✅ CV reprocessed successfully: {cv_id}")
        
        return JSONResponse({
            "status": "success",
            "message": f"CV '{filename}' reprocessed successfully",
            "cv_id": cv_id,
            "updated_data": standardized_data,
            "processing_stats": {
                "skills_count": len(standardized_data.get("skills", [])),
                "responsibilities_count": len(standardized_data.get("responsibilities", [])),
                "embeddings_generated": len(embeddings)
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CV reprocessing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CV reprocessing failed: {str(e)}")

@router.get("/cv/{cv_id}/embeddings")
async def get_cv_embeddings_info(cv_id: str) -> JSONResponse:
    """
    Get detailed embeddings information for a CV.
    Useful for debugging and understanding the embedding structure.
    """
    try:
        logger.info(f"🔍 Getting embeddings info for CV: {cv_id}")
        
        qdrant_utils = get_qdrant_utils()
        
        # Check if CV exists
        cv_data = qdrant_utils.retrieve_document(cv_id, "cv")
        if not cv_data:
            raise HTTPException(status_code=404, detail=f"CV not found: {cv_id}")
        
        # Get embeddings
        embeddings = qdrant_utils.retrieve_embeddings(cv_id, "cv")
        
        if not embeddings:
            return JSONResponse({
                "status": "success",
                "cv_id": cv_id,
                "embeddings_found": False,
                "message": "No embeddings found for this CV"
            })
        
        # Analyze embeddings
        embeddings_info = {
            "cv_id": cv_id,
            "filename": cv_data.get("filename", "Unknown"),
            "embeddings_found": True,
            "skills": {
                "count": len(embeddings.get("skills", {})),
                "skills_list": list(embeddings.get("skills", {}).keys()),
                "embedding_dimension": len(list(embeddings.get("skills", {}).values())[0]) if embeddings.get("skills") else 0
            },
            "responsibilities": {
                "count": len(embeddings.get("responsibilities", {})),
                "responsibilities_list": [resp[:100] + "..." if len(resp) > 100 else resp for resp in embeddings.get("responsibilities", {}).keys()],
                "embedding_dimension": len(list(embeddings.get("responsibilities", {}).values())[0]) if embeddings.get("responsibilities") else 0
            },
            "title_embedding": "title" in embeddings,
            "experience_embedding": "experience" in embeddings,
            "total_embeddings": sum([
                len(embeddings.get("skills", {})),
                len(embeddings.get("responsibilities", {})),
                1 if "title" in embeddings else 0,
                1 if "experience" in embeddings else 0
            ])
        }
        
        logger.info(f"✅ Retrieved embeddings info for CV: {cv_id}")
        
        return JSONResponse({
            "status": "success",
            "embeddings_info": embeddings_info
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get CV embeddings info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get CV embeddings info: {str(e)}")

@router.post("/standardize-cv")
async def standardize_cv_text(request: StandardizeCVRequest) -> JSONResponse:
    """
    Standardize CV text using LLM without storing to database.
    Used by frontend for text-only processing and analysis.
    """
    try:
        logger.info(f"📄 Standardizing CV text: {request.cv_filename}")
        
        # Validate input
        if not request.cv_text or not request.cv_text.strip():
            raise HTTPException(status_code=400, detail="CV text cannot be empty")
        
        if len(request.cv_text) > 50000:  # 50KB text limit
            raise HTTPException(status_code=400, detail="CV text too long (max 50KB)")
        
        # Step 1: Standardize with LLM
        logger.info("🧠 Standardizing CV with LLM")
        llm_service = get_llm_service()
        standardized_data = llm_service.standardize_cv(request.cv_text, request.cv_filename)
        
        # Step 2: Generate embeddings for response (optional analysis)
        logger.info("🔥 Generating embeddings for analysis")
        embedding_service = get_embedding_service()
        
        embeddings_info = {}
        # Skills embeddings info
        if standardized_data.get("skills"):
            skills_embeddings = embedding_service.generate_skill_embeddings(standardized_data["skills"])
            embeddings_info["skills_count"] = len(skills_embeddings)
            embeddings_info["skills_dimension"] = len(list(skills_embeddings.values())[0]) if skills_embeddings else 0
        
        # Responsibilities embeddings info
        if standardized_data.get("responsibilities"):
            resp_embeddings = embedding_service.generate_responsibility_embeddings(standardized_data["responsibilities"])
            embeddings_info["responsibilities_count"] = len(resp_embeddings)
            embeddings_info["responsibilities_dimension"] = len(list(resp_embeddings.values())[0]) if resp_embeddings else 0
        
        logger.info(f"✅ CV text standardized successfully: {request.cv_filename}")
        
        return JSONResponse({
            "status": "success",
            "message": f"CV '{request.cv_filename}' standardized successfully",
            "filename": request.cv_filename,
            "standardized_data": standardized_data,
            "processing_stats": {
                "input_text_length": len(request.cv_text),
                "skills_count": len(standardized_data.get("skills", [])),
                "responsibilities_count": len(standardized_data.get("responsibilities", [])),
                "embeddings_info": embeddings_info
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CV text standardization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CV standardization failed: {str(e)}")
