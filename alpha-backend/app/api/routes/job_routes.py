import logging
import traceback
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import os
import uuid
from io import BytesIO
import docx
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import json
import time
from pydantic import BaseModel
from fastapi import BackgroundTasks
import asyncio

from app.utils.gpt_extractor import standardize_job_description_with_gpt, standardize_cv_with_gpt
from app.utils.qdrant_utils import save_jd_to_qdrant, list_jds, get_qdrant_client, save_cv_to_qdrant, list_cvs
from app.services.granular_matching_service import get_granular_matching_service
from app.utils.content_classifier import classify_document_content, validate_document_classification
from app.services.granular_matching_service import GranularMatchingService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg']
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

router = APIRouter()

# Request Models
class StandardizeAndMatchRequest(BaseModel):
    jd_text: str
    cv_text: str

class BulkCVUploadRequest(BaseModel):
    cv_text: str
    filenames: Optional[List[str]] = None

class CosineTopKMatchRequest(BaseModel):
    jd_id: str
    top_k: int = 5

class StandardizedMatchRequest(BaseModel):
    jd_id: str
    cv_id: str

# Utility Functions
def extract_text(file: UploadFile) -> str:
    """Extract text from uploaded file with enhanced error handling."""
    try:
        if file.filename.endswith(".pdf"):
            content = file.file.read()
            doc = fitz.open(stream=content, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text.strip()
        
        elif file.filename.endswith(".docx"):
            try:
                content = file.file.read()
                document = docx.Document(BytesIO(content))
                paragraphs = [p.text.strip() for p in document.paragraphs if p.text.strip()]
                tables_text = []
                for table in document.tables:
                    for row in table.rows:
                        row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                        if row_text:
                            tables_text.append(" | ".join(row_text))
                extracted_text = "\n".join(paragraphs + (["\n--- Tables ---"] + tables_text if tables_text else []))
                if not extracted_text.strip():
                    raise ValueError("No text could be extracted from DOCX file")
                return extracted_text
            except Exception as docx_error:
                logger.error(f"DOCX extraction failed for {file.filename}: {str(docx_error)}")
                raise ValueError(f"Failed to extract text from DOCX file {file.filename}. The file may be corrupted or protected.")
        
        elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')):
            content = file.file.read()
            image = Image.open(BytesIO(content))
            text = pytesseract.image_to_string(image)
            return text.strip()
        
        elif file.filename.lower().endswith(('.txt', '.text')):
            # Handle plain text files
            content = file.file.read()
            # Try different encodings
            try:
                text = content.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    text = content.decode('latin-1')
                except UnicodeDecodeError:
                    text = content.decode('utf-8', errors='ignore')
            return text.strip()
        
        else:
            raise ValueError(f"Unsupported file type: {file.filename}")
    
    except Exception as e:
        logger.error(f"Text extraction failed for {file.filename}: {str(e)}")
        raise ValueError(f"Failed to extract text from {file.filename}: {str(e)}")

# ============================================================================
# CORE API ENDPOINTS (Only the ones being used by frontend)
# ============================================================================

@router.post("/standardize-jd")
async def standardize_job_description(
    file: Optional[UploadFile] = File(None),
    jd_text: Optional[str] = Form(None)
) -> JSONResponse:
    """
    Standardize job description using GPT-4o-mini for improved matching accuracy.
    """
    try:
        # Extract text from file or use provided text
        if file:
            extracted_text = extract_text(file)
            filename = file.filename
        elif jd_text:
            extracted_text = jd_text
            filename = "text_input.txt"
        else:
            raise HTTPException(status_code=400, detail="Either file or jd_text must be provided")
        
        logger.info(f"🚀 Starting standardized JD processing for {filename}")
        
        # Use the standardized GPT function
        standardized_result = standardize_job_description_with_gpt(extracted_text, filename)
        
        # Save to Qdrant with standardized data
        jd_id = save_jd_to_qdrant(extracted_text, json.dumps(standardized_result), filename)
        
        logger.info(f"✅ Successfully processed standardized JD {filename} (ID: {jd_id})")
        
        return JSONResponse({
            "status": "success",
            "jd_id": jd_id,
            "filename": filename,
            "standardized_data": standardized_result,
            "message": f"Job description {filename} standardized and saved successfully"
        })
        
    except Exception as e:
        logger.error(f"JD standardization failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"JD standardization failed: {str(e)}")

@router.post("/standardize-cv")
async def standardize_cv(file: UploadFile = File(...)) -> JSONResponse:
    """
    Standardize CV using GPT-4o-mini for improved matching accuracy.
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {file_ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
            )
        
        # Check file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        logger.info(f"🚀 Starting standardized CV processing for {file.filename}")
        
        # Extract text
        extracted_text = extract_text(file)
        
        # Use the standardized GPT function
        standardized_result = standardize_cv_with_gpt(extracted_text, file.filename)
        
        # Save to Qdrant with standardized data
        cv_id = save_cv_to_qdrant(extracted_text, json.dumps(standardized_result), file.filename)
        
        logger.info(f"✅ Successfully processed standardized CV {file.filename} (ID: {cv_id})")
        
        return JSONResponse({
            "status": "success",
            "message": f"CV standardized successfully",
            "cv_id": cv_id,
            "filename": file.filename,
            "standardized_data": standardized_result,
            "extracted_text": extracted_text,
            "processing_method": "standardized_gpt"
        })
        
    except Exception as e:
        logger.error(f"❌ Error in standardized CV processing: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to standardize CV: {str(e)}")

@router.get("/list-jds")
async def list_job_descriptions() -> JSONResponse:
    """List all job descriptions in the database."""
    try:
        jds = list_jds()
        return JSONResponse({
            "status": "success",
            "count": len(jds),
            "jds": jds
        })
    except Exception as e:
        logger.error(f"Failed to list JDs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list job descriptions: {str(e)}")

@router.get("/list-cvs")
async def list_cvs_endpoint() -> JSONResponse:
    """List all CVs in the database."""
    try:
        cvs = list_cvs()
        return JSONResponse({
            "status": "success",
            "count": len(cvs),
            "cvs": cvs
        })
    except Exception as e:
        logger.error(f"Failed to list CVs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list CVs: {str(e)}")

@router.post("/standardize-and-match-text")
async def standardize_and_match_text(
    request: StandardizeAndMatchRequest,
    background_tasks: BackgroundTasks
):
    """
    🚀 PERFORMANCE OPTIMIZATION: Parallel CV processing endpoint
    Standardize and match multiple CVs against a JD simultaneously.
    """
    try:
        logger.info(f"🚀 Starting parallel CV analysis: {len(request.cv_texts)} CVs")
        start_time = time.time()
        
        # Validate inputs
        if not request.jd_text or not request.cv_texts:
            raise HTTPException(status_code=400, detail="JD text and CV texts are required")
        
        # 🚀 PERFORMANCE OPTIMIZATION: Process CVs in parallel batches
        max_concurrency = 3  # Process 3 CVs simultaneously
        results = []
        
        # Process CVs in batches for optimal performance
        for i in range(0, len(request.cv_texts), max_concurrency):
            batch = request.cv_texts[i:i + max_concurrency]
            batch_start = time.time()
            
            logger.info(f"📦 Processing batch {i//max_concurrency + 1}: CVs {i+1}-{min(i+max_concurrency, len(request.cv_texts))}")
            
            # Process batch in parallel
            batch_tasks = []
            for j, cv_text in enumerate(batch):
                cv_index = i + j
                task = process_single_cv_parallel(
                    cv_text=cv_text,
                    jd_text=request.jd_text,
                    cv_index=cv_index,
                    total_cvs=len(request.cv_texts)
                )
                batch_tasks.append(task)
            
            # Wait for batch to complete
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            # Process batch results
            for j, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    logger.error(f"❌ CV {i+j+1} processing failed: {str(result)}")
                    # Create fallback result to maintain workflow
                    fallback_result = create_fallback_cv_result(
                        cv_text=request.cv_texts[i+j],
                        cv_index=i+j,
                        error=str(result)
                    )
                    results.append(fallback_result)
                else:
                    results.append(result)
            
            batch_time = time.time() - batch_start
            logger.info(f"✅ Batch {i//max_concurrency + 1} completed in {batch_time:.2f}s")
        
        total_time = time.time() - start_time
        logger.info(f"🎉 All {len(request.cv_texts)} CVs processed in {total_time:.2f}s")
        
        return {
            "success": True,
            "results": results,
            "processing_time": total_time,
            "cv_count": len(request.cv_texts),
            "optimization": "parallel_processing"
        }
        
    except Exception as e:
        logger.error(f"❌ Parallel CV analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

async def process_single_cv_parallel(
    cv_text: str, 
    jd_text: str, 
    cv_index: int, 
    total_cvs: int
) -> Dict[str, Any]:
    """
    Process a single CV in parallel with optimized performance.
    """
    try:
        logger.info(f"🔄 Processing CV {cv_index + 1}/{total_cvs}")
        
        # Standardize CV using GPT
        cv_standardized = await standardize_cv_text_async(cv_text)
        
        # Standardize JD using GPT
        jd_standardized = await standardize_jd_text_async(jd_text)
        
        # Calculate matching scores using optimized embedding service
        matching_service = GranularMatchingService()
        match_result = await matching_service.calculate_match_score_async(
            jd_standardized, cv_standardized
        )
        
        # Add metadata
        match_result["cv_index"] = cv_index + 1
        match_result["total_cvs"] = total_cvs
        match_result["processing_metadata"]["optimization"] = "parallel_processing"
        
        logger.info(f"✅ CV {cv_index + 1} processed successfully")
        return match_result
        
    except Exception as e:
        logger.error(f"❌ CV {cv_index + 1} processing failed: {str(e)}")
        raise e

async def standardize_cv_text_async(cv_text: str) -> Dict[str, Any]:
    """
    Asynchronously standardize CV text using GPT.
    """
    try:
        # Run GPT standardization in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, 
            standardize_cv_with_gpt, 
            cv_text, 
            "cv_text_input.txt"
        )
        return result
    except Exception as e:
        logger.error(f"CV standardization failed: {str(e)}")
        raise e

async def standardize_jd_text_async(jd_text: str) -> Dict[str, Any]:
    """
    Asynchronously standardize JD text using GPT.
    """
    try:
        # Run GPT standardization in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, 
            standardize_job_description_with_gpt, 
            jd_text, 
            "jd_text_input.txt"
        )
        return result
    except Exception as e:
        logger.error(f"JD standardization failed: {str(e)}")
        raise e

def create_fallback_cv_result(cv_text: str, cv_index: int, error: str) -> Dict[str, Any]:
    """
    Create a fallback result when CV processing fails to maintain workflow continuity.
    """
    return {
        "cv_id": f"fallback-{cv_index}-{int(time.time())}",
        "cv_filename": f"cv_{cv_index + 1}.txt",
        "overall_score": 0.0,
        "skills_score": 0.0,
        "experience_score": 0.0,
        "education_score": 0.0,
        "title_score": 0.0,
        "standardized_cv": {
            "skills": [],
            "experience": "",
            "responsibilities": [],
            "years_of_experience": "Unknown",
            "job_title": "Unknown",
            "filename": f"cv_{cv_index + 1}.txt",
            "standardization_method": "fallback",
            "processing_metadata": {
                "gpt_model_used": "none",
                "processing_time": 0.0,
                "extraction_method": "fallback",
                "standardization_version": "2.0",
                "error": error
            }
        },
        "match_details": {
            "overall_score": 0.0,
            "breakdown": {
                "skills_score": 0.0,
                "experience_score": 0.0,
                "title_score": 0.0,
                "responsibility_score": 0.0
            },
            "explanation": f"Processing failed: {error}",
            "jd_data": {},
            "cv_data": {},
            "detailed_analysis": {}
        },
        "cv_index": cv_index + 1,
        "total_cvs": 1,
        "processing_metadata": {
            "optimization": "parallel_processing",
            "status": "failed",
            "error": error
        }
    }

@router.post("/bulk-upload-cvs")
async def bulk_upload_cvs(request: BulkCVUploadRequest):
    """
    Upload and standardize multiple CVs at once with real GPT-4o-mini processing.
    """
    try:
        logger.info(f"Starting bulk CV upload: {len(request.cv_texts)} CVs")
        
        results = []
        failed_uploads = []
        
        for i, cv_text in enumerate(request.cv_texts):
            try:
                # Get filename or use default
                filename = f"bulk_cv_{i+1}.txt"
                if request.filenames and i < len(request.filenames):
                    filename = request.filenames[i]
                
                logger.info(f"Processing CV {i+1}/{len(request.cv_texts)}: {filename}")
                
                # Standardize with GPT-4o-mini
                standardized_data = standardize_cv_with_gpt(cv_text, filename)
                
                # Save to Qdrant with embedding
                cv_id = save_cv_to_qdrant(
                    extracted_text=cv_text,
                    structured_info=standardized_data,
                    filename=filename
                )
                
                if cv_id:
                    results.append({
                        "cv_id": cv_id,
                        "filename": filename,
                        "status": "success",
                        "standardized_data": standardized_data
                    })
                    logger.info(f"✅ CV {i+1} processed successfully: {cv_id}")
                else:
                    failed_uploads.append({
                        "index": i+1,
                        "filename": filename,
                        "error": "Failed to save to Qdrant"
                    })
                    
            except Exception as e:
                logger.error(f"Failed to process CV {i+1}: {str(e)}")
                failed_uploads.append({
                    "index": i+1,
                    "filename": filename if 'filename' in locals() else f"cv_{i+1}",
                    "error": str(e)
                })
        
        return JSONResponse(content={
            "status": "completed",
            "total_cvs": len(request.cv_texts),
            "successful_uploads": len(results),
            "failed_uploads": len(failed_uploads),
            "results": results,
            "failures": failed_uploads,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"Bulk CV upload failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Bulk upload failed: {str(e)}")

@router.post("/cosine-top-k-match")
async def cosine_top_k_match(request: CosineTopKMatchRequest):
    """
    Find top-k candidates for a JD using cosine similarity on embeddings.
    """
    try:
        logger.info(f"Finding top-{request.top_k} candidates for JD: {request.jd_id}")
        
        client = get_qdrant_client()
        
        # Get the JD and its embedding by point ID
        jd_points = client.retrieve(
            collection_name="jds",
            ids=[request.jd_id],
            with_payload=True,
            with_vectors=True
        )
        
        if not jd_points:
            raise HTTPException(status_code=404, detail="Job description not found")
        
        jd_point = jd_points[0]
        jd_embedding = jd_point.vector
        jd_payload = jd_point.payload
        
        logger.info(f"JD found: {jd_payload.get('filename', 'Unknown')}")
        
        # Use Qdrant's vector search to find similar CVs
        search_results = client.search(
            collection_name="cvs",
            query_vector=jd_embedding,
            limit=request.top_k,
            with_payload=True,
            with_vectors=True
        )
        
        top_candidates = []
        
        for result in search_results:
            cv_payload = result.payload
            cv_structured_info = cv_payload.get("structured_info", {})
            
            # Parse CV structured info
            if isinstance(cv_structured_info, str):
                cv_structured_info = json.loads(cv_structured_info)
            
            top_candidates.append({
                "cv_id": result.id,
                "filename": cv_payload.get("filename", "Unknown"),
                "cosine_similarity": float(result.score),
                "upload_date": cv_payload.get("upload_date", "Unknown"),
                "standardized_data": cv_structured_info
            })
        
        return JSONResponse({
            "status": "success",
            "jd_id": request.jd_id,
            "top_k": request.top_k,
            "candidates_found": len(top_candidates),
            "matches": top_candidates,
            "method": "cosine_similarity_with_custom_scoring"
        })
        
    except Exception as e:
        logger.error(f"Cosine matching failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Cosine matching failed: {str(e)}")

@router.post("/standardized-match")
async def calculate_standardized_match(request: StandardizedMatchRequest) -> JSONResponse:
    """
    Calculate match score between standardized job description and CV.
    """
    try:
        from qdrant_client import models
        
        jd_id = request.jd_id
        cv_id = request.cv_id
        
        logger.info(f"🔍 Calculating standardized match between JD {jd_id} and CV {cv_id}")
        
        # Get standardized data from Qdrant
        client = get_qdrant_client()
        
        # Get JD data
        jd_points = client.scroll(
            collection_name="jds",
            scroll_filter=models.Filter(
                must=[models.FieldCondition(key="id", match=models.MatchValue(value=jd_id))]
            ),
            limit=1
        )
        
        if not jd_points[0]:
            raise HTTPException(status_code=404, detail="Job description not found")
        
        jd_data = jd_points[0][0].payload
        jd_standardized = jd_data.get("structured_info", {})
        if isinstance(jd_standardized, str):
            jd_standardized = json.loads(jd_standardized)
        
        # Get CV data
        cv_points = client.scroll(
            collection_name="cvs",
            scroll_filter=models.Filter(
                must=[models.FieldCondition(key="id", match=models.MatchValue(value=cv_id))]
            ),
            limit=1
        )
        
        if not cv_points[0]:
            raise HTTPException(status_code=404, detail="CV not found")
        
        cv_data = cv_points[0][0].payload
        cv_standardized = cv_data.get("structured_info", {})
        if isinstance(cv_standardized, str):
            cv_standardized = json.loads(cv_standardized)
        
        # Simple scoring logic
        skills_match = 0.8  # Mock value
        experience_match = 0.7  # Mock value
        overall_score = (skills_match + experience_match) / 2
        
        logger.info(f"✅ Standardized match calculated: {overall_score:.2f}")
        
        return JSONResponse({
            "status": "success",
            "jd_id": jd_id,
            "cv_id": cv_id,
            "overall_score": overall_score * 100,
            "breakdown": {
                "skills_score": skills_match * 100,
                "experience_score": experience_match * 100
            },
            "jd_data": jd_standardized,
            "cv_data": cv_standardized
        })
        
    except Exception as e:
        logger.error(f"Standardized match failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Standardized match failed: {str(e)}")

@router.post("/re-extract-cv-text")
async def re_extract_cv_text(file: UploadFile = File(...)) -> JSONResponse:
    """
    Re-extract raw text from a CV file to fix corrupted raw data.
    """
    try:
        logger.info(f"Re-extracting text from {file.filename}")
        
        # Extract raw text only (no GPT processing)
        raw_text = extract_text(file)
        
        logger.info(f"Successfully re-extracted {len(raw_text)} characters from {file.filename}")
        
        return JSONResponse(content={
            "filename": file.filename,
            "raw_text": raw_text,
            "character_count": len(raw_text),
            "status": "success"
        })
        
    except Exception as e:
        logger.error(f"Error re-extracting text from {file.filename}: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Text re-extraction failed: {str(e)}"}
        )

@router.get("/audit-classifications")
async def audit_document_classifications() -> JSONResponse:
    """
    Audit all documents to identify misclassified CVs and JDs.
    """
    try:
        logger.info("Starting document classification audit...")
        
        # Get all CVs and JDs
        cvs_list = list_cvs()
        jds_list = list_jds()
        
        misclassifications = []
        audit_results = {
            "total_cvs": len(cvs_list),
            "total_jds": len(jds_list),
            "misclassified_count": 0,
            "cvs_in_jd_collection": 0,
            "jds_in_cv_collection": 0,
            "misclassifications": []
        }
        
        # Check CVs (should not be JDs)
        for cv in cvs_list:
            if cv.get('extracted_text') and cv.get('filename'):
                is_correct, actual_type, confidence = validate_document_classification(
                    cv['extracted_text'], 
                    cv['filename'], 
                    'cv'
                )
                
                if not is_correct and confidence > 0.7:
                    misclassification = {
                        "id": cv.get('id'),
                        "filename": cv['filename'],
                        "current_collection": "cvs",
                        "detected_type": actual_type,
                        "confidence": confidence,
                        "should_be_in": "jds" if actual_type == "jd" else "cvs"
                    }
                    misclassifications.append(misclassification)
                    audit_results["jds_in_cv_collection"] += 1
        
        # Check JDs (should not be CVs)
        for jd in jds_list:
            if jd.get('extracted_text') and jd.get('filename'):
                is_correct, actual_type, confidence = validate_document_classification(
                    jd['extracted_text'], 
                    jd['filename'], 
                    'jd'
                )
                
                if not is_correct and confidence > 0.7:
                    misclassification = {
                        "id": jd.get('id'),
                        "filename": jd['filename'],
                        "current_collection": "jds",
                        "detected_type": actual_type,
                        "confidence": confidence,
                        "should_be_in": "cvs" if actual_type == "cv" else "jds"
                    }
                    misclassifications.append(misclassification)
                    audit_results["cvs_in_jd_collection"] += 1
        
        audit_results["misclassified_count"] = len(misclassifications)
        audit_results["misclassifications"] = misclassifications
        
        logger.info(f"Classification audit completed: {audit_results['misclassified_count']} misclassifications found")
        
        return JSONResponse(content={
            "status": "success",
            "audit_results": audit_results,
            "summary": f"Found {audit_results['misclassified_count']} misclassified documents"
        })
        
    except Exception as e:
        logger.error(f"Error during classification audit: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Classification audit failed: {str(e)}"}
        )