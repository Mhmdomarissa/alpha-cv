"""
Enhanced Matching with LLM Analysis

This module adds LLM contextual analysis to semantic matching results.
Uses a single bulk LLM call (all top candidates at once) with GPT-4.1-mini for efficiency.
"""

import asyncio
import logging
from typing import Dict, List
from app.services.llm_matching_service import get_llm_matching_service
from app.utils.qdrant_utils import get_qdrant_utils, get_decompressed_content

logger = logging.getLogger(__name__)


async def enhance_with_llm_analysis_batched(
    semantic_results: List[dict],
    jd_id: str,
    batch_size: int = 10,
) -> List[dict]:
    """
    Enhance top candidates with LLM contextual analysis.
    Uses one bulk API call for all top candidates (up to 50) with GPT-4.1-mini.
    
    Args:
        semantic_results: List of semantic matching results sorted by score
        jd_id: Job description ID
        batch_size: Unused (kept for API compatibility); bulk path ignores it
        
    Returns:
        Enhanced results with LLM analysis for top min(50, len(results)) candidates
    """
    try:
        total_candidates = len(semantic_results)
        llm_analyze_count = min(50, total_candidates)
        
        if llm_analyze_count == 0:
            return semantic_results
        
        logger.info(f"🤖 Starting LLM analysis (single bulk request) for top {llm_analyze_count}/{total_candidates} candidates")
        
        qdrant = get_qdrant_utils()
        
        # Fetch JD raw text (one document)
        jd_docs = qdrant.client.retrieve("jd_documents", ids=[jd_id], with_payload=True, with_vectors=False)
        if not jd_docs or not jd_docs[0].payload:
            logger.warning(f"⚠️ JD {jd_id} not found, skipping LLM analysis")
            for result in semantic_results:
                result["has_llm_analysis"] = False
            return semantic_results
        jd_raw_text = get_decompressed_content(jd_docs[0].payload)
        if not jd_raw_text or len(jd_raw_text.strip()) < 50:
            logger.warning(f"⚠️ JD {jd_id} has no usable raw text, skipping LLM analysis")
            for result in semantic_results:
                result["has_llm_analysis"] = False
            return semantic_results
        
        # Fetch all top CV raw texts in one batch
        top_candidates = semantic_results[:llm_analyze_count]
        cv_ids = [r["cv_id"] for r in top_candidates]
        cv_docs = qdrant.client.retrieve("cv_documents", ids=cv_ids, with_payload=True, with_vectors=False)
        id_to_payload = {}
        if cv_docs:
            for i, point in enumerate(cv_docs):
                if point.id is not None:
                    id_to_payload[str(point.id)] = point.payload or {}
                elif i < len(cv_ids):
                    id_to_payload[cv_ids[i]] = point.payload or {}
        
        candidates_for_bulk = []
        for r in top_candidates:
            cv_id = r["cv_id"]
            payload = id_to_payload.get(str(cv_id)) or id_to_payload.get(cv_id) or {}
            cv_raw = get_decompressed_content(payload) or ""
            candidates_for_bulk.append({
                "cv_id": cv_id,
                "cv_raw_text": cv_raw,
                "semantic_score": float(r.get("overall_score", 0)) * 100,
            })
        
        # Single bulk LLM call (all candidates at once)
        llm_service = get_llm_matching_service()
        loop = asyncio.get_event_loop()
        from concurrent.futures import ThreadPoolExecutor
        if not hasattr(enhance_with_llm_analysis_batched, "_executor"):
            enhance_with_llm_analysis_batched._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="llm_bulk")
        analyses = await loop.run_in_executor(
            enhance_with_llm_analysis_batched._executor,
            lambda: llm_service.analyze_cv_jd_fit_bulk(jd_raw_text, candidates_for_bulk),
        )
        
        # Merge analyses back into results (same order)
        for i, result in enumerate(top_candidates):
            if i < len(analyses):
                analysis = analyses[i]
                result["llm_analysis"] = analysis
                result["has_llm_analysis"] = True
                if analysis.get("llm_score") is not None:
                    result["llm_score"] = analysis["llm_score"] / 100.0
                    result["semantic_score"] = result["overall_score"]
                    result["overall_score"] = result["llm_score"]
            else:
                result["has_llm_analysis"] = False
        
        for result in semantic_results[llm_analyze_count:]:
            result["has_llm_analysis"] = False
        
        logger.info(f"🎉 LLM analysis completed: {llm_analyze_count} analyzed in one request, {total_candidates - llm_analyze_count} semantic-only")
        return semantic_results
        
    except Exception as e:
        logger.error(f"❌ LLM enhancement failed: {e}")
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
