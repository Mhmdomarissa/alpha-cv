"""
CV routes for handling CV uploads and management.
"""

import os
import logging
import time
import random
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

router = APIRouter(tags=["CV Management"])

# Constants
SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Request models for text-based processing
class StandardizeCVRequest(BaseModel):
    cv_text: str
    cv_filename: str = "cv.txt"

@router.post("/upload-cv")
async def upload_cv(files: List[UploadFile] = File(..., description="CV files to upload (single or multiple)")) -> JSONResponse:
    """
    Single route handles both single CV and multiple CVs upload.
    Complete pipeline: file validation -> text extraction -> PII removal -> LLM standardization -> embedding generation -> storage.
    """
    try:
        logger.info("---------- CV UPLOAD START ----------")
        logger.info(f"Number of files: {len(files)}")
        
        if len(files) == 1:
            logger.info("Processing single CV upload")
        else:
            logger.info(f"Processing multiple CV upload: {len(files)} files")
        
        # Process all files
        results = []
        processed_count = 0
        success_count = 0
        failed_count = 0
        
        for file in files:
            filename = file.filename
            content_type = file.content_type
            
            try:
                logger.info(f"Processing file: {filename}")
                
                # Validate file
                if not filename:
                    results.append({"filename": "unknown", "success": False, "error": "No filename provided"})
                    failed_count += 1
                    continue
                
                file_ext = os.path.splitext(filename)[1].lower()
                if file_ext not in SUPPORTED_EXTENSIONS:
                    results.append({"filename": filename, "success": False, "error": f"Unsupported file type: {file_ext}"})
                    failed_count += 1
                    continue
                
                # Read file content into memory first
                try:
                    await file.seek(0)
                    file_content = await file.read()
                    file_size = len(file_content)
                    logger.info(f"📁 Successfully read file: {filename}, size: {file_size} bytes")
                except Exception as e:
                    logger.error(f"❌ Failed to read uploaded file: {str(e)}")
                    results.append({"filename": filename, "success": False, "error": f"Failed to read file: {str(e)}"})
                    failed_count += 1
                    continue
                
                if file_size > MAX_FILE_SIZE:
                    logger.error(f"❌ File too large: {file_size} bytes (max: {MAX_FILE_SIZE})")
                    results.append({"filename": filename, "success": False, "error": f"File too large: {file_size} bytes"})
                    failed_count += 1
                    continue
                
                # Save file temporarily for processing
                import tempfile
                
                with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
                    tmp_file.write(file_content)
                    tmp_file_path = tmp_file.name
                
                try:
                    # Step 1: Extract text from document and PII
                    logger.info("---------- STEP 1: TEXT & PII EXTRACTION ----------")
                    parsing_service = get_parsing_service()
                    parsed_result = parsing_service.process_document(tmp_file_path, "cv")
                    
                    raw_text = parsed_result["raw_text"]
                    clean_text = parsed_result["clean_text"]
                    extracted_pii = parsed_result.get("extracted_pii", {})
                    
                    logger.info(f"Raw text length: {len(raw_text)} chars")
                    logger.info(f"Clean text length: {len(clean_text)} chars")
                    logger.info(f"Extracted PII: {extracted_pii}")
                    
                    # Step 2: Standardize with LLM using clean text
                    logger.info("---------- STEP 2: LLM STANDARDIZATION ----------")
                    llm_service = get_llm_service()
                    standardized_data = llm_service.standardize_cv(clean_text, filename)
                    
                    logger.info(f"Processing time: {standardized_data.get('processing_metadata', {}).get('processing_time', 'N/A')}s")
                    logger.info(f"Model used: {standardized_data.get('processing_metadata', {}).get('model_used', 'N/A')}")
                    
                    # Step 3: Add extracted PII back to standardized data
                    logger.info("---------- STEP 3: PII REINTEGRATION ----------")
                    if extracted_pii.get("email"):
                        standardized_data["email"] = extracted_pii["email"][0]
                    if extracted_pii.get("phone"):
                        standardized_data["phone"] = extracted_pii["phone"][0]
                    
                    # Step 4: Generate embeddings
                    logger.info("---------- STEP 4: EMBEDDING GENERATION ----------")
                    embedding_service = get_embedding_service()
                    embeddings = embedding_service.generate_document_embeddings(standardized_data)
                    
                    # Step 5: Store in Qdrant
                    logger.info("---------- STEP 5: QDRANT STORAGE ----------")
                    qdrant_utils = get_qdrant_utils()
                    cv_id = str(uuid.uuid4())
                    upload_date = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    file_ext = os.path.splitext(filename)[1].lower()
                    
                    # Store document
                    qdrant_utils.store_document(cv_id, "cv", filename, file_ext[1:] if file_ext else "txt", raw_text, upload_date)
                    
                    # Store structured data
                    qdrant_utils.store_structured_data(cv_id, "cv", standardized_data)
                    
                    # Store embeddings
                    qdrant_utils.store_embeddings_exact(cv_id, "cv", embeddings)
                    
                    logger.info(f"✅ Successfully processed {filename}")
                    success_count += 1
                    results.append({
                        "filename": filename,
                        "success": True,
                        "cv_id": cv_id,
                        "extracted_text": clean_text,
                        "standardized_data": standardized_data,
                        "processing_metadata": {
                            "raw_text_length": len(raw_text),
                            "clean_text_length": len(clean_text),
                            "skills_count": len(standardized_data.get("skills", [])),
                            "responsibilities_count": len(standardized_data.get("responsibilities", [])),
                            "embeddings_generated": len(embeddings)
                        }
                    })
                    
                except Exception as e:
                    logger.error(f"❌ Failed to process file {filename}: {str(e)}")
                    failed_count += 1
                    results.append({
                        "filename": filename,
                        "success": False,
                        "error": str(e)
                    })
                finally:
                    # Clean up temporary file
                    if os.path.exists(tmp_file_path):
                        os.unlink(tmp_file_path)
                        logger.info(f"Cleaned up temporary file: {tmp_file_path}")
        
            except Exception as e:
                logger.error(f"❌ Failed to process file {filename}: {str(e)}")
                failed_count += 1
                results.append({
                    "filename": filename,
                    "success": False,
                    "error": str(e)
                })
        
        processed_count = success_count + failed_count
        
        logger.info("---------- CV UPLOAD SUMMARY ----------")
        logger.info(f"Files processed: {processed_count}")
        logger.info(f"Successful: {success_count}")
        logger.info(f"Failed: {failed_count}")
        logger.info("---------- CV UPLOAD END ----------")
        
        return JSONResponse({
            "status": "success" if failed_count == 0 else "partial_success" if success_count > 0 else "failed",
            "message": f"Processed {processed_count} files. {success_count} successful, {failed_count} failed.",
            "summary": {
                "processed": processed_count,
                "successful": success_count,
                "failed": failed_count
            },
            "results": results
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CV upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CV processing failed: {str(e)}")


# Functions continue below

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
                "job_title": cv.get("job_title", "Not specified"),
                "years_of_experience": cv.get("years_of_experience", "Not specified"),
                "skills_count": len(cv.get("skills", [])),
                "skills": cv.get("skills", []),
                "responsibilities_count": len(cv.get("responsibilities", [])),
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
        logger.info(f"🗑 Deleting CV: {cv_id}")
        
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
        embeddings = embedding_service.generate_document_embeddings(standardized_data)
        
        # Step 3: Update in database
        logger.info("💾 Updating in database")
        
        # Store document, structured data, and embeddings
        qdrant_utils.store_document(cv_id, filename, original_text, "cv")
        qdrant_utils.store_structured_data(cv_id, standardized_data, "cv")
        qdrant_utils.store_embeddings_exact(cv_id, embeddings, "cv")
        
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
                "count": len(embeddings.get("skill_vectors", [])),
                "embedding_dimension": len(embeddings.get("skill_vectors", [])[0]) if embeddings.get("skill_vectors") else 0
            },
            "responsibilities": {
                "count": len(embeddings.get("responsibility_vectors", [])),
                "embedding_dimension": len(embeddings.get("responsibility_vectors", [])[0]) if embeddings.get("responsibility_vectors") else 0
            },
            "title_embedding": "job_title_vector" in embeddings,
            "experience_embedding": "experience_vector" in embeddings,
            "total_embeddings": (
                len(embeddings.get("skill_vectors", [])) +
                len(embeddings.get("responsibility_vectors", [])) +
                (1 if "job_title_vector" in embeddings else 0) +
                (1 if "experience_vector" in embeddings else 0)
            )
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
        embeddings = embedding_service.generate_document_embeddings(standardized_data)
        
        embeddings_info = {
            "skills_count": len(embeddings.get("skill_vectors", [])),
            "responsibilities_count": len(embeddings.get("responsibility_vectors", [])),
            "total_vectors": (
                len(embeddings.get("skill_vectors", [])) +
                len(embeddings.get("responsibility_vectors", [])) +
                (1 if "job_title_vector" in embeddings else 0) +
                (1 if "experience_vector" in embeddings else 0)
            )
        }
        
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
