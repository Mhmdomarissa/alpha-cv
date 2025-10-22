"""
Email Scheduler Service - Automated Email Processing
===================================================

Provides scheduled email processing functionality:
1. Periodic email checking (every 5 minutes)
2. Background email processing
3. Email processing statistics and monitoring
4. Configurable scheduling intervals
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import json

from app.services.email_cv_processor import get_email_cv_processor
from app.services.azure_email_service import get_azure_email_service

logger = logging.getLogger(__name__)

class EmailScheduler:
    """Scheduled email processing service"""
    
    def __init__(self):
        self.email_processor = get_email_cv_processor()
        self.azure_service = get_azure_email_service()
        
        # Configuration
        self.check_interval_minutes = int(os.getenv("EMAIL_CHECK_INTERVAL_MINUTES", "5"))
        self.max_emails_per_batch = int(os.getenv("EMAIL_MAX_BATCH_SIZE", "50"))
        self.is_running = False
        self.last_check_time = None
        self.last_processing_time = None
        self.processing_stats = {
            "total_processed": 0,
            "successful_today": 0,
            "failed_today": 0,
            "last_successful_run": None,
            "last_error": None
        }
        
        # Statistics file
        self.stats_file = "/data/email_processing_stats.json"
        self._load_stats()
        
        logger.info(f"📅 EmailScheduler initialized (check interval: {self.check_interval_minutes} minutes)")
    
    def _load_stats(self):
        """Load processing statistics from file"""
        try:
            if os.path.exists(self.stats_file):
                with open(self.stats_file, 'r') as f:
                    saved_stats = json.load(f)
                    self.processing_stats.update(saved_stats)
        except Exception as e:
            logger.warning(f"⚠️ Failed to load email processing stats: {e}")
    
    def _save_stats(self):
        """Save processing statistics to file"""
        try:
            os.makedirs(os.path.dirname(self.stats_file), exist_ok=True)
            with open(self.stats_file, 'w') as f:
                json.dump(self.processing_stats, f, indent=2)
        except Exception as e:
            logger.warning(f"⚠️ Failed to save email processing stats: {e}")
    
    async def start_scheduler(self):
        """Start the email processing scheduler"""
        if self.is_running:
            logger.warning("⚠️ Email scheduler is already running")
            return
        
        self.is_running = True
        logger.info("🚀 Starting email processing scheduler")
        
        try:
            # Set initial check time
            self.last_check_time = datetime.utcnow()
            
            while self.is_running:
                try:
                    await self._process_emails_batch()
                except Exception as e:
                    logger.error(f"❌ Error in email processing batch: {e}")
                    self.processing_stats["last_error"] = str(e)
                    self._save_stats()
                
                # Wait for next check
                await asyncio.sleep(self.check_interval_minutes * 60)
        
        except asyncio.CancelledError:
            logger.info("🛑 Email scheduler cancelled")
        except Exception as e:
            logger.error(f"❌ Email scheduler failed: {e}")
        finally:
            self.is_running = False
            logger.info("🛑 Email scheduler stopped")
    
    async def stop_scheduler(self):
        """Stop the email processing scheduler"""
        logger.info("🛑 Stopping email processing scheduler")
        self.is_running = False
    
    async def _process_emails_batch(self):
        """Process a batch of emails"""
        try:
            logger.info("📧 Starting scheduled email processing batch")
            self.last_check_time = datetime.utcnow()
            
            # Process emails
            results = await self.email_processor.process_all_email_cvs()
            
            # Update statistics
            successful_count = sum(1 for r in results if r.get("success", False))
            failed_count = len(results) - successful_count
            
            self.processing_stats["total_processed"] += len(results)
            self.processing_stats["successful_today"] += successful_count
            self.processing_stats["failed_today"] += failed_count
            
            if successful_count > 0:
                self.processing_stats["last_successful_run"] = datetime.utcnow().isoformat()
                self.last_processing_time = datetime.utcnow()
            
            self._save_stats()
            
            if results:
                logger.info(f"✅ Processed {len(results)} emails: {successful_count} successful, {failed_count} failed")
            else:
                logger.info("📧 No emails to process")
        
        except Exception as e:
            logger.error(f"❌ Email processing batch failed: {e}")
            self.processing_stats["last_error"] = str(e)
            self._save_stats()
            raise
    
    async def force_process_emails(self) -> Dict[str, Any]:
        """Force immediate email processing (for manual triggers)"""
        try:
            logger.info("🔄 Force processing emails triggered")
            
            start_time = datetime.utcnow()
            results = await self.email_processor.process_all_email_cvs()
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            successful_count = sum(1 for r in results if r.get("success", False))
            failed_count = len(results) - successful_count
            
            # Update statistics
            self.processing_stats["total_processed"] += len(results)
            self.processing_stats["successful_today"] += successful_count
            self.processing_stats["failed_today"] += failed_count
            
            if successful_count > 0:
                self.processing_stats["last_successful_run"] = datetime.utcnow().isoformat()
            
            self._save_stats()
            
            return {
                "success": True,
                "processed_count": len(results),
                "successful_count": successful_count,
                "failed_count": failed_count,
                "processing_time": processing_time,
                "results": results
            }
        
        except Exception as e:
            logger.error(f"❌ Force email processing failed: {e}")
            self.processing_stats["last_error"] = str(e)
            self._save_stats()
            return {
                "success": False,
                "error": str(e),
                "processed_count": 0,
                "successful_count": 0,
                "failed_count": 0
            }
    
    def get_scheduler_status(self) -> Dict[str, Any]:
        """Get current scheduler status and statistics"""
        next_check_seconds = self._get_next_check_in_minutes()
        
        return {
            "is_running": self.is_running,
            "check_interval_minutes": self.check_interval_minutes,
            "max_emails_per_batch": self.max_emails_per_batch,
            "last_check_time": self.last_check_time.isoformat() if self.last_check_time else None,
            "last_processing_time": self.last_processing_time.isoformat() if self.last_processing_time else None,
            "next_check_in_minutes": next_check_seconds,  # Now returns seconds for precision
            "next_check_in_seconds": next_check_seconds,  # Explicit seconds field
            "statistics": self.processing_stats.copy()
        }
    
    def _get_next_check_in_minutes(self) -> Optional[int]:
        """Calculate minutes until next scheduled check"""
        if not self.last_check_time or not self.is_running:
            return None
        
        next_check = self.last_check_time + timedelta(minutes=self.check_interval_minutes)
        now = datetime.utcnow()
        
        if next_check > now:
            # Return exact seconds remaining for more precision
            seconds_remaining = (next_check - now).total_seconds()
            return max(0, int(seconds_remaining))
        else:
            return 0  # Should check now
    
    def reset_daily_stats(self):
        """Reset daily statistics (call this daily)"""
        self.processing_stats["successful_today"] = 0
        self.processing_stats["failed_today"] = 0
        self._save_stats()
        logger.info("📊 Daily email processing statistics reset")

# Global scheduler instance
_email_scheduler: Optional[EmailScheduler] = None

def get_email_scheduler() -> EmailScheduler:
    """Get singleton instance of email scheduler"""
    global _email_scheduler
    if _email_scheduler is None:
        _email_scheduler = EmailScheduler()
    return _email_scheduler

async def start_email_scheduler():
    """Start the email scheduler (call this during app startup)"""
    scheduler = get_email_scheduler()
    await scheduler.start_scheduler()

async def stop_email_scheduler():
    """Stop the email scheduler (call this during app shutdown)"""
    scheduler = get_email_scheduler()
    await scheduler.stop_scheduler()

