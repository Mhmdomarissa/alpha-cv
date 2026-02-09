"""
LLM-based Contextual Matching Service

Provides deep, contextual analysis of CV-JD fit using GPT-4.1-mini.
Analyzes what skills match, what's missing, and provides detailed summaries.
"""

import json
import logging
from typing import Dict, List, Optional

from app.services.llm_service import get_llm_service

logger = logging.getLogger(__name__)


class LLMMatchingService:
    """
    LLM-powered contextual matching for detailed CV-JD analysis.
    
    Provides:
    - Matched skills breakdown
    - Missing skills identification
    - Extra bonus skills
    - Responsibility alignment analysis
    - Overall fit summary
    - Red flags detection
    """
    
    def __init__(self):
        self.llm_service = get_llm_service()
        self.model = "gpt-4.1-mini-2025-04-14"
        
    def analyze_cv_jd_fit(
        self,
        cv_structured: dict,
        jd_structured: dict,
        semantic_score: float
    ) -> dict:
        """
        Analyze CV-JD fit using LLM for detailed insights.
        
        Args:
            cv_structured: Parsed CV data (contains cv_id for fetching raw text)
            jd_structured: Parsed JD data (contains jd_id for fetching raw text)
            semantic_score: Initial semantic similarity score (0-100)
            
        Returns:
            {
                "llm_score": 85.5,  # LLM's refined score
                "matched_skills": ["Azure", "Terraform"],
                "missing_skills": ["Kubernetes"],
                "extra_skills": ["Python"],
                "responsibility_match": "Strong (8/10)",
                "overall_fit": "Excellent candidate...",
                "red_flags": []
            }
        """
        try:
            # Fetch RAW extracted text from documents instead of structured data
            from app.utils.qdrant_utils import get_qdrant_utils, get_decompressed_content
            
            qdrant = get_qdrant_utils()
            cv_id = cv_structured.get("id")
            jd_id = jd_structured.get("id")
            
            # Get raw document content
            cv_doc_points = qdrant.client.retrieve("cv_documents", ids=[cv_id], with_payload=True, with_vectors=False)
            jd_doc_points = qdrant.client.retrieve("jd_documents", ids=[jd_id], with_payload=True, with_vectors=False)
            
            cv_raw_text = ""
            jd_raw_text = ""
            
            if cv_doc_points and len(cv_doc_points) > 0:
                cv_payload = cv_doc_points[0].payload
                cv_raw_text = get_decompressed_content(cv_payload)
                logger.info(f"📄 Retrieved CV raw text: {len(cv_raw_text)} characters")
            
            if jd_doc_points and len(jd_doc_points) > 0:
                jd_payload = jd_doc_points[0].payload
                jd_raw_text = get_decompressed_content(jd_payload)
                logger.info(f"📄 Retrieved JD raw text: {len(jd_raw_text)} characters")
            
            if not cv_raw_text or not jd_raw_text:
                logger.warning("⚠️ Could not retrieve raw text, falling back to semantic score")
                return self._fallback_analysis(semantic_score)
            
            prompt = self._build_analysis_prompt_with_raw_text(cv_raw_text, jd_raw_text, semantic_score)
            
            # Log prompt length to verify complete data is included
            logger.info(f"📏 LLM Prompt length: {len(prompt)} characters")
            
            # Call OpenAI API with proper message format
            messages = [
                {"role": "system", "content": "You are an expert technical recruiter. Always respond with valid JSON only, no other text."},
                {"role": "user", "content": prompt}
            ]
            
            response = self.llm_service._call_openai_api(
                messages=messages,
                model=self.model,
                max_tokens=1500,
                json_schema=None  # Enables JSON mode
            )
            
            # The LLMService already parses the JSON and returns it in .data
            if response and response.success:
                analysis = response.data
            else:
                error_msg = response.error_message if response else "Unknown error"
                raise Exception(f"OpenAI API call failed: {error_msg}")
            
            # Validate and normalize response
            analysis = self._normalize_analysis(analysis)
            
            logger.info(f"✅ LLM analysis completed - Score: {analysis.get('llm_score', 'N/A')}")
            
            return analysis
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ LLM JSON parsing failed: {e}")
            return self._fallback_analysis(semantic_score)
        except Exception as e:
            logger.error(f"❌ LLM analysis failed: {e}")
            return self._fallback_analysis(semantic_score)
    
    
    def _build_analysis_prompt_with_raw_text(
        self,
        cv_raw_text: str,
        jd_raw_text: str,
        semantic_score: float
    ) -> str:
        """Build detailed analysis prompt for LLM using RAW extracted text from documents."""
        
        prompt = f"""You are an expert technical recruiter analyzing candidate-job fit.

**COMPLETE JOB DESCRIPTION** (raw extracted text):
{jd_raw_text}

**COMPLETE CANDIDATE CV** (raw extracted text):
{cv_raw_text}

**INITIAL SEMANTIC SCORE**: {semantic_score:.1f}% (from vector similarity)

**YOUR TASK**:
Analyze this CV-JD match using ALL the information provided above and provide:

1. **LLM Score** (0-100): Your refined match score considering context, synonyms, and transferable skills
2. **Key Matches**: 5 detailed bullet points explaining WHY they match (e.g., "Strong experience in X demonstrated by Y...")
3. **Gaps**: 3-5 detailed bullet points explaining what critical skills or experiences are missing or concerning
4. **Match Level**: One of (Strong/Good/Average/Low)
5. **Summary**: A cohesive paragraph (3-4 sentences) of overall fit and recommendation

**IMPORTANT**:
- Consider synonyms (e.g., "K8s" = "Kubernetes")
- Consider transferable skills (e.g., "Docker" relates to "Container orchestration")
- Be descriptive in Key Matches and Gaps—don't just list keywords.
- LLM score should be within ±15% of semantic score unless there's strong justification
- Use ALL available information from the raw text

Format your response as valid JSON:
{{
  "llm_score": 85.5,
  "match_level": "Strong",
  "key_matches": [
    "Strong experience in Azure infrastructure management demonstrated at Vodafone...",
    "Expertise in automation tools including Terraform and Azure DevOps...",
    "..."
  ],
  "gaps": [
    "Lack of specific mention of container orchestration experience with AKS...",
    "No direct experience mentioned with Azure Monitor or DataDog...",
    "..."
  ],
  "summary": "This candidate scores an 85, indicating a strong match for the Cloud Engineer - Azure role. Their extensive experience...",
  "red_flags": []
}}"""
        
        return prompt
    
    def _format_list(self, items: List[str], max_items: int = 20) -> str:
        """Format list items for prompt."""
        if not items:
            return "- None specified"
        
        # Limit to max_items to keep prompt size reasonable
        items_to_show = items[:max_items]
        formatted = "\n".join(f"- {item}" for item in items_to_show)
        
        if len(items) > max_items:
            formatted += f"\n- ... and {len(items) - max_items} more"
        
        return formatted
    
    def _normalize_analysis(self, analysis: dict) -> dict:
        """Validate and normalize LLM response."""
        
        # Ensure all required fields exist
        normalized = {
            "llm_score": float(analysis.get("llm_score", 0)),
            "match_level": analysis.get("match_level", "Unknown"),
            "key_matches": analysis.get("key_matches", analysis.get("matched_skills", [])),
            "gaps": analysis.get("gaps", analysis.get("missing_skills", [])),
            "summary": analysis.get("summary", analysis.get("overall_fit", "Analysis unavailable")),
            "red_flags": analysis.get("red_flags", [])
        }
        
        # Clamp score to 0-100
        normalized["llm_score"] = max(0.0, min(100.0, normalized["llm_score"]))
        
        # Ensure arrays
        for key in ["key_matches", "gaps", "red_flags"]:
            if not isinstance(normalized[key], list):
                if isinstance(normalized[key], str):
                    normalized[key] = [normalized[key]]
                else:
                    normalized[key] = []
        
        return normalized
    
    def _fallback_analysis(self, semantic_score: float) -> dict:
        """Return fallback analysis if LLM fails."""
        return {
            "llm_score": semantic_score,  # Use semantic score as fallback
            "match_level": "Average",
            "key_matches": [],
            "gaps": [],
            "summary": "Detailed analysis could not be completed. Semantic score is based on vector similarity.",
            "red_flags": ["LLM analysis failed - using semantic score only"]
        }


def get_llm_matching_service() -> LLMMatchingService:
    """Get LLM matching service instance."""
    return LLMMatchingService()
