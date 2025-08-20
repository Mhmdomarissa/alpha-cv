"""
Batch Extraction Routes - Ultra-Efficient GPT Processing
GPT ONLY does extraction/standardization - NO matching!
Supports 1 GPT call for all CVs + 1 GPT call for JD = 2 total calls
"""
import logging
import time
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from pydantic import BaseModel

from app.utils.gpt_batch_extractor import (
    extract_and_standardize_cvs_batch,
    extract_and_standardize_jd,
    set_gpt_model,
    get_current_gpt_model
)
from app.utils.smart_cache import get_cache_stats, cache_health_check, clear_cache

logger = logging.getLogger(__name__)

router = APIRouter()

class BatchExtractionRequest(BaseModel):
    """Request for batch CV + JD extraction."""
    jd_text: str
    cv_texts: List[str]
    cv_filenames: List[str] = None
    jd_filename: str = "job_description.txt"
    gpt_model: str = "gpt-5-nano"  # Optimized default

class CVBatchRequest(BaseModel):
    """Request for CV batch extraction only."""
    cv_texts: List[str]
    cv_filenames: List[str] = None
    gpt_model: str = "gpt-5-nano"

class JDExtractionRequest(BaseModel):
    """Request for JD extraction only."""
    jd_text: str
    jd_filename: str = "job_description.txt"
    gpt_model: str = "gpt-5-nano"

@router.post("/extract-batch-all")
async def extract_batch_all(request: BatchExtractionRequest) -> JSONResponse:
    """
    ULTRA-EFFICIENT: Extract and standardize ALL documents in 2 GPT calls total.
    
    - 1 GPT call for ALL CVs (batch processing)
    - 1 GPT call for JD
    - Total: 2 GPT calls regardless of CV count
    - GPT ONLY does extraction - NO matching
    """
    start_time = time.time()
    
    try:
        logger.info(f"🚀 Starting ULTRA-EFFICIENT batch extraction")
        logger.info(f"📄 Processing {len(request.cv_texts)} CVs + 1 JD with {request.gpt_model}")
        
        # Validate input
        if not request.jd_text or not request.jd_text.strip():
            raise HTTPException(status_code=400, detail="JD text is required")
        
        if not request.cv_texts or len(request.cv_texts) == 0:
            raise HTTPException(status_code=400, detail="At least one CV text is required")
        
        if len(request.cv_texts) > 50:  # Reasonable batch limit
            raise HTTPException(status_code=400, detail="Maximum 50 CVs per batch")
        
        # Set GPT model
        set_gpt_model(request.gpt_model)
        
        # Prepare filenames
        cv_filenames = request.cv_filenames or [f"cv_{i+1}.txt" for i in range(len(request.cv_texts))]
        
        # STEP 1: Extract ALL CVs in single GPT call
        logger.info(f"📄 STEP 1: Batch extracting {len(request.cv_texts)} CVs...")
        cv_extraction_start = time.time()
        
        standardized_cvs = extract_and_standardize_cvs_batch(
            cv_texts=request.cv_texts,
            filenames=cv_filenames,
            model=request.gpt_model
        )
        
        cv_extraction_time = time.time() - cv_extraction_start
        logger.info(f"✅ CV batch extraction completed in {cv_extraction_time:.2f}s")
        
        # STEP 2: Extract JD in single GPT call
        logger.info("📋 STEP 2: Extracting JD...")
        jd_extraction_start = time.time()
        
        standardized_jd = extract_and_standardize_jd(
            jd_text=request.jd_text,
            filename=request.jd_filename,
            model=request.gpt_model
        )
        
        jd_extraction_time = time.time() - jd_extraction_start
        logger.info(f"✅ JD extraction completed in {jd_extraction_time:.2f}s")
        
        total_time = time.time() - start_time
        
        # Prepare response
        response_data = {
            "status": "success",
            "extraction_method": "ultra_efficient_batch",
            "gpt_model_used": request.gpt_model,
            "processing_summary": {
                "total_documents": len(request.cv_texts) + 1,
                "total_cvs": len(request.cv_texts),
                "total_jds": 1,
                "total_gpt_calls": 2,  # Always 2 regardless of CV count!
                "total_processing_time": round(total_time, 2),
                "cv_extraction_time": round(cv_extraction_time, 2),
                "jd_extraction_time": round(jd_extraction_time, 2),
                "efficiency_gain": f"{len(request.cv_texts) + 1} documents in 2 GPT calls"
            },
            "standardized_jd": standardized_jd,
            "standardized_cvs": standardized_cvs,
            "extraction_metadata": {
                "cv_skills_extracted": sum(len(cv.get("skills", [])) for cv in standardized_cvs),
                "cv_responsibilities_extracted": sum(len(cv.get("responsibilities", [])) for cv in standardized_cvs),
                "jd_skills_extracted": len(standardized_jd.get("skills", [])),
                "jd_responsibilities_extracted": len(standardized_jd.get("responsibilities", [])),
                "total_data_points": (
                    sum(len(cv.get("skills", [])) + len(cv.get("responsibilities", [])) for cv in standardized_cvs) +
                    len(standardized_jd.get("skills", [])) + len(standardized_jd.get("responsibilities", []))
                )
            }
        }
        
        logger.info(f"🎉 ULTRA-EFFICIENT extraction completed!")
        logger.info(f"📊 Processed {len(request.cv_texts) + 1} documents in {total_time:.2f}s with 2 GPT calls")
        
        return JSONResponse(response_data)
        
    except Exception as e:
        logger.error(f"❌ Batch extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch extraction failed: {str(e)}")

@router.post("/extract-cvs-batch")
async def extract_cvs_batch(request: CVBatchRequest) -> JSONResponse:
    """
    Extract and standardize multiple CVs in 1 GPT call.
    GPT ONLY does extraction - NO matching.
    """
    start_time = time.time()
    
    try:
        logger.info(f"🚀 Starting CV batch extraction for {len(request.cv_texts)} CVs")
        
        # Validate input
        if not request.cv_texts or len(request.cv_texts) == 0:
            raise HTTPException(status_code=400, detail="At least one CV text is required")
        
        if len(request.cv_texts) > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 CVs per batch")
        
        # Set GPT model
        set_gpt_model(request.gpt_model)
        
        # Prepare filenames
        cv_filenames = request.cv_filenames or [f"cv_{i+1}.txt" for i in range(len(request.cv_texts))]
        
        # Extract ALL CVs in single GPT call
        standardized_cvs = extract_and_standardize_cvs_batch(
            cv_texts=request.cv_texts,
            filenames=cv_filenames,
            model=request.gpt_model
        )
        
        total_time = time.time() - start_time
        
        response_data = {
            "status": "success",
            "extraction_method": "cv_batch_only",
            "gpt_model_used": request.gpt_model,
            "processing_summary": {
                "total_cvs": len(request.cv_texts),
                "total_gpt_calls": 1,
                "processing_time": round(total_time, 2),
                "efficiency": f"{len(request.cv_texts)} CVs in 1 GPT call"
            },
            "standardized_cvs": standardized_cvs
        }
        
        logger.info(f"✅ CV batch extraction completed: {len(standardized_cvs)} CVs in {total_time:.2f}s")
        
        return JSONResponse(response_data)
        
    except Exception as e:
        logger.error(f"❌ CV batch extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CV batch extraction failed: {str(e)}")

@router.post("/extract-jd")
async def extract_jd(request: JDExtractionRequest) -> JSONResponse:
    """
    Extract and standardize Job Description in 1 GPT call.
    GPT ONLY does extraction - NO matching.
    """
    start_time = time.time()
    
    try:
        logger.info(f"🚀 Starting JD extraction for {request.jd_filename}")
        
        # Validate input
        if not request.jd_text or not request.jd_text.strip():
            raise HTTPException(status_code=400, detail="JD text is required")
        
        # Set GPT model
        set_gpt_model(request.gpt_model)
        
        # Extract JD
        standardized_jd = extract_and_standardize_jd(
            jd_text=request.jd_text,
            filename=request.jd_filename,
            model=request.gpt_model
        )
        
        total_time = time.time() - start_time
        
        response_data = {
            "status": "success",
            "extraction_method": "jd_single",
            "gpt_model_used": request.gpt_model,
            "processing_summary": {
                "total_gpt_calls": 1,
                "processing_time": round(total_time, 2)
            },
            "standardized_jd": standardized_jd
        }
        
        logger.info(f"✅ JD extraction completed in {total_time:.2f}s")
        
        return JSONResponse(response_data)
        
    except Exception as e:
        logger.error(f"❌ JD extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"JD extraction failed: {str(e)}")

@router.get("/batch-status")
async def get_batch_status() -> JSONResponse:
    """Get current batch processing configuration and status."""
    try:
        current_model = get_current_gpt_model()
        
        status = {
            "status": "operational",
            "extraction_mode": "batch_optimized",
            "current_gpt_model": current_model,
            "supported_models": ["gpt-4o-mini", "gpt-5-nano"],
            "batch_capabilities": {
                "max_cvs_per_batch": 50,
                "cv_batch_gpt_calls": 1,
                "jd_extraction_gpt_calls": 1,
                "total_gpt_calls_for_full_batch": 2
            },
            "efficiency_metrics": {
                "old_system_calls": "2 * num_documents",
                "new_system_calls": "2 (regardless of document count)",
                "efficiency_gain": "Up to 95% reduction in GPT calls"
            },
            "gpt_functionality": {
                "extraction_only": True,
                "standardization_only": True,
                "matching_analysis": False,
                "note": "GPT does ONLY extraction/standardization - matching done via vectors"
            }
        }
        
        return JSONResponse(status)
        
    except Exception as e:
        logger.error(f"❌ Status check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")

@router.post("/set-gpt-model")
async def set_gpt_model_endpoint(model: str) -> JSONResponse:
    """
    Set the GPT model for batch processing.
    
    Supported models:
    - gpt-4o-mini (default, good balance)
    - gpt-5-nano (when available, most efficient)
    """
    try:
        if model not in ["gpt-4o-mini", "gpt-5-nano"]:
            raise HTTPException(
                status_code=400, 
                detail="Invalid model. Supported: gpt-4o-mini, gpt-5-nano"
            )
        
        set_gpt_model(model)
        
        return JSONResponse({
            "status": "success",
            "message": f"GPT model set to {model}",
            "current_model": model,
            "optimized_for": "extraction_and_standardization_only"
        })
        
    except Exception as e:
        logger.error(f"❌ Model setting failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model setting failed: {str(e)}")

@router.get("/cache-stats")
async def get_cache_statistics() -> JSONResponse:
    """Get comprehensive cache statistics and performance metrics."""
    try:
        stats = get_cache_stats()
        health = cache_health_check()
        
        return JSONResponse({
            "status": "success",
            "cache_statistics": stats,
            "cache_health": health,
            "recommendations": _get_cache_recommendations(stats)
        })
        
    except Exception as e:
        logger.error(f"❌ Cache stats retrieval failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cache stats failed: {str(e)}")

@router.post("/clear-cache")
async def clear_document_cache() -> JSONResponse:
    """Clear all cached documents and reset statistics."""
    try:
        clear_cache()
        
        return JSONResponse({
            "status": "success",
            "message": "Document cache cleared successfully",
            "cache_cleared": True
        })
        
    except Exception as e:
        logger.error(f"❌ Cache clearing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cache clearing failed: {str(e)}")

def _get_cache_recommendations(stats: Dict[str, Any]) -> List[str]:
    """Generate cache optimization recommendations based on stats."""
    recommendations = []
    
    hit_rate = stats.get("hit_rate", 0)
    
    if hit_rate < 20:
        recommendations.append("Consider uploading similar documents to improve cache efficiency")
    elif hit_rate < 50:
        recommendations.append("Cache performance is moderate - good for typical usage patterns")
    else:
        recommendations.append("Excellent cache performance - significant cost savings achieved")
    
    if stats.get("cache_size", 0) > 100:
        recommendations.append("Consider periodic cache cleanup to free memory")
    
    if stats.get("total_requests", 0) > 1000:
        recommendations.append("High usage detected - consider implementing Redis for production")
    
    return recommendations
