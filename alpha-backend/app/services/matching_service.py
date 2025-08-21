# alpha-backend/app/services/matching_service.py
"""
Matching Service - Consolidated CV-JD Matching Operations
Handles ALL matching logic between CVs and Job Descriptions.
Single responsibility: Calculate match scores and generate detailed reports.
"""

import logging
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np

from app.services.embedding_service import get_embedding_service
from app.utils.qdrant_utils import get_qdrant_utils

logger = logging.getLogger(__name__)

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

class MatchingService:
    SCORING_WEIGHTS = {"skills": 0.80, "responsibilities": 0.15, "title": 0.025, "experience": 0.025}

    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.qdrant_utils = get_qdrant_utils()
        logger.info("🎯 MatchingService initialized")

    def match_cv_against_jd_exact(self, cv_id: str, jd_id: str) -> dict:
        """
        EXACT matching with specified weights using stored embeddings.
        NO redundant LLM calls - use stored embeddings only.
        
        Args:
            cv_id: CV identifier
            jd_id: JD identifier
            
        Returns:
            Dict with exact matching results
        """
        try:
            logger.info(f"🎯 EXACT matching: CV {cv_id} vs JD {jd_id}")
            start_time = time.time()
            
            # Get stored embeddings (NO LLM calls)
            cv_embeddings = self._get_stored_embeddings(cv_id, "cv")
            jd_embeddings = self._get_stored_embeddings(jd_id, "jd")
            
            if not cv_embeddings or not jd_embeddings:
                raise Exception("Missing embeddings for CV or JD")
            
            # Calculate similarities with EXACT weights
            scores = {}
            
            # 80% - Skills matching (20 skill vectors vs 20 skill vectors)
            skills_score = self._calculate_skills_similarity_exact(
                cv_embeddings["skill_vectors"], 
                jd_embeddings["skill_vectors"]
            )
            scores["skills_score"] = skills_score * 0.80
            logger.info(f"Skills similarity: {skills_score:.3f} (weighted: {scores['skills_score']:.3f})")
            
            # 15% - Responsibilities matching (10 vs 10 vectors)
            responsibilities_score = self._calculate_responsibilities_similarity_exact(
                cv_embeddings["responsibility_vectors"],
                jd_embeddings["responsibility_vectors"] 
            )
            scores["responsibilities_score"] = responsibilities_score * 0.15
            logger.info(f"Responsibilities similarity: {responsibilities_score:.3f} (weighted: {scores['responsibilities_score']:.3f})")
            
            # 2.5% - Experience matching (1 vs 1 vector)
            experience_score = self._cosine_similarity_lists(
                cv_embeddings["experience_vector"][0],
                jd_embeddings["experience_vector"][0]
            )
            scores["experience_score"] = experience_score * 0.025
            logger.info(f"Experience similarity: {experience_score:.3f} (weighted: {scores['experience_score']:.3f})")
            
            # 2.5% - Job title matching (1 vs 1 vector)  
            job_title_score = self._cosine_similarity_lists(
                cv_embeddings["job_title_vector"][0],
                jd_embeddings["job_title_vector"][0]
            )
            scores["job_title_score"] = job_title_score * 0.025
            logger.info(f"Job title similarity: {job_title_score:.3f} (weighted: {scores['job_title_score']:.3f})")
            
            # Final score calculation
            final_score = sum(scores.values())
            processing_time = time.time() - start_time
            
            result = {
                "cv_id": cv_id,
                "jd_id": jd_id,
                "final_score": final_score,
                "final_score_percentage": final_score * 100,
                "breakdown": scores,
                "processing_time": processing_time,
                "vector_counts": {
                    "cv_skill_vectors": len(cv_embeddings.get("skill_vectors", [])),
                    "cv_responsibility_vectors": len(cv_embeddings.get("responsibility_vectors", [])),
                    "jd_skill_vectors": len(jd_embeddings.get("skill_vectors", [])),
                    "jd_responsibility_vectors": len(jd_embeddings.get("responsibility_vectors", []))
                }
            }
            
            logger.info(f"✅ EXACT matching complete: {final_score:.3f} ({final_score*100:.1f}%) in {processing_time:.2f}s")
            return result
            
        except Exception as e:
            logger.error(f"❌ EXACT matching failed: {str(e)}")
            raise Exception(f"CV-JD exact matching failed: {str(e)}")
    
    def _get_stored_embeddings(self, doc_id: str, doc_type: str) -> dict:
        """Get stored embeddings from the embeddings collection."""
        try:
            collection_name = f"{doc_type}_embeddings"
            
            # Get all embedding vectors for this document
            search_result = self.qdrant_utils.client.scroll(
                collection_name=collection_name,
                scroll_filter={
                    "must": [{"key": "document_id", "match": {"value": doc_id}}]
                },
                limit=50,  # Should be exactly 32 vectors
                with_payload=True,
                with_vectors=True
            )
            
            if not search_result[0]:
                logger.warning(f"No embeddings found for {doc_id} in {collection_name}")
                return {}
            
            # Organize vectors by type
            embeddings = {
                "skill_vectors": [],
                "responsibility_vectors": [],
                "experience_vector": [],
                "job_title_vector": []
            }
            
            for point in search_result[0]:
                vector_type = point.payload.get("vector_type")
                vector_index = point.payload.get("vector_index", 0)
                
                if vector_type == "skill":
                    # Ensure we have exactly 20 skill vectors
                    while len(embeddings["skill_vectors"]) <= vector_index:
                        embeddings["skill_vectors"].append(None)
                    embeddings["skill_vectors"][vector_index] = point.vector
                elif vector_type == "responsibility":
                    # Ensure we have exactly 10 responsibility vectors
                    while len(embeddings["responsibility_vectors"]) <= vector_index:
                        embeddings["responsibility_vectors"].append(None)
                    embeddings["responsibility_vectors"][vector_index] = point.vector
                elif vector_type == "experience":
                    embeddings["experience_vector"] = [point.vector]
                elif vector_type == "job_title":
                    embeddings["job_title_vector"] = [point.vector]
            
            # Filter out None values and ensure correct sizes
            embeddings["skill_vectors"] = [v for v in embeddings["skill_vectors"] if v is not None][:20]
            embeddings["responsibility_vectors"] = [v for v in embeddings["responsibility_vectors"] if v is not None][:10]
            
            logger.info(f"Retrieved {len(embeddings['skill_vectors'])} skill vectors, {len(embeddings['responsibility_vectors'])} responsibility vectors")
            
            return embeddings
            
        except Exception as e:
            logger.error(f"❌ Failed to get stored embeddings for {doc_id}: {str(e)}")
            return {}
    
    def _calculate_skills_similarity_exact(self, cv_skills: list, jd_skills: list) -> float:
        """Calculate average similarity across all skill vectors (20 vs 20)."""
        if not cv_skills or not jd_skills:
            return 0.0
        
        similarities = []
        for cv_skill in cv_skills:
            max_sim = max([self._cosine_similarity_lists(cv_skill, jd_skill) for jd_skill in jd_skills])
            similarities.append(max_sim)
        
        return float(np.mean(similarities))
    
    def _calculate_responsibilities_similarity_exact(self, cv_resp: list, jd_resp: list) -> float:
        """Calculate average similarity across all responsibility vectors (10 vs 10)."""  
        if not cv_resp or not jd_resp:
            return 0.0
        
        similarities = []
        for cv_r in cv_resp:
            max_sim = max([self._cosine_similarity_lists(cv_r, jd_r) for jd_r in jd_resp])
            similarities.append(max_sim)
        
        return float(np.mean(similarities))
    
    def _cosine_similarity_lists(self, vec1: list, vec2: list) -> float:
        """Calculate cosine similarity between two vectors as lists."""
        try:
            vec1_np = np.array(vec1)
            vec2_np = np.array(vec2)
            
            # Calculate cosine similarity
            dot_product = np.dot(vec1_np, vec2_np)
            norm1 = np.linalg.norm(vec1_np)
            norm2 = np.linalg.norm(vec2_np)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            similarity = dot_product / (norm1 * norm2)
            return float(max(0.0, min(1.0, similarity)))  # Clamp to [0, 1]
            
        except Exception as e:
            logger.error(f"❌ Cosine similarity calculation failed: {str(e)}")
            return 0.0

    def match_cv_against_jd(self, cv_id: str, jd_id: str) -> MatchResult:
        try:
            logger.info("---------- MATCHING START ----------")
            logger.info(f"CV ID: {cv_id}")
            logger.info(f"JD ID: {jd_id}")
            logger.info("Using stored standardized data (no LLM call)")
            logger.info("---------------------------------")
            
            start_time = time.time()
            
            # Step 1: Retrieve stored documents (no LLM call)
            logger.info("---------- STEP 1: RETRIEVING STORED DATA ----------")
            cv_data = self.qdrant_utils.retrieve_document(cv_id, "cv")
            jd_data = self.qdrant_utils.retrieve_document(jd_id, "jd")
            
            if not cv_data:
                logger.error(f"❌ CV not found: {cv_id}")
                raise Exception(f"CV not found: {cv_id}")
            if not jd_data:
                logger.error(f"❌ JD not found: {jd_id}")
                raise Exception(f"JD not found: {jd_id}")
            
            logger.info(f"CV data keys: {list(cv_data.keys())}")
            logger.info(f"JD data keys: {list(jd_data.keys())}")
            logger.info("----------------------------------------------------")
            
            # Step 2: Extract standardized data
            logger.info("---------- STEP 2: EXTRACTING STANDARDIZED DATA ----------")
            cv_std = cv_data.get("structured_info", {})
            jd_std = jd_data.get("structured_info", {})
            
            logger.info(f"CV skills count: {len(cv_std.get('skills', []))}")
            logger.info(f"JD skills count: {len(jd_std.get('skills', []))}")
            logger.info(f"CV responsibilities count: {len(cv_std.get('responsibilities', []))}")
            logger.info(f"JD responsibilities count: {len(jd_std.get('responsibilities', []) or jd_std.get('responsibility_sentences', []))}")
            logger.info("----------------------------------------------------------")
            
            # Step 3: Get embeddings
            logger.info("---------- STEP 3: RETRIEVING EMBEDDINGS ----------")
            cv_emb = self._get_document_embeddings(cv_id, cv_std, "cv")
            jd_emb = self._get_document_embeddings(jd_id, jd_std, "jd")
            
            logger.info(f"CV embeddings: {list(cv_emb.keys())}")
            logger.info(f"JD embeddings: {list(jd_emb.keys())}")
            logger.info("--------------------------------------------------")
            
            # Step 4: Calculate similarities
            logger.info("---------- STEP 4: CALCULATING SIMILARITIES ----------")
            
            # Skills similarity
            logger.info("Calculating skills similarity...")
            skills_analysis = self._calculate_skills_similarity(
                jd_emb.get("skills", {}), cv_emb.get("skills", {}),
                jd_std.get("skills", []), cv_std.get("skills", [])
            )
            logger.info(f"Skills match: {skills_analysis['skill_match_percentage']:.1f}%")
            
            # Responsibilities similarity
            logger.info("Calculating responsibilities similarity...")
            responsibilities_analysis = self._calculate_responsibilities_similarity(
                jd_emb.get("responsibilities", {}), cv_emb.get("responsibilities", {}),
                jd_std.get("responsibilities", []) or jd_std.get("responsibility_sentences", []),
                cv_std.get("responsibilities", [])
            )
            logger.info(f"Responsibilities match: {responsibilities_analysis['responsibility_match_percentage']:.1f}%")
            
            # Title similarity
            logger.info("Calculating title similarity...")
            title_similarity = self._calculate_title_similarity(jd_emb.get("title"), cv_emb.get("title"))
            logger.info(f"Title similarity: {title_similarity:.3f}")
            
            # Experience match
            logger.info("Analyzing experience match...")
            experience_match = self._analyze_experience_match(jd_std.get("experience_years", ""), cv_std.get("experience_years", ""))
            logger.info(f"Experience match: {experience_match[1]:.1f}% (meets requirement: {experience_match[0]})")
            
            logger.info("------------------------------------------------------")
            
            # Step 5: Create match result
            logger.info("---------- STEP 5: CREATING MATCH RESULT ----------")
            result = self._create_match_result(
                cv_id=cv_id, jd_id=jd_id, cv_standardized=cv_std, jd_standardized=jd_std,
                skills_analysis=skills_analysis, responsibilities_analysis=responsibilities_analysis,
                title_similarity=title_similarity, experience_match=experience_match,
                processing_time=time.time() - start_time
            )
            
            logger.info(f"Overall score: {result.overall_score:.1f}%")
            logger.info(f"Processing time: {result.processing_time:.2f}s")
            logger.info("----------------------------------------------------")
            
            logger.info("---------- MATCHING COMPLETE ----------")
            logger.info(f"Final score: {result.overall_score:.1f}%")
            logger.info("------------------------------------")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Matching failed: {str(e)}")
            logger.error("---------- MATCHING FAILED ----------")
            raise Exception(f"CV-JD matching failed: {str(e)}")

    def bulk_match(self, jd_id: str, cv_ids: List[str], top_k: int = 10) -> List[MatchResult]:
        try:
            logger.info(f"🚀 Bulk matching JD {jd_id} against {len(cv_ids)} CVs")
            results: List[MatchResult] = []
            for cv_id in cv_ids:
                try:
                    results.append(self.match_cv_against_jd(cv_id, jd_id))
                except Exception as e:
                    logger.warning(f"⚠ Failed to match CV {cv_id}: {str(e)}")
                    continue
            results.sort(key=lambda x: x.overall_score, reverse=True)
            return results[:top_k]
        except Exception as e:
            logger.error(f"❌ Bulk matching failed: {str(e)}")
            raise Exception(f"Bulk matching failed: {str(e)}")

    def find_top_candidates(self, jd_id: str, limit: int = 10) -> List[MatchResult]:
        try:
            logger.info(f"🔍 Finding top {limit} candidates for JD {jd_id}")
            all_cvs = self.qdrant_utils.list_documents("cv")
            cv_ids = [cv["id"] for cv in all_cvs]
            return self.bulk_match(jd_id, cv_ids, top_k=limit)
        except Exception as e:
            logger.error(f"❌ Top candidate search failed: {str(e)}")
            raise Exception(f"Top candidate search failed: {str(e)}")

    def _get_document_embeddings(self, doc_id: str, std: Dict[str, Any], doc_type: str) -> Dict[str, Any]:
        try:
            stored = self.qdrant_utils.retrieve_embeddings(doc_id, doc_type)
            if stored:
                return stored

            logger.info(f"Generating new embeddings for {doc_type} {doc_id}")
            e: Dict[str, Any] = {}
            if std.get("skills"):
                e["skills"] = self.embedding_service.generate_skill_embeddings(std["skills"])
            responsibilities = std.get("responsibilities", []) or std.get("responsibility_sentences", [])
            if responsibilities:
                e["responsibilities"] = self.embedding_service.generate_responsibility_embeddings(responsibilities)
            title = std.get("job_title", "")
            if title and title != "Not specified":
                e["title"] = self.embedding_service.generate_single_embedding(title)
            exp = std.get("experience_years", "") or std.get("years_of_experience", "")
            if exp and exp != "Not specified":
                e["experience"] = self.embedding_service.generate_single_embedding(exp)
            self.qdrant_utils.store_embeddings(doc_id, e, doc_type)
            return e
        except Exception as e:
            logger.error(f"❌ Failed to get embeddings for {doc_type} {doc_id}: {str(e)}")
            raise Exception(f"Embedding retrieval failed: {str(e)}")

    def _calculate_skills_similarity(self, jd_emb: Dict[str, np.ndarray], cv_emb: Dict[str, np.ndarray], jd_skills: List[str], cv_skills: List[str]) -> Dict[str, Any]:
        if not jd_emb or not cv_emb:
            return {"skill_match_percentage": 0.0, "matched_skills": 0, "total_jd_skills": len(jd_skills), "matches": [], "unmatched_jd_skills": jd_skills}
        matches, matched_count = [], 0
        for jd_skill in jd_skills:
            v1 = jd_emb.get(jd_skill)
            if v1 is None:
                continue
            best_match, best_sim = None, 0.0
            for cv_skill in cv_skills:
                v2 = cv_emb.get(cv_skill)
                if v2 is None:
                    continue
                sim = self.embedding_service.calculate_cosine_similarity(v1, v2)
                if sim > best_sim:
                    best_sim, best_match = sim, cv_skill
            if best_match and best_sim >= self.embedding_service.SIMILARITY_THRESHOLDS["skills"]["minimum"]:
                matched_count += 1
                matches.append({"jd_skill": jd_skill, "cv_skill": best_match, "similarity": best_sim, "quality": self.embedding_service.get_match_quality(best_sim, "skills")})
        total = len(jd_skills) or 1
        pct = matched_count / total * 100
        unmatched = [s for s in jd_skills if s not in [m["jd_skill"] for m in matches]]
        return {"skill_match_percentage": pct, "matched_skills": matched_count, "total_jd_skills": len(jd_skills), "matches": matches, "unmatched_jd_skills": unmatched}

    def _calculate_responsibilities_similarity(self, jd_emb: Dict[str, np.ndarray], cv_emb: Dict[str, np.ndarray], jd_resps: List[str], cv_resps: List[str]) -> Dict[str, Any]:
        if not jd_emb or not cv_emb:
            return {"responsibility_match_percentage": 0.0, "matched_responsibilities": 0, "total_jd_responsibilities": len(jd_resps), "matches": [], "unmatched_jd_responsibilities": jd_resps}
        matches, matched_count = [], 0
        for jd_r in jd_resps:
            v1 = jd_emb.get(jd_r)
            if v1 is None:
                continue
            best_match, best_sim = None, 0.0
            for cv_r in cv_resps:
                v2 = cv_emb.get(cv_r)
                if v2 is None:
                    continue
                sim = self.embedding_service.calculate_cosine_similarity(v1, v2)
                if sim > best_sim:
                    best_sim, best_match = sim, cv_r
            if best_match and best_sim >= self.embedding_service.SIMILARITY_THRESHOLDS["responsibilities"]["minimum"]:
                matched_count += 1
                matches.append({"jd_responsibility": jd_r, "cv_responsibility": best_match, "similarity": best_sim, "quality": self.embedding_service.get_match_quality(best_sim, "responsibilities")})
        total = len(jd_resps) or 1
        pct = matched_count / total * 100
        unmatched = [r for r in jd_resps if r not in [m["jd_responsibility"] for m in matches]]
        return {"responsibility_match_percentage": pct, "matched_responsibilities": matched_count, "total_jd_responsibilities": len(jd_resps), "matches": matches, "unmatched_jd_responsibilities": unmatched}

    def _calculate_title_similarity(self, jd_title_vec: Optional[np.ndarray], cv_title_vec: Optional[np.ndarray]) -> float:
        if jd_title_vec is None or cv_title_vec is None:
            return 0.0
        return self.embedding_service.calculate_cosine_similarity(jd_title_vec, cv_title_vec)

    def _analyze_experience_match(self, jd_experience: str, cv_experience: str) -> Tuple[bool, float]:
        try:
            import re
            jd_years = re.findall(r'(\d+)', jd_experience)
            cv_years = re.findall(r'(\d+)', cv_experience)
            if jd_years and cv_years:
                req, cand = int(jd_years[0]), int(cv_years[0])
                if cand >= req:
                    score = min(100.0, 80.0 + (cand - req) * 5)
                    return True, score
                else:
                    score = max(30.0, (cand / max(req, 1)) * 60)
                    return False, score
            return True, 75.0
        except Exception as e:
            logger.warning(f"⚠ Experience analysis failed: {str(e)}")
            return True, 75.0

    def _create_match_result(self, cv_id: str, jd_id: str, cv_standardized: Dict[str, Any], jd_standardized: Dict[str, Any],
                              skills_analysis: Dict[str, Any], responsibilities_analysis: Dict[str, Any],
                              title_similarity: float, experience_match: Tuple[bool, float], processing_time: float) -> MatchResult:

        skills_score = skills_analysis["skill_match_percentage"]
        responsibilities_score = responsibilities_analysis["responsibility_match_percentage"]
        title_score = title_similarity * 100
        meets, experience_score = experience_match

        overall_score = (
            skills_score * self.SCORING_WEIGHTS["skills"] +
            responsibilities_score * self.SCORING_WEIGHTS["responsibilities"] +
            title_score * self.SCORING_WEIGHTS["title"] +
            experience_score * self.SCORING_WEIGHTS["experience"]
        )

        explanation_parts = []
        if skills_score >= 80:
            explanation_parts.append(f"Excellent skills match: {skills_analysis['matched_skills']}/{skills_analysis['total_jd_skills']} ({skills_score:.0f}%)")
        elif skills_score >= 60:
            explanation_parts.append(f"Good skills match: {skills_analysis['matched_skills']}/{skills_analysis['total_jd_skills']} ({skills_score:.0f}%)")
        else:
            explanation_parts.append(f"Limited skills match: {skills_analysis['matched_skills']}/{skills_analysis['total_jd_skills']} ({skills_score:.0f}%)")

        if responsibilities_score >= 70:
            explanation_parts.append(f"Strong experience alignment: {responsibilities_analysis['matched_responsibilities']}/{responsibilities_analysis['total_jd_responsibilities']} ({responsibilities_score:.0f}%)")
        elif responsibilities_score >= 50:
            explanation_parts.append(f"Moderate experience alignment: {responsibilities_analysis['matched_responsibilities']}/{responsibilities_analysis['total_jd_responsibilities']} ({responsibilities_score:.0f}%)")
        else:
            explanation_parts.append(f"Limited experience alignment: {responsibilities_analysis['matched_responsibilities']}/{responsibilities_analysis['total_jd_responsibilities']} ({responsibilities_score:.0f}%)")

        if title_similarity >= 0.8:
            explanation_parts.append("Job title strongly aligned")
        elif title_similarity >= 0.6:
            explanation_parts.append("Job title moderately aligned")
        else:
            explanation_parts.append("Job title limited alignment")

        explanation_parts.append("Experience requirements satisfied" if meets else "Experience requirements may not be fully met")
        explanation = ". ".join(explanation_parts) + "."

        match_details = {
            "skills_analysis": {
                "total_required": skills_analysis["total_jd_skills"],
                "matched": skills_analysis["matched_skills"],
                "match_percentage": skills_analysis["skill_match_percentage"],
                "matches": skills_analysis["matches"][:5],
                "unmatched": skills_analysis["unmatched_jd_skills"]
            },
            "responsibilities_analysis": {
                "total_required": responsibilities_analysis["total_jd_responsibilities"],
                "matched": responsibilities_analysis["matched_responsibilities"],
                "match_percentage": responsibilities_analysis["responsibility_match_percentage"],
                "matches": responsibilities_analysis["matches"][:5],
                "unmatched": responsibilities_analysis["unmatched_jd_responsibilities"]
            },
            "title_analysis": {
                "jd_title": jd_standardized.get("job_title", ""),
                "cv_title": cv_standardized.get("job_title", ""),
                "similarity": title_similarity,
                "match_quality": self.embedding_service.get_match_quality(title_similarity, "skills")
            },
            "experience_analysis": {
                "jd_requirement": jd_standardized.get("experience_years", ""),
                "cv_experience": cv_standardized.get("experience_years", ""),
                "meets_requirement": meets,
                "score": experience_score
            },
            "scoring_weights": self.SCORING_WEIGHTS
        }

        return MatchResult(
            cv_id=cv_id, jd_id=jd_id, overall_score=overall_score,
            skills_score=skills_score, responsibilities_score=responsibilities_score,
            title_score=title_score, experience_score=experience_score,
            explanation=explanation, match_details=match_details, processing_time=processing_time
        )

_matching_service: Optional[MatchingService] = None
def get_matching_service() -> MatchingService:
    global _matching_service
    if _matching_service is None:
        _matching_service = MatchingService()
    return _matching_service