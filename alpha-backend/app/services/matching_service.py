"""
Matching Service - Consolidated CV-JD Matching Operations
Handles ALL matching logic between CVs and Job Descriptions.
Single responsibility: Calculate match scores and generate detailed reports.
"""

import logging
import time
import uuid
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np

from app.services.embedding_service import get_embedding_service
from app.utils.qdrant_utils import get_qdrant_utils

logger = logging.getLogger(__name__)

@dataclass
class MatchResult:
    """Structured match result between CV and JD."""
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
    """
    Consolidated service for all CV-JD matching operations.
    Fetches embeddings, calculates similarities, and generates comprehensive reports.
    """
    
    # Weighted scoring formula
    SCORING_WEIGHTS = {
        "skills": 0.40,
        "responsibilities": 0.35,
        "title": 0.15,
        "experience": 0.10
    }
    
    def __init__(self):
        """Initialize the matching service."""
        self.embedding_service = get_embedding_service()
        self.qdrant_utils = get_qdrant_utils()
        logger.info("🎯 MatchingService initialized")
    
    def match_cv_against_jd(self, cv_id: str, jd_id: str) -> MatchResult:
        """
        Main matching function - performs comprehensive CV-JD matching.
        
        Args:
            cv_id: CV identifier in database
            jd_id: Job description identifier in database
            
        Returns:
            Detailed match result with scores and explanations
        """
        try:
            logger.info(f"🔍 Matching CV {cv_id} against JD {jd_id}")
            start_time = time.time()
            
            # Retrieve CV and JD data from database
            cv_data = self.qdrant_utils.retrieve_document(cv_id, "cv")
            jd_data = self.qdrant_utils.retrieve_document(jd_id, "jd")
            
            if not cv_data:
                raise Exception(f"CV not found: {cv_id}")
            if not jd_data:
                raise Exception(f"JD not found: {jd_id}")
            
            # Extract standardized data
            cv_standardized = cv_data.get("structured_info", {})
            jd_standardized = jd_data.get("structured_info", {})
            
            # Retrieve or generate embeddings
            cv_embeddings = self._get_document_embeddings(cv_id, cv_standardized, "cv")
            jd_embeddings = self._get_document_embeddings(jd_id, jd_standardized, "jd")
            
            # Calculate similarity scores
            skills_analysis = self._calculate_skills_similarity(
                jd_embeddings["skills"], 
                cv_embeddings["skills"],
                jd_standardized.get("skills", []),
                cv_standardized.get("skills", [])
            )
            
            responsibilities_analysis = self._calculate_responsibilities_similarity(
                jd_embeddings["responsibilities"], 
                cv_embeddings["responsibilities"],
                jd_standardized.get("responsibilities", []),
                cv_standardized.get("responsibilities", [])
            )
            
            title_similarity = self._calculate_title_similarity(
                jd_embeddings.get("title"), 
                cv_embeddings.get("title")
            )
            
            experience_match = self._analyze_experience_match(
                jd_standardized.get("experience_years", ""),
                cv_standardized.get("experience_years", "")
            )
            
            # Generate comprehensive match result
            result = self._create_match_result(
                cv_id=cv_id,
                jd_id=jd_id,
                cv_standardized=cv_standardized,
                jd_standardized=jd_standardized,
                skills_analysis=skills_analysis,
                responsibilities_analysis=responsibilities_analysis,
                title_similarity=title_similarity,
                experience_match=experience_match,
                processing_time=time.time() - start_time
            )
            
            logger.info(f"✅ Matching completed: {result.overall_score:.1f}% overall score")
            return result
            
        except Exception as e:
            logger.error(f"❌ Matching failed: {str(e)}")
            raise Exception(f"CV-JD matching failed: {str(e)}")
    
    def bulk_match(self, jd_id: str, cv_ids: List[str], top_k: int = 10) -> List[MatchResult]:
        """
        Perform bulk matching of one JD against multiple CVs.
        
        Args:
            jd_id: Job description identifier
            cv_ids: List of CV identifiers
            top_k: Number of top matches to return
            
        Returns:
            List of match results sorted by overall score
        """
        try:
            logger.info(f"🚀 Bulk matching JD {jd_id} against {len(cv_ids)} CVs")
            start_time = time.time()
            
            results = []
            for cv_id in cv_ids:
                try:
                    result = self.match_cv_against_jd(cv_id, jd_id)
                    results.append(result)
                except Exception as e:
                    logger.warning(f"⚠️ Failed to match CV {cv_id}: {str(e)}")
                    continue
            
            # Sort by overall score (descending)
            results.sort(key=lambda x: x.overall_score, reverse=True)
            
            # Return top k results
            top_results = results[:top_k]
            
            processing_time = time.time() - start_time
            logger.info(f"✅ Bulk matching completed: {len(top_results)} results in {processing_time:.2f}s")
            
            return top_results
            
        except Exception as e:
            logger.error(f"❌ Bulk matching failed: {str(e)}")
            raise Exception(f"Bulk matching failed: {str(e)}")
    
    def find_top_candidates(self, jd_id: str, limit: int = 10) -> List[MatchResult]:
        """
        Find top CV candidates for a given JD using vector similarity search.
        
        Args:
            jd_id: Job description identifier
            limit: Maximum number of candidates to return
            
        Returns:
            List of top matching candidates
        """
        try:
            logger.info(f"🔍 Finding top {limit} candidates for JD {jd_id}")
            
            # Get all CVs from database
            all_cvs = self.qdrant_utils.list_documents("cv")
            cv_ids = [cv["id"] for cv in all_cvs]
            
            # Perform bulk matching
            results = self.bulk_match(jd_id, cv_ids, top_k=limit)
            
            logger.info(f"✅ Found {len(results)} top candidates")
            return results
            
        except Exception as e:
            logger.error(f"❌ Top candidate search failed: {str(e)}")
            raise Exception(f"Top candidate search failed: {str(e)}")
    
    def _get_document_embeddings(self, doc_id: str, standardized_data: Dict[str, Any], doc_type: str) -> Dict[str, Any]:
        """
        Retrieve or generate embeddings for a document.
        
        Args:
            doc_id: Document identifier
            standardized_data: Structured document data
            doc_type: "cv" or "jd"
            
        Returns:
            Dictionary containing all embeddings for the document
        """
        try:
            # Try to retrieve existing embeddings from database
            stored_embeddings = self.qdrant_utils.retrieve_embeddings(doc_id, doc_type)
            
            if stored_embeddings:
                logger.debug(f"Using stored embeddings for {doc_type} {doc_id}")
                return stored_embeddings
            
            # Generate new embeddings if not found
            logger.info(f"Generating new embeddings for {doc_type} {doc_id}")
            
            embeddings = {}
            
            # Skills embeddings
            skills = standardized_data.get("skills", [])
            if skills:
                embeddings["skills"] = self.embedding_service.generate_skill_embeddings(skills)
            
            # Responsibilities embeddings
            responsibilities = standardized_data.get("responsibilities", [])
            if not responsibilities:
                responsibilities = standardized_data.get("responsibility_sentences", [])
            if responsibilities:
                embeddings["responsibilities"] = self.embedding_service.generate_responsibility_embeddings(responsibilities)
            
            # Title embedding
            job_title = standardized_data.get("job_title", "")
            if job_title and job_title != "Not specified":
                embeddings["title"] = self.embedding_service.generate_single_embedding(job_title)
            
            # Experience embedding
            experience = standardized_data.get("experience_years", "")
            if not experience:
                experience = standardized_data.get("years_of_experience", "")
            if experience and experience != "Not specified":
                embeddings["experience"] = self.embedding_service.generate_single_embedding(experience)
            
            # Store embeddings for future use
            self.qdrant_utils.store_embeddings(doc_id, embeddings, doc_type)
            
            return embeddings
            
        except Exception as e:
            logger.error(f"❌ Failed to get embeddings for {doc_type} {doc_id}: {str(e)}")
            raise Exception(f"Embedding retrieval failed: {str(e)}")
    
    def _calculate_skills_similarity(self, jd_skills_embeddings: Dict[str, np.ndarray], cv_skills_embeddings: Dict[str, np.ndarray], jd_skills: List[str], cv_skills: List[str]) -> Dict[str, Any]:
        """Calculate detailed skills similarity analysis."""
        if not jd_skills_embeddings or not cv_skills_embeddings:
            return {
                "skill_match_percentage": 0.0,
                "matched_skills": 0,
                "total_jd_skills": len(jd_skills),
                "matches": [],
                "unmatched_jd_skills": jd_skills
            }
        
        logger.debug(f"Calculating skills similarity: {len(jd_skills)} JD skills vs {len(cv_skills)} CV skills")
        
        matches = []
        matched_skills = 0
        
        for jd_skill in jd_skills:
            if jd_skill not in jd_skills_embeddings:
                continue
                
            best_match = None
            best_similarity = 0.0
            
            jd_embedding = jd_skills_embeddings[jd_skill]
            
            for cv_skill in cv_skills:
                if cv_skill not in cv_skills_embeddings:
                    continue
                    
                cv_embedding = cv_skills_embeddings[cv_skill]
                similarity = self.embedding_service.calculate_cosine_similarity(jd_embedding, cv_embedding)
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = cv_skill
            
            if best_match and best_similarity >= self.embedding_service.SIMILARITY_THRESHOLDS["skills"]["minimum"]:
                matched_skills += 1
                match_quality = self.embedding_service.get_match_quality(best_similarity, "skills")
                
                matches.append({
                    "jd_skill": jd_skill,
                    "cv_skill": best_match,
                    "similarity": best_similarity,
                    "quality": match_quality
                })
        
        # Calculate match percentage
        total_jd_skills = len(jd_skills)
        skill_match_percentage = (matched_skills / total_jd_skills * 100) if total_jd_skills > 0 else 0
        
        # Find unmatched skills
        matched_jd_skills = [match["jd_skill"] for match in matches]
        unmatched_jd_skills = [skill for skill in jd_skills if skill not in matched_jd_skills]
        
        return {
            "skill_match_percentage": skill_match_percentage,
            "matched_skills": matched_skills,
            "total_jd_skills": total_jd_skills,
            "matches": matches,
            "unmatched_jd_skills": unmatched_jd_skills
        }
    
    def _calculate_responsibilities_similarity(self, jd_resp_embeddings: Dict[str, np.ndarray], cv_resp_embeddings: Dict[str, np.ndarray], jd_responsibilities: List[str], cv_responsibilities: List[str]) -> Dict[str, Any]:
        """Calculate detailed responsibilities similarity analysis."""
        if not jd_resp_embeddings or not cv_resp_embeddings:
            return {
                "responsibility_match_percentage": 0.0,
                "matched_responsibilities": 0,
                "total_jd_responsibilities": len(jd_responsibilities),
                "matches": [],
                "unmatched_jd_responsibilities": jd_responsibilities
            }
        
        logger.debug(f"Calculating responsibilities similarity: {len(jd_responsibilities)} JD vs {len(cv_responsibilities)} CV")
        
        matches = []
        matched_responsibilities = 0
        
        for jd_resp in jd_responsibilities:
            if jd_resp not in jd_resp_embeddings:
                continue
                
            best_match = None
            best_similarity = 0.0
            
            jd_embedding = jd_resp_embeddings[jd_resp]
            
            for cv_resp in cv_responsibilities:
                if cv_resp not in cv_resp_embeddings:
                    continue
                    
                cv_embedding = cv_resp_embeddings[cv_resp]
                similarity = self.embedding_service.calculate_cosine_similarity(jd_embedding, cv_embedding)
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = cv_resp
            
            if best_match and best_similarity >= self.embedding_service.SIMILARITY_THRESHOLDS["responsibilities"]["minimum"]:
                matched_responsibilities += 1
                match_quality = self.embedding_service.get_match_quality(best_similarity, "responsibilities")
                
                matches.append({
                    "jd_responsibility": jd_resp,
                    "cv_responsibility": best_match,
                    "similarity": best_similarity,
                    "quality": match_quality
                })
        
        # Calculate match percentage
        total_jd_responsibilities = len(jd_responsibilities)
        responsibility_match_percentage = (matched_responsibilities / total_jd_responsibilities * 100) if total_jd_responsibilities > 0 else 0
        
        # Find unmatched responsibilities
        matched_jd_responsibilities = [match["jd_responsibility"] for match in matches]
        unmatched_jd_responsibilities = [resp for resp in jd_responsibilities if resp not in matched_jd_responsibilities]
        
        return {
            "responsibility_match_percentage": responsibility_match_percentage,
            "matched_responsibilities": matched_responsibilities,
            "total_jd_responsibilities": total_jd_responsibilities,
            "matches": matches,
            "unmatched_jd_responsibilities": unmatched_jd_responsibilities
        }
    
    def _calculate_title_similarity(self, jd_title_embedding: Optional[np.ndarray], cv_title_embedding: Optional[np.ndarray]) -> float:
        """Calculate similarity between job titles."""
        if jd_title_embedding is None or cv_title_embedding is None:
            return 0.0
        
        return self.embedding_service.calculate_cosine_similarity(jd_title_embedding, cv_title_embedding)
    
    def _analyze_experience_match(self, jd_experience: str, cv_experience: str) -> Tuple[bool, float]:
        """
        Analyze if CV experience meets JD requirements.
        
        Returns:
            Tuple of (meets_requirement: bool, score: float)
        """
        try:
            import re
            
            # Extract numeric years from experience strings
            jd_years = re.findall(r'(\d+)', jd_experience)
            cv_years = re.findall(r'(\d+)', cv_experience)
            
            if jd_years and cv_years:
                required_years = int(jd_years[0])
                candidate_years = int(cv_years[0])
                
                if candidate_years >= required_years:
                    # Calculate score based on how much they exceed requirement
                    excess_years = candidate_years - required_years
                    score = min(100.0, 80.0 + (excess_years * 5))  # Base 80% + bonus for extra experience
                    return True, score
                else:
                    # Partial credit for having some experience
                    score = max(30.0, (candidate_years / required_years) * 60)
                    return False, score
            
            # Default to neutral if can't parse
            return True, 75.0
            
        except Exception as e:
            logger.warning(f"⚠️ Experience analysis failed: {str(e)}")
            return True, 75.0
    
    def _create_match_result(self, cv_id: str, jd_id: str, cv_standardized: Dict[str, Any], jd_standardized: Dict[str, Any], skills_analysis: Dict[str, Any], responsibilities_analysis: Dict[str, Any], title_similarity: float, experience_match: Tuple[bool, float], processing_time: float) -> MatchResult:
        """Create comprehensive match result with detailed analysis."""
        
        # Extract scores
        skills_score = skills_analysis["skill_match_percentage"]
        responsibilities_score = responsibilities_analysis["responsibility_match_percentage"]
        title_score = title_similarity * 100
        experience_meets_req, experience_score = experience_match
        
        # Calculate weighted overall score
        overall_score = (
            skills_score * self.SCORING_WEIGHTS["skills"] +
            responsibilities_score * self.SCORING_WEIGHTS["responsibilities"] +
            title_score * self.SCORING_WEIGHTS["title"] +
            experience_score * self.SCORING_WEIGHTS["experience"]
        )
        
        # Generate explanation
        explanation = self._generate_match_explanation(
            skills_analysis, responsibilities_analysis, title_similarity, experience_meets_req
        )
        
        # Create detailed match information
        match_details = {
            "skills_analysis": {
                "total_required": skills_analysis["total_jd_skills"],
                "matched": skills_analysis["matched_skills"],
                "match_percentage": skills_analysis["skill_match_percentage"],
                "matches": skills_analysis["matches"][:5],  # Top 5 for display
                "unmatched": skills_analysis["unmatched_jd_skills"]
            },
            "responsibilities_analysis": {
                "total_required": responsibilities_analysis["total_jd_responsibilities"],
                "matched": responsibilities_analysis["matched_responsibilities"],
                "match_percentage": responsibilities_analysis["responsibility_match_percentage"],
                "matches": responsibilities_analysis["matches"][:5],  # Top 5 for display
                "unmatched": responsibilities_analysis["unmatched_jd_responsibilities"]
            },
            "title_analysis": {
                "jd_title": jd_standardized.get("job_title", ""),
                "cv_title": cv_standardized.get("job_title", ""),
                "similarity": title_similarity,
                "match_quality": self.embedding_service.get_match_quality(title_similarity, "skills")  # Use skills threshold
            },
            "experience_analysis": {
                "jd_requirement": jd_standardized.get("experience_years", ""),
                "cv_experience": cv_standardized.get("experience_years", ""),
                "meets_requirement": experience_meets_req,
                "score": experience_score
            },
            "scoring_weights": self.SCORING_WEIGHTS
        }
        
        return MatchResult(
            cv_id=cv_id,
            jd_id=jd_id,
            overall_score=overall_score,
            skills_score=skills_score,
            responsibilities_score=responsibilities_score,
            title_score=title_score,
            experience_score=experience_score,
            explanation=explanation,
            match_details=match_details,
            processing_time=processing_time
        )
    
    def _generate_match_explanation(self, skills_analysis: Dict[str, Any], responsibilities_analysis: Dict[str, Any], title_similarity: float, experience_meets_req: bool) -> str:
        """Generate human-readable explanation of the match."""
        explanations = []
        
        # Skills analysis
        skill_pct = skills_analysis["skill_match_percentage"]
        matched_skills = skills_analysis["matched_skills"]
        total_skills = skills_analysis["total_jd_skills"]
        
        if skill_pct >= 80:
            explanations.append(f"Excellent skills match: {matched_skills}/{total_skills} required skills matched ({skill_pct:.0f}%)")
        elif skill_pct >= 60:
            explanations.append(f"Good skills match: {matched_skills}/{total_skills} required skills matched ({skill_pct:.0f}%)")
        else:
            explanations.append(f"Limited skills match: Only {matched_skills}/{total_skills} required skills matched ({skill_pct:.0f}%)")
        
        # Responsibilities analysis
        resp_pct = responsibilities_analysis["responsibility_match_percentage"]
        matched_resp = responsibilities_analysis["matched_responsibilities"]
        total_resp = responsibilities_analysis["total_jd_responsibilities"]
        
        if resp_pct >= 70:
            explanations.append(f"Strong experience alignment: {matched_resp}/{total_resp} responsibilities matched ({resp_pct:.0f}%)")
        elif resp_pct >= 50:
            explanations.append(f"Moderate experience alignment: {matched_resp}/{total_resp} responsibilities matched ({resp_pct:.0f}%)")
        else:
            explanations.append(f"Limited experience alignment: {matched_resp}/{total_resp} responsibilities matched ({resp_pct:.0f}%)")
        
        # Title match
        if title_similarity >= 0.8:
            explanations.append("Job title strongly aligned with candidate profile")
        elif title_similarity >= 0.6:
            explanations.append("Job title moderately aligned with candidate profile")
        else:
            explanations.append("Job title shows limited alignment with candidate profile")
        
        # Experience match
        if experience_meets_req:
            explanations.append("Experience requirements satisfied")
        else:
            explanations.append("Experience requirements may not be fully met")
        
        return ". ".join(explanations) + "."

# Global instance
_matching_service: Optional[MatchingService] = None

def get_matching_service() -> MatchingService:
    """Get global matching service instance."""
    global _matching_service
    if _matching_service is None:
        _matching_service = MatchingService()
    return _matching_service
