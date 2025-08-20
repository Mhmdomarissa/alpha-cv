"""
Optimized API routes for high-performance CV analysis
Target: 10-20 seconds for 100 CVs vs 1 JD
"""

import logging
import time
import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from pydantic import BaseModel
import uuid

from app.services.performance_optimized_service import get_optimized_service
from app.utils.gpt_extractor_unified import standardize_cv_unified, standardize_jd_unified

logger = logging.getLogger(__name__)

router = APIRouter()

class BulkAnalysisRequest(BaseModel):
    jd_text: str
    cv_texts: List[str]
    filenames: List[str] = None

class OptimizedMatchRequest(BaseModel):
    jd_text: str
    cv_text: str

@router.post("/bulk-analyze-optimized")
async def bulk_analyze_optimized(request: BulkAnalysisRequest) -> JSONResponse:
    """
    Ultra-fast bulk CV analysis endpoint.
    Processes multiple CVs against one JD in 10-20 seconds.
    """
    start_time = time.time()
    
    try:
        logger.info(f"🚀 Starting optimized bulk analysis: 1 JD vs {len(request.cv_texts)} CVs")
        
        # Validate input
        if not request.jd_text or not request.jd_text.strip():
            raise HTTPException(status_code=400, detail="Job description text is required")
        
        if not request.cv_texts or len(request.cv_texts) == 0:
            raise HTTPException(status_code=400, detail="At least one CV text is required")
        
        if len(request.cv_texts) > 200:
            raise HTTPException(status_code=400, detail="Maximum 200 CVs allowed per request")
        
        # Use optimized service
        optimized_service = get_optimized_service()
        
        # Perform ultra-fast matching
        results = optimized_service.perform_ultra_fast_matching(
            jd_text=request.jd_text,
            cv_texts=request.cv_texts,
            filenames=request.filenames
        )
        
        # Convert results to API format
        api_results = []
        for result in results:
            api_results.append({
                "cv_id": result.cv_id,
                "cv_filename": request.filenames[len(api_results)] if request.filenames and len(api_results) < len(request.filenames) else f"CV_{len(api_results)+1}",
                "overall_score": result.overall_score,
                "skills_score": result.breakdown["skills_score"],
                "experience_score": result.breakdown["experience_score"],
                "education_score": 100.0,  # TODO: Implement education matching when JD education requirements are available
                "title_score": result.breakdown["title_score"],
                "match_details": {
                    "overall_score": result.overall_score,
                    "breakdown": result.breakdown,
                    "explanation": result.explanation,
                    "skill_match_percentage": result.skill_match_percentage,
                    "responsibility_match_percentage": result.responsibility_match_percentage,
                    "title_similarity": result.title_similarity,
                    "experience_match": result.experience_match
                }
            })
        
        total_time = time.time() - start_time
        
        logger.info(f"🎉 Optimized bulk analysis completed in {total_time:.2f}s")
        logger.info(f"📊 Performance: {total_time/len(request.cv_texts):.3f}s per CV")
        
        return JSONResponse({
            "status": "success",
            "results": api_results,
            "processing_time": total_time,
            "performance_metrics": {
                "total_cvs": len(request.cv_texts),
                "time_per_cv": total_time / len(request.cv_texts),
                "cvs_per_second": len(request.cv_texts) / total_time,
                "optimization_version": "2.0"
            },
            "message": f"Processed {len(request.cv_texts)} CVs in {total_time:.2f} seconds"
        })
        
    except Exception as e:
        logger.error(f"❌ Optimized bulk analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/standardize-cv-optimized")
async def standardize_cv_optimized(request: OptimizedMatchRequest) -> JSONResponse:
    """
    Optimized CV standardization endpoint with exactly 20 skills and 10 responsibilities.
    """
    try:
        logger.info("📄 Starting optimized CV standardization...")
        start_time = time.time()
        
        if not request.cv_text or not request.cv_text.strip():
            raise HTTPException(status_code=400, detail="CV text is required")
        
        # Use optimized GPT processing
        result = standardize_cv_unified(request.cv_text, "cv_input.txt")
        
        # Validate output
        if len(result.get("skills", [])) != 20:
            logger.warning(f"⚠️ CV skills count: {len(result.get('skills', []))} (expected 20)")
        
        if len(result.get("responsibilities", [])) != 10:
            logger.warning(f"⚠️ CV responsibilities count: {len(result.get('responsibilities', []))} (expected 10)")
        
        processing_time = time.time() - start_time
        
        return JSONResponse({
            "status": "success",
            "cv_id": str(uuid.uuid4()),
            "filename": "cv_input.txt",
            "standardized_data": result,
            "processing_time": processing_time,
            "validation": {
                "skills_count": len(result.get("skills", [])),
                "responsibilities_count": len(result.get("responsibilities", [])),
                "meets_requirements": len(result.get("skills", [])) == 20 and len(result.get("responsibilities", [])) == 10
            },
            "message": "CV standardized successfully with optimized processing"
        })
        
    except Exception as e:
        logger.error(f"❌ Optimized CV standardization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CV standardization failed: {str(e)}")

@router.post("/standardize-jd-optimized")
async def standardize_jd_optimized(request: OptimizedMatchRequest) -> JSONResponse:
    """
    Optimized JD standardization endpoint with exactly 20 skills and 10 responsibilities.
    """
    try:
        logger.info("📋 Starting optimized JD standardization...")
        start_time = time.time()
        
        if not request.jd_text or not request.jd_text.strip():
            raise HTTPException(status_code=400, detail="JD text is required")
        
        # Use optimized GPT processing
        result = standardize_jd_unified(request.jd_text, "jd_input.txt")
        
        # Validate output
        if len(result.get("skills", [])) != 20:
            logger.warning(f"⚠️ JD skills count: {len(result.get('skills', []))} (expected 20)")
        
        if len(result.get("responsibility_sentences", [])) != 10:
            logger.warning(f"⚠️ JD responsibilities count: {len(result.get('responsibility_sentences', []))} (expected 10)")
        
        processing_time = time.time() - start_time
        
        return JSONResponse({
            "status": "success",
            "jd_id": str(uuid.uuid4()),
            "filename": "jd_input.txt",
            "standardized_data": result,
            "processing_time": processing_time,
            "validation": {
                "skills_count": len(result.get("skills", [])),
                "responsibilities_count": len(result.get("responsibility_sentences", [])),
                "meets_requirements": len(result.get("skills", [])) == 20 and len(result.get("responsibility_sentences", [])) == 10
            },
            "message": "JD standardized successfully with optimized processing"
        })
        
    except Exception as e:
        logger.error(f"❌ Optimized JD standardization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"JD standardization failed: {str(e)}")

@router.get("/performance-status")
async def get_performance_status() -> JSONResponse:
    """
    Get current performance optimization status and metrics.
    """
    try:
        optimized_service = get_optimized_service()
        
        # Test model performance
        start_time = time.time()
        test_embedding = optimized_service.embedding_service.get_embedding("performance test")
        embedding_time = time.time() - start_time
        
        return JSONResponse({
            "status": "operational",
            "optimization_version": "2.0",
            "performance_metrics": {
                "embedding_model": "all-mpnet-base-v2",
                "embedding_dimensions": len(test_embedding),
                "embedding_latency_ms": embedding_time * 1000,
                "cache_status": {
                    "jd_cache_size": len(optimized_service._jd_cache) if hasattr(optimized_service, '_jd_cache') else 0,
                    "cv_cache_size": len(optimized_service._cv_cache) if hasattr(optimized_service, '_cv_cache') else 0
                },
                "thread_pool_workers": 4,
                "batch_size": 32
            },
            "target_performance": {
                "100_cvs_vs_1_jd": "10-20 seconds",
                "single_cv_analysis": "0.1-0.2 seconds",
                "gpt_processing": "optimized with 800 tokens max"
            },
            "optimizations_applied": [
                "Connection reuse for OpenAI API",
                "Reduced token limits (800 vs 2000)",
                "Aggressive input truncation (1200 vs 4000 chars)",
                "JD caching for multiple CV analysis",
                "Parallel CV standardization",
                "Batch embedding processing",
                "Model warm-up on startup",
                "Optimized similarity thresholds"
            ]
        })
        
    except Exception as e:
        logger.error(f"❌ Performance status check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")

@router.post("/benchmark-performance")
async def benchmark_performance() -> JSONResponse:
    """
    Run a performance benchmark to measure current system speed.
    """
    try:
        logger.info("🏃 Starting performance benchmark...")
        
        # Sample data for benchmarking
        sample_jd = """
        Software Engineer Position
        We are looking for a skilled software engineer with experience in Python, JavaScript, React, and database management.
        Responsibilities include developing web applications, writing clean code, testing, and collaborating with team members.
        Requirements: 3+ years experience, Computer Science degree, strong problem-solving skills.
        """
        
        sample_cvs = [
            "John Doe - Software Engineer with 5 years Python and React experience. Built web applications and APIs.",
            "Jane Smith - Full-stack developer with JavaScript, Node.js, and database skills. 4 years experience.",
            "Bob Johnson - Frontend developer with React, CSS, HTML expertise. 3 years in web development.",
            "Alice Brown - Backend engineer with Python, Django, PostgreSQL experience. 6 years professional work.",
            "Charlie Wilson - DevOps engineer with AWS, Docker, Python automation skills. 4 years experience."
        ] * 4  # 20 CVs total for benchmark
        
        filenames = [f"CV_{i+1}.pdf" for i in range(len(sample_cvs))]
        
        optimized_service = get_optimized_service()
        
        # Run benchmark
        start_time = time.time()
        results = optimized_service.perform_ultra_fast_matching(
            jd_text=sample_jd,
            cv_texts=sample_cvs,
            filenames=filenames
        )
        total_time = time.time() - start_time
        
        # Calculate metrics
        cvs_per_second = len(sample_cvs) / total_time
        time_per_cv = total_time / len(sample_cvs)
        projected_100_cvs = 100 * time_per_cv
        
        logger.info(f"🎉 Benchmark completed: {len(sample_cvs)} CVs in {total_time:.2f}s")
        
        return JSONResponse({
            "status": "success",
            "benchmark_results": {
                "total_cvs": len(sample_cvs),
                "total_time_seconds": total_time,
                "time_per_cv_seconds": time_per_cv,
                "cvs_per_second": cvs_per_second,
                "projected_100_cvs_time": projected_100_cvs,
                "target_met": projected_100_cvs <= 20,
                "performance_grade": "Excellent" if projected_100_cvs <= 15 else "Good" if projected_100_cvs <= 20 else "Needs Improvement"
            },
            "sample_results": [
                {
                    "cv_filename": results[i].cv_id,
                    "overall_score": results[i].overall_score,
                    "processing_time": results[i].processing_time
                } for i in range(min(3, len(results)))  # Show first 3 results
            ],
            "message": f"Benchmark completed: {cvs_per_second:.1f} CVs/second, projected 100 CVs in {projected_100_cvs:.1f}s"
        })
        
    except Exception as e:
        logger.error(f"❌ Performance benchmark failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Benchmark failed: {str(e)}")
