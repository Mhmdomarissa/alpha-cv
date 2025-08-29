"""
Matching Service - Consolidated CV-JD Matching Operations
Uses EXACT 32-vector storage in {cv,jd}_embeddings and structured JSON in {cv,jd}_structured.
"""
import logging
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np
from scipy.optimize import linear_sum_assignment
from app.services.embedding_service import get_embedding_service
from app.utils.qdrant_utils import get_qdrant_utils
logger = logging.getLogger(__name__)

# ----------------------------
# Utilities
# ----------------------------
def normalize_weights(weights: Dict[str, float]) -> Dict[str, float]:
    total = sum(weights.values())
    if total <= 0:
        return {"skills": 0.25, "responsibilities": 0.25, "job_title": 0.25, "experience": 0.25}
    return {k: v / total for k, v in weights.items()}

def years_score(jd_years: int, cv_years: int) -> float:
    if jd_years <= 0:
        return 1.0
    return min(1.0, float(cv_years) / float(jd_years))

def hungarian_mean(sim_matrix: np.ndarray) -> Tuple[float, List[Tuple[int, int, float]]]:
    if sim_matrix.size == 0:
        return 0.0, []
    r_idx, c_idx = linear_sum_assignment(-sim_matrix)  # maximize
    pairs = [(int(r), int(c), float(sim_matrix[r, c])) for r, c in zip(r_idx, c_idx)]
    score = float(np.mean([p[2] for p in pairs])) if pairs else 0.0
    return score, pairs

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

# ----------------------------
# Response models
# ----------------------------
@dataclass
class MatchResult:
    cv_id: str
    jd_id: str
    overall_score: float
    skills_score: float
    responsibilities_score: float
    title_score: float
    experience_score: float
    explanation: str
    match_details: Dict[str, Any]
    processing_time: float

# ----------------------------
# Matching Service
# ----------------------------
class MatchingService:
    # Final presentation weights (percent-based inputs later scaled to 0..1 here)
    SCORING_WEIGHTS = {"skills": 0.80, "responsibilities": 0.15, "title": 0.025, "experience": 0.025}

    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.qdrant = get_qdrant_utils()
        logger.info("🎯 MatchingService initialized (uses *_structured & *_embeddings)")

    # ---------- Public APIs ----------
    def match_cv_against_jd_exact(self, cv_id: str, jd_id: str) -> dict:
        """
        EXACT vector matching (32 vectors) using {cv,jd}_embeddings.
        Weights: 80% skills, 15% responsibilities, 2.5% title, 2.5% experience.
        """
        try:
            logger.info(f"🎯 EXACT 32-vector matching: CV {cv_id} vs JD {jd_id}")
            t0 = time.time()
            cv_vecs = self._get_exact_vectors(cv_id, "cv")
            jd_vecs = self._get_exact_vectors(jd_id, "jd")
            if not cv_vecs or not jd_vecs:
                raise Exception("Missing embeddings for CV or JD")
            # 80% - Skills (average best alignment of each CV skill to JD skills)
            skills_score = self._avg_best_similarity(cv_vecs["skill_vectors"], jd_vecs["skill_vectors"])
            # 15% - Responsibilities
            resp_score = self._avg_best_similarity(cv_vecs["responsibility_vectors"], jd_vecs["responsibility_vectors"])
            # 2.5% - Experience (1 vs 1)
            exp_score = self._cos_sim_list(cv_vecs["experience_vector"][0], jd_vecs["experience_vector"][0]) if (cv_vecs["experience_vector"] and jd_vecs["experience_vector"]) else 0.0
            # 2.5% - Title (1 vs 1)
            title_score = self._cos_sim_list(cv_vecs["job_title_vector"][0], jd_vecs["job_title_vector"][0]) if (cv_vecs["job_title_vector"] and jd_vecs["job_title_vector"]) else 0.0
            final = skills_score * 0.80 + resp_score * 0.15 + exp_score * 0.025 + title_score * 0.025
            dt = time.time() - t0
            return {
                "cv_id": cv_id,
                "jd_id": jd_id,
                "final_score": final,
                "final_score_percentage": final * 100.0,
                "breakdown": {
                    "skills_score": skills_score * 0.80,
                    "responsibilities_score": resp_score * 0.15,
                    "experience_score": exp_score * 0.025,
                    "job_title_score": title_score * 0.025,
                },
                "processing_time": dt,
                "vector_counts": {
                    "cv_skill_vectors": len(cv_vecs.get("skill_vectors", [])),
                    "cv_responsibility_vectors": len(cv_vecs.get("responsibility_vectors", [])),
                    "jd_skill_vectors": len(jd_vecs.get("skill_vectors", [])),
                    "jd_responsibility_vectors": len(jd_vecs.get("responsibility_vectors", [])),
                },
            }
        except Exception as e:
            logger.error(f"❌ EXACT matching failed: {e}")
            raise Exception(f"CV-JD exact matching failed: {e}")

    def match_cv_against_jd(self, cv_id: str, jd_id: str) -> MatchResult:
        """
        Explainable matching:
        - Pulls structured text from {cv,jd}_structured
        - Uses vectors from {cv,jd}_embeddings if present; else generates & stores exact 32 vectors.
        - Produces % scores for skills/responsibilities and combines with title/experience into weighted overall.
        """
        try:
            logger.info("---------- MATCHING START ----------")
            logger.info(f"CV ID: {cv_id} | JD ID: {jd_id}")
            t0 = time.time()
            # ---- structured JSON ----
            cv_std = self._get_structured(cv_id, "cv")
            jd_std = self._get_structured(jd_id, "jd")
            if not cv_std:
                raise Exception(f"CV not found: {cv_id}")
            if not jd_std:
                raise Exception(f"JD not found: {jd_id}")
            # ---- embeddings (prefer stored; otherwise generate + persist exact 32) ----
            cv_emb = self._get_or_generate_embeddings(cv_id, "cv", cv_std)
            jd_emb = self._get_or_generate_embeddings(jd_id, "jd", jd_std)
            # ---- similarities ----
            skills_analysis = self._skills_similarity(
                jd_emb["skills"], cv_emb["skills"],
                jd_std.get("skills", []),
                cv_std.get("skills", [])
            )
            responsibilities_analysis = self._responsibilities_similarity(
                jd_emb["responsibilities"], cv_emb["responsibilities"],
                jd_std.get("responsibilities", []) or jd_std.get("responsibility_sentences", []),
                cv_std.get("responsibilities", [])
            )
            title_sim = 0.0
            if jd_emb["title"] is not None and cv_emb["title"] is not None:
                title_sim = self.embedding_service.calculate_cosine_similarity(jd_emb["title"], cv_emb["title"])
            meets, exp_score_pct = self._experience_match(
                jd_std.get("experience_years", "") or jd_std.get("years_of_experience", ""),
                cv_std.get("experience_years", "") or cv_std.get("years_of_experience", "")
            )
            # ---- assemble weighted score ----
            skills_pct = skills_analysis["skill_match_percentage"]
            resp_pct = responsibilities_analysis["responsibility_match_percentage"]
            title_pct = title_sim * 100.0
            overall = (
                skills_pct * self.SCORING_WEIGHTS["skills"] +
                resp_pct * self.SCORING_WEIGHTS["responsibilities"] +
                title_pct * self.SCORING_WEIGHTS["title"] +
                exp_score_pct * self.SCORING_WEIGHTS["experience"]
            )
            explanation = self._build_explanation(
                skills_pct, skills_analysis, resp_pct, responsibilities_analysis, title_sim, meets
            )
            match_details = self._build_details(cv_std, jd_std, skills_analysis, responsibilities_analysis, title_sim, exp_score_pct)
            return MatchResult(
                cv_id=cv_id, jd_id=jd_id, overall_score=overall,
                skills_score=skills_pct, responsibilities_score=resp_pct,
                title_score=title_pct, experience_score=exp_score_pct,
                explanation=explanation, match_details=match_details,
                processing_time=time.time() - t0
            )
        except Exception as e:
            logger.error(f"❌ Matching failed: {e}")
            raise Exception(f"CV-JD matching failed: {e}")

    def match_structured_data(self, cv_structured: dict, jd_structured: dict, weights: dict = None) -> MatchResult:
        """
        Match CV against JD using structured data directly.
        Uses the same algorithm as match_cv_against_jd but works with in-memory data.
        """
        try:
            logger.info("---------- MATCHING START (structured data) ----------")
            logger.info(f"CV: {cv_structured.get('name', 'unknown')} | JD: {jd_structured.get('job_title', 'unknown')}")
            t0 = time.time()
            
            # Use provided weights or default
            if weights is None:
                weights = self.SCORING_WEIGHTS
            else:
                # Normalize weights if needed
                total = sum(weights.values())
                if total > 0:
                    weights = {k: v/total for k, v in weights.items()}
                else:
                    weights = self.SCORING_WEIGHTS
            
            # Parse years properly to handle string values like "3-7"
            jd_years = safe_parse_years(jd_structured.get("years_of_experience", 0))
            cv_years = safe_parse_years(cv_structured.get("years_of_experience", 0))
            
            # Update structured data with parsed years
            jd_structured["years_of_experience"] = jd_years
            cv_structured["years_of_experience"] = cv_years
            
            # Generate embeddings for CV and JD
            cv_emb = self._generate_embeddings_from_structured(cv_structured, "cv")
            jd_emb = self._generate_embeddings_from_structured(jd_structured, "jd")
            
            # Calculate similarities
            skills_analysis = self._skills_similarity(
                jd_emb["skills"], cv_emb["skills"],
                jd_structured.get("skills", []),
                cv_structured.get("skills", [])
            )
            responsibilities_analysis = self._responsibilities_similarity(
                jd_emb["responsibilities"], cv_emb["responsibilities"],
                jd_structured.get("responsibilities", []),
                cv_structured.get("responsibilities", [])
            )
            
            # Calculate title similarity
            title_sim = 0.0
            if jd_emb["title"] is not None and cv_emb["title"] is not None:
                title_sim = self.embedding_service.calculate_cosine_similarity(jd_emb["title"], cv_emb["title"])
            
            # Calculate experience match
            meets, exp_score_pct = self._experience_match(
                str(jd_years),  # Convert to string for the experience_match method
                str(cv_years)   # Convert to string for the experience_match method
            )
            
            # Calculate weighted overall score
            skills_pct = skills_analysis["skill_match_percentage"]
            resp_pct = responsibilities_analysis["responsibility_match_percentage"]
            title_pct = title_sim * 100.0
            
            overall = (
                skills_pct * weights.get("skills", 0.25) +
                resp_pct * weights.get("responsibilities", 0.25) +
                title_pct * weights.get("job_title", 0.25) +
                exp_score_pct * weights.get("experience", 0.25)
            )
            
            # Build explanation
            explanation = self._build_explanation(
                skills_pct, skills_analysis, resp_pct, responsibilities_analysis, title_sim, meets
            )
            
            # Build match details
            match_details = self._build_details(
                cv_structured, jd_structured, skills_analysis, responsibilities_analysis, title_sim, exp_score_pct
            )
            
            return MatchResult(
                cv_id=cv_structured.get("id", "unknown"),
                jd_id=jd_structured.get("id", "unknown"),
                overall_score=overall,
                skills_score=skills_pct,
                responsibilities_score=resp_pct,
                title_score=title_pct,
                experience_score=exp_score_pct,
                explanation=explanation,
                match_details=match_details,
                processing_time=time.time() - t0
            )
        except Exception as e:
            logger.error(f"❌ Matching failed: {e}")
            raise Exception(f"CV-JD matching failed: {e}")

    def bulk_match(self, jd_id: str, cv_ids: List[str], top_k: int = 10) -> List[MatchResult]:
        try:
            results: List[MatchResult] = []
            for cid in cv_ids:
                try:
                    results.append(self.match_cv_against_jd(cid, jd_id))
                except Exception as e:
                    logger.warning(f"⚠ Failed to match CV {cid}: {e}")
            results.sort(key=lambda x: x.overall_score, reverse=True)
            return results[:top_k]
        except Exception as e:
            logger.error(f"❌ Bulk matching failed: {e}")
            raise

    def find_top_candidates(self, jd_id: str, limit: int = 10) -> List[MatchResult]:
        try:
            cv_ids = self._list_all_cv_ids()
            return self.bulk_match(jd_id, cv_ids, top_k=limit)
        except Exception as e:
            logger.error(f"❌ Top candidate search failed: {e}")
            raise

    # ---------- Data access helpers ----------
    def _get_structured(self, doc_id: str, doc_type: str) -> Dict[str, Any]:
        """
        Fetch structured JSON from {doc_type}_structured by id.
        """
        try:
            res = self.qdrant.client.retrieve(f"{doc_type}_structured", ids=[doc_id], with_payload=True, with_vectors=False)
            if not res:
                return {}
            payload = res[0].payload or {}
            return payload.get("structured_info", payload)
        except Exception as e:
            logger.error(f"❌ Structured fetch failed for {doc_type} {doc_id}: {e}")
            return {}

    def _get_exact_vectors(self, doc_id: str, doc_type: str) -> Dict[str, Any]:
        """
        Pull points from {doc_type}_embeddings with document_id filter.
        Returns dict with lists: skill_vectors[20], responsibility_vectors[10], experience_vector[1], job_title_vector[1].
        """
        try:
            points, _ = self.qdrant.client.scroll(
                collection_name=f"{doc_type}_embeddings",
                scroll_filter={"must": [{"key": "document_id", "match": {"value": doc_id}}]},
                limit=2000,
                with_payload=True,
                with_vectors=True
            )
            if not points:
                return {}
            out = {
                "skill_vectors": [],
                "responsibility_vectors": [],
                "experience_vector": [],
                "job_title_vector": []
            }
            # Pre-size arrays to keep ordering if indices exist
            skill_temp: Dict[int, List[float]] = {}
            resp_temp: Dict[int, List[float]] = {}
            for p in points:
                pl = p.payload or {}
                vtype = pl.get("vector_type")
                vidx = int(pl.get("vector_index", 0))
                vec = p.vector if isinstance(p.vector, list) else p.vector  # already list
                if vtype == "skill":
                    skill_temp[vidx] = vec
                elif vtype == "responsibility":
                    resp_temp[vidx] = vec
                elif vtype == "experience":
                    out["experience_vector"] = [vec]
                elif vtype == "job_title":
                    out["job_title_vector"] = [vec]
            # Order by index and clip to required counts
            out["skill_vectors"] = [skill_temp[i] for i in sorted(skill_temp.keys())][:20]
            out["responsibility_vectors"] = [resp_temp[i] for i in sorted(resp_temp.keys())][:10]
            return out
        except Exception as e:
            logger.error(f"❌ Exact vectors fetch failed for {doc_type} {doc_id}: {e}")
            return {}

    def _get_or_generate_embeddings(self, doc_id: str, doc_type: str, std: Dict[str, Any]) -> Dict[str, Any]:
        """
        Returns sentence->vector maps for skills/responsibilities + single vectors for title/experience.
        Prefers stored {doc_type}_embeddings; if absent, generates and stores exactly 32 vectors.
        """
        # Try to reconstruct maps from stored embeddings first
        points, _ = self.qdrant.client.scroll(
            collection_name=f"{doc_type}_embeddings",
            scroll_filter={"must": [{"key": "document_id", "match": {"value": doc_id}}]},
            limit=2000,
            with_payload=True,
            with_vectors=True
        )
        if points:
            skills_map: Dict[str, np.ndarray] = {}
            resp_map: Dict[str, np.ndarray] = {}
            title_vec: Optional[np.ndarray] = None
            exp_vec: Optional[np.ndarray] = None
            for p in points:
                pl = p.payload or {}
                vtype = pl.get("vector_type")
                content = pl.get("content", "")
                vec = np.array(p.vector) if isinstance(p.vector, list) else np.array(p.vector)
                if vtype == "skill" and content:
                    skills_map[content] = vec
                elif vtype == "responsibility" and content:
                    resp_map[content] = vec
                elif vtype == "job_title":
                    title_vec = vec
                elif vtype == "experience":
                    exp_vec = vec
            return {"skills": skills_map, "responsibilities": resp_map, "title": title_vec, "experience": exp_vec}
        # No stored vectors? Generate and persist exact 32
        emb = self.embedding_service
        doc_emb = emb.generate_document_embeddings(std)
        self.qdrant.store_embeddings_exact(doc_id, doc_type, doc_emb)
        # Build maps from generated content lists
        skills_map = {}
        for s, v in zip(doc_emb.get("skills", []), doc_emb.get("skill_vectors", [])):
            skills_map[s] = np.array(v)
        resp_map = {}
        for r, v in zip(doc_emb.get("responsibilities", []), doc_emb.get("responsibility_vectors", [])):
            resp_map[r] = np.array(v)
        title_vec = np.array(doc_emb["job_title_vector"][0]) if doc_emb.get("job_title_vector") else None
        exp_vec = np.array(doc_emb["experience_vector"][0]) if doc_emb.get("experience_vector") else None
        return {"skills": skills_map, "responsibilities": resp_map, "title": title_vec, "experience": exp_vec}

    def _generate_embeddings_from_structured(self, structured_data: dict, doc_type: str) -> dict:
        """
        Generate embeddings from structured data without storing to database.
        """
        # Generate document embeddings using the embedding service
        doc_emb = self.embedding_service.generate_document_embeddings(structured_data)
        
        # Build maps from generated content lists
        skills_map = {}
        for s, v in zip(doc_emb.get("skills", []), doc_emb.get("skill_vectors", [])):
            skills_map[s] = np.array(v)
        
        resp_map = {}
        for r, v in zip(doc_emb.get("responsibilities", []), doc_emb.get("responsibility_vectors", [])):
            resp_map[r] = np.array(v)
        
        title_vec = np.array(doc_emb["job_title_vector"][0]) if doc_emb.get("job_title_vector") else None
        exp_vec = np.array(doc_emb["experience_vector"][0]) if doc_emb.get("experience_vector") else None
        
        return {
            "skills": skills_map,
            "responsibilities": resp_map,
            "title": title_vec,
            "experience": exp_vec
        }

    def _list_all_cv_ids(self) -> List[str]:
        """
        Returns all CV ids from cv_structured.
        """
        ids: List[str] = []
        offset = None
        while True:
            points, next_off = self.qdrant.client.scroll(
                collection_name="cv_structured",
                limit=500,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            for p in points:
                pl = p.payload or {}
                ids.append(pl.get("id") or pl.get("document_id") or str(p.id))
            if not next_off:
                break
            offset = next_off
        return ids

    # ---------- Similarity helpers ----------
    def _avg_best_similarity(self, A: List[List[float]], B: List[List[float]]) -> float:
        """
        For each vector in A, take the best cosine similarity against all vectors in B; then average.
        """
        if not A or not B:
            return 0.0
        sims = []
        for va in A:
            va_np = np.array(va)
            best = 0.0
            for vb in B:
                vb_np = np.array(vb)
                num = float(np.dot(va_np, vb_np))
                den = float(np.linalg.norm(va_np) * np.linalg.norm(vb_np)) or 1.0
                sim = max(0.0, min(1.0, num / den))
                if sim > best:
                    best = sim
            sims.append(best)
        return float(np.mean(sims)) if sims else 0.0

    def _cos_sim_list(self, v1: List[float], v2: List[float]) -> float:
        v1 = np.array(v1); v2 = np.array(v2)
        den = (np.linalg.norm(v1) * np.linalg.norm(v2)) or 1.0
        return float(max(0.0, min(1.0, float(np.dot(v1, v2)) / den)))

    def _skills_similarity(self, jd_emb: Dict[str, np.ndarray], cv_emb: Dict[str, np.ndarray],
                           jd_skills: List[str], cv_skills: List[str]) -> Dict[str, Any]:
        if not jd_emb or not cv_emb:
            return {"skill_match_percentage": 0.0, "matched_skills": 0, "total_jd_skills": len(jd_skills), 
                    "matches": [], "unmatched_jd_skills": jd_skills}
        
        matches, matched = [], 0
        for idx, jd_s in enumerate(jd_skills):
            v1 = jd_emb.get(jd_s)
            if v1 is None:
                continue
            
            best_item, best_sim = None, 0.0
            best_idx = -1
            
            for cv_idx, cv_s in enumerate(cv_skills):
                v2 = cv_emb.get(cv_s)
                if v2 is None:
                    continue
                    
                sim = self.embedding_service.calculate_cosine_similarity(v1, v2)
                if sim > best_sim:
                    best_sim, best_item, best_idx = sim, cv_s, cv_idx
            
            if best_item and best_sim >= self.embedding_service.SIMILARITY_THRESHOLDS["skills"]["minimum"]:
                matched += 1
                matches.append({
                    "jd_skill": jd_s, 
                    "cv_skill": best_item, 
                    "similarity": best_sim, 
                    "quality": self.embedding_service.get_match_quality(best_sim, "skills"),
                    "jd_index": idx,
                    "cv_index": best_idx
                })
        
        total = len(jd_skills) or 1
        pct = matched / total * 100.0
        unmatched = [s for s in jd_skills if s not in [m["jd_skill"] for m in matches]]
        
        return {
            "skill_match_percentage": pct, 
            "matched_skills": matched, 
            "total_jd_skills": len(jd_skills), 
            "matches": matches, 
            "unmatched_jd_skills": unmatched
        }

    def _responsibilities_similarity(self, jd_emb: Dict[str, np.ndarray], cv_emb: Dict[str, np.ndarray],
                                     jd_resps: List[str], cv_resps: List[str]) -> Dict[str, Any]:
        if not jd_emb or not cv_emb:
            return {"responsibility_match_percentage": 0.0, "matched_responsibilities": 0, 
                    "total_jd_responsibilities": len(jd_resps), "matches": [], 
                    "unmatched_jd_responsibilities": jd_resps}
        
        matches, matched = [], 0
        for idx, jd_r in enumerate(jd_resps):
            v1 = jd_emb.get(jd_r)
            if v1 is None:
                continue
                
            best_item, best_sim = None, 0.0
            best_idx = -1
            
            for cv_idx, cv_r in enumerate(cv_resps):
                v2 = cv_emb.get(cv_r)
                if v2 is None:
                    continue
                    
                sim = self.embedding_service.calculate_cosine_similarity(v1, v2)
                if sim > best_sim:
                    best_sim, best_item, best_idx = sim, cv_r, cv_idx
            
            if best_item and best_sim >= self.embedding_service.SIMILARITY_THRESHOLDS["responsibilities"]["minimum"]:
                matched += 1
                matches.append({
                    "jd_responsibility": jd_r, 
                    "cv_responsibility": best_item, 
                    "similarity": best_sim, 
                    "quality": self.embedding_service.get_match_quality(best_sim, "responsibilities"),
                    "jd_index": idx,
                    "cv_index": best_idx
                })
        
        total = len(jd_resps) or 1
        pct = matched / total * 100.0
        unmatched = [r for r in jd_resps if r not in [m["jd_responsibility"] for m in matches]]
        
        return {
            "responsibility_match_percentage": pct, 
            "matched_responsibilities": matched, 
            "total_jd_responsibilities": len(jd_resps), 
            "matches": matches, 
            "unmatched_jd_responsibilities": unmatched
        }

    def _experience_match(self, jd_exp: str, cv_exp: str) -> Tuple[bool, float]:
        try:
            import re
            jd_nums = re.findall(r'(\d+)', jd_exp or "")
            cv_nums = re.findall(r'(\d+)', cv_exp or "")
            if jd_nums and cv_nums:
                req, cand = int(jd_nums[0]), int(cv_nums[0])
                if cand >= req:
                    return True, min(100.0, 80.0 + (cand - req) * 5.0)
                else:
                    return False, max(30.0, (cand / max(req, 1)) * 60.0)
            return True, 75.0
        except Exception:
            return True, 75.0

    def _build_explanation(self, skills_pct: float, skills_analysis: Dict[str, Any],
                           resp_pct: float, resp_analysis: Dict[str, Any],
                           title_sim: float, meets: bool) -> str:
        parts = []
        if skills_pct >= 80:
            parts.append(f"Excellent skills match: {skills_analysis['matched_skills']}/{skills_analysis['total_jd_skills']} ({skills_pct:.0f}%)")
        elif skills_pct >= 60:
            parts.append(f"Good skills match: {skills_analysis['matched_skills']}/{skills_analysis['total_jd_skills']} ({skills_pct:.0f}%)")
        else:
            parts.append(f"Limited skills match: {skills_analysis['matched_skills']}/{skills_analysis['total_jd_skills']} ({skills_pct:.0f}%)")
        if resp_pct >= 70:
            parts.append(f"Strong experience alignment: {resp_analysis['matched_responsibilities']}/{resp_analysis['total_jd_responsibilities']} ({resp_pct:.0f}%)")
        elif resp_pct >= 50:
            parts.append(f"Moderate experience alignment: {resp_analysis['matched_responsibilities']}/{resp_analysis['total_jd_responsibilities']} ({resp_pct:.0f}%)")
        else:
            parts.append(f"Limited experience alignment: {resp_analysis['matched_responsibilities']}/{resp_analysis['total_jd_responsibilities']} ({resp_pct:.0f}%)")
        if title_sim >= 0.8:
            parts.append("Job title strongly aligned")
        elif title_sim >= 0.6:
            parts.append("Job title moderately aligned")
        else:
            parts.append("Job title limited alignment")
        parts.append("Experience requirements satisfied" if meets else "Experience requirements may not be fully met")
        return ". ".join(parts) + "."

    def _build_details(self, cv_std: Dict[str, Any], jd_std: Dict[str, Any],
                       skills_analysis: Dict[str, Any], resp_analysis: Dict[str, Any],
                       title_sim: float, exp_score: float) -> Dict[str, Any]:
        return {
            "skills_analysis": {
                "total_required": skills_analysis["total_jd_skills"],
                "matched": skills_analysis["matched_skills"],
                "match_percentage": skills_analysis["skill_match_percentage"],
                "matches": skills_analysis["matches"][:5],
                "unmatched": skills_analysis["unmatched_jd_skills"],
            },
            "responsibilities_analysis": {
                "total_required": resp_analysis["total_jd_responsibilities"],
                "matched": resp_analysis["matched_responsibilities"],
                "match_percentage": resp_analysis["responsibility_match_percentage"],
                "matches": resp_analysis["matches"][:5],
                "unmatched": resp_analysis["unmatched_jd_responsibilities"],
            },
            "title_analysis": {
                "jd_title": jd_std.get("job_title", ""),
                "cv_title": cv_std.get("job_title", ""),
                "similarity": title_sim,
                "match_quality": self.embedding_service.get_match_quality(title_sim, "skills"),
            },
            "experience_analysis": {
                "jd_requirement": jd_std.get("experience_years", "") or jd_std.get("years_of_experience", ""),
                "cv_experience": cv_std.get("experience_years", "") or cv_std.get("years_of_experience", ""),
                "meets_requirement": exp_score >= 75.0,
                "score": exp_score,
            },
            "scoring_weights": self.SCORING_WEIGHTS,
        }

# Singleton accessor
_matching_service: Optional[MatchingService] = None
def get_matching_service() -> MatchingService:
    global _matching_service
    if _matching_service is None:
        _matching_service = MatchingService()
    return _matching_service