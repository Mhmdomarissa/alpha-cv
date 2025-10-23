"""
Email Database Service
Handles email processing data storage in PostgreSQL
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

class EmailDatabaseService:
    """Service for managing email processing data in PostgreSQL"""
    
    def __init__(self):
        """Initialize database connection"""
        self.db_config = {
            'host': os.getenv('POSTGRES_HOST', 'postgres'),
            'port': os.getenv('POSTGRES_PORT', '5432'),
            'database': os.getenv('POSTGRES_DB', 'cv_database'),
            'user': os.getenv('POSTGRES_USER', 'cv_user'),
            'password': os.getenv('POSTGRES_PASSWORD', 'cv_password')
        }
        self.connection = None
        self._connect()
        
    def _connect(self):
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(**self.db_config)
            logger.info("✅ Connected to PostgreSQL for email data")
        except Exception as e:
            logger.error(f"❌ Failed to connect to PostgreSQL: {e}")
            raise
    
    def _get_cursor(self):
        """Get database cursor"""
        if not self.connection or self.connection.closed:
            self._connect()
        return self.connection.cursor(cursor_factory=RealDictCursor)
    
    def is_email_processed(self, email_id: str) -> bool:
        """Check if email has been processed"""
        try:
            with self._get_cursor() as cursor:
                cursor.execute(
                    "SELECT id FROM processed_emails WHERE email_id = %s",
                    (email_id,)
                )
                return cursor.fetchone() is not None
        except Exception as e:
            logger.error(f"❌ Failed to check processed email {email_id}: {e}")
            return False
    
    def mark_email_processed(self, email_id: str, subject: str = None, sender_email: str = None) -> bool:
        """Mark email as processed"""
        try:
            with self._get_cursor() as cursor:
                cursor.execute(
                    """INSERT INTO processed_emails (email_id, subject, sender_email) 
                       VALUES (%s, %s, %s) 
                       ON CONFLICT (email_id) DO NOTHING""",
                    (email_id, subject, sender_email)
                )
                self.connection.commit()
                logger.info(f"✅ Marked email as processed: {email_id}")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to mark email as processed {email_id}: {e}")
            return False
    
    def get_processed_emails(self) -> List[str]:
        """Get list of all processed email IDs"""
        try:
            with self._get_cursor() as cursor:
                cursor.execute("SELECT email_id FROM processed_emails ORDER BY processed_at DESC")
                return [row['email_id'] for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"❌ Failed to get processed emails: {e}")
            return []
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get email processing statistics"""
        try:
            with self._get_cursor() as cursor:
                cursor.execute("SELECT * FROM email_processing_stats ORDER BY id DESC LIMIT 1")
                result = cursor.fetchone()
                if result:
                    return dict(result)
                return {
                    'total_processed': 0,
                    'successful_today': 0,
                    'failed_today': 0,
                    'last_successful_run': None,
                    'last_error': None
                }
        except Exception as e:
            logger.error(f"❌ Failed to get processing stats: {e}")
            return {
                'total_processed': 0,
                'successful_today': 0,
                'failed_today': 0,
                'last_successful_run': None,
                'last_error': None
            }
    
    def update_processing_stats(self, stats: Dict[str, Any]) -> bool:
        """Update processing statistics"""
        try:
            with self._get_cursor() as cursor:
                cursor.execute(
                    """UPDATE email_processing_stats 
                       SET total_processed = %s, successful_today = %s, failed_today = %s,
                           last_successful_run = %s, last_error = %s, updated_at = CURRENT_TIMESTAMP
                       WHERE id = 1""",
                    (
                        stats.get('total_processed', 0),
                        stats.get('successful_today', 0),
                        stats.get('failed_today', 0),
                        stats.get('last_successful_run'),
                        stats.get('last_error')
                    )
                )
                self.connection.commit()
                logger.info("✅ Updated processing statistics")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to update processing stats: {e}")
            return False
    
    def record_email_upload(self, email_id: str, file_name: str, file_path: str, file_size: int) -> bool:
        """Record email file upload"""
        try:
            with self._get_cursor() as cursor:
                cursor.execute(
                    """INSERT INTO email_uploads (email_id, file_name, file_path, file_size) 
                       VALUES (%s, %s, %s, %s)""",
                    (email_id, file_name, file_path, file_size)
                )
                self.connection.commit()
                logger.info(f"✅ Recorded email upload: {file_name}")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to record email upload: {e}")
            return False
    
    def get_email_uploads(self, email_id: str = None) -> List[Dict[str, Any]]:
        """Get email uploads, optionally filtered by email_id"""
        try:
            with self._get_cursor() as cursor:
                if email_id:
                    cursor.execute(
                        "SELECT * FROM email_uploads WHERE email_id = %s ORDER BY upload_date DESC",
                        (email_id,)
                    )
                else:
                    cursor.execute("SELECT * FROM email_uploads ORDER BY upload_date DESC")
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"❌ Failed to get email uploads: {e}")
            return []
    
    def reset_processed_emails(self) -> bool:
        """Reset all processed emails (admin function)"""
        try:
            with self._get_cursor() as cursor:
                cursor.execute("DELETE FROM processed_emails")
                cursor.execute("DELETE FROM email_uploads")
                cursor.execute(
                    "UPDATE email_processing_stats SET total_processed = 0, successful_today = 0, failed_today = 0, last_successful_run = NULL, last_error = NULL"
                )
                self.connection.commit()
                logger.info("✅ Reset all email processing data")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to reset processed emails: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        if self.connection and not self.connection.closed:
            self.connection.close()

# Global instance
email_db_service = EmailDatabaseService()
