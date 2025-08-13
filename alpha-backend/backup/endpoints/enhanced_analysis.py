"""
Enhanced analysis endpoints using the new enterprise-grade services.
Provides comprehensive CV-JD matching with detailed score breakdown.
"""

import logging
import time
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import tempfile
import os

from app.services.embedding_service import get_embedding_service
from app.services.standardization_service import get_standardization_service
from app.services.matching_service import get_matching_service
from app.utils.ocr_utils import extract_text_from_file

logger = logging.getLogger(__name__)

router = APIRouter()

class TextAnalysisRequest(BaseModel):
    """Request model for text-based analysis."""
    cv_texts: List[str]
    jd_text: str
    jd_title: str = "Job Position"
    scoring_weights: Optional[Dict[str, float]] = None

class AnalysisResult(BaseModel):
    """Analysis result model."""
    overall_score: float
    rank: int
    detailed_scores: Dict[str, Any]
    explanation: str
    recommendations: List[str]
    strengths: List[str]
    weaknesses: List[str]
    cv_summary: Dict[str, Any]

class BatchAnalysisResponse(BaseModel):
    """Batch analysis response model."""
    status: str
    total_cvs: int
    processing_time: float
    jd_summary: Dict[str, Any]
    results: List[AnalysisResult]
    top_candidates: List[AnalysisResult]

@router.post("/enhanced-text-analysis", response_model=BatchAnalysisResponse)
async def enhanced_text_analysis(request: TextAnalysisRequest):
    """
    Perform enhanced CV-JD analysis with detailed score breakdown.
    
    Features:
    - Sentence Transformers + OpenAI embeddings
    - Structured data extraction with GPT-4
    - Detailed score breakdown (Skills %, Experience %, etc.)
    - Ranking and recommendations
    """
    logger.info(f"Starting enhanced analysis: {len(request.cv_texts)} CVs")
    start_time = time.time()
    
    try:
        # Initialize services
        standardization_service = get_standardization_service()
        matching_service = get_matching_service(request.scoring_weights)
        
        # Standardize job description
        logger.info("Standardizing job description...")
        jd_standardized = standardization_service.standardize_jd(
            request.jd_text, 
            f"{request.jd_title}.txt"
        )
        
        # Process all CVs
        results = []
        cv_id = 1
        
        for cv_text in request.cv_texts:
            try:
                logger.info(f"Processing CV {cv_id}/{len(request.cv_texts)}")
                
                # Standardize CV
                cv_standardized = standardization_service.standardize_cv(
                    cv_text,
                    f"cv_{cv_id}.txt"
                )
                
                # Calculate match
                match_result = matching_service.calculate_match(
                    cv_standardized,
                    jd_standardized,
                    cv_id=str(cv_id),
                    jd_id="jd_1"
                )
                
                # Create result
                result = AnalysisResult(
                    overall_score=match_result.match_score.overall_score,
                    rank=0,  # Will be set after sorting
                    detailed_scores={
                        "skills_score": match_result.match_score.skills_score,
                        "experience_score": match_result.match_score.experience_score,
                        "education_score": match_result.match_score.education_score,
                        "title_score": match_result.match_score.title_score,
                        "industry_score": match_result.match_score.industry_score,
                        "embedding_similarity": match_result.match_score.embedding_similarity,
                        "breakdown": {
                            "technical_skills": match_result.match_score.technical_skills_match,
                            "soft_skills": match_result.match_score.soft_skills_match,
                            "tools": match_result.match_score.tools_match,
                            "programming_languages": match_result.match_score.programming_languages_match,
                            "frameworks": match_result.match_score.frameworks_match,
                            "experience_level": match_result.match_score.experience_level_match,
                            "years_experience": match_result.match_score.years_experience_score,
                            "education_level": match_result.match_score.education_level_match,
                            "degree_match": match_result.match_score.degree_match
                        }
                    },
                    explanation=match_result.explanation,
                    recommendations=match_result.recommendations,
                    strengths=match_result.strengths,
                    weaknesses=match_result.weaknesses,
                    cv_summary={
                        "name": cv_standardized.full_name,
                        "title": cv_standardized.job_title,
                        "experience_level": cv_standardized.experience_level.value,
                        "years_experience": cv_standardized.years_of_experience,
                        "education": cv_standardized.education_level.value,
                        "top_skills": cv_standardized.technical_skills[:5],
                        "email": cv_standardized.email,
                        "location": cv_standardized.location
                    }
                )
                
                results.append(result)
                cv_id += 1
                
            except Exception as e:
                logger.error(f"Failed to process CV {cv_id}: {str(e)}")
                # Continue with other CVs
                cv_id += 1
                continue
        
        # Sort by overall score and assign ranks
        results.sort(key=lambda x: x.overall_score, reverse=True)
        for i, result in enumerate(results):
            result.rank = i + 1
        
        # Get top candidates (top 3 or all if less than 3)
        top_candidates = results[:3]
        
        processing_time = time.time() - start_time
        
        # Create response
        response = BatchAnalysisResponse(
            status="success",
            total_cvs=len(results),
            processing_time=round(processing_time, 3),
            jd_summary={
                "title": jd_standardized.job_title,
                "company": jd_standardized.company,
                "required_experience": jd_standardized.required_experience_level.value,
                "min_years": jd_standardized.min_years_experience,
                "required_skills": jd_standardized.required_technical_skills[:10],
                "industry": jd_standardized.industry,
                "education": jd_standardized.required_education.value
            },
            results=results,
            top_candidates=top_candidates
        )
        
        logger.info(f"✅ Enhanced analysis completed: {len(results)} CVs processed in {processing_time:.3f}s")
        return response
        
    except Exception as e:
        logger.error(f"Enhanced analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/enhanced-file-analysis")
async def enhanced_file_analysis(
    cv_files: List[UploadFile] = File(...),
    jd_file: UploadFile = File(...),
    jd_title: str = Form("Job Position"),
    scoring_weights: Optional[str] = Form(None)
):
    """
    Perform enhanced analysis with file uploads.
    
    Supports: PDF, DOCX, TXT files
    Returns detailed scoring and analysis
    """
    logger.info(f"Starting enhanced file analysis: {len(cv_files)} CV files")
    start_time = time.time()
    
    try:
        # Parse scoring weights if provided
        weights = None
        if scoring_weights:
            import json
            try:
                weights = json.loads(scoring_weights)
            except json.JSONDecodeError:
                logger.warning("Invalid scoring weights JSON, using defaults")
        
        # Extract JD text
        with tempfile.NamedTemporaryFile(delete=False) as temp_jd:
            content = await jd_file.read()
            temp_jd.write(content)
            temp_jd_path = temp_jd.name
        
        try:
            jd_text = extract_text_from_file(temp_jd_path, jd_file.filename)
        finally:
            os.unlink(temp_jd_path)
        
        # Extract CV texts
        cv_texts = []
        for cv_file in cv_files:
            with tempfile.NamedTemporaryFile(delete=False) as temp_cv:
                content = await cv_file.read()
                temp_cv.write(content)
                temp_cv_path = temp_cv.name
            
            try:
                cv_text = extract_text_from_file(temp_cv_path, cv_file.filename)
                cv_texts.append(cv_text)
            except Exception as e:
                logger.error(f"Failed to extract text from {cv_file.filename}: {str(e)}")
                # Continue with other files
            finally:
                os.unlink(temp_cv_path)
        
        if not cv_texts:
            raise HTTPException(status_code=400, detail="No valid CV files could be processed")
        
        # Create analysis request
        request = TextAnalysisRequest(
            cv_texts=cv_texts,
            jd_text=jd_text,
            jd_title=jd_title,
            scoring_weights=weights
        )
        
        # Perform analysis
        result = await enhanced_text_analysis(request)
        
        # Add file information
        for i, cv_result in enumerate(result.results):
            if i < len(cv_files):
                cv_result.cv_summary["filename"] = cv_files[i].filename
        
        processing_time = time.time() - start_time
        result.processing_time = round(processing_time, 3)
        
        logger.info(f"✅ Enhanced file analysis completed in {processing_time:.3f}s")
        return result
        
    except Exception as e:
        logger.error(f"Enhanced file analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File analysis failed: {str(e)}")

@router.get("/service-health")
async def service_health():
    """Check health of all enhanced services."""
    try:
        embedding_service = get_embedding_service()
        
        health_status = {
            "status": "healthy",
            "services": {
                "embedding_service": embedding_service.health_check(),
                "standardization_service": {"status": "operational"},
                "matching_service": {"status": "operational"}
            },
            "features": {
                "sentence_transformers": True,
                "openai_embeddings": True,
                "structured_extraction": True,
                "detailed_scoring": True,
                "batch_processing": True
            }
        }
        
        return health_status
        
    except Exception as e:
        logger.error(f"Service health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }