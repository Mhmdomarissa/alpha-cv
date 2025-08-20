"""
Special Routes - Database Operations, Matching, and System Management
Handles matching operations, system health, and administrative functions.
Single responsibility: CV-JD matching and system management operations.
"""

import logging
import time
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.matching_service import get_matching_service
from app.services.embedding_service import get_embedding_service
from app.services.llm_service import get_llm_service
from app.services.parsing_service import get_parsing_service
from app.utils.qdrant_utils import get_qdrant_utils
from app.utils.cache import get_cache_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Request Models
class MatchRequest(BaseModel):
    cv_id: str
    jd_id: str

class BulkMatchRequest(BaseModel):
    jd_id: str
    cv_ids: List[str]
    top_k: Optional[int] = 10

class TopCandidatesRequest(BaseModel):
    jd_id: str
    limit: Optional[int] = 10

class TextMatchRequest(BaseModel):
    jd_text: str
    cv_text: str
    jd_filename: Optional[str] = "jd_input.txt"
    cv_filename: Optional[str] = "cv_input.txt"

@router.post("/match-cv-jd")
async def match_cv_jd(request: MatchRequest) -> JSONResponse:
    """
    Match a specific CV against a specific Job Description.
    Returns detailed matching analysis with scores and explanations.
    """
    try:
        logger.info(f"🎯 Matching CV {request.cv_id} against JD {request.jd_id}")
        
        matching_service = get_matching_service()
        result = matching_service.match_cv_against_jd(request.cv_id, request.jd_id)
        
        # Convert MatchResult dataclass to dictionary for JSON response
        response_data = {
            "status": "success",
            "match_result": {
                "cv_id": result.cv_id,
                "jd_id": result.jd_id,
                "overall_score": result.overall_score,
                "breakdown": {
                    "skills_score": result.skills_score,
                    "responsibilities_score": result.responsibilities_score,
                    "title_score": result.title_score,
                    "experience_score": result.experience_score
                },
                "explanation": result.explanation,
                "match_details": result.match_details,
                "processing_time": result.processing_time
            },
            "scoring_weights": {
                "skills": 40,
                "responsibilities": 35,
                "title": 15,
                "experience": 10
            },
            "matching_method": "consolidated_service"
        }
        
        logger.info(f"✅ Matching completed: {result.overall_score:.1f}% overall score")
        
        return JSONResponse(response_data)
        
    except Exception as e:
        logger.error(f"❌ CV-JD matching failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(e)}")

@router.post("/bulk-match")
async def bulk_match(request: BulkMatchRequest) -> JSONResponse:
    """
    Perform bulk matching of one JD against multiple CVs.
    Returns top matching candidates sorted by overall score.
    """
    try:
        logger.info(f"🚀 Bulk matching JD {request.jd_id} against {len(request.cv_ids)} CVs")
        
        if len(request.cv_ids) > 50:
            raise HTTPException(
                status_code=400,
                detail="Maximum 50 CVs allowed per bulk match request"
            )
        
        matching_service = get_matching_service()
        results = matching_service.bulk_match(request.jd_id, request.cv_ids, request.top_k)
        
        # Convert results to JSON-serializable format
        match_results = []
        for result in results:
            match_data = {
                "cv_id": result.cv_id,
                "jd_id": result.jd_id,
                "overall_score": result.overall_score,
                "breakdown": {
                    "skills_score": result.skills_score,
                    "responsibilities_score": result.responsibilities_score,
                    "title_score": result.title_score,
                    "experience_score": result.experience_score
                },
                "explanation": result.explanation,
                "processing_time": result.processing_time,
                "match_summary": {
                    "skills_matched": result.match_details["skills_analysis"]["matched"],
                    "total_skills_required": result.match_details["skills_analysis"]["total_required"],
                    "responsibilities_matched": result.match_details["responsibilities_analysis"]["matched"],
                    "total_responsibilities_required": result.match_details["responsibilities_analysis"]["total_required"]
                }
            }
            match_results.append(match_data)
        
        response_data = {
            "status": "success",
            "bulk_match_results": {
                "jd_id": request.jd_id,
                "total_cvs_processed": len(request.cv_ids),
                "results_returned": len(match_results),
                "top_k": request.top_k,
                "matches": match_results
            },
            "matching_method": "bulk_processing"
        }
        
        logger.info(f"✅ Bulk matching completed: {len(match_results)} results")
        
        return JSONResponse(response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Bulk matching failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bulk matching failed: {str(e)}")

@router.post("/find-top-candidates")
async def find_top_candidates(request: TopCandidatesRequest) -> JSONResponse:
    """
    Find top CV candidates for a given JD from all CVs in the database.
    Uses vector similarity search for efficient candidate discovery.
    """
    try:
        logger.info(f"🔍 Finding top {request.limit} candidates for JD {request.jd_id}")
        
        matching_service = get_matching_service()
        results = matching_service.find_top_candidates(request.jd_id, request.limit)
        
        # Get additional candidate information
        qdrant_utils = get_qdrant_utils()
        
        candidates = []
        for result in results:
            # Get CV details
            cv_data = qdrant_utils.retrieve_document(result.cv_id, "cv")
            
            candidate_info = {
                "cv_id": result.cv_id,
                "overall_score": result.overall_score,
                "breakdown": {
                    "skills_score": result.skills_score,
                    "responsibilities_score": result.responsibilities_score,
                    "title_score": result.title_score,
                    "experience_score": result.experience_score
                },
                "explanation": result.explanation,
                "candidate_details": {
                    "filename": cv_data.get("filename", "Unknown") if cv_data else "Unknown",
                    "full_name": cv_data.get("full_name", "Not specified") if cv_data else "Not specified",
                    "job_title": cv_data.get("job_title", "Not specified") if cv_data else "Not specified",
                    "years_of_experience": cv_data.get("years_of_experience", "Not specified") if cv_data else "Not specified",
                    "top_skills": cv_data.get("skills", [])[:5] if cv_data else []  # Top 5 skills
                },
                "match_highlights": {
                    "top_skill_matches": result.match_details["skills_analysis"]["matches"][:3],
                    "top_responsibility_matches": result.match_details["responsibilities_analysis"]["matches"][:3]
                }
            }
            candidates.append(candidate_info)
        
        response_data = {
            "status": "success",
            "candidate_search": {
                "jd_id": request.jd_id,
                "candidates_found": len(candidates),
                "search_limit": request.limit,
                "candidates": candidates
            },
            "search_method": "vector_similarity"
        }
        
        logger.info(f"✅ Found {len(candidates)} top candidates")
        
        return JSONResponse(response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Top candidate search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Candidate search failed: {str(e)}")

@router.post("/match-text")
async def match_text(request: TextMatchRequest) -> JSONResponse:
    """
    Match raw JD and CV text without storing in database.
    Useful for quick evaluations and testing.
    """
    try:
        logger.info("🔍 Performing text-based matching")
        
        if not request.jd_text.strip() or not request.cv_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Both jd_text and cv_text are required and cannot be empty"
            )
        
        start_time = time.time()
        
        # Step 1: Process JD text
        logger.info("📋 Processing JD text")
        llm_service = get_llm_service()
        jd_standardized = llm_service.standardize_jd(request.jd_text, request.jd_filename)
        
        # Step 2: Process CV text
        logger.info("📄 Processing CV text")
        cv_standardized = llm_service.standardize_cv(request.cv_text, request.cv_filename)
        
        # Step 3: Generate embeddings
        logger.info("🔥 Generating embeddings")
        embedding_service = get_embedding_service()
        
        # JD embeddings
        jd_embeddings = {}
        if jd_standardized.get("skills"):
            jd_embeddings["skills"] = embedding_service.generate_skill_embeddings(
                jd_standardized["skills"]
            )
        
        jd_responsibilities = jd_standardized.get("responsibilities", [])
        if not jd_responsibilities:
            jd_responsibilities = jd_standardized.get("responsibility_sentences", [])
        if jd_responsibilities:
            jd_embeddings["responsibilities"] = embedding_service.generate_responsibility_embeddings(
                jd_responsibilities
            )
        
        # CV embeddings
        cv_embeddings = {}
        if cv_standardized.get("skills"):
            cv_embeddings["skills"] = embedding_service.generate_skill_embeddings(
                cv_standardized["skills"]
            )
        
        if cv_standardized.get("responsibilities"):
            cv_embeddings["responsibilities"] = embedding_service.generate_responsibility_embeddings(
                cv_standardized["responsibilities"]
            )
        
        # Step 4: Calculate similarities (simplified version)
        logger.info("🎯 Calculating similarities")
        
        # Skills similarity
        skills_matches = 0
        total_jd_skills = len(jd_standardized.get("skills", []))
        skill_details = []
        
        if jd_embeddings.get("skills") and cv_embeddings.get("skills"):
            for jd_skill, jd_emb in jd_embeddings["skills"].items():
                best_similarity = 0.0
                best_cv_skill = None
                
                for cv_skill, cv_emb in cv_embeddings["skills"].items():
                    similarity = embedding_service.calculate_cosine_similarity(jd_emb, cv_emb)
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_cv_skill = cv_skill
                
                if best_similarity >= 0.6:  # Minimum threshold
                    skills_matches += 1
                    quality = embedding_service.get_match_quality(best_similarity, "skills")
                    skill_details.append({
                        "jd_skill": jd_skill,
                        "cv_skill": best_cv_skill,
                        "similarity": best_similarity,
                        "quality": quality
                    })
        
        skills_score = (skills_matches / total_jd_skills * 100) if total_jd_skills > 0 else 0
        
        # Responsibilities similarity (simplified)
        responsibilities_matches = 0
        total_jd_responsibilities = len(jd_responsibilities)
        responsibility_details = []
        
        if jd_embeddings.get("responsibilities") and cv_embeddings.get("responsibilities"):
            for jd_resp, jd_emb in jd_embeddings["responsibilities"].items():
                best_similarity = 0.0
                best_cv_resp = None
                
                for cv_resp, cv_emb in cv_embeddings["responsibilities"].items():
                    similarity = embedding_service.calculate_cosine_similarity(jd_emb, cv_emb)
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_cv_resp = cv_resp
                
                if best_similarity >= 0.55:  # Minimum threshold for responsibilities
                    responsibilities_matches += 1
                    quality = embedding_service.get_match_quality(best_similarity, "responsibilities")
                    responsibility_details.append({
                        "jd_responsibility": jd_resp[:100] + "..." if len(jd_resp) > 100 else jd_resp,
                        "cv_responsibility": best_cv_resp[:100] + "..." if len(best_cv_resp) > 100 else best_cv_resp,
                        "similarity": best_similarity,
                        "quality": quality
                    })
        
        responsibilities_score = (responsibilities_matches / total_jd_responsibilities * 100) if total_jd_responsibilities > 0 else 0
        
        # Title similarity
        title_score = 75.0  # Default score for text matching
        if (jd_standardized.get("job_title") and cv_standardized.get("job_title") and 
            jd_standardized["job_title"] != "Not specified" and cv_standardized["job_title"] != "Not specified"):
            jd_title_emb = embedding_service.generate_single_embedding(jd_standardized["job_title"])
            cv_title_emb = embedding_service.generate_single_embedding(cv_standardized["job_title"])
            title_similarity = embedding_service.calculate_cosine_similarity(jd_title_emb, cv_title_emb)
            title_score = title_similarity * 100
        
        # Experience score (simplified)
        experience_score = 75.0  # Default score
        
        # Overall score
        overall_score = (
            skills_score * 0.40 +
            responsibilities_score * 0.35 +
            title_score * 0.15 +
            experience_score * 0.10
        )
        
        processing_time = time.time() - start_time
        
        response_data = {
            "status": "success",
            "text_match_result": {
                "overall_score": overall_score,
                "breakdown": {
                    "skills_score": skills_score,
                    "responsibilities_score": responsibilities_score,
                    "title_score": title_score,
                    "experience_score": experience_score
                },
                "detailed_analysis": {
                    "skills_analysis": {
                        "total_required": total_jd_skills,
                        "matched": skills_matches,
                        "match_percentage": skills_score,
                        "top_matches": skill_details[:5]
                    },
                    "responsibilities_analysis": {
                        "total_required": total_jd_responsibilities,
                        "matched": responsibilities_matches,
                        "match_percentage": responsibilities_score,
                        "top_matches": responsibility_details[:5]
                    }
                },
                "standardized_data": {
                    "jd": jd_standardized,
                    "cv": cv_standardized
                },
                "processing_time": processing_time
            },
            "matching_method": "real_time_text"
        }
        
        logger.info(f"✅ Text matching completed: {overall_score:.1f}% overall score in {processing_time:.2f}s")
        
        return JSONResponse(response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Text matching failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Text matching failed: {str(e)}")

@router.get("/health")
async def health_check() -> JSONResponse:
    """
    Comprehensive system health check.
    Verifies all services and database connections.
    """
    try:
        logger.info("🏥 Performing system health check")
        
        health_status = {
            "status": "healthy",
            "timestamp": time.time(),
            "services": {}
        }
        
        # Check Qdrant database
        try:
            qdrant_utils = get_qdrant_utils()
            qdrant_health = qdrant_utils.health_check()
            health_status["services"]["qdrant"] = qdrant_health
        except Exception as e:
            health_status["services"]["qdrant"] = {"status": "unhealthy", "error": str(e)}
            health_status["status"] = "degraded"
        
        # Check embedding service
        try:
            embedding_service = get_embedding_service()
            embedding_health = embedding_service.health_check()
            health_status["services"]["embedding"] = embedding_health
        except Exception as e:
            health_status["services"]["embedding"] = {"status": "unhealthy", "error": str(e)}
            health_status["status"] = "degraded"
        
        # Check cache service
        try:
            cache_service = get_cache_service()
            cache_stats = cache_service.get_stats()
            health_status["services"]["cache"] = {
                "status": "healthy",
                "stats": cache_stats
            }
        except Exception as e:
            health_status["services"]["cache"] = {"status": "unhealthy", "error": str(e)}
            health_status["status"] = "degraded"
        
        # Check environment
        import os
        health_status["environment"] = {
            "openai_key_configured": bool(os.getenv("OPENAI_API_KEY")),
            "qdrant_host": os.getenv("QDRANT_HOST", "qdrant"),
            "qdrant_port": os.getenv("QDRANT_PORT", "6333")
        }
        
        # Overall system status
        if health_status["status"] == "healthy":
            logger.info("✅ System health check passed")
        else:
            logger.warning("⚠️ System health check shows degraded status")
        
        return JSONResponse(health_status)
        
    except Exception as e:
        logger.error(f"❌ Health check failed: {str(e)}")
        return JSONResponse({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": time.time()
        }, status_code=500)

@router.post("/clear-database")
async def clear_database(confirm: bool = False) -> JSONResponse:
    """
    Clear all data from the database (DEVELOPMENT ONLY).
    Requires explicit confirmation to prevent accidental data loss.
    """
    try:
        if not confirm:
            raise HTTPException(
                status_code=400,
                detail="This operation requires explicit confirmation. Set 'confirm=true' to proceed."
            )
        
        logger.warning("🧹 CLEARING ALL DATABASE DATA")
        
        qdrant_utils = get_qdrant_utils()
        success = qdrant_utils.clear_all_data()
        
        # Also clear cache
        cache_service = get_cache_service()
        cache_service.clear()
        
        if success:
            logger.warning("⚠️ ALL DATA CLEARED from database and cache")
            return JSONResponse({
                "status": "success",
                "message": "All data cleared from database and cache",
                "warning": "This action cannot be undone",
                "timestamp": time.time()
            })
        else:
            raise HTTPException(status_code=500, detail="Failed to clear database")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Database clear failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database clear failed: {str(e)}")

@router.get("/system-stats")
async def get_system_stats() -> JSONResponse:
    """
    Get comprehensive system statistics and metrics.
    """
    try:
        logger.info("📊 Gathering system statistics")
        
        qdrant_utils = get_qdrant_utils()
        cache_service = get_cache_service()
        
        # Get document counts
        cvs = qdrant_utils.list_documents("cv")
        jds = qdrant_utils.list_documents("jd")
        
        # Get cache stats
        cache_stats = cache_service.get_stats()
        
        # Calculate some basic analytics
        cv_skills_counts = [len(cv.get("skills", [])) for cv in cvs]
        jd_skills_counts = [len(jd.get("skills", [])) for jd in jds]
        
        stats = {
            "database_stats": {
                "total_cvs": len(cvs),
                "total_jds": len(jds),
                "total_documents": len(cvs) + len(jds)
            },
            "cv_analytics": {
                "total_cvs": len(cvs),
                "avg_skills_per_cv": sum(cv_skills_counts) / len(cv_skills_counts) if cv_skills_counts else 0,
                "max_skills_per_cv": max(cv_skills_counts) if cv_skills_counts else 0,
                "min_skills_per_cv": min(cv_skills_counts) if cv_skills_counts else 0
            },
            "jd_analytics": {
                "total_jds": len(jds),
                "avg_skills_per_jd": sum(jd_skills_counts) / len(jd_skills_counts) if jd_skills_counts else 0,
                "max_skills_per_jd": max(jd_skills_counts) if jd_skills_counts else 0,
                "min_skills_per_jd": min(jd_skills_counts) if jd_skills_counts else 0
            },
            "cache_stats": cache_stats,
            "system_info": {
                "embedding_model": "all-mpnet-base-v2",
                "embedding_dimension": 768,
                "llm_model": "gpt-4o-mini",
                "similarity_metric": "cosine"
            }
        }
        
        logger.info("✅ System statistics gathered")
        
        return JSONResponse({
            "status": "success",
            "stats": stats,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to gather system stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to gather system stats: {str(e)}")
