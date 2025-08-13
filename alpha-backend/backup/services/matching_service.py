"""
Enterprise-grade CV-JD matching service with detailed score breakdown.
Provides comprehensive similarity analysis with categorical scoring.
"""

import logging
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import re

from app.services.standardization_service import StandardizedCV, StandardizedJD
from app.services.embedding_service import get_embedding_service

logger = logging.getLogger(__name__)

@dataclass
class MatchScore:
    """Detailed match score breakdown."""
    overall_score: float
    skills_score: float
    experience_score: float
    education_score: float
    title_score: float
    industry_score: float
    embedding_similarity: float
    
    # Detailed breakdowns
    technical_skills_match: float
    soft_skills_match: float
    tools_match: float
    programming_languages_match: float
    frameworks_match: float
    
    # Experience details
    experience_level_match: float
    years_experience_score: float
    
    # Education details
    education_level_match: float
    degree_match: float

@dataclass 
class MatchResult:
    """Complete matching result with explanation."""
    cv_id: str
    jd_id: str
    cv_data: StandardizedCV
    jd_data: StandardizedJD
    match_score: MatchScore
    explanation: str
    recommendations: List[str]
    strengths: List[str]
    weaknesses: List[str]

class MatchingService:
    """
    Advanced CV-JD matching service with detailed analytics.
    
    Features:
    - Multi-dimensional similarity scoring
    - Embedding-based semantic similarity
    - Rule-based categorical matching
    - Detailed explanations and recommendations
    - Configurable scoring weights
    """
    
    def __init__(self, scoring_weights: Optional[Dict[str, float]] = None):
        """
        Initialize matching service with configurable weights.
        
        Args:
            scoring_weights: Custom weights for different scoring categories
        """
        self.embedding_service = get_embedding_service()
        
        # Default scoring weights (must sum to 1.0)
        self.weights = scoring_weights or {
            "skills": 0.35,           # Technical + soft skills
            "experience": 0.25,       # Experience level + years
            "education": 0.15,        # Education requirements
            "title": 0.10,           # Job title similarity
            "industry": 0.05,        # Industry alignment
            "embedding": 0.10        # Semantic similarity
        }
        
        # Validate weights
        total_weight = sum(self.weights.values())
        if abs(total_weight - 1.0) > 0.01:
            logger.warning(f"Scoring weights sum to {total_weight}, not 1.0. Normalizing...")
            for key in self.weights:
                self.weights[key] /= total_weight
        
        logger.info(f"MatchingService initialized with weights: {self.weights}")
    
    def calculate_match(
        self, 
        cv_data: StandardizedCV, 
        jd_data: StandardizedJD,
        cv_id: str = "unknown",
        jd_id: str = "unknown"
    ) -> MatchResult:
        """
        Calculate comprehensive match score between CV and JD.
        
        Args:
            cv_data: Standardized CV data
            jd_data: Standardized JD data
            cv_id: CV identifier
            jd_id: JD identifier
            
        Returns:
            MatchResult with detailed scoring and analysis
        """
        logger.info(f"Calculating match: CV={cv_id}, JD={jd_id}")
        start_time = time.time()
        
        try:
            # Calculate individual score components
            skills_score, skills_details = self._calculate_skills_score(cv_data, jd_data)
            experience_score, experience_details = self._calculate_experience_score(cv_data, jd_data)
            education_score, education_details = self._calculate_education_score(cv_data, jd_data)
            title_score = self._calculate_title_score(cv_data, jd_data)
            industry_score = self._calculate_industry_score(cv_data, jd_data)
            embedding_score = self._calculate_embedding_similarity(cv_data, jd_data)
            
            # Calculate weighted overall score
            overall_score = (
                self.weights["skills"] * skills_score +
                self.weights["experience"] * experience_score +
                self.weights["education"] * education_score +
                self.weights["title"] * title_score +
                self.weights["industry"] * industry_score +
                self.weights["embedding"] * embedding_score
            ) * 100  # Convert to percentage
            
            # Create detailed match score
            match_score = MatchScore(
                overall_score=round(overall_score, 2),
                skills_score=round(skills_score * 100, 2),
                experience_score=round(experience_score * 100, 2),
                education_score=round(education_score * 100, 2),
                title_score=round(title_score * 100, 2),
                industry_score=round(industry_score * 100, 2),
                embedding_similarity=round(embedding_score * 100, 2),
                
                # Skills breakdown
                technical_skills_match=skills_details["technical"],
                soft_skills_match=skills_details["soft"],
                tools_match=skills_details["tools"],
                programming_languages_match=skills_details["programming"],
                frameworks_match=skills_details["frameworks"],
                
                # Experience breakdown
                experience_level_match=experience_details["level"],
                years_experience_score=experience_details["years"],
                
                # Education breakdown
                education_level_match=education_details["level"],
                degree_match=education_details["degree"]
            )
            
            # Generate explanation and recommendations
            explanation = self._generate_explanation(match_score, cv_data, jd_data)
            recommendations = self._generate_recommendations(match_score, cv_data, jd_data)
            strengths = self._identify_strengths(match_score, cv_data, jd_data)
            weaknesses = self._identify_weaknesses(match_score, cv_data, jd_data)
            
            result = MatchResult(
                cv_id=cv_id,
                jd_id=jd_id,
                cv_data=cv_data,
                jd_data=jd_data,
                match_score=match_score,
                explanation=explanation,
                recommendations=recommendations,
                strengths=strengths,
                weaknesses=weaknesses
            )
            
            processing_time = time.time() - start_time
            logger.info(f"✅ Match calculation completed in {processing_time:.3f}s: {overall_score:.1f}%")
            
            return result
            
        except Exception as e:
            logger.error(f"Match calculation failed: {str(e)}")
            raise
    
    def _calculate_skills_score(
        self, 
        cv_data: StandardizedCV, 
        jd_data: StandardizedJD
    ) -> Tuple[float, Dict[str, float]]:
        """Calculate detailed skills matching score."""
        
        # Technical skills matching
        cv_technical = set(skill.lower().strip() for skill in cv_data.technical_skills)
        jd_required_tech = set(skill.lower().strip() for skill in jd_data.required_technical_skills)
        jd_preferred_tech = set(skill.lower().strip() for skill in jd_data.preferred_technical_skills)
        
        technical_score = self._calculate_skill_overlap(cv_technical, jd_required_tech, jd_preferred_tech)
        
        # Soft skills matching
        cv_soft = set(skill.lower().strip() for skill in cv_data.soft_skills)
        jd_soft = set(skill.lower().strip() for skill in jd_data.required_soft_skills)
        
        soft_score = self._calculate_simple_overlap(cv_soft, jd_soft)
        
        # Tools and platforms
        cv_tools = set(tool.lower().strip() for tool in cv_data.tools_and_platforms)
        jd_tools = set(tool.lower().strip() for tool in jd_data.required_tools)
        
        tools_score = self._calculate_simple_overlap(cv_tools, jd_tools)
        
        # Programming languages
        cv_lang = set(lang.lower().strip() for lang in cv_data.programming_languages)
        jd_lang = set(lang.lower().strip() for lang in jd_data.programming_languages)
        
        programming_score = self._calculate_simple_overlap(cv_lang, jd_lang)
        
        # Frameworks and libraries
        cv_frameworks = set(fw.lower().strip() for fw in cv_data.frameworks_libraries)
        jd_frameworks = set(fw.lower().strip() for fw in jd_data.frameworks_libraries)
        
        frameworks_score = self._calculate_simple_overlap(cv_frameworks, jd_frameworks)
        
        # Weighted average of all skills components
        overall_skills_score = (
            0.4 * technical_score +
            0.2 * soft_score +
            0.15 * tools_score +
            0.15 * programming_score +
            0.1 * frameworks_score
        )
        
        details = {
            "technical": round(technical_score * 100, 2),
            "soft": round(soft_score * 100, 2),
            "tools": round(tools_score * 100, 2),
            "programming": round(programming_score * 100, 2),
            "frameworks": round(frameworks_score * 100, 2)
        }
        
        return overall_skills_score, details
    
    def _calculate_experience_score(
        self, 
        cv_data: StandardizedCV, 
        jd_data: StandardizedJD
    ) -> Tuple[float, Dict[str, float]]:
        """Calculate experience matching score."""
        
        # Experience level mapping for comparison
        level_hierarchy = {
            "entry": 1,
            "junior": 2,
            "mid": 3,
            "senior": 4,
            "lead": 5,
            "principal": 6
        }
        
        cv_level = level_hierarchy.get(cv_data.experience_level.value, 0)
        jd_level = level_hierarchy.get(jd_data.required_experience_level.value, 0)
        
        # Experience level score (prefer exact match or higher)
        if cv_level >= jd_level:
            level_score = 1.0
        else:
            # Penalty for being under-qualified
            level_score = max(0.0, cv_level / jd_level)
        
        # Years of experience score
        cv_years = cv_data.years_of_experience
        jd_min_years = jd_data.min_years_experience
        jd_max_years = jd_data.max_years_experience or (jd_min_years + 5)  # Default range
        
        if cv_years >= jd_min_years:
            if cv_years <= jd_max_years:
                years_score = 1.0  # Perfect fit
            else:
                # Slight penalty for being overqualified
                years_score = max(0.8, 1.0 - (cv_years - jd_max_years) * 0.02)
        else:
            # Penalty for insufficient experience
            years_score = max(0.0, cv_years / jd_min_years)
        
        # Combined experience score
        overall_experience_score = 0.6 * level_score + 0.4 * years_score
        
        details = {
            "level": round(level_score * 100, 2),
            "years": round(years_score * 100, 2)
        }
        
        return overall_experience_score, details
    
    def _calculate_education_score(
        self, 
        cv_data: StandardizedCV, 
        jd_data: StandardizedJD
    ) -> Tuple[float, Dict[str, float]]:
        """Calculate education matching score."""
        
        # Education level hierarchy
        education_hierarchy = {
            "high_school": 1,
            "certificate": 2,
            "bootcamp": 2,
            "associate": 3,
            "bachelor": 4,
            "master": 5,
            "phd": 6
        }
        
        cv_edu_level = education_hierarchy.get(cv_data.education_level.value, 0)
        jd_edu_level = education_hierarchy.get(jd_data.required_education.value, 0)
        
        # Education level score
        if cv_edu_level >= jd_edu_level:
            level_score = 1.0
        else:
            level_score = max(0.0, cv_edu_level / jd_edu_level)
        
        # Degree matching (if specific degrees are mentioned)
        cv_degrees = set(degree.lower().strip() for degree in cv_data.degrees)
        jd_degrees = set(degree.lower().strip() for degree in jd_data.preferred_degrees)
        
        if jd_degrees:
            degree_score = self._calculate_simple_overlap(cv_degrees, jd_degrees)
        else:
            degree_score = 1.0  # No specific degree requirements
        
        # Combined education score
        overall_education_score = 0.7 * level_score + 0.3 * degree_score
        
        details = {
            "level": round(level_score * 100, 2),
            "degree": round(degree_score * 100, 2)
        }
        
        return overall_education_score, details
    
    def _calculate_title_score(self, cv_data: StandardizedCV, jd_data: StandardizedJD) -> float:
        """Calculate job title similarity score."""
        cv_title = cv_data.job_title.lower().strip()
        jd_title = jd_data.job_title.lower().strip()
        
        # Use TF-IDF for semantic similarity
        try:
            vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english')
            vectors = vectorizer.fit_transform([cv_title, jd_title])
            similarity = cosine_similarity(vectors[0:1], vectors[1:2])[0][0]
            return float(similarity)
        except:
            # Fallback to simple word overlap
            cv_words = set(cv_title.split())
            jd_words = set(jd_title.split())
            return self._calculate_simple_overlap(cv_words, jd_words)
    
    def _calculate_industry_score(self, cv_data: StandardizedCV, jd_data: StandardizedJD) -> float:
        """Calculate industry alignment score."""
        if not jd_data.industry:
            return 1.0  # No industry requirement
        
        cv_industries = set(ind.lower().strip() for ind in cv_data.industry_experience)
        jd_industry = jd_data.industry.lower().strip()
        
        # Check for exact or partial matches
        for cv_ind in cv_industries:
            if jd_industry in cv_ind or cv_ind in jd_industry:
                return 1.0
        
        return 0.0
    
    def _calculate_embedding_similarity(
        self, 
        cv_data: StandardizedCV, 
        jd_data: StandardizedJD
    ) -> float:
        """Calculate semantic similarity using embeddings."""
        try:
            # Create comprehensive text representations
            cv_text = self._create_cv_text_representation(cv_data)
            jd_text = self._create_jd_text_representation(jd_data)
            
            # Get embeddings
            cv_embedding = self.embedding_service.get_embedding(cv_text)
            jd_embedding = self.embedding_service.get_embedding(jd_text)
            
            # Calculate cosine similarity
            cv_vector = np.array(cv_embedding).reshape(1, -1)
            jd_vector = np.array(jd_embedding).reshape(1, -1)
            
            similarity = cosine_similarity(cv_vector, jd_vector)[0][0]
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Embedding similarity calculation failed: {str(e)}")
            return 0.0
    
    def _calculate_skill_overlap(
        self, 
        cv_skills: set, 
        jd_required: set, 
        jd_preferred: set
    ) -> float:
        """Calculate skill overlap with required/preferred weighting."""
        if not jd_required and not jd_preferred:
            return 1.0
        
        # Matches in required skills (weighted heavily)
        required_matches = len(cv_skills.intersection(jd_required))
        required_total = len(jd_required)
        
        # Matches in preferred skills (weighted lightly)
        preferred_matches = len(cv_skills.intersection(jd_preferred))
        preferred_total = len(jd_preferred)
        
        # Calculate weighted score
        if required_total > 0:
            required_score = required_matches / required_total
        else:
            required_score = 1.0
        
        if preferred_total > 0:
            preferred_score = preferred_matches / preferred_total
        else:
            preferred_score = 1.0
        
        # Weight required skills more heavily than preferred
        overall_score = 0.8 * required_score + 0.2 * preferred_score
        return min(1.0, overall_score)
    
    def _calculate_simple_overlap(self, set1: set, set2: set) -> float:
        """Calculate simple overlap between two sets."""
        if not set2:
            return 1.0
        
        intersection = len(set1.intersection(set2))
        return intersection / len(set2)
    
    def _create_cv_text_representation(self, cv_data: StandardizedCV) -> str:
        """Create comprehensive text representation of CV for embedding."""
        parts = [
            cv_data.job_title,
            cv_data.professional_summary,
            " ".join(cv_data.technical_skills),
            " ".join(cv_data.soft_skills),
            " ".join(cv_data.tools_and_platforms),
            " ".join(cv_data.programming_languages),
            " ".join(cv_data.frameworks_libraries),
            " ".join(cv_data.industry_experience),
            " ".join(cv_data.specializations)
        ]
        
        return " ".join(filter(None, parts))
    
    def _create_jd_text_representation(self, jd_data: StandardizedJD) -> str:
        """Create comprehensive text representation of JD for embedding."""
        parts = [
            jd_data.job_title,
            " ".join(jd_data.responsibilities),
            " ".join(jd_data.requirements),
            " ".join(jd_data.required_technical_skills),
            " ".join(jd_data.preferred_technical_skills),
            " ".join(jd_data.required_soft_skills),
            " ".join(jd_data.required_tools),
            " ".join(jd_data.programming_languages),
            " ".join(jd_data.frameworks_libraries),
            jd_data.industry or ""
        ]
        
        return " ".join(filter(None, parts))
    
    def _generate_explanation(
        self, 
        match_score: MatchScore, 
        cv_data: StandardizedCV, 
        jd_data: StandardizedJD
    ) -> str:
        """Generate human-readable explanation of the match."""
        explanations = []
        
        # Overall assessment
        if match_score.overall_score >= 80:
            explanations.append("🎯 Excellent match - highly recommended candidate")
        elif match_score.overall_score >= 60:
            explanations.append("✅ Good match - suitable candidate with minor gaps")
        elif match_score.overall_score >= 40:
            explanations.append("⚠️ Moderate match - consider with reservations")
        else:
            explanations.append("❌ Poor match - significant gaps identified")
        
        # Skills assessment
        if match_score.skills_score >= 80:
            explanations.append(f"Strong skills alignment ({match_score.skills_score:.1f}%)")
        elif match_score.skills_score >= 60:
            explanations.append(f"Adequate skills match ({match_score.skills_score:.1f}%)")
        else:
            explanations.append(f"Skills gap identified ({match_score.skills_score:.1f}%)")
        
        # Experience assessment
        if match_score.experience_score >= 80:
            explanations.append(f"Experience requirements met ({match_score.experience_score:.1f}%)")
        elif match_score.experience_score >= 60:
            explanations.append(f"Acceptable experience level ({match_score.experience_score:.1f}%)")
        else:
            explanations.append(f"Experience gap noted ({match_score.experience_score:.1f}%)")
        
        return " | ".join(explanations)
    
    def _generate_recommendations(
        self, 
        match_score: MatchScore, 
        cv_data: StandardizedCV, 
        jd_data: StandardizedJD
    ) -> List[str]:
        """Generate actionable recommendations."""
        recommendations = []
        
        if match_score.overall_score >= 80:
            recommendations.append("Schedule interview immediately")
            recommendations.append("Consider for fast-track hiring process")
        elif match_score.overall_score >= 60:
            recommendations.append("Proceed with standard interview process")
            recommendations.append("Assess specific skill gaps during interview")
        else:
            recommendations.append("Consider for junior roles or training programs")
            recommendations.append("Evaluate potential for skill development")
        
        # Specific skill recommendations
        if match_score.technical_skills_match < 70:
            recommendations.append("Assess technical skills through coding test")
        
        if match_score.experience_score < 70:
            recommendations.append("Consider mentorship or senior support")
        
        return recommendations
    
    def _identify_strengths(
        self, 
        match_score: MatchScore, 
        cv_data: StandardizedCV, 
        jd_data: StandardizedJD
    ) -> List[str]:
        """Identify candidate strengths."""
        strengths = []
        
        if match_score.technical_skills_match >= 80:
            strengths.append("Strong technical skills alignment")
        
        if match_score.experience_score >= 80:
            strengths.append("Meets experience requirements")
        
        if match_score.education_score >= 80:
            strengths.append("Excellent educational background")
        
        if match_score.title_score >= 80:
            strengths.append("Relevant job title/role experience")
        
        return strengths
    
    def _identify_weaknesses(
        self, 
        match_score: MatchScore, 
        cv_data: StandardizedCV, 
        jd_data: StandardizedJD
    ) -> List[str]:
        """Identify potential weaknesses or gaps."""
        weaknesses = []
        
        if match_score.technical_skills_match < 60:
            weaknesses.append("Technical skills gap")
        
        if match_score.experience_score < 60:
            weaknesses.append("Insufficient experience level")
        
        if match_score.education_score < 60:
            weaknesses.append("Education requirements not fully met")
        
        if match_score.soft_skills_match < 60:
            weaknesses.append("Soft skills alignment could be improved")
        
        return weaknesses

# Global instance
_matching_service: Optional[MatchingService] = None

def get_matching_service(scoring_weights: Optional[Dict[str, float]] = None) -> MatchingService:
    """Get global matching service instance."""
    global _matching_service
    if _matching_service is None:
        _matching_service = MatchingService(scoring_weights)
    return _matching_service