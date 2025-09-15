"""
Enhanced Careers Service for Viral Traffic
==========================================

Async processing service designed to handle massive job application loads
without blocking the main API thread.
"""

import asyncio
import logging
import time
import uuid
from typing import Dict, Any, Optional, List
from pathlib import Path

logger = logging.getLogger(__name__)

async def process_job_application_async(application_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a job application asynchronously
    This function handles the heavy lifting of CV processing without blocking
    """
    start_time = time.time()
    
    try:
        logger.info(f"🔄 Starting async processing for application {application_data.get('application_id', 'unknown')}")
        
        # Extract application details
        public_token = application_data["public_token"]
        applicant_name = application_data["applicant_name"]
        applicant_email = application_data["applicant_email"]
        applicant_phone = application_data.get("applicant_phone")
        cover_letter = application_data.get("cover_letter")
        cv_file_path = application_data["cv_file_path"]
        application_id = application_data["application_id"]
        
        # Import services (avoid circular imports)
        from app.services.parsing_service import get_parsing_service
        from app.services.llm_service import get_llm_service
        from app.services.embedding_service import get_embedding_service
        from app.services.matching_service import MatchingService
        from app.utils.qdrant_utils import get_qdrant_utils
        
        # Initialize services
        parsing_service = get_parsing_service()
        llm_service = get_llm_service()
        embedding_service = get_embedding_service()
        matching_service = MatchingService()
        qdrant = get_qdrant_utils()
        
        # Step 1: Get job posting details
        logger.info(f"📋 Fetching job details for token: {public_token}")
        job_posting = await asyncio.to_thread(qdrant.get_job_posting_by_token, public_token)
        
        if not job_posting:
            raise Exception(f"Job posting not found for token: {public_token}")
        
        # Step 2: Process CV file
        logger.info(f"📄 Processing CV file: {cv_file_path}")
        
        # Parse CV document
        parsed = await asyncio.to_thread(parsing_service.process_document, cv_file_path, "cv")
        cv_raw_text = parsed["clean_text"]
        
        # Generate CV standardized data using LLM
        cv_standardized = await asyncio.to_thread(llm_service.standardize_cv, cv_raw_text, cv_file_path)
        
        # Generate CV embeddings
        cv_embeddings = await asyncio.to_thread(embedding_service.generate_document_embeddings, cv_standardized)
        
        # Step 3: Store CV in database
        logger.info(f"💾 Storing CV data in database")
        
        # Generate CV ID
        import uuid
        cv_id = str(uuid.uuid4())
        
        # Store raw CV document
        await asyncio.to_thread(
            qdrant.store_document,
            cv_id, "cv", cv_file_path,
            "application/octet-stream",
            cv_raw_text, 
            time.strftime("%Y-%m-%dT%H:%M:%S"),
            file_path=cv_file_path
        )
        
        # Store structured CV data
        cv_structured_payload = cv_standardized.copy()
        cv_structured_payload.update({
            "name": applicant_name,
            "email": applicant_email,
            "document_type": "cv"
        })
        
        await asyncio.to_thread(
            qdrant.store_structured_data,
            cv_id, "cv", cv_structured_payload
        )
        
        # Store CV embeddings
        await asyncio.to_thread(
            qdrant.store_embeddings_exact,
            cv_id, "cv", cv_embeddings
        )
        
        # Step 4: Perform matching analysis
        logger.info(f"🎯 Performing CV-JD matching analysis")
        
        # Get original JD ID for matching (not the UI display job posting ID)
        jd_id = job_posting.get("jd_id") or job_posting.get("id")
        
        if not jd_id:
            logger.warning(f"⚠️ No JD ID found for matching, proceeding without match score")
            # Create a mock MatchResult-like object for missing JD ID
            class MockMatchResult:
                def __init__(self):
                    self.overall_score = 0
                    self.explanation = "Matching analysis unavailable - JD ID not found"
                    self.match_details = {}
            
            match_result = MockMatchResult()
        else:
            # Perform detailed matching
            try:
                match_result = await asyncio.to_thread(
                    matching_service.match_cv_against_jd,
                    cv_id,
                    jd_id
                )
            except Exception as e:
                logger.warning(f"⚠️ Matching analysis failed: {str(e)}")
                # Create a mock MatchResult-like object for error cases
                class MockMatchResult:
                    def __init__(self):
                        self.overall_score = 0
                        self.explanation = f"Matching analysis failed: {str(e)}"
                        self.match_details = {}
                
                match_result = MockMatchResult()
        
        # Step 5: Store application record
        logger.info(f"📝 Storing application record")
        
        # Store application in CV collection with job reference
        application_metadata = {
            "application_id": application_id,
            "job_posting_id": job_posting["id"],  # UI display job posting
            "original_jd_id": jd_id,  # Original JD used for matching
            "job_token": public_token,
            "applicant_name": applicant_name,
            "applicant_email": applicant_email,
            "applicant_phone": applicant_phone,
            "cover_letter": cover_letter,
            "match_percentage": getattr(match_result, "overall_score", 0),
            "match_analysis": {
                "overall_score": getattr(match_result, "overall_score", 0),
                "explanation": getattr(match_result, "explanation", "No analysis available"),
                "match_details": getattr(match_result, "match_details", {})
            },
            "application_status": "submitted",
            "submitted_at": time.time(),
            "document_type": "job_application"
        }
        
        # Link application to job posting
        await asyncio.to_thread(
            qdrant.link_application_to_job,
            cv_id, job_posting["id"], application_metadata, 
            cv_file_path, time.strftime("%Y-%m-%dT%H:%M:%S")
        )
        
        # Step 6: Send confirmation email (async)
        try:
            await asyncio.to_thread(
                send_application_confirmation_email,
                applicant_email,
                applicant_name,
                job_posting["job_title"],
                application_id
            )
        except Exception as e:
            logger.warning(f"⚠️ Failed to send confirmation email: {str(e)}")
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Return success result
        result = {
            "success": True,
            "application_id": application_id,
            "cv_id": cv_id,
            "match_percentage": getattr(match_result, "overall_score", 0),
            "processing_time": processing_time,
            "message": f"Thank you, {applicant_name}! Your application has been processed successfully.",
            "next_steps": "We'll review your application and contact you if there's a match. Check your email for confirmation."
        }
        
        logger.info(f"✅ Application {application_id} processed successfully in {processing_time:.2f}s")
        return result
        
    except Exception as e:
        processing_time = time.time() - start_time
        error_msg = str(e)
        
        logger.error(f"❌ Application processing failed after {processing_time:.2f}s: {error_msg}")
        
        # Return error result
        return {
            "success": False,
            "application_id": application_data.get("application_id", "unknown"),
            "error": error_msg,
            "processing_time": processing_time,
            "message": "We're sorry, but there was an issue processing your application. Please try again later.",
            "next_steps": "If the problem persists, please contact our support team."
        }

def send_application_confirmation_email(email: str, name: str, job_title: str, application_id: str):
    """
    Send confirmation email to applicant
    This is a placeholder - implement with your email service
    """
    logger.info(f"📧 Sending confirmation email to {email} for application {application_id}")
    
    # TODO: Implement actual email sending
    # Example with SendGrid, AWS SES, or other email service
    
    return True

async def get_application_processing_stats() -> Dict[str, Any]:
    """Get statistics about application processing"""
    try:
        from app.services.enhanced_job_queue import get_enterprise_job_queue
        
        job_queue = await get_enterprise_job_queue()
        stats = job_queue.get_system_metrics()
        
        return {
            "queue_stats": stats,
            "system_health": {
                "queue_healthy": stats["performance_metrics"]["memory_utilization"] < 80,
                "workers_healthy": stats["worker_metrics"]["worker_utilization"] > 20,
                "processing_healthy": stats["queue_metrics"]["success_rate"] > 80,
                "circuit_breaker_healthy": not stats["circuit_breaker"]["is_open"]
            },
            "recommendations": _get_system_recommendations(stats)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get processing stats: {str(e)}")
        return {
            "error": str(e),
            "system_health": {
                "queue_healthy": False,
                "workers_healthy": False,
                "processing_healthy": False,
                "circuit_breaker_healthy": False
            }
        }

def _get_system_recommendations(stats: Dict[str, Any]) -> List[str]:
    """Generate system recommendations based on current stats"""
    recommendations = []
    
    # Memory recommendations
    memory_util = stats["performance_metrics"]["memory_utilization"]
    if memory_util > 85:
        recommendations.append("🔴 CRITICAL: Memory usage very high - consider scaling infrastructure")
    elif memory_util > 70:
        recommendations.append("🟡 WARNING: Memory usage high - monitor closely")
    
    # Queue recommendations
    queue_size = stats["queue_metrics"]["current_queue_size"]
    if queue_size > 1000:
        recommendations.append("🔴 CRITICAL: Very large queue - consider adding more workers")
    elif queue_size > 500:
        recommendations.append("🟡 WARNING: Large queue detected")
    
    # Success rate recommendations
    success_rate = stats["queue_metrics"]["success_rate"]
    if success_rate < 80:
        recommendations.append("🔴 CRITICAL: Low success rate - investigate errors")
    elif success_rate < 90:
        recommendations.append("🟡 WARNING: Success rate could be improved")
    
    # Worker recommendations
    worker_util = stats["worker_metrics"]["worker_utilization"]
    if worker_util > 95:
        recommendations.append("🟡 High worker utilization - consider auto-scaling")
    elif worker_util < 30:
        recommendations.append("ℹ️ Low worker utilization - system running efficiently")
    
    if not recommendations:
        recommendations.append("✅ System running optimally")
    
    return recommendations
