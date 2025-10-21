"""
Email CV Processor - Integrates Azure Email Service with CV Processing Pipeline
================================================================================

This service bridges the gap between email processing and CV processing:
1. Takes processed emails from Azure Email Service
2. Extracts CV attachments and saves them temporarily
3. Processes CVs through the existing CV processing pipeline
4. Creates job applications in the database
5. Sends confirmation emails to applicants
"""

import asyncio
import logging
import os
import tempfile
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path
import base64

from app.services.azure_email_service import ProcessedEmail, get_azure_email_service
from app.services.parsing_service import get_parsing_service
from app.services.llm_service import get_llm_service
from app.services.embedding_service import get_embedding_service
from app.utils.qdrant_utils import get_qdrant_utils
from app.services.s3_storage import get_s3_storage_service

logger = logging.getLogger(__name__)

class EmailCVProcessor:
    """Processes CV attachments from emails through the existing CV pipeline"""
    
    def __init__(self):
        self.azure_email_service = get_azure_email_service()
        self.parsing_service = get_parsing_service()
        self.llm_service = get_llm_service()
        self.embedding_service = get_embedding_service()
        self.qdrant = get_qdrant_utils()
        self.s3_service = get_s3_storage_service()
        
        # Temporary directory for processing CVs
        self.temp_dir = "/tmp/email_cv_processing"
        os.makedirs(self.temp_dir, exist_ok=True)
        
        logger.info("🔄 EmailCVProcessor initialized")
    
    async def save_cv_attachment(self, attachment: Dict[str, Any], application_id: str) -> str:
        """Save CV attachment to temporary file and upload to S3"""
        try:
            # Decode base64 content
            content_bytes = base64.b64decode(attachment['content_bytes'])
            
            # Create temporary file
            file_ext = attachment['file_extension']
            temp_filename = f"{application_id}_cv{file_ext}"
            temp_path = os.path.join(self.temp_dir, temp_filename)
            
            # Write content to temporary file
            with open(temp_path, 'wb') as f:
                f.write(content_bytes)
            
            logger.info(f"💾 Saved CV attachment to temp file: {temp_path}")
            
            # Upload to S3
            s3_path = self.s3_service.upload_file(temp_path, application_id, "cv", file_ext)
            
            # Clean up temporary file
            try:
                os.unlink(temp_path)
            except Exception:
                pass
            
            logger.info(f"☁️ Uploaded CV to S3: {s3_path}")
            return s3_path
        
        except Exception as e:
            logger.error(f"❌ Failed to save CV attachment: {e}")
            raise
    
    async def process_cv_from_email(self, processed_email: ProcessedEmail) -> Dict[str, Any]:
        """Process a single CV from email through the complete pipeline"""
        try:
            logger.info(f"🔄 Processing CV from email: {processed_email.email_id}")
            
            if not processed_email.cv_attachments:
                raise Exception("No CV attachments to process")
            
            # Use the first CV attachment (could be extended to handle multiple)
            cv_attachment = processed_email.cv_attachments[0]
            
            # Generate application ID
            application_id = str(uuid.uuid4())
            
            # Save CV attachment
            cv_s3_path = await self.save_cv_attachment(cv_attachment, application_id)
            
            # Download CV from S3 for processing
            temp_file_path = os.path.join(self.temp_dir, f"{application_id}_processing{cv_attachment['file_extension']}")
            self.s3_service.download_file(application_id, "cv", cv_attachment['file_extension'], temp_file_path)
            
            try:
                # Parse CV document
                parsed = self.parsing_service.process_document(temp_file_path, "cv")
                cv_raw_text = parsed["clean_text"]
                extracted_pii = parsed["extracted_pii"]
                
                if not cv_raw_text or len(cv_raw_text.strip()) < 50:
                    raise Exception("Could not extract sufficient text from CV")
                
                # Generate CV standardized data using LLM
                cv_standardized = self.llm_service.standardize_cv(
                    cv_raw_text, 
                    cv_attachment['name']
                )
                
                # Merge extracted PII into standardized data
                if "contact_info" not in cv_standardized:
                    cv_standardized["contact_info"] = {}
                
                # Add extracted PII to contact_info
                if extracted_pii.get("email") and len(extracted_pii["email"]) > 0:
                    cv_standardized["contact_info"]["email"] = extracted_pii["email"][0]
                if extracted_pii.get("phone") and len(extracted_pii["phone"]) > 0:
                    cv_standardized["contact_info"]["phone"] = extracted_pii["phone"][0]
                
                # Also store PII at top level for backward compatibility
                if extracted_pii.get("email") and len(extracted_pii["email"]) > 0:
                    cv_standardized["email"] = extracted_pii["email"][0]
                if extracted_pii.get("phone") and len(extracted_pii["phone"]) > 0:
                    cv_standardized["phone"] = extracted_pii["phone"][0]
                
                # Generate CV embeddings
                cv_embeddings = self.embedding_service.generate_document_embeddings(cv_standardized)
                
                # Generate CV ID
                cv_id = str(uuid.uuid4())
                
                # Store raw CV document
                self.qdrant.store_document(
                    cv_id, "cv", cv_s3_path,
                    cv_attachment['content_type'],
                    cv_raw_text, 
                    datetime.utcnow().isoformat(),
                    file_path=cv_s3_path
                )
                
                # Store structured CV data
                # IMPORTANT: source and email_id must be at structured_info level for API access
                cv_structured_payload = cv_standardized.copy()
                cv_structured_payload.update({
                    "name": cv_standardized.get("name", "Unknown Applicant"),
                    "email": processed_email.applicant_email,
                    "document_type": "cv",
                    "is_job_application": True,
                    "cv_filename": cv_attachment['name'],
                    "source": "email_application",  # At this level, will be nested in structured_info
                    "email_id": processed_email.email_id,
                    "job_posting_id": processed_email.job_posting_id
                })
                
                self.qdrant.store_structured_data(cv_id, "cv", cv_structured_payload)
                
                # Store CV embeddings
                self.qdrant.store_embeddings_exact(cv_id, "cv", cv_embeddings)
                
                # Note: We do NOT perform automatic matching here
                # HR will manually match CVs from the careers page
                logger.info(f"📝 CV stored - manual matching will be done by HR from careers page")
                
                # Extract expected salary from email body
                expected_salary = None
                if processed_email.email_body:
                    expected_salary = self.azure_email_service.extract_expected_salary(processed_email.email_body)
                
                # Store application record (without automatic matching)
                application_metadata = {
                    "application_id": application_id,
                    "job_posting_id": processed_email.job_posting_id,
                    "job_title": processed_email.job_title,
                    "subject_id": processed_email.subject_id,
                    "applicant_name": cv_standardized.get("name", "Unknown Applicant"),
                    "applicant_email": processed_email.applicant_email,
                    "cv_filename": cv_attachment['name'],
                    "expected_salary": expected_salary,  # Extracted from email body
                    "match_percentage": 0,  # No automatic matching - HR will do manual matching
                    "match_analysis": {},  # Empty - HR will do manual matching
                    "application_status": "submitted",
                    "submitted_at": datetime.utcnow().isoformat(),
                    "document_type": "job_application",
                    "source": "email_application",
                    "email_id": processed_email.email_id,
                    "requires_manual_matching": True  # Flag to indicate manual matching needed
                }
                
                # Link application to job posting
                self.qdrant.link_application_to_job(
                    cv_id, 
                    processed_email.job_posting_id, 
                    application_metadata, 
                    cv_s3_path, 
                    datetime.utcnow().isoformat()
                )
                
                # Send confirmation email to applicant
                try:
                    await self.send_application_confirmation_email(
                        processed_email.applicant_email,
                        cv_standardized.get("name", "Applicant"),
                        processed_email.job_title or "Position",
                        application_id
                    )
                except Exception as e:
                    logger.warning(f"⚠️ Failed to send confirmation email: {str(e)}")
                
                result = {
                    "success": True,
                    "application_id": application_id,
                    "cv_id": cv_id,
                    "job_posting_id": processed_email.job_posting_id,
                    "job_title": processed_email.job_title,
                    "applicant_name": cv_standardized.get("name", "Unknown Applicant"),
                    "applicant_email": processed_email.applicant_email,
                    "match_percentage": 0,  # No automatic matching
                    "cv_filename": cv_attachment['name'],
                    "processing_time": datetime.utcnow().isoformat(),
                    "message": f"CV processed and saved - manual matching required for {cv_standardized.get('name', 'Applicant')}"
                }
                
                logger.info(f"✅ Successfully processed CV from email: {application_id}")
                return result
            
            finally:
                # Clean up temporary file
                try:
                    if os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                except Exception:
                    pass
        
        except Exception as e:
            logger.error(f"❌ Failed to process CV from email {processed_email.email_id}: {e}")
            return {
                "success": False,
                "email_id": processed_email.email_id,
                "error": str(e),
                "message": f"Failed to process CV: {str(e)}"
            }
    
    async def process_all_email_cvs(self) -> List[Dict[str, Any]]:
        """Process all CVs from unread emails"""
        try:
            logger.info("🔄 Starting email CV processing batch")
            
            # Get processed emails from Azure service
            processed_emails = await self.azure_email_service.process_all_unread_emails()
            
            if not processed_emails:
                logger.info("📧 No emails to process")
                return []
            
            # Filter emails that are ready for CV processing
            ready_emails = [
                email for email in processed_emails 
                if email.processing_status == "ready_for_cv_processing"
            ]
            
            if not ready_emails:
                logger.info("📧 No emails ready for CV processing")
                return []
            
            # Process each CV
            results = []
            for processed_email in ready_emails:
                try:
                    result = await self.process_cv_from_email(processed_email)
                    results.append(result)
                except Exception as e:
                    logger.error(f"❌ Failed to process email {processed_email.email_id}: {e}")
                    results.append({
                        "success": False,
                        "email_id": processed_email.email_id,
                        "error": str(e)
                    })
            
            logger.info(f"✅ Processed {len(results)} CVs from emails")
            return results
        
        except Exception as e:
            logger.error(f"❌ Failed to process email CVs: {e}")
            return []
    
    async def send_application_confirmation_email(self, email: str, name: str, job_title: str, application_id: str):
        """Send confirmation email to applicant"""
        try:
            # This is a placeholder - implement with your email service
            # You could use SendGrid, AWS SES, or Microsoft Graph API to send emails
            
            logger.info(f"📧 Sending confirmation email to {email} for application {application_id}")
            
            # TODO: Implement actual email sending
            # Example implementation:
            # - Use Microsoft Graph API to send email
            # - Or integrate with SendGrid/AWS SES
            # - Include application details and next steps
            
            return True
        
        except Exception as e:
            logger.error(f"❌ Failed to send confirmation email: {e}")
            raise

# Singleton instance
_email_cv_processor: Optional[EmailCVProcessor] = None

def get_email_cv_processor() -> EmailCVProcessor:
    """Get singleton instance of email CV processor"""
    global _email_cv_processor
    if _email_cv_processor is None:
        _email_cv_processor = EmailCVProcessor()
    return _email_cv_processor

