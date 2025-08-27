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

from app.services.matching_service import get_matching_service, normalize_weights, years_score, hungarian_mean

def safe_parse_years(years_value) -> int:
    """Safely parse years of experience, handling string values like 'Not specified' or '5-8'."""
    if not years_value:
        return 0
    
    if isinstance(years_value, int):
        return years_value
    
    if isinstance(years_value, str):
        # Handle cases like "Not specified", "X years", etc.
        if years_value.lower() in ["not specified", "x years", "not applicable", "n/a", ""]:
            return 0
        
        # Handle ranges like "5-8", "3-5" by taking the minimum
        if "-" in years_value:
            try:
                parts = years_value.split("-")
                return int(parts[0].strip())
            except (ValueError, IndexError):
                return 0
        
        # Handle simple numbers like "5", "10"
        try:
            # Remove common suffixes
            clean_value = years_value.replace(" years", "").replace("+", "").strip()
            return int(clean_value)
        except ValueError:
            return 0
    
    return 0
from app.services.embedding_service import get_embedding_service, get_model
from app.services.llm_service import get_llm_service, extract_jd
from app.services.parsing_service import get_parsing_service
from app.utils.qdrant_utils import get_qdrant_utils
from app.utils.cache import get_cache_service
from app.schemas.matching import MatchRequest as NewMatchRequest, MatchResponse, CandidateBreakdown, AssignmentItem, AlternativesItem, MatchWeights
import numpy as np

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

# Alias for frontend compatibility
@router.post("/standardize-and-match-text")
async def standardize_and_match_text(request: TextMatchRequest) -> JSONResponse:
    """
    Alias for match_text endpoint to maintain frontend compatibility.
    """
    return await match_text(request)

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
                "llm_model": "gpt-4o-nano",
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

@router.get("/database/status")
async def get_database_status():
    """
    Get comprehensive database status and collection information.
    """
    try:
        logger.info("🔍 Getting database status...")
        
        from app.utils.qdrant_utils import QdrantUtils
        qdrant = QdrantUtils()
        
        # Get all collections
        collections_info = qdrant.client.get_collections()
        collections = []
        
        for collection in collections_info.collections:
            collection_name = collection.name
            collection_info = qdrant.client.get_collection(collection_name)
            
            # Convert vector config to serializable format
            if hasattr(collection_info.config.params.vectors, '__dict__'):
                # Single vector config
                vector_config = {
                    "size": collection_info.config.params.vectors.size,
                    "distance": str(collection_info.config.params.vectors.distance)
                }
            else:
                # Multi-vector config
                vector_config = {}
                for name, params in collection_info.config.params.vectors.items():
                    vector_config[name] = {
                        "size": params.size,
                        "distance": str(params.distance)
                    }
            
            collections.append({
                "name": collection_name,
                "points_count": collection_info.points_count,
                "vector_config": vector_config,
                "status": str(collection_info.status),
                "indexed_vectors_count": collection_info.indexed_vectors_count
            })
        
        return JSONResponse({
            "status": "success",
            "collections": collections,
            "total_collections": len(collections),
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get database status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database status error: {str(e)}")

@router.get("/database/collections")
async def list_all_collections():
    """
    List all Qdrant collections with detailed information.
    """
    try:
        logger.info("📋 Listing all collections...")
        
        from app.utils.qdrant_utils import QdrantUtils
        qdrant = QdrantUtils()
        
        collections_info = qdrant.client.get_collections()
        detailed_collections = {}
        
        for collection in collections_info.collections:
            collection_name = collection.name
            collection_info = qdrant.client.get_collection(collection_name)
            
            # Get sample data
            try:
                sample_points = qdrant.client.scroll(
                    collection_name=collection_name,
                    limit=2,
                    with_payload=True,
                    with_vectors=False
                )
                sample_data = [point.payload for point in sample_points[0]] if sample_points[0] else []
            except:
                sample_data = []
            
            # Convert vector config to serializable format
            if hasattr(collection_info.config.params.vectors, '__dict__'):
                # Single vector config
                vector_config = {
                    "size": collection_info.config.params.vectors.size,
                    "distance": str(collection_info.config.params.vectors.distance)
                }
            else:
                # Multi-vector config
                vector_config = {}
                for name, params in collection_info.config.params.vectors.items():
                    vector_config[name] = {
                        "size": params.size,
                        "distance": str(params.distance)
                    }
            
            detailed_collections[collection_name] = {
                "points_count": collection_info.points_count,
                "vector_config": vector_config,
                "status": str(collection_info.status),
                "sample_data": sample_data
            }
        
        return JSONResponse({
            "status": "success", 
            "collections": detailed_collections,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to list collections: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Collections listing error: {str(e)}")

@router.get("/database/cv/{cv_id}")
async def get_cv_data(cv_id: str):
    """
    Show what's stored for a specific CV.
    """
    try:
        logger.info(f"🔍 Getting CV data for: {cv_id}")
        
        from app.utils.qdrant_utils import QdrantUtils
        qdrant = QdrantUtils()
        
        # Try both collection formats
        cv_data = {}
        
        # Check new multi-vector collection
        try:
            result = qdrant.client.retrieve(
                collection_name="cv",
                ids=[cv_id],
                with_payload=True,
                with_vectors=True
            )
            if result:
                cv_data["multi_vector_storage"] = {
                    "found": True,
                    "payload": result[0].payload,
                    "vectors": {k: f"{len(v)} dims" for k, v in result[0].vector.items()} if hasattr(result[0], 'vector') else {}
                }
            else:
                cv_data["multi_vector_storage"] = {"found": False}
        except Exception as e:
            cv_data["multi_vector_storage"] = {"found": False, "error": str(e)}
        
        # Check old single-vector collection
        try:
            result = qdrant.client.retrieve(
                collection_name="cvs",
                ids=[cv_id],
                with_payload=True,
                with_vectors=False
            )
            if result:
                cv_data["single_vector_storage"] = {
                    "found": True,
                    "payload": result[0].payload
                }
            else:
                cv_data["single_vector_storage"] = {"found": False}
        except Exception as e:
            cv_data["single_vector_storage"] = {"found": False, "error": str(e)}
        
        # Check individual skill embeddings
        try:
            skills_result = qdrant.client.scroll(
                collection_name="skills",
                scroll_filter={
                    "must": [{"key": "document_id", "match": {"value": cv_id}}]
                },
                limit=10,
                with_payload=True
            )
            cv_data["individual_skills"] = {
                "found": len(skills_result[0]) > 0,
                "count": len(skills_result[0]),
                "sample": [point.payload for point in skills_result[0][:3]]
            }
        except Exception as e:
            cv_data["individual_skills"] = {"found": False, "error": str(e)}
        
        return JSONResponse({
            "status": "success",
            "cv_id": cv_id,
            "storage_locations": cv_data,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get CV data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CV data retrieval error: {str(e)}")

@router.get("/database/jd/{jd_id}")
async def get_jd_data(jd_id: str):
    """
    Show what's stored for a specific JD.
    """
    try:
        logger.info(f"🔍 Getting JD data for: {jd_id}")
        
        from app.utils.qdrant_utils import QdrantUtils
        qdrant = QdrantUtils()
        
        jd_data = {}
        
        # Check new multi-vector collection
        try:
            result = qdrant.client.retrieve(
                collection_name="jd",
                ids=[jd_id],
                with_payload=True,
                with_vectors=True
            )
            if result:
                jd_data["multi_vector_storage"] = {
                    "found": True,
                    "payload": result[0].payload,
                    "vectors": {k: f"{len(v)} dims" for k, v in result[0].vector.items()} if hasattr(result[0], 'vector') else {}
                }
            else:
                jd_data["multi_vector_storage"] = {"found": False}
        except Exception as e:
            jd_data["multi_vector_storage"] = {"found": False, "error": str(e)}
        
        # Check old single-vector collection
        try:
            result = qdrant.client.retrieve(
                collection_name="jds",
                ids=[jd_id],
                with_payload=True,
                with_vectors=False
            )
            if result:
                jd_data["single_vector_storage"] = {
                    "found": True,
                    "payload": result[0].payload
                }
            else:
                jd_data["single_vector_storage"] = {"found": False}
        except Exception as e:
            jd_data["single_vector_storage"] = {"found": False, "error": str(e)}
        
        return JSONResponse({
            "status": "success",
            "jd_id": jd_id,
            "storage_locations": jd_data,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get JD data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"JD data retrieval error: {str(e)}")

@router.get("/database/embeddings")
async def get_embeddings_info():
    """
    Show embedding structure and samples from all collections.
    """
    try:
        logger.info("🔍 Getting embeddings information...")
        
        from app.utils.qdrant_utils import QdrantUtils
        qdrant = QdrantUtils()
        
        embeddings_info = {}
        
        # Check multi-vector collections
        for collection_name in ["cv", "jd"]:
            try:
                collection_info = qdrant.client.get_collection(collection_name)
                sample_points = qdrant.client.scroll(
                    collection_name=collection_name,
                    limit=1,
                    with_payload=True,
                    with_vectors=True
                )
                
                if sample_points[0]:
                    point = sample_points[0][0]
                    embeddings_info[collection_name] = {
                        "total_points": collection_info.points_count,
                        "vector_structure": {k: f"{len(v)} dimensions" for k, v in point.vector.items()} if hasattr(point, 'vector') else {},
                        "sample_payload_keys": list(point.payload.keys()) if point.payload else [],
                        "embedding_model": "all-mpnet-base-v2"
                    }
                else:
                    embeddings_info[collection_name] = {
                        "total_points": collection_info.points_count,
                        "vector_structure": "No data",
                        "status": "Empty collection"
                    }
            except Exception as e:
                embeddings_info[collection_name] = {"error": str(e)}
        
        # Check individual collections
        for collection_name in ["skills", "responsibilities"]:
            try:
                collection_info = qdrant.client.get_collection(collection_name)
                sample_points = qdrant.client.scroll(
                    collection_name=collection_name,
                    limit=3,
                    with_payload=True,
                    with_vectors=False
                )
                
                embeddings_info[collection_name] = {
                    "total_points": collection_info.points_count,
                    "vector_structure": "Single 768-dim vector per item",
                    "sample_contents": [point.payload.get("content", "") for point in sample_points[0][:3]] if sample_points[0] else [],
                    "embedding_model": "all-mpnet-base-v2"
                }
            except Exception as e:
                embeddings_info[collection_name] = {"error": str(e)}
        
        return JSONResponse({
            "status": "success",
            "embeddings_info": embeddings_info,
            "embedding_model": "all-mpnet-base-v2",
            "vector_dimensions": 768,
            "distance_metric": "Cosine",
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get embeddings info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Embeddings info error: {str(e)}")

@router.post("/match", response_model=MatchResponse)
async def match_candidates(req: NewMatchRequest):
    """
    Match candidates against a job description using Hungarian algorithm.
    Returns deterministic, explainable matching results.
    """
    try:
        logger.info(f"🎯 Starting matching request: JD={req.jd_id or 'text'}, CVs={len(req.cv_ids) if req.cv_ids else 'all'}")
        
        # 1) Resolve JD
        if not (req.jd_id or req.jd_text):
            raise HTTPException(status_code=400, detail="Provide jd_id or jd_text")

        qdrant = get_qdrant_utils()
        
        if req.jd_id:
            jd = qdrant.get_structured_jd(req.jd_id)
            if not jd:
                raise HTTPException(status_code=404, detail="JD not found")
        else:
            # Extract with LLM service then structure exactly like DB structured JD
            jd = await extract_jd(req.jd_text)

        jd_title = jd.get("job_title") or ""
        jd_years = safe_parse_years(jd.get("years_of_experience"))
        jd_skills = [s for s in jd.get("skills_sentences", []) if s]
        jd_resps = [r for r in jd.get("responsibility_sentences", []) if r]

        # 2) Candidates list
        candidates_meta = []
        if req.cv_ids:
            for cid in req.cv_ids:
                c = qdrant.get_structured_cv(cid)
                if c: 
                    candidates_meta.append(c)
        else:
            # all CVs
            for meta in qdrant.list_all_cvs():
                c = qdrant.get_structured_cv(meta["id"])
                if c: 
                    candidates_meta.append(c)

        if not candidates_meta:
            raise HTTPException(status_code=404, detail="No CVs available for matching")

        # 3) Weights
        w = req.weights.dict() if req.weights else MatchWeights().dict()
        w_norm = normalize_weights(w)

        # 4) Embeddings model
        model = get_model()

        # Precompute JD embeddings
        emb_jd_sk = model.encode(jd_skills, normalize_embeddings=True) if (w_norm["skills"] > 0 and jd_skills) else np.array([])
        emb_jd_rs = model.encode(jd_resps, normalize_embeddings=True) if (w_norm["responsibilities"] > 0 and jd_resps) else np.array([])
        emb_jd_ti = model.encode([jd_title], normalize_embeddings=True) if (w_norm["job_title"] > 0 and jd_title) else None

        resp_candidates = []
        for c in candidates_meta:
            cv_id = c["id"]
            cv_name = c.get("name") or cv_id
            cv_title = c.get("job_title") or ""
            cv_years = safe_parse_years(c.get("years_of_experience"))
            cv_skills = [s for s in c.get("skills_sentences", []) if s]
            cv_resps = [r for r in c.get("responsibility_sentences", []) if r]

            # Encode CV
            emb_cv_sk = model.encode(cv_skills, normalize_embeddings=True) if (w_norm["skills"] > 0 and cv_skills and emb_jd_sk.size) else np.array([])
            emb_cv_rs = model.encode(cv_resps, normalize_embeddings=True) if (w_norm["responsibilities"] > 0 and cv_resps and emb_jd_rs.size) else np.array([])

            # Similarity matrices and Hungarian assignment
            skills_score = 0.0
            skills_assign = []
            skills_alts = []
            if emb_jd_sk.size and emb_cv_sk.size:
                sim = np.matmul(emb_jd_sk, emb_cv_sk.T)  # cosine because normalized
                score, pairs = hungarian_mean(sim)
                skills_score = score
                skills_assign = [
                    AssignmentItem(
                        type="skill",
                        jd_index=rr,
                        jd_item=jd_skills[rr],
                        cv_index=cc,
                        cv_item=cv_skills[cc],
                        score=float(sim[rr, cc])
                    )
                    for (rr, cc, _) in pairs
                ]
                
                # Alternatives (top-K excluding assigned)
                jd_to_assigned_cv = {rr: cc for (rr, cc, _) in pairs}
                topK = int(req.top_alternatives or 3)
                for j in range(sim.shape[0]):
                    row = [(i, float(sim[j, i])) for i in range(sim.shape[1])]
                    row.sort(key=lambda x: x[1], reverse=True)
                    items = []
                    for i, sc in row:
                        if jd_to_assigned_cv.get(j) == i:  # skip assigned
                            continue
                        items.append({"cv_index": i, "cv_item": cv_skills[i], "score": sc})
                        if len(items) >= topK: 
                            break
                    skills_alts.append(AlternativesItem(jd_index=j, items=items))

            resp_score = 0.0
            resp_assign = []
            resp_alts = []
            if emb_jd_rs.size and emb_cv_rs.size:
                simr = np.matmul(emb_jd_rs, emb_cv_rs.T)
                score_r, pairs_r = hungarian_mean(simr)
                resp_score = score_r
                resp_assign = [
                    AssignmentItem(
                        type="responsibility",
                        jd_index=rr,
                        jd_item=jd_resps[rr],
                        cv_index=cc,
                        cv_item=cv_resps[cc],
                        score=float(simr[rr, cc])
                    )
                    for (rr, cc, _) in pairs_r
                ]
                
                jd_to_assigned_cv_r = {rr: cc for (rr, cc, _) in pairs_r}
                topK = int(req.top_alternatives or 3)
                for j in range(simr.shape[0]):
                    row = [(i, float(simr[j, i])) for i in range(simr.shape[1])]
                    row.sort(key=lambda x: x[1], reverse=True)
                    items = []
                    for i, sc in row:
                        if jd_to_assigned_cv_r.get(j) == i:
                            continue
                        items.append({"cv_index": i, "cv_item": cv_resps[i], "score": sc})
                        if len(items) >= topK: 
                            break
                    resp_alts.append(AlternativesItem(jd_index=j, items=items))

            title_score = 0.0
            if w_norm["job_title"] > 0 and emb_jd_ti is not None and cv_title:
                emb_cv_ti = model.encode([cv_title], normalize_embeddings=True)
                title_score = float(np.dot(emb_jd_ti, emb_cv_ti.T)[0][0])

            exp_score = years_score(jd_years, cv_years) if w_norm["experience"] > 0 else 0.0

            overall = (w_norm["skills"] * skills_score +
                      w_norm["responsibilities"] * resp_score +
                      w_norm["job_title"] * title_score +
                      w_norm["experience"] * exp_score)

            resp_candidates.append(CandidateBreakdown(
                cv_id=cv_id,
                cv_name=cv_name,
                cv_job_title=cv_title,
                cv_years=cv_years,
                skills_score=skills_score,
                responsibilities_score=resp_score,
                job_title_score=title_score,
                years_score=exp_score,
                overall_score=overall,
                skills_assignments=skills_assign,
                responsibilities_assignments=resp_assign,
                skills_alternatives=skills_alts,
                responsibilities_alternatives=resp_alts
            ))

        resp_candidates.sort(key=lambda x: x.overall_score, reverse=True)
        
        logger.info(f"✅ Matching complete: {len(resp_candidates)} candidates processed")
        
        return MatchResponse(
            jd_id=req.jd_id,
            jd_job_title=jd_title,
            jd_years=jd_years,
            normalized_weights=MatchWeights(**w_norm),
            candidates=resp_candidates
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Matching failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Matching error: {str(e)}")

@router.get("/database/view")
async def view_database() -> JSONResponse:
    """
    Get formatted database view with all CVs and JDs for visualization.
    Returns structured data optimized for frontend display.
    """
    try:
        logger.info("📊 Getting formatted database view")
        
        qdrant_utils = get_qdrant_utils()
        
        # Get all CVs with detailed information
        cvs_raw = qdrant_utils.list_documents("cv")
        formatted_cvs = []
        
        for cv in cvs_raw:
            formatted_cv = {
                "id": cv["id"],
                "name": cv.get("full_name", "Unknown"),
                "filename": cv.get("filename", "Unknown"),
                "job_title": cv.get("job_title", "Not specified"),
                "skills_count": len(cv.get("skills", [])),
                "experience_years": cv.get("years_of_experience", "Not specified"),
                "upload_date": cv.get("upload_date", "Unknown"),
                "text_length": len(cv.get("extracted_text", "")),
                "top_skills": cv.get("skills", [])[:5],  # Top 5 skills for preview
                "responsibilities_count": len(cv.get("responsibilities", [])),
                "has_structured_data": bool(cv.get("structured_info"))
            }
            formatted_cvs.append(formatted_cv)
        
        # Get all JDs with detailed information  
        jds_raw = qdrant_utils.list_documents("jd")
        formatted_jds = []
        
        for jd in jds_raw:
            formatted_jd = {
                "id": jd["id"],
                "filename": jd.get("filename", "Unknown"),
                "job_title": jd.get("job_title", "Not specified"),
                "required_skills": len(jd.get("skills", [])),
                "required_years": jd.get("years_of_experience", "Not specified"),
                "upload_date": jd.get("upload_date", "Unknown"),
                "text_length": len(jd.get("extracted_text", "")),
                "top_skills": jd.get("skills", [])[:5],  # Top 5 required skills
                "responsibilities_count": len(jd.get("responsibility_sentences", [])),
                "has_structured_data": bool(jd.get("structured_info"))
            }
            formatted_jds.append(formatted_jd)
        
        # Sort by upload date (newest first)
        formatted_cvs.sort(key=lambda x: x["upload_date"], reverse=True)
        formatted_jds.sort(key=lambda x: x["upload_date"], reverse=True)
        
        # Calculate summary statistics
        summary_stats = {
            "total_documents": len(formatted_cvs) + len(formatted_jds),
            "total_cvs": len(formatted_cvs),
            "total_jds": len(formatted_jds),
            "avg_cv_skills": sum(cv["skills_count"] for cv in formatted_cvs) / len(formatted_cvs) if formatted_cvs else 0,
            "avg_jd_skills": sum(jd["required_skills"] for jd in formatted_jds) / len(formatted_jds) if formatted_jds else 0,
            "ready_for_matching": len(formatted_cvs) > 0 and len(formatted_jds) > 0
        }
        
        logger.info(f"✅ Database view retrieved: {len(formatted_cvs)} CVs, {len(formatted_jds)} JDs")
        
        return JSONResponse({
            "success": True,
            "data": {
                "cvs": formatted_cvs,
                "jds": formatted_jds,
                "summary": summary_stats
            },
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get database view: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database view error: {str(e)}")


