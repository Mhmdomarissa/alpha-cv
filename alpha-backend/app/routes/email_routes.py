"""
Email Processing Routes - Azure Email Integration API
====================================================

Provides API endpoints for:
1. Manual email processing trigger
2. Email processing status and monitoring
3. Webhook endpoint for real-time email processing
4. Email processing statistics and health checks
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.services.azure_email_service import get_azure_email_service
from app.services.email_cv_processor import get_email_cv_processor
from app.deps.auth import require_admin, require_user
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== Request/Response Models ====================

class EmailProcessingRequest(BaseModel):
    """Request model for manual email processing"""
    max_emails: Optional[int] = Field(50, description="Maximum number of emails to process")
    force_reprocess: bool = Field(False, description="Force reprocessing of already processed emails")

class EmailProcessingResponse(BaseModel):
    """Response model for email processing results"""
    success: bool
    processed_count: int
    successful_count: int
    failed_count: int
    results: List[Dict[str, Any]]
    processing_time: float
    message: str

class EmailProcessingStatus(BaseModel):
    """Model for email processing status"""
    is_processing: bool
    last_processed: Optional[str]
    total_processed_today: int
    successful_today: int
    failed_today: int
    next_scheduled_run: Optional[str]

class EmailHealthCheck(BaseModel):
    """Model for email service health check"""
    azure_connection: bool
    mailbox_accessible: bool
    access_token_valid: bool
    last_successful_processing: Optional[str]
    error_message: Optional[str]

# ==================== Email Processing Endpoints ====================

@router.post("/process-emails", response_model=EmailProcessingResponse)
async def process_emails(
    request: EmailProcessingRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_user)
) -> EmailProcessingResponse:
    """
    Manually trigger email processing
    
    This endpoint processes unread emails from the Azure mailbox and extracts CV attachments.
    Only authenticated users can trigger this process.
    """
    try:
        logger.info(f"🔄 Manual email processing triggered by user: {current_user.username}")
        
        start_time = datetime.utcnow()
        
        # Get email processing services
        azure_service = get_azure_email_service()
        cv_processor = get_email_cv_processor()
        
        # Process emails
        results = await cv_processor.process_all_email_cvs()
        
        # Calculate statistics
        successful_count = sum(1 for r in results if r.get("success", False))
        failed_count = len(results) - successful_count
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        response = EmailProcessingResponse(
            success=True,
            processed_count=len(results),
            successful_count=successful_count,
            failed_count=failed_count,
            results=results,
            processing_time=processing_time,
            message=f"Processed {len(results)} emails successfully"
        )
        
        logger.info(f"✅ Email processing completed: {successful_count} successful, {failed_count} failed")
        return response
        
    except Exception as e:
        logger.error(f"❌ Email processing failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Email processing failed: {str(e)}"
        )

@router.post("/process-emails/background")
async def process_emails_background(
    request: EmailProcessingRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_user)
) -> JSONResponse:
    """
    Trigger email processing in background
    
    This endpoint queues email processing to run in the background,
    allowing for immediate response while processing continues.
    """
    try:
        logger.info(f"🔄 Background email processing triggered by user: {current_user.username}")
        
        # Add background task
        background_tasks.add_task(
            _process_emails_background_task,
            request.max_emails,
            current_user.username
        )
        
        return JSONResponse({
            "success": True,
            "message": "Email processing started in background",
            "triggered_by": current_user.username,
            "timestamp": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to start background email processing: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start background processing: {str(e)}"
        )

async def _process_emails_background_task(max_emails: int, triggered_by: str):
    """Background task for email processing"""
    try:
        logger.info(f"🔄 Starting background email processing (triggered by: {triggered_by})")
        
        cv_processor = get_email_cv_processor()
        results = await cv_processor.process_all_email_cvs()
        
        successful_count = sum(1 for r in results if r.get("success", False))
        logger.info(f"✅ Background email processing completed: {successful_count}/{len(results)} successful")
        
    except Exception as e:
        logger.error(f"❌ Background email processing failed: {e}")

@router.get("/status", response_model=EmailProcessingStatus)
async def get_email_processing_status(
    current_user: User = Depends(require_user)
) -> EmailProcessingStatus:
    """
    Get current email processing status
    
    Returns information about the last processing run and statistics.
    """
    try:
        # This would need to be implemented with proper state tracking
        # For now, return basic status information
        
        return EmailProcessingStatus(
            is_processing=False,  # Would need to track this
            last_processed=None,  # Would need to track this
            total_processed_today=0,  # Would need to track this
            successful_today=0,  # Would need to track this
            failed_today=0,  # Would need to track this
            next_scheduled_run=None  # Would need to implement scheduling
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to get email processing status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get status: {str(e)}"
        )

@router.get("/health", response_model=EmailHealthCheck)
async def email_health_check(
    current_user: User = Depends(require_user)
) -> EmailHealthCheck:
    """
    Check email service health
    
    Verifies Azure connection, mailbox accessibility, and access token validity.
    """
    try:
        azure_service = get_azure_email_service()
        
        # Test Azure connection
        try:
            access_token = await azure_service.get_access_token()
            azure_connection = True
            access_token_valid = True
        except Exception as e:
            azure_connection = False
            access_token_valid = False
            error_message = str(e)
        
        # Test mailbox accessibility
        try:
            if access_token_valid:
                emails = await azure_service.get_unread_emails(access_token, max_emails=1)
                mailbox_accessible = True
            else:
                mailbox_accessible = False
        except Exception as e:
            mailbox_accessible = False
            error_message = str(e)
        
        return EmailHealthCheck(
            azure_connection=azure_connection,
            mailbox_accessible=mailbox_accessible,
            access_token_valid=access_token_valid,
            last_successful_processing=None,  # Would need to track this
            error_message=error_message if not azure_connection or not mailbox_accessible else None
        )
        
    except Exception as e:
        logger.error(f"❌ Email health check failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}"
        )

@router.get("/processed-emails")
async def get_processed_emails(
    limit: int = 50,
    current_user: User = Depends(require_user)
) -> JSONResponse:
    """
    Get list of recently processed emails
    
    Returns information about emails that have been processed by the system.
    """
    try:
        # This would need to be implemented with proper data storage
        # For now, return empty list
        
        return JSONResponse({
            "success": True,
            "processed_emails": [],
            "total_count": 0,
            "message": "No processed emails found"
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get processed emails: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get processed emails: {str(e)}"
        )

@router.post("/webhook/email-received")
async def email_webhook(
    webhook_data: Dict[str, Any],
    background_tasks: BackgroundTasks
) -> JSONResponse:
    """
    Webhook endpoint for real-time email processing
    
    This endpoint can be called by Microsoft Graph API when new emails arrive.
    It triggers immediate processing of the new email.
    """
    try:
        logger.info("📧 Email webhook received")
        
        # Add background task to process emails
        background_tasks.add_task(
            _process_emails_background_task,
            10,  # Process up to 10 emails
            "webhook_trigger"
        )
        
        return JSONResponse({
            "success": True,
            "message": "Email processing triggered via webhook",
            "timestamp": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Email webhook failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Webhook processing failed: {str(e)}"
        )

# ==================== Admin Endpoints ====================

@router.post("/admin/reset-processed-emails")
async def reset_processed_emails(
    current_admin: User = Depends(require_admin)
) -> JSONResponse:
    """
    Reset processed emails list (Admin only)
    
    This allows reprocessing of all emails by clearing the processed emails cache.
    """
    try:
        logger.info(f"🔄 Resetting processed emails list by admin: {current_admin.username}")
        
        azure_service = get_azure_email_service()
        azure_service.processed_emails.clear()
        azure_service._save_processed_emails()
        
        return JSONResponse({
            "success": True,
            "message": "Processed emails list reset successfully",
            "reset_by": current_admin.username,
            "timestamp": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to reset processed emails: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset processed emails: {str(e)}"
        )

@router.get("/admin/processed-emails-count")
async def get_processed_emails_count(
    current_admin: User = Depends(require_admin)
) -> JSONResponse:
    """
    Get count of processed emails (Admin only)
    """
    try:
        azure_service = get_azure_email_service()
        count = len(azure_service.processed_emails)
        
        return JSONResponse({
            "success": True,
            "processed_emails_count": count,
            "timestamp": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get processed emails count: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get count: {str(e)}"
        )

