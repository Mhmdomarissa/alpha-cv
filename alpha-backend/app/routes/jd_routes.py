"""
JD Routes - Consolidated Job Description API endpoints
Handles ALL Job Description operations: upload, processing, listing, and management.
Single responsibility: Job Description document management through REST API.
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
class StandardizeJDRequest(BaseModel):
    jd_text: str
    jd_filename: str = "jd.txt"

@router.post("/upload-jd")
async def upload_jd(
    file: Optional[UploadFile] = File(None),
    jd_text: Optional[str] = Form(None)
) -> JSONResponse:
    """
    Upload and process Job Description file or text.
    Complete pipeline: file validation -> text extraction -> PII removal -> LLM standardization -> embedding generation -> storage.
    """
    try:
        logger.info("---------- JD UPLOAD START ----------")
        
        # Determine input type and extract text
        if file:
            logger.info(f"Processing JD file upload: {file.filename}")
            
            # Validate file
            if not file.filename:
                logger.error("❌ No filename provided")
                raise HTTPException(status_code=400, detail="No filename provided")
            
            file_ext = os.path.splitext(file.filename)[1].lower()
            if file_ext not in SUPPORTED_EXTENSIONS:
                logger.error(f"❌ Unsupported file type: {file_ext}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {file_ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
                )
            
            # Check file size
            file.file.seek(0, 2)
            file_size = file.file.tell()
            file.file.seek(0)
            
            if file_size > MAX_FILE_SIZE:
                logger.error(f"❌ File too large: {file_size} bytes (max: {MAX_FILE_SIZE})")
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large: {file_size} bytes (max: {MAX_FILE_SIZE})"
                )
            
            # Save file temporarily for processing
            import tempfile
            import shutil
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
                file.file.seek(0)
                shutil.copyfileobj(file.file, tmp_file)
                tmp_file_path = tmp_file.name
            
            try:
                # Extract text from file with PII removal
                logger.info("---------- STEP 1: TEXT EXTRACTION & PII REMOVAL ----------")
                parsing_service = get_parsing_service()
                parsed_result = parsing_service.process_document(tmp_file_path, "jd")
                
                extracted_text = parsed_result["clean_text"]
                filename = file.filename
                
                logger.info(f"Extracted text length: {len(extracted_text)} chars")
                logger.info("PII removed from JD text")
                logger.info("--------------------------------------------------------")
                
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
                    
        elif jd_text:
            logger.info("Processing JD text input")
            logger.info("---------- STEP 1: TEXT PROCESSING & PII REMOVAL ----------")
            
            # Clean text input and remove PII
            parsing_service = get_parsing_service()
            extracted_text, _ = parsing_service.remove_pii_data(jd_text.strip())
            filename = "text_input.txt"
            
            logger.info(f"Clean text length: {len(extracted_text)} chars")
            logger.info("PII removed from JD text")
            logger.info("--------------------------------------------------------")
            
            if len(extracted_text) < 50:
                logger.error("❌ JD text too short")
                raise HTTPException(
                    status_code=400,
                    detail="JD text too short (minimum 50 characters required)"
                )
                
        else:
            logger.error("❌ No file or text provided")
            raise HTTPException(
                status_code=400,
                detail="Either file upload or jd_text must be provided"
            )
        
        # Step 2: Standardize with LLM
        logger.info("---------- STEP 2: LLM STANDARDIZATION ----------")
        logger.info("Sending clean text to LLM (PII removed)")
        logger.info("--------------------------------------------")
        
        llm_service = get_llm_service()
        standardized_data = llm_service.standardize_jd(extracted_text, filename)
        
        logger.info("---------- LLM RESPONSE RECEIVED ----------")
        logger.info(f"Processing time: {standardized_data.get('processing_metadata', {}).get('processing_time', 'N/A')}s")
        logger.info(f"Model used: {standardized_data.get('processing_metadata', {}).get('model_used', 'N/A')}")
        logger.info(f"Standardized data keys: {list(standardized_data.keys())}")
        logger.info("-----------------------------------------")
        
        # Step 3: Generate embeddings
        logger.info("---------- STEP 3: EMBEDDING GENERATION ----------")
        embedding_service = get_embedding_service()
        
        embeddings = {}
        # Skills embeddings (JDs should have exactly 20 skills)
        if standardized_data.get("skills"):
            logger.info(f"Generating embeddings for {len(standardized_data['skills'])} skills")
            embeddings["skills"] = embedding_service.generate_skill_embeddings(
                standardized_data["skills"]
            )
        
        # Responsibilities embeddings (JDs should have exactly 10 responsibilities)
        responsibilities = standardized_data.get("responsibilities", [])
        if not responsibilities:
            responsibilities = standardized_data.get("responsibility_sentences", [])
        if responsibilities:
            logger.info(f"Generating embeddings for {len(responsibilities)} responsibilities")
            embeddings["responsibilities"] = embedding_service.generate_responsibility_embeddings(
                responsibilities
            )
        
        # Title embedding
        if standardized_data.get("job_title") and standardized_data["job_title"] != "Not specified":
            logger.info(f"Generating embedding for job title: {standardized_data['job_title']}")
            embeddings["title"] = embedding_service.generate_single_embedding(
                standardized_data["job_title"]
            )
        
        # Experience embedding
        experience = standardized_data.get("experience_years", "")
        if experience and experience != "Not specified":
            logger.info(f"Generating embedding for experience: {experience}")
            embeddings["experience"] = embedding_service.generate_single_embedding(experience)
        
        logger.info(f"Total embeddings generated: {len(embeddings)}")
        logger.info("-------------------------------------------------")
        
        # Step 4: Store in database
        logger.info("---------- STEP 4: DATABASE STORAGE ----------")
        jd_id = str(uuid.uuid4())
        qdrant_utils = get_qdrant_utils()
        
        jd_data = {
            "filename": filename,
            "extracted_text": extracted_text,
            "structured_info": standardized_data
        }
        
        stored_jd_id = qdrant_utils.store_jd_embeddings(jd_id, embeddings, jd_data)
        
        # Store structured data for matching
        qdrant_utils.store_structured_data(jd_id, "jd", {
            "document_id": jd_id,
            "structured_info": standardized_data
        })
        
        logger.info(f"✅ JD processed successfully: {stored_jd_id}")
        logger.info("-----------------------------------------")
        
        return JSONResponse({
            "status": "success",
            "message": f"Job Description '{filename}' processed successfully",
            "jd_id": stored_jd_id,
            "filename": filename,
            "standardized_data": standardized_data,
            "processing_stats": {
                "text_length": len(extracted_text),
                "skills_count": len(standardized_data.get("skills", [])),
                "responsibilities_count": len(responsibilities),
                "embeddings_generated": len(embeddings)
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ JD upload failed: {str(e)}")
        logger.error("---------- JD UPLOAD FAILED ----------")
        raise HTTPException(status_code=500, detail=f"JD processing failed: {str(e)}")

@router.get("/jds")
async def list_jds() -> JSONResponse:
    """
    List all processed Job Descriptions in the database.
    Returns comprehensive metadata for each JD.
    """
    try:
        logger.info("📋 Listing all JDs")
        
        qdrant_utils = get_qdrant_utils()
        jds = qdrant_utils.list_documents("jd")
        
        # Enhance JD data with additional metadata
        enhanced_jds = []
        for jd in jds:
            enhanced_jd = {
                "id": jd["id"],
                "filename": jd["filename"],
                "upload_date": jd["upload_date"],
                "job_title": jd.get("job_title", "Not specified"),
                "years_of_experience": jd.get("years_of_experience", "Not specified"),
                "skills_count": len(jd.get("skills", [])),
                "skills": jd.get("skills", []),
                "responsibilities_count": len(jd.get("responsibility_sentences", [])),
                "text_length": len(jd.get("extracted_text", "")),
                "has_structured_data": bool(jd.get("structured_info"))
            }
            enhanced_jds.append(enhanced_jd)
        
        # Sort by upload date (newest first)
        enhanced_jds.sort(key=lambda x: x["upload_date"], reverse=True)
        
        logger.info(f"📋 Found {len(enhanced_jds)} JDs")
        
        return JSONResponse({
            "status": "success",
            "count": len(enhanced_jds),
            "jds": enhanced_jds
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to list JDs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list JDs: {str(e)}")

@router.get("/jd/{jd_id}")
async def get_jd_details(jd_id: str) -> JSONResponse:
    """
    Get detailed information about a specific Job Description.
    Includes structured data, embeddings info, and processing metadata.
    """
    try:
        logger.info(f"🔍 Getting details for JD: {jd_id}")
        
        qdrant_utils = get_qdrant_utils()
        jd_data = qdrant_utils.retrieve_document(jd_id, "jd")
        
        if not jd_data:
            raise HTTPException(status_code=404, detail=f"JD not found: {jd_id}")
        
        # Get embeddings info
        embeddings = qdrant_utils.retrieve_embeddings(jd_id, "jd")
        embeddings_info = {}
        
        if embeddings:
            embeddings_info = {
                "skills_embeddings": len(embeddings.get("skills", {})),
                "responsibilities_embeddings": len(embeddings.get("responsibilities", {})),
                "has_title_embedding": "title" in embeddings,
                "has_experience_embedding": "experience" in embeddings
            }
        
        # Get responsibilities (check both field names for compatibility)
        responsibilities = jd_data.get("responsibilities", [])
        if not responsibilities:
            responsibilities = jd_data.get("responsibility_sentences", [])
        
        # Structure response
        response_data = {
            "id": jd_id,
            "filename": jd_data.get("filename", "Unknown"),
            "upload_date": jd_data.get("upload_date", "Unknown"),
            "document_type": jd_data.get("document_type", "jd"),
            "job_requirements": {
                "job_title": jd_data.get("job_title", "Not specified"),
                "years_of_experience": jd_data.get("years_of_experience", "Not specified"),
                "skills": jd_data.get("skills", []),
                "responsibilities": responsibilities,
                "skills_count": len(jd_data.get("skills", [])),
                "responsibilities_count": len(responsibilities)
            },
            "text_info": {
                "extracted_text_length": len(jd_data.get("extracted_text", "")),
                "extracted_text_preview": jd_data.get("extracted_text", "")[:500] + "..." if len(jd_data.get("extracted_text", "")) > 500 else jd_data.get("extracted_text", "")
            },
            "embeddings_info": embeddings_info,
            "structured_info": jd_data.get("structured_info", {}),
            "processing_metadata": jd_data.get("structured_info", {}).get("processing_metadata", {})
        }
        
        logger.info(f"✅ Retrieved JD details: {jd_id}")
        
        return JSONResponse({
            "status": "success",
            "jd": response_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get JD details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get JD details: {str(e)}")

@router.delete("/jd/{jd_id}")
async def delete_jd(jd_id: str) -> JSONResponse:
    """
    Delete a Job Description and all its associated data.
    Removes from all collections: main document, skills, and responsibilities.
    """
    try:
        logger.info(f"🗑 Deleting JD: {jd_id}")
        
        qdrant_utils = get_qdrant_utils()
        
        # Check if JD exists
        jd_data = qdrant_utils.retrieve_document(jd_id, "jd")
        if not jd_data:
            raise HTTPException(status_code=404, detail=f"JD not found: {jd_id}")
        
        # Delete JD and all associated embeddings
        success = qdrant_utils.delete_document(jd_id, "jd")
        
        if success:
            logger.info(f"✅ JD deleted successfully: {jd_id}")
            
            return JSONResponse({
                "status": "success",
                "message": f"Job Description '{jd_data.get('filename', jd_id)}' deleted successfully",
                "deleted_jd_id": jd_id
            })
        else:
            raise HTTPException(status_code=500, detail="Failed to delete JD")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete JD: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete JD: {str(e)}")

@router.post("/jd/{jd_id}/reprocess")
async def reprocess_jd(jd_id: str) -> JSONResponse:
    """
    Reprocess an existing JD with updated algorithms.
    Useful when LLM prompts or embedding models are updated.
    """
    try:
        logger.info(f"🔄 Reprocessing JD: {jd_id}")
        
        qdrant_utils = get_qdrant_utils()
        
        # Get existing JD data
        jd_data = qdrant_utils.retrieve_document(jd_id, "jd")
        if not jd_data:
            raise HTTPException(status_code=404, detail=f"JD not found: {jd_id}")
        
        # Get original extracted text
        original_text = jd_data.get("extracted_text", "")
        if not original_text:
            raise HTTPException(status_code=400, detail="No extracted text found for reprocessing")
        
        filename = jd_data.get("filename", "reprocessed_jd.txt")
        
        # Step 1: Re-standardize with current LLM
        logger.info("🧠 Re-standardizing with current LLM")
        llm_service = get_llm_service()
        standardized_data = llm_service.standardize_jd(original_text, filename)
        
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
        responsibilities = standardized_data.get("responsibilities", [])
        if not responsibilities:
            responsibilities = standardized_data.get("responsibility_sentences", [])
        if responsibilities:
            embeddings["responsibilities"] = embedding_service.generate_responsibility_embeddings(
                responsibilities
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
        updated_jd_data = {
            "filename": filename,
            "extracted_text": original_text,
            "structured_info": standardized_data
        }
        
        # Delete old data first
        qdrant_utils.delete_document(jd_id, "jd")
        
        # Store updated data with same ID
        qdrant_utils.store_jd_embeddings(jd_id, embeddings, updated_jd_data)
        
        logger.info(f"✅ JD reprocessed successfully: {jd_id}")
        
        return JSONResponse({
            "status": "success",
            "message": f"Job Description '{filename}' reprocessed successfully",
            "jd_id": jd_id,
            "updated_data": standardized_data,
            "processing_stats": {
                "skills_count": len(standardized_data.get("skills", [])),
                "responsibilities_count": len(responsibilities),
                "embeddings_generated": len(embeddings)
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ JD reprocessing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"JD reprocessing failed: {str(e)}")

@router.get("/jd/{jd_id}/embeddings")
async def get_jd_embeddings_info(jd_id: str) -> JSONResponse:
    """
    Get detailed embeddings information for a Job Description.
    Useful for debugging and understanding the embedding structure.
    """
    try:
        logger.info(f"🔍 Getting embeddings info for JD: {jd_id}")
        
        qdrant_utils = get_qdrant_utils()
        
        # Check if JD exists
        jd_data = qdrant_utils.retrieve_document(jd_id, "jd")
        if not jd_data:
            raise HTTPException(status_code=404, detail=f"JD not found: {jd_id}")
        
        # Get embeddings
        embeddings = qdrant_utils.retrieve_embeddings(jd_id, "jd")
        
        if not embeddings:
            return JSONResponse({
                "status": "success",
                "jd_id": jd_id,
                "embeddings_found": False,
                "message": "No embeddings found for this JD"
            })
        
        # Analyze embeddings
        embeddings_info = {
            "jd_id": jd_id,
            "filename": jd_data.get("filename", "Unknown"),
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
        
        logger.info(f"✅ Retrieved embeddings info for JD: {jd_id}")
        
        return JSONResponse({
            "status": "success",
            "embeddings_info": embeddings_info
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get JD embeddings info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get JD embeddings info: {str(e)}")

@router.post("/standardize-jd")
async def standardize_jd_text(request: StandardizeJDRequest) -> JSONResponse:
    """
    Standardize JD text using LLM without storing to database.
    Used by frontend for text-only processing and analysis.
    """
    try:
        logger.info(f"📄 Standardizing JD text: {request.jd_filename}")
        
        # Validate input
        if not request.jd_text or not request.jd_text.strip():
            raise HTTPException(status_code=400, detail="JD text cannot be empty")
        
        if len(request.jd_text) > 50000:  # 50KB text limit
            raise HTTPException(status_code=400, detail="JD text too long (max 50KB)")
        
        # Step 1: Standardize with LLM
        logger.info("🧠 Standardizing JD with LLM")
        llm_service = get_llm_service()
        standardized_data = llm_service.standardize_jd(request.jd_text, request.jd_filename)
        
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
        responsibilities = standardized_data.get("responsibilities", [])
        if not responsibilities:
            responsibilities = standardized_data.get("responsibility_sentences", [])
        
        if responsibilities:
            resp_embeddings = embedding_service.generate_responsibility_embeddings(responsibilities)
            embeddings_info["responsibilities_count"] = len(resp_embeddings)
            embeddings_info["responsibilities_dimension"] = len(list(resp_embeddings.values())[0]) if resp_embeddings else 0
        
        logger.info(f"✅ JD text standardized successfully: {request.jd_filename}")
        
        return JSONResponse({
            "status": "success",
            "message": f"JD '{request.jd_filename}' standardized successfully",
            "filename": request.jd_filename,
            "standardized_data": standardized_data,
            "processing_stats": {
                "input_text_length": len(request.jd_text),
                "skills_count": len(standardized_data.get("skills", [])),
                "responsibilities_count": len(responsibilities),
                "embeddings_info": embeddings_info
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ JD text standardization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"JD standardization failed: {str(e)}")