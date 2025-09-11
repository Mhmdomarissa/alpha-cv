"""
Special Routes - Matching, Health, System & DB Introspection
Uses:
  - *_structured for standardized JSON
  - *_embeddings for EXACT 32 vectors
  - *_documents for raw files/text payloads
"""
import logging
import time
from typing import List, Dict, Any, Optional, Tuple
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.deps.auth import require_admin
from app.models.user import User
from app.services.matching_service import (
    get_matching_service,
    years_score,
    hungarian_mean,
)
from app.services.embedding_service import get_embedding_service, get_model
from app.services.llm_service import get_llm_service
from app.utils.qdrant_utils import get_qdrant_utils
from app.utils.cache import get_cache_service
from app.schemas.matching import (
    MatchRequest as NewMatchRequest,
    MatchResponse,
    CandidateBreakdown,
    AssignmentItem,
    AlternativesItem,
    MatchWeights,
)
from app.services.matching_service import get_matching_service
import numpy as np
logger = logging.getLogger(__name__)
router = APIRouter()

# ----------------------------
# Models for legacy endpoints
# ----------------------------
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

# ----------------------------
# Helpers
# ----------------------------
def normalize_weights(weights: Dict[str, float]) -> Dict[str, float]:
    """Normalize weights to sum to 1.0"""
    total = sum(weights.values())
    if total <= 0:
        return {"skills": 0.25, "responsibilities": 0.25, "job_title": 0.25, "experience": 0.25}
    return {k: v / total for k, v in weights.items()}

def safe_parse_years(years_value) -> int:
    """Safely parse years of experience, handling string values like 'Not specified' or '5-8'."""
    if not years_value:
        return 0
    if isinstance(years_value, int):
        return years_value
    if isinstance(years_value, str):
        s = years_value.strip()
        if not s or s.lower() in {"not specified", "x years", "not applicable", "n/a"}:
            return 0
        if "-" in s:
            try:
                return int(s.split("-")[0].strip())
            except Exception:
                return 0
        try:
            s = s.replace(" years", "").replace("+", "").strip()
            return int(s)
        except Exception:
            return 0
    return 0

def _scroll_all(collection: str, with_vectors: bool = False, limit: int = 500) -> List[Any]:
    qdrant = get_qdrant_utils().client
    out, offset = [], None
    while True:
        points, next_off = qdrant.scroll(
            collection_name=collection,
            limit=limit,
            offset=offset,
            with_payload=True,
            with_vectors=with_vectors,
        )
        out.extend(points or [])
        if not next_off:
            break
        offset = next_off
    return out

def _get_structured_cv(cv_id: str) -> Optional[Dict[str, Any]]:
    q = get_qdrant_utils().client
    res = q.retrieve("cv_structured", ids=[cv_id], with_payload=True, with_vectors=False)
    if not res:
        return None
    payload = res[0].payload or {}
    info = payload.get("structured_info", payload)
    # Normalize keys used by UI
    return {
        "id": cv_id,
        "name": info.get("full_name", info.get("name", cv_id)),
        "job_title": info.get("job_title", ""),
        "years_of_experience": info.get("experience_years", info.get("years_of_experience", 0)),
        "skills": info.get("skills", []),
        "responsibilities": info.get("responsibilities", info.get("responsibility_sentences", [])),
        "structured_info": info,
    }

def _get_structured_jd(jd_id: str) -> Optional[Dict[str, Any]]:
    q = get_qdrant_utils().client
    res = q.retrieve("jd_structured", ids=[jd_id], with_payload=True, with_vectors=False)
    if not res:
        return None
    payload = res[0].payload or {}
    info = payload.get("structured_info", payload)
    return {
        "id": jd_id,
        "job_title": info.get("job_title", ""),
        "years_of_experience": info.get("experience_years", info.get("years_of_experience", 0)),
        "skills": info.get("skills", []),
        "responsibilities": info.get("responsibilities", info.get("responsibility_sentences", [])),
        "structured_info": info,
    }

# ----------------------------
# Matching endpoints (legacy)
# ----------------------------
@router.post("/match-cv-jd")
async def match_cv_jd(request: MatchRequest) -> JSONResponse:
    """
    Match a specific CV against a specific JD using explainable scoring
    (skills/responsibilities %, title & experience signals).
    """
    try:
        svc = get_matching_service()
        result = svc.match_cv_against_jd(request.cv_id, request.jd_id)
        response = {
            "status": "success",
            "match_result": {
                "cv_id": result.cv_id,
                "jd_id": result.jd_id,
                "overall_score": result.overall_score,
                "breakdown": {
                    "skills_score": result.skills_score,
                    "responsibilities_score": result.responsibilities_score,
                    "title_score": result.title_score,
                    "experience_score": result.experience_score,
                },
                "explanation": result.explanation,
                "match_details": result.match_details,
                "processing_time": result.processing_time,
            },
            "scoring_weights": {
                "skills": 80,
                "responsibilities": 15,
                "title": 2.5,
                "experience": 2.5,
            },
            "matching_method": "explainable_via_structured+32vec",
        }
        return JSONResponse(response)
    except Exception as e:
        logger.error(f"❌ CV-JD matching failed: {e}")
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(e)}")

@router.post("/bulk-match")
async def bulk_match(request: BulkMatchRequest) -> JSONResponse:
    """
    Bulk match one JD against many CVs and return top-k.
    """
    try:
        if len(request.cv_ids) > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 CVs per request")
        svc = get_matching_service()
        results = svc.bulk_match(request.jd_id, request.cv_ids, request.top_k)
        matches = []
        for r in results:
            matches.append({
                "cv_id": r.cv_id,
                "jd_id": r.jd_id,
                "overall_score": r.overall_score,
                "breakdown": {
                    "skills_score": r.skills_score,
                    "responsibilities_score": r.responsibilities_score,
                    "title_score": r.title_score,
                    "experience_score": r.experience_score,
                },
                "explanation": r.explanation,
                "processing_time": r.processing_time,
                "match_summary": {
                    "skills_matched": r.match_details["skills_analysis"]["matched"],
                    "total_skills_required": r.match_details["skills_analysis"]["total_required"],
                    "responsibilities_matched": r.match_details["responsibilities_analysis"]["matched"],
                    "total_responsibilities_required": r.match_details["responsibilities_analysis"]["total_required"],
                }
            })
        return JSONResponse({
            "status": "success",
            "bulk_match_results": {
                "jd_id": request.jd_id,
                "total_cvs_processed": len(request.cv_ids),
                "results_returned": len(matches),
                "top_k": request.top_k,
                "matches": matches,
            },
            "matching_method": "bulk_structured+32vec",
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Bulk matching failed: {e}")
        raise HTTPException(status_code=500, detail=f"Bulk matching failed: {str(e)}")

@router.post("/find-top-candidates")
async def find_top_candidates(request: TopCandidatesRequest) -> JSONResponse:
    """
    Run matching across ALL CVs in DB and return the top-N candidates.
    """
    try:
        svc = get_matching_service()
        results = svc.find_top_candidates(request.jd_id, request.limit)
        candidates = []
        for r in results:
            cv_info = _get_structured_cv(r.cv_id) or {"id": r.cv_id}
            candidates.append({
                "cv_id": r.cv_id,
                "overall_score": r.overall_score,
                "breakdown": {
                    "skills_score": r.skills_score,
                    "responsibilities_score": r.responsibilities_score,
                    "title_score": r.title_score,
                    "experience_score": r.experience_score,
                },
                "explanation": r.explanation,
                "candidate_details": {
                    "filename": cv_info.get("filename", "Unknown"),
                    "full_name": cv_info.get("name", "Not specified"),
                    "job_title": cv_info.get("job_title", "Not specified"),
                    "years_of_experience": cv_info.get("years_of_experience", "Not specified"),
                    "top_skills": (cv_info.get("skills") or [])[:5],
                },
                "match_highlights": {
                    "top_skill_matches": r.match_details["skills_analysis"]["matches"][:3],
                    "top_responsibility_matches": r.match_details["responsibilities_analysis"]["matches"][:3],
                }
            })
        return JSONResponse({
            "status": "success",
            "candidate_search": {
                "jd_id": request.jd_id,
                "candidates_found": len(candidates),
                "search_limit": request.limit,
                "candidates": candidates,
            },
            "search_method": "full_db_structured+32vec",
        })
    except Exception as e:
        logger.error(f"❌ Top candidate search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Candidate search failed: {str(e)}")

# ----------------------------
# Real-time text match (no DB)
# ----------------------------
# In special_routes.py, update the /match endpoint

@router.post("/match", response_model=MatchResponse)
async def match_candidates(req: NewMatchRequest):
    """
    Deterministic, explainable matching using Hungarian assignment on
    sentence-level embeddings. Delegates to MatchingService helpers.
    """
    try:
        logger.info(f"🎯 Starting matching request: JD={req.jd_id or 'text'}, CVs={len(req.cv_ids) if req.cv_ids else 'all'}")
        qdrant = get_qdrant_utils()
        matching_service = get_matching_service()  # Get the matching service instance
        
        # Resolve JD (id or text)
        if not (req.jd_id or req.jd_text):
            raise HTTPException(status_code=400, detail="Provide jd_id or jd_text")
        
        if req.jd_id:
            jd = qdrant.get_structured_jd(req.jd_id)
            if not jd:
                raise HTTPException(status_code=404, detail="JD not found")
        else:
            # Use LLM to standardize JD text to the same schema as DB
            llm = get_llm_service()
            jd_std = llm.standardize_jd(req.jd_text, "jd_input.txt")
            jd = {
                "id": "text_jd",
                "job_title": jd_std.get("job_title", ""),
                "years_of_experience": jd_std.get("experience_years", 0),
                "skills_sentences": jd_std.get("skills", [])[:20],
                "responsibility_sentences": (jd_std.get("responsibilities", []) or jd_std.get("responsibility_sentences", []))[:10],
            }
        
        # Parse JD years properly to handle string values like "3-7"
        jd_title = jd.get("job_title") or ""
        jd_years = safe_parse_years(jd.get("years_of_experience"))
        jd_skills = [s for s in jd.get("skills_sentences", []) if s]
        jd_resps = [r for r in jd.get("responsibility_sentences", []) if r]
        
        # Candidate set
        candidates_meta = []
        if req.cv_ids:
            for cid in req.cv_ids:
                c = qdrant.get_structured_cv(cid)
                if c:
                    candidates_meta.append(c)
        else:
            for meta in qdrant.list_all_cvs():
                c = qdrant.get_structured_cv(meta["id"])
                if c:
                    candidates_meta.append(c)
        
        if not candidates_meta:
            raise HTTPException(status_code=404, detail="No CVs available for matching")
        
        # Weights
        W = req.weights.dict() if req.weights else MatchWeights().dict()
        Wn = normalize_weights(W)
        
        # Prepare JD structured data for MatchingService
        jd_structured = {
            "id": jd.get("id", "text_jd"),
            "job_title": jd_title,
            "years_of_experience": jd_years,  # Use the parsed integer value
            "skills": jd_skills,
            "responsibilities": jd_resps
        }
        
        # Process each candidate using MatchingService
        resp_candidates = []
        for c in candidates_meta:
            cv_id = c["id"]
            cv_name = c.get("name") or cv_id
            
            # Parse CV years properly
            cv_title = c.get("job_title", "")
            cv_years = safe_parse_years(c.get("years_of_experience"))
            cv_skills = [s for s in c.get("skills_sentences", []) if s]
            cv_resps = [r for r in c.get("responsibility_sentences", []) if r]
            
            # Prepare CV structured data for MatchingService
            cv_structured = {
                "id": cv_id,
                "name": cv_name,
                "job_title": cv_title,
                "years_of_experience": cv_years,  # Use the parsed integer value
                "skills": cv_skills,
                "responsibilities": cv_resps
            }
            
            # Use MatchingService to get match result
            # For stored JDs, use optimized method with stored embeddings
            # For text JDs, fall back to legacy method
            if jd_structured.get("id") != "text_jd":
                # OPTIMIZED: Use stored embeddings for both CV and JD
                match_result = matching_service.match_by_ids(
                    cv_id=cv_id,
                    jd_id=jd_structured.get("id"),
                    weights=Wn
                )
            else:
                # LEGACY: Generate embeddings for text JD, use stored for CV if available
                match_result = matching_service.match_structured_data(
                    cv_structured=cv_structured,
                    jd_structured=jd_structured,
                    weights=Wn
                )
            
            # Convert MatchResult to CandidateBreakdown
            # Extract assignments from match_details
            skills_assignments = []
            if "skills_analysis" in match_result.match_details and "matches" in match_result.match_details["skills_analysis"]:
                for match in match_result.match_details["skills_analysis"]["matches"]:
                    skills_assignments.append(AssignmentItem(
                        type="skill",
                        jd_index=match.get("jd_index", 0),
                        jd_item=match.get("jd_skill", ""),
                        cv_index=match.get("cv_index", 0),
                        cv_item=match.get("cv_skill", ""),
                        score=match.get("similarity", 0.0),
                    ))
            
            responsibilities_assignments = []
            if "responsibilities_analysis" in match_result.match_details and "matches" in match_result.match_details["responsibilities_analysis"]:
                for match in match_result.match_details["responsibilities_analysis"]["matches"]:
                    responsibilities_assignments.append(AssignmentItem(
                        type="responsibility",
                        jd_index=match.get("jd_index", 0),
                        jd_item=match.get("jd_responsibility", ""),
                        cv_index=match.get("cv_index", 0),
                        cv_item=match.get("cv_responsibility", ""),
                        score=match.get("similarity", 0.0),
                    ))
            
            # Get unmatched skills and responsibilities
            unmatched_jd_skills = match_result.match_details.get("skills_analysis", {}).get("unmatched_jd_skills", [])
            unmatched_jd_responsibilities = match_result.match_details.get("responsibilities_analysis", {}).get("unmatched_jd_responsibilities", [])
            
            # Create CandidateBreakdown
            resp_candidates.append(CandidateBreakdown(
                cv_id=cv_id,
                cv_name=cv_name,
                cv_job_title=cv_title,
                cv_years=cv_years,  # Use the parsed integer value
                skills_score=match_result.skills_score / 100.0,  # Convert percentage to 0-1 scale
                responsibilities_score=match_result.responsibilities_score / 100.0,
                job_title_score=match_result.title_score / 100.0,
                years_score=match_result.experience_score / 100.0,
                overall_score=match_result.overall_score / 100.0,
                skills_assignments=skills_assignments,
                responsibilities_assignments=responsibilities_assignments,
                unmatched_jd_skills=unmatched_jd_skills,
                unmatched_jd_responsibilities=unmatched_jd_responsibilities,
                skills_alternatives=[],  # Not provided by MatchingService
                responsibilities_alternatives=[]  # Not provided by MatchingService
            ))
        
        # Sort candidates by overall score
        resp_candidates.sort(key=lambda x: x.overall_score, reverse=True)
        
        return MatchResponse(
            jd_id=req.jd_id,
            jd_job_title=jd_title,
            jd_years=jd_years,  # Use the parsed integer value
            normalized_weights=MatchWeights(**Wn),
            candidates=resp_candidates
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Matching failed: {e}")
        raise HTTPException(status_code=500, detail=f"Matching error: {str(e)}")
async def match_text(request: TextMatchRequest) -> JSONResponse:
    """
    Match CV text against JD text using LLM standardization and embedding generation.
    This is a legacy endpoint for text-to-text matching.
    """
    try:
        logger.info("---------- TEXT MATCHING START ----------")
        
        # Get services
        llm = get_llm_service()
        matching_service = get_matching_service()
        
        # Standardize both CV and JD
        cv_std = llm.standardize_cv(request.cv_text, request.cv_filename)
        jd_std = llm.standardize_jd(request.jd_text, request.jd_filename)
        
        # Create structured data
        cv_structured = {
            "id": "text_cv",
            "name": "Text CV",
            "job_title": cv_std.get("job_title", ""),
            "years_of_experience": cv_std.get("experience_years", 0),
            "skills": cv_std.get("skills", [])[:20],
            "responsibilities": cv_std.get("responsibilities", [])[:10]
        }
        
        jd_structured = {
            "id": "text_jd",
            "job_title": jd_std.get("job_title", ""),
            "years_of_experience": jd_std.get("experience_years", 0),
            "skills": jd_std.get("skills", [])[:20],
            "responsibilities": jd_std.get("responsibilities", [])[:10]
        }
        
        # Use legacy matching method for text-to-text
        match_result = matching_service.match_structured_data(
            cv_structured=cv_structured,
            jd_structured=jd_structured,
            weights=MatchWeights().dict()
        )
        
        return JSONResponse({
            "status": "success",
            "match_result": {
                "overall_score": match_result.overall_score,
                "skills_score": match_result.skills_score,
                "responsibilities_score": match_result.responsibilities_score,
                "title_score": match_result.title_score,
                "experience_score": match_result.experience_score,
                "explanation": match_result.explanation,
                "processing_time": match_result.processing_time
            }
        })
        
    except Exception as e:
        logger.error(f"❌ Text matching failed: {e}")
        raise HTTPException(status_code=500, detail=f"Text matching failed: {str(e)}")

# Alias kept for FE compatibility
@router.post("/standardize-and-match-text")
async def standardize_and_match_text(request: TextMatchRequest) -> JSONResponse:
    return await match_text(request)

# ----------------------------
# New deterministic matcher (schemas)
# ----------------------------
# @router.post("/match", response_model=MatchResponse)
# async def match_candidates(req: NewMatchRequest):
#     """
#     Deterministic, explainable matching using Hungarian assignment on
#     sentence-level embeddings. Delegates to MatchingService helpers.
#     """
#     try:
#         logger.info(f"🎯 Starting matching request: JD={req.jd_id or 'text'}, CVs={len(req.cv_ids) if req.cv_ids else 'all'}")
#         qdrant = get_qdrant_utils()
#         matching_service = get_matching_service()  # Get the matching service instance
        
#         # Resolve JD (id or text)
#         if not (req.jd_id or req.jd_text):
#             raise HTTPException(status_code=400, detail="Provide jd_id or jd_text")
        
#         if req.jd_id:
#             jd = qdrant.get_structured_jd(req.jd_id)
#             if not jd:
#                 raise HTTPException(status_code=404, detail="JD not found")
#         else:
#             # Use LLM to standardize JD text to the same schema as DB
#             llm = get_llm_service()
#             jd_std = llm.standardize_jd(req.jd_text, "jd_input.txt")
#             jd = {
#                 "id": "text_jd",
#                 "job_title": jd_std.get("job_title", ""),
#                 "years_of_experience": jd_std.get("experience_years", 0),
#                 "skills_sentences": jd_std.get("skills", [])[:20],
#                 "responsibility_sentences": (jd_std.get("responsibilities", []) or jd_std.get("responsibility_sentences", []))[:10],
#             }
        
#         # Candidate set
#         candidates_meta = []
#         if req.cv_ids:
#             for cid in req.cv_ids:
#                 c = qdrant.get_structured_cv(cid)
#                 if c:
#                     candidates_meta.append(c)
#         else:
#             for meta in qdrant.list_all_cvs():
#                 c = qdrant.get_structured_cv(meta["id"])
#                 if c:
#                     candidates_meta.append(c)
        
#         if not candidates_meta:
#             raise HTTPException(status_code=404, detail="No CVs available for matching")
        
#         # Weights
#         W = req.weights.dict() if req.weights else MatchWeights().dict()
#         Wn = normalize_weights(W)
        
#         # Prepare JD structured data for MatchingService
#         jd_structured = {
#             "id": jd.get("id", "text_jd"),
#             "job_title": jd.get("job_title", ""),
#             "years_of_experience": jd.get("years_of_experience", 0),
#             "skills": jd.get("skills_sentences", []),
#             "responsibilities": jd.get("responsibility_sentences", [])
#         }
        
#         # Process each candidate using MatchingService
#         resp_candidates = []
#         for c in candidates_meta:
#             cv_id = c["id"]
#             cv_name = c.get("name") or cv_id
            
#             # Prepare CV structured data for MatchingService
#             cv_structured = {
#                 "id": cv_id,
#                 "name": cv_name,
#                 "job_title": c.get("job_title", ""),
#                 "years_of_experience": c.get("years_of_experience", 0),
#                 "skills": c.get("skills_sentences", []),
#                 "responsibilities": c.get("responsibility_sentences", [])
#             }
            
#             # Use MatchingService to get match result
#             match_result = matching_service.match_structured_data(
#                 cv_structured=cv_structured,
#                 jd_structured=jd_structured,
#                 weights=Wn  # Pass normalized weights
#             )
            
#             # Convert MatchResult to CandidateBreakdown
#             # Extract assignments from match_details
#             skills_assignments = []
#             if "skills_analysis" in match_result.match_details and "matches" in match_result.match_details["skills_analysis"]:
#                 for match in match_result.match_details["skills_analysis"]["matches"]:
#                     skills_assignments.append(AssignmentItem(
#                         type="skill",
#                         jd_index=match.get("jd_index", 0),
#                         jd_item=match.get("jd_skill", ""),
#                         cv_index=match.get("cv_index", 0),
#                         cv_item=match.get("cv_skill", ""),
#                         score=match.get("similarity", 0.0),
#                     ))
            
#             responsibilities_assignments = []
#             if "responsibilities_analysis" in match_result.match_details and "matches" in match_result.match_details["responsibilities_analysis"]:
#                 for match in match_result.match_details["responsibilities_analysis"]["matches"]:
#                     responsibilities_assignments.append(AssignmentItem(
#                         type="responsibility",
#                         jd_index=match.get("jd_index", 0),
#                         jd_item=match.get("jd_responsibility", ""),
#                         cv_index=match.get("cv_index", 0),
#                         cv_item=match.get("cv_responsibility", ""),
#                         score=match.get("similarity", 0.0),
#                     ))
            
#             # Create CandidateBreakdown
#             resp_candidates.append(CandidateBreakdown(
#                 cv_id=cv_id,
#                 cv_name=cv_name,
#                 cv_job_title=cv_structured.get("job_title", ""),
#                 cv_years=cv_structured.get("years_of_experience", 0),
#                 skills_score=match_result.skills_score / 100.0,  # Convert percentage to 0-1 scale
#                 responsibilities_score=match_result.responsibilities_score / 100.0,
#                 job_title_score=match_result.title_score / 100.0,
#                 years_score=match_result.experience_score / 100.0,
#                 overall_score=match_result.overall_score / 100.0,
#                 skills_assignments=skills_assignments,
#                 responsibilities_assignments=responsibilities_assignments,
#                 skills_alternatives=[],  # Not provided by MatchingService
#                 responsibilities_alternatives=[]  # Not provided by MatchingService
#             ))
        
#         # Sort candidates by overall score
#         resp_candidates.sort(key=lambda x: x.overall_score, reverse=True)
        
#         return MatchResponse(
#             jd_id=req.jd_id,
#             jd_job_title=jd_structured.get("job_title", ""),
#             jd_years=jd_structured.get("years_of_experience", 0),
#             normalized_weights=MatchWeights(**Wn),
#             candidates=resp_candidates
#         )
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"❌ Matching failed: {e}")
#         raise HTTPException(status_code=500, detail=f"Matching error: {str(e)}")

# ----------------------------
# Health & system stats
# ----------------------------
@router.get("/health")
async def health_check() -> JSONResponse:
    """
    Verify services and DB connectivity.
    """
    try:
        status = {"status": "healthy", "timestamp": time.time(), "services": {}}
        try:
            q = get_qdrant_utils()
            status["services"]["qdrant"] = q.health_check()
        except Exception as e:
            status["services"]["qdrant"] = {"status": "unhealthy", "error": str(e)}
            status["status"] = "degraded"
        try:
            emb = get_embedding_service()
            status["services"]["embedding"] = emb.health_check()
        except Exception as e:
            status["services"]["embedding"] = {"status": "unhealthy", "error": str(e)}
            status["status"] = "degraded"
        try:
            cache = get_cache_service()
            status["services"]["cache"] = {"status": "healthy", "stats": cache.get_stats()}
        except Exception as e:
            status["services"]["cache"] = {"status": "unhealthy", "error": str(e)}
            status["status"] = "degraded"
        import os
        status["environment"] = {
            "openai_key_configured": bool(os.getenv("OPENAI_API_KEY")),
            "qdrant_host": os.getenv("QDRANT_HOST", "qdrant"),
            "qdrant_port": os.getenv("QDRANT_PORT", "6333"),
        }
        return JSONResponse(status)
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        return JSONResponse(
            {"status": "unhealthy", "error": str(e), "timestamp": time.time()},
            status_code=500
        )

@router.post("/clear-database")
async def clear_database(confirm: bool = False, _: User = Depends(require_admin)) -> JSONResponse:
    """
    ADMIN ONLY - drops all Qdrant collections and recreates them.
    Requires admin role authentication.
    """
    try:
        if not confirm:
            raise HTTPException(status_code=400, detail="Set 'confirm=true' to proceed.")
        q = get_qdrant_utils()
        ok = q.clear_all_data()
        get_cache_service().clear()
        if ok:
            return JSONResponse({
                "status": "success",
                "message": "All data cleared from database and cache",
                "timestamp": time.time(),
            })
        raise HTTPException(status_code=500, detail="Failed to clear database")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Database clear failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database clear failed: {str(e)}")

@router.get("/system-stats")
async def get_system_stats() -> JSONResponse:
    """
    Count items and provide light analytics.
    """
    try:
        q = get_qdrant_utils().client
        cvs = _scroll_all("cv_structured")
        jds = _scroll_all("jd_structured")
        def _skills_count(points):
            vals = []
            for p in points:
                info = (p.payload or {}).get("structured_info", p.payload or {})
                vals.append(len(info.get("skills", [])))
            return vals
        cv_sk_counts = _skills_count(cvs)
        jd_sk_counts = _skills_count(jds)
        stats = {
            "database_stats": {
                "total_cvs": len(cvs),
                "total_jds": len(jds),
                "total_documents": len(cvs) + len(jds),
            },
            "cv_analytics": {
                "total_cvs": len(cvs),
                "avg_skills_per_cv": (sum(cv_sk_counts) / len(cv_sk_counts)) if cv_sk_counts else 0,
                "max_skills_per_cv": max(cv_sk_counts) if cv_sk_counts else 0,
                "min_skills_per_cv": min(cv_sk_counts) if cv_sk_counts else 0,
            },
            "jd_analytics": {
                "total_jds": len(jds),
                "avg_skills_per_jd": (sum(jd_sk_counts) / len(jd_sk_counts)) if jd_sk_counts else 0,
                "max_skills_per_jd": max(jd_sk_counts) if jd_sk_counts else 0,
                "min_skills_per_jd": min(jd_sk_counts) if jd_sk_counts else 0,
            },
            "cache_stats": get_cache_service().get_stats(),
            "system_info": {
                "embedding_model": "all-mpnet-base-v2",
                "embedding_dimension": 768,
                "llm_model": "gpt-4.1-mini",
                "similarity_metric": "cosine",
            },
        }
        return JSONResponse({"status": "success", "stats": stats, "timestamp": time.time()})
    except Exception as e:
        logger.error(f"❌ Failed to gather system stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to gather system stats: {str(e)}")

# ----------------------------
# DB Introspection
# ----------------------------
@router.get("/database/status")
async def get_database_status():
    try:
        q = get_qdrant_utils().client
        cols = q.get_collections()
        collections = []
        for c in cols.collections:
            name = c.name
            info = q.get_collection(name)
            # Vector config (single or multi)
            vectors = info.config.params.vectors
            if hasattr(vectors, "size"):
                vector_config = {"size": vectors.size, "distance": str(vectors.distance)}
            else:
                vector_config = {n: {"size": v.size, "distance": str(v.distance)} for n, v in vectors.items()}
            collections.append({
                "name": name,
                "points_count": info.points_count,
                "vector_config": vector_config,
                "status": str(info.status),
                "indexed_vectors_count": info.indexed_vectors_count,
            })
        return JSONResponse({
            "status": "success",
            "collections": collections,
            "total_collections": len(collections),
            "timestamp": time.time(),
        })
    except Exception as e:
        logger.error(f"❌ Failed to get database status: {e}")
        raise HTTPException(status_code=500, detail=f"Database status error: {str(e)}")

@router.get("/database/collections")
async def list_all_collections():
    try:
        q = get_qdrant_utils().client
        cols = q.get_collections()
        detailed = {}
        for c in cols.collections:
            name = c.name
            info = q.get_collection(name)
            try:
                sample_points, _ = q.scroll(
                    collection_name=name,
                    limit=2,
                    with_payload=True,
                    with_vectors=False,
                )
                samples = [p.payload for p in (sample_points or [])]
            except Exception:
                samples = []
            vectors = info.config.params.vectors
            if hasattr(vectors, "size"):
                vector_config = {"size": vectors.size, "distance": str(vectors.distance)}
            else:
                vector_config = {n: {"size": v.size, "distance": str(v.distance)} for n, v in vectors.items()}
            detailed[name] = {
                "points_count": info.points_count,
                "vector_config": vector_config,
                "status": str(info.status),
                "sample_data": samples,
            }
        return JSONResponse({"status": "success", "collections": detailed, "timestamp": time.time()})
    except Exception as e:
        logger.error(f"❌ Failed to list collections: {e}")
        raise HTTPException(status_code=500, detail=f"Collections listing error: {str(e)}")

@router.get("/database/cv/{cv_id}")
async def get_cv_data(cv_id: str):
    """
    Show what's stored for a specific CV across the three collections:
      - cv_documents
      - cv_structured
      - cv_embeddings
    """
    try:
        q = get_qdrant_utils().client
        out: Dict[str, Any] = {}
        # cv_documents
        try:
            res = q.retrieve("cv_documents", ids=[cv_id], with_payload=True, with_vectors=False)
            out["documents"] = {"found": bool(res), "payload": (res[0].payload if res else None)}
        except Exception as e:
            out["documents"] = {"found": False, "error": str(e)}
        # cv_structured
        try:
            res = q.retrieve("cv_structured", ids=[cv_id], with_payload=True, with_vectors=False)
            out["structured"] = {"found": bool(res), "payload": (res[0].payload if res else None)}
        except Exception as e:
            out["structured"] = {"found": False, "error": str(e)}
        # cv_embeddings (sample)
        try:
            pts, _ = q.scroll(
                collection_name="cv_embeddings",
                scroll_filter={"must": [{"key": "document_id", "match": {"value": cv_id}}]},
                limit=5,
                with_payload=True,
                with_vectors=False,
            )
            out["embeddings"] = {
                "found": bool(pts),
                "count_sampled": len(pts or []),
                "sample": [p.payload for p in (pts or [])],
            }
        except Exception as e:
            out["embeddings"] = {"found": False, "error": str(e)}
        return JSONResponse({"status": "success", "cv_id": cv_id, "storage_locations": out, "timestamp": time.time()})
    except Exception as e:
        logger.error(f"❌ Failed to get CV data: {e}")
        raise HTTPException(status_code=500, detail=f"CV data retrieval error: {str(e)}")

@router.get("/database/jd/{jd_id}")
async def get_jd_data(jd_id: str):
    """
    Show what's stored for a specific JD across the three collections:
      - jd_documents
      - jd_structured
      - jd_embeddings
    """
    try:
        q = get_qdrant_utils().client
        out: Dict[str, Any] = {}
        # jd_documents
        try:
            res = q.retrieve("jd_documents", ids=[jd_id], with_payload=True, with_vectors=False)
            out["documents"] = {"found": bool(res), "payload": (res[0].payload if res else None)}
        except Exception as e:
            out["documents"] = {"found": False, "error": str(e)}
        # jd_structured
        try:
            res = q.retrieve("jd_structured", ids=[jd_id], with_payload=True, with_vectors=False)
            out["structured"] = {"found": bool(res), "payload": (res[0].payload if res else None)}
        except Exception as e:
            out["structured"] = {"found": False, "error": str(e)}
        # jd_embeddings (sample)
        try:
            pts, _ = q.scroll(
                collection_name="jd_embeddings",
                scroll_filter={"must": [{"key": "document_id", "match": {"value": jd_id}}]},
                limit=5,
                with_payload=True,
                with_vectors=False,
            )
            out["embeddings"] = {
                "found": bool(pts),
                "count_sampled": len(pts or []),
                "sample": [p.payload for p in (pts or [])],
            }
        except Exception as e:
            out["embeddings"] = {"found": False, "error": str(e)}
        return JSONResponse({"status": "success", "jd_id": jd_id, "storage_locations": out, "timestamp": time.time()})
    except Exception as e:
        logger.error(f"❌ Failed to get JD data: {e}")
        raise HTTPException(status_code=500, detail=f"JD data retrieval error: {str(e)}")

@router.get("/database/embeddings")
async def get_embeddings_info():
    """
    Summarize embedding structure for cv_embeddings and jd_embeddings.
    """
    try:
        q = get_qdrant_utils().client
        info = {}
        for name in ["cv_embeddings", "jd_embeddings"]:
            try:
                coll = q.get_collection(name)
                pts, _ = q.scroll(
                    collection_name=name,
                    limit=1,
                    with_payload=True,
                    with_vectors=True,
                )
                if pts:
                    p = pts[0]
                    info[name] = {
                        "total_points": coll.points_count,
                        "sample_payload_keys": list((p.payload or {}).keys()),
                        "vector_dim": len(p.vector) if isinstance(p.vector, list) else 768,
                        "embedding_model": "all-mpnet-base-v2",
                    }
                else:
                    info[name] = {
                        "total_points": coll.points_count,
                        "vector_structure": "No data",
                        "status": "Empty collection",
                    }
            except Exception as e:
                info[name] = {"error": str(e)}
        return JSONResponse({
            "status": "success",
            "embeddings_info": info,
            "embedding_model": "all-mpnet-base-v2",
            "vector_dimensions": 768,
            "distance_metric": "Cosine",
            "timestamp": time.time(),
        })
    except Exception as e:
        logger.error(f"❌ Failed to get embeddings info: {e}")
        raise HTTPException(status_code=500, detail=f"Embeddings info error: {str(e)}")

@router.get("/database/view")
async def view_database() -> JSONResponse:
    """
    Formatted DB view using *_structured collections.
    """
    try:
        cvs = _scroll_all("cv_structured")
        jds = _scroll_all("jd_structured")
        formatted_cvs = []
        for p in cvs:
            pl = p.payload or {}
            s = pl.get("structured_info", pl)
            formatted_cvs.append({
                "id": pl.get("id") or pl.get("document_id") or str(p.id),
                "name": s.get("full_name", s.get("name", "Unknown")),
                "filename": s.get("filename", "Unknown"),
                "job_title": s.get("job_title", "Not specified"),
                "skills_count": len(s.get("skills", [])),
                "experience_years": s.get("experience_years", "Not specified"),
                "upload_date": s.get("upload_date", "Unknown"),
                "text_length": len(s.get("extracted_text", "")) if s.get("extracted_text") else 0,
                "top_skills": (s.get("skills", [])[:5]),
                "responsibilities_count": len(s.get("responsibilities", s.get("responsibility_sentences", []))),
                "has_structured_data": True,
            })
        formatted_jds = []
        for p in jds:
            pl = p.payload or {}
            s = pl.get("structured_info", pl)
            formatted_jds.append({
                "id": pl.get("id") or pl.get("document_id") or str(p.id),
                "filename": s.get("filename", "Unknown"),
                "job_title": s.get("job_title", "Not specified"),
                "required_skills": len(s.get("skills", [])),
                "required_years": s.get("experience_years", "Not specified"),
                "upload_date": s.get("upload_date", "Unknown"),
                "text_length": len(s.get("extracted_text", "")) if s.get("extracted_text") else 0,
                "top_skills": (s.get("skills", [])[:5]),
                "responsibilities_count": len(s.get("responsibilities", s.get("responsibility_sentences", []))),
                "has_structured_data": True,
            })
        formatted_cvs.sort(key=lambda x: x["upload_date"], reverse=True)
        formatted_jds.sort(key=lambda x: x["upload_date"], reverse=True)
        summary = {
            "total_documents": len(formatted_cvs) + len(formatted_jds),
            "total_cvs": len(formatted_cvs),
            "total_jds": len(formatted_jds),
            "avg_cv_skills": (sum(c["skills_count"] for c in formatted_cvs) / len(formatted_cvs)) if formatted_cvs else 0,
            "avg_jd_skills": (sum(j["required_skills"] for j in formatted_jds) / len(formatted_jds)) if formatted_jds else 0,
            "ready_for_matching": bool(formatted_cvs) and bool(formatted_jds),
        }
        return JSONResponse({
            "success": True,
            "data": {"cvs": formatted_cvs, "jds": formatted_jds, "summary": summary},
            "timestamp": time.time(),
        })
    except Exception as e:
        logger.error(f"❌ Failed to get database view: {e}")
        raise HTTPException(status_code=500, detail=f"Database view error: {str(e)}")