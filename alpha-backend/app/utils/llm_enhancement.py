"""
Enhanced Matching with Batched LLM Analysis

This module adds LLM contextual analysis to semantic matching results.
Provides adaptive top-K selection and batched processing for performance.
"""

import asyncio
import logging
from typing import Dict, List
from app.services.llm_matching_service import get_llm_matching_service
from app.utils.qdrant_utils import get_qdrant_utils

logger = logging.getLogger(__name__)


async def enhance_with_llm_analysis_batched(
    semantic_results: List[dict],
    jd_id: str,
    batch_size: int = 10
) -> List[dict]:
    """
    Enhance top candidates with LLM contextual analysis using batched processing.
    
    Args:
        semantic_results: List of semantic matching results sorted by score
        jd_id: Job description ID
        batch_size: Number of LLM calls to run in parallel (default 10)
        
    Returns:
        Enhanced results with LLM analysis for top min(50, len(results)) candidates
    """
    try:
        total_candidates = len(semantic_results)
        
        # Adaptive top-K: analyze top 50 or all if less than 50
        llm_analyze_count = min(50, total_candidates)
        
        if llm_analyze_count == 0:
            return semantic_results
        
        logger.info(f"🤖 Starting LLM analysis for top {llm_analyze_count}/{total_candidates} candidates")
        
        # Get JD structured data once
        qdrant = get_qdrant_utils()
        jd_structured = qdrant.get_structured_jd(jd_id)
        if not jd_structured:
            logger.warning(f"⚠️ JD {jd_id} not found, skipping LLM analysis")
            for result in semantic_results:
                result["has_llm_analysis"] = False
            return semantic_results
        
        # Get LLM service
        llm_service = get_llm_matching_service()
        
        # Process top candidates in batches
        top_candidates = semantic_results[:llm_analyze_count]
        
        for batch_start in range(0, llm_analyze_count, batch_size):
            batch_end = min(batch_start + batch_size, llm_analyze_count)
            batch = top_candidates[batch_start:batch_end]
            batch_num = (batch_start // batch_size) + 1
            total_batches = (llm_analyze_count + batch_size - 1) // batch_size
            
            logger.info(f"📦 Processing LLM batch {batch_num}/{total_batches}: candidates {batch_start+1}-{batch_end}")
            
            # Create async tasks for this batch
            tasks = []
            for result in batch:
                task = analyze_single_candidate_async(
                    result=result,
                    jd_structured=jd_structured,
                    llm_service=llm_service,
                    qdrant=qdrant
                )
                tasks.append(task)
            
            # Run batch in parallel
            await asyncio.gather(*tasks, return_exceptions=True)
            
            logger.info(f"✅ LLM batch {batch_num}/{total_batches} completed")
        
        # Mark remaining as not analyzed
        for result in semantic_results[llm_analyze_count:]:
            result["has_llm_analysis"] = False
        
        logger.info(f"🎉 LLM analysis completed: {llm_analyze_count} analyzed, {total_candidates - llm_analyze_count} semantic-only")
        
        return semantic_results
        
    except Exception as e:
        logger.error(f"❌ LLM enhancement failed: {e}")
        # Mark all as not analyzed on error
        for result in semantic_results:
            result["has_llm_analysis"] = False
        return semantic_results


async def analyze_single_candidate_async(
    result: dict,
    jd_structured: dict,
    llm_service,
    qdrant
) -> None:
    """
    Analyze a single candidate with LLM asynchronously.
    Modifies result in-place to add llm_analysis field.
    """
    try:
        cv_id = result.get("cv_id")
        semantic_score = result.get("overall_score", 0) * 100  # Convert to 0-100 scale
        
        # Get CV structured data
        cv_structured = qdrant.get_structured_cv(cv_id)
        if not cv_structured:
            result["has_llm_analysis"] = False
            result["llm_analysis_error"] = "CV data not found"
            return
        
        # Run LLM analysis in thread pool (OpenAI is blocking)
        loop = asyncio.get_event_loop()
        from concurrent.futures import ThreadPoolExecutor
        
        if not hasattr(analyze_single_candidate_async, '_executor'):
            analyze_single_candidate_async._executor = ThreadPoolExecutor(
                max_workers=5, 
                thread_name_prefix="llm_worker"
            )
        
        llm_analysis = await loop.run_in_executor(
            analyze_single_candidate_async._executor,
            llm_service.analyze_cv_jd_fit,
            cv_structured,
            jd_structured,
            semantic_score
        )
        
        # Add LLM analysis to result
        result["llm_analysis"] = llm_analysis
        result["has_llm_analysis"] = True
        
        # Override score with LLM score if available
        if llm_analysis.get("llm_score"):
            result["llm_score"] = llm_analysis["llm_score"] / 100.0  # Normalize to 0-1
            # Keep semantic_score as original
            result["semantic_score"] = result["overall_score"]
            # Update overall_score to use LLM score
            result["overall_score"] = result["llm_score"]
        
        logger.debug(f"✅ LLM analysis for {cv_id}: semantic={semantic_score:.1f}%, llm={llm_analysis.get('llm_score', 0):.1f}%")
        
    except Exception as e:
        logger.error(f"❌ LLM analysis failed for CV {result.get('cv_id')}: {e}")
        result["has_llm_analysis"] = False
        result["llm_analysis_error"] = str(e)
