"""
Enhanced Granular CV-JD Matching Service with Individual Skill and Responsibility Matching.
Uses all-mpnet-base-v2 embeddings for precise vector similarity matching.
"""

import logging
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np

from app.services.embedding_service import get_embedding_service
from app.utils.gpt_extractor import standardize_job_description_with_gpt, standardize_cv_with_gpt

logger = logging.getLogger(__name__)

@dataclass
class GranularMatchResult:
    """Enhanced match result with granular skill and responsibility breakdown."""
    jd_id: str
    cv_id: str
    overall_score: float
    
    # Skill matching results
    skill_match_percentage: float
    skill_matches: List[Dict[str, Any]]
    unmatched_jd_skills: List[str]
    
    # Responsibility matching results
    responsibility_match_percentage: float
    responsibility_matches: List[Dict[str, Any]]
    unmatched_jd_responsibilities: List[str]
    
    # Additional metrics
    title_similarity: float
    experience_match: bool
    
    # Detailed breakdown for frontend display
    breakdown: Dict[str, float]
    explanation: str
    match_details: Dict[str, Any]

class GranularMatchingService:
    """Enhanced matching service with individual skill and responsibility vector matching."""
    
    def __init__(self):
        """Initialize the granular matching service."""
        self.embedding_service = get_embedding_service()
        logger.info("🚀 Initialized Granular Matching Service with all-mpnet-base-v2")
    
    def perform_enhanced_matching(
        self, 
        jd_text: str, 
        cv_text: str,
        jd_filename: str = "jd_input.txt",
        cv_filename: str = "cv_input.txt"
    ) -> Dict[str, Any]:
        """
        Perform enhanced granular matching between JD and CV.
        
        Args:
            jd_text: Job description text
            cv_text: CV text
            jd_filename: Job description filename
            cv_filename: CV filename
            
        Returns:
            Enhanced match result with granular breakdown
        """
        start_time = time.time()
        logger.info(f"🔍 Starting enhanced granular matching: {jd_filename} vs {cv_filename}")
        
        try:
            # Step 1: Standardize with enhanced GPT prompts
            logger.info("📝 Standardizing JD and CV with enhanced GPT prompts...")
            jd_standardized = standardize_job_description_with_gpt(jd_text, jd_filename)
            cv_standardized = standardize_cv_with_gpt(cv_text, cv_filename)
            
            # Step 2: Extract skills and responsibilities
            jd_skills = jd_standardized.get("skills", [])
            cv_skills = cv_standardized.get("skills", [])
            
            jd_responsibilities = jd_standardized.get("responsibility_sentences", [])
            cv_responsibilities = cv_standardized.get("responsibilities", [])
            
            logger.info(f"📊 JD: {len(jd_skills)} skills, {len(jd_responsibilities)} responsibilities")
            logger.info(f"📊 CV: {len(cv_skills)} skills, {len(cv_responsibilities)} responsibilities")
            
            # Step 3: Perform granular skill matching
            logger.info("🔍 Performing individual skill matching with all-mpnet-base-v2...")
            skill_analysis = self.embedding_service.calculate_skill_similarity_matrix(jd_skills, cv_skills)
            
            # Step 4: Perform granular responsibility matching
            logger.info("🔍 Performing individual responsibility matching...")
            responsibility_analysis = self.embedding_service.calculate_responsibility_similarity_matrix(
                jd_responsibilities, cv_responsibilities
            )
            
            # Step 5: Calculate title similarity
            jd_title = jd_standardized.get("job_title", "")
            cv_title = cv_standardized.get("job_title", "")
            title_similarity = self._calculate_title_similarity(jd_title, cv_title)
            
            # Step 6: Analyze experience match
            jd_experience = jd_standardized.get("years_of_experience", "")
            cv_experience = cv_standardized.get("years_of_experience", "")
            experience_match = self._analyze_experience_match(jd_experience, cv_experience)
            
            # Step 7: Calculate overall scores and create result
            result = self._create_enhanced_match_result(
                jd_standardized=jd_standardized,
                cv_standardized=cv_standardized,
                skill_analysis=skill_analysis,
                responsibility_analysis=responsibility_analysis,
                title_similarity=title_similarity,
                experience_match=experience_match,
                processing_time=time.time() - start_time
            )
            
            logger.info(f"✅ Enhanced matching completed in {result['processing_time']:.2f}s")
            logger.info(f"📈 Overall Score: {result['match_result']['overall_score']:.1f}%")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Enhanced matching failed: {str(e)}")
            raise Exception(f"Enhanced granular matching failed: {str(e)}")
    
    def _calculate_title_similarity(self, jd_title: str, cv_title: str) -> float:
        """Calculate semantic similarity between job titles."""
        if not jd_title or not cv_title:
            return 0.0
            
        try:
            jd_embedding = self.embedding_service.get_embedding(jd_title)
            cv_embedding = self.embedding_service.get_embedding(cv_title)
            return self.embedding_service._calculate_cosine_similarity(jd_embedding, cv_embedding)
        except Exception as e:
            logger.error(f"❌ Title similarity calculation failed: {str(e)}")
            return 0.0
    
    def _analyze_experience_match(self, jd_experience: str, cv_experience: str) -> bool:
        """Analyze if CV experience meets JD requirements."""
        try:
            # Simple heuristic - look for numbers in experience strings
            import re
            
            jd_years = re.findall(r'(\d+)', jd_experience)
            cv_years = re.findall(r'(\d+)', cv_experience)
            
            if jd_years and cv_years:
                required_years = int(jd_years[0])
                candidate_years = int(cv_years[0])
                return candidate_years >= required_years
            
            return True  # Default to true if can't parse
            
        except Exception as e:
            logger.error(f"❌ Experience analysis failed: {str(e)}")
            return True
    
    def _create_enhanced_match_result(
        self,
        jd_standardized: Dict[str, Any],
        cv_standardized: Dict[str, Any],
        skill_analysis: Dict[str, Any],
        responsibility_analysis: Dict[str, Any],
        title_similarity: float,
        experience_match: bool,
        processing_time: float
    ) -> Dict[str, Any]:
        """Create comprehensive match result with all analysis."""
        
        # Calculate weighted overall score
        skill_score = skill_analysis['skill_match_percentage']
        responsibility_score = responsibility_analysis['responsibility_match_percentage']
        title_score = title_similarity * 100
        experience_score = 100.0 if experience_match else 50.0
        
        # Weighted calculation (skills: 40%, responsibilities: 35%, title: 15%, experience: 10%)
        overall_score = (
            skill_score * 0.40 +
            responsibility_score * 0.35 +
            title_score * 0.15 +
            experience_score * 0.10
        )
        
        # Create detailed explanation
        explanation = self._generate_detailed_explanation(
            skill_analysis, responsibility_analysis, title_similarity, experience_match
        )
        
        # Create match details for frontend
        match_details = {
            "skill_analysis": {
                "total_required": skill_analysis['total_jd_skills'],
                "matched": skill_analysis['matched_skills'],
                "match_percentage": skill_analysis['skill_match_percentage'],
                "matches": skill_analysis['matches'][:5],  # Top 5 matches for display
                "unmatched": skill_analysis['unmatched_jd_skills']
            },
            "responsibility_analysis": {
                "total_required": responsibility_analysis['total_jd_responsibilities'],
                "matched": responsibility_analysis['matched_responsibilities'],
                "match_percentage": responsibility_analysis['responsibility_match_percentage'],
                "matches": responsibility_analysis['matches'][:5],  # Top 5 matches for display
                "unmatched": responsibility_analysis['unmatched_jd_responsibilities']
            },
            "title_analysis": {
                "jd_title": jd_standardized.get("job_title", ""),
                "cv_title": cv_standardized.get("job_title", ""),
                "similarity": title_similarity,
                "match_quality": "excellent" if title_similarity >= 0.8 else 
                               "good" if title_similarity >= 0.6 else "moderate"
            },
            "experience_analysis": {
                "jd_requirement": jd_standardized.get("years_of_experience", ""),
                "cv_experience": cv_standardized.get("years_of_experience", ""),
                "meets_requirement": experience_match,
                "score": experience_score
            }
        }
        
        # Generate IDs
        import uuid
        jd_id = str(uuid.uuid4())
        cv_id = str(uuid.uuid4())
        
        return {
            "status": "success",
            "jd_id": jd_id,
            "cv_id": cv_id,
            "jd_standardized_data": jd_standardized,
            "cv_standardized_data": cv_standardized,
            "match_result": {
                "overall_score": overall_score,
                "breakdown": {
                    "skills_score": skill_score,
                    "experience_score": experience_score,
                    "title_score": title_score,
                    "responsibility_score": responsibility_score
                },
                "explanation": explanation,
                "jd_data": {
                    "skills": jd_standardized.get("skills", []),
                    "title": jd_standardized.get("job_title", ""),
                    "years_required": jd_standardized.get("years_of_experience", "")
                },
                "cv_data": {
                    "skills": cv_standardized.get("skills", []),
                    "title": cv_standardized.get("job_title", ""),
                    "years_experience": cv_standardized.get("years_of_experience", "")
                },
                "detailed_analysis": match_details
            },
            "processing_time": processing_time,
            "embedding_model": "all-mpnet-base-v2",
            "matching_version": "2.0-granular"
        }
    
    def _generate_detailed_explanation(
        self,
        skill_analysis: Dict[str, Any],
        responsibility_analysis: Dict[str, Any],
        title_similarity: float,
        experience_match: bool
    ) -> str:
        """Generate human-readable explanation of the match."""
        
        explanations = []
        
        # Skill analysis
        skill_pct = skill_analysis['skill_match_percentage']
        matched_skills = skill_analysis['matched_skills']
        total_skills = skill_analysis['total_jd_skills']
        
        if skill_pct >= 80:
            explanations.append(f"Excellent skills match: {matched_skills}/{total_skills} required skills matched ({skill_pct:.0f}%)")
        elif skill_pct >= 60:
            explanations.append(f"Good skills match: {matched_skills}/{total_skills} required skills matched ({skill_pct:.0f}%)")
        else:
            explanations.append(f"Limited skills match: Only {matched_skills}/{total_skills} required skills matched ({skill_pct:.0f}%)")
        
        # Responsibility analysis
        resp_pct = responsibility_analysis['responsibility_match_percentage']
        matched_resp = responsibility_analysis['matched_responsibilities']
        total_resp = responsibility_analysis['total_jd_responsibilities']
        
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
        if experience_match:
            explanations.append("Experience requirements satisfied")
        else:
            explanations.append("Experience requirements may not be fully met")
        
        return ". ".join(explanations) + "."

# Global instance
_granular_matching_service: Optional[GranularMatchingService] = None

def get_granular_matching_service() -> GranularMatchingService:
    """Get global granular matching service instance."""
    global _granular_matching_service
    if _granular_matching_service is None:
        _granular_matching_service = GranularMatchingService()
    return _granular_matching_service