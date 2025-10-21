"""
Azure Email Service - Microsoft Graph API Integration
====================================================

Handles email processing from cv@alphadatarecruitment.ae mailbox:
1. Connects to Microsoft Graph API using Azure App Registration
2. Reads emails with CV attachments from applicants
3. Parses email subjects to match job postings
4. Extracts CV attachments and processes them through existing pipeline
"""

import asyncio
import logging
import os
import re
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
import aiohttp
import json
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class EmailMessage:
    """Represents an email message from Microsoft Graph API"""
    id: str
    subject: str
    sender: str
    received_datetime: datetime
    has_attachments: bool
    attachments: List[Dict[str, Any]]
    body_preview: str

@dataclass
class ProcessedEmail:
    """Represents a processed email with extracted data"""
    email_id: str
    job_title: Optional[str]
    subject_id: Optional[str]
    job_posting_id: Optional[str]
    applicant_email: str
    cv_attachments: List[Dict[str, Any]]
    processing_status: str
    email_body: Optional[str] = None
    error_message: Optional[str] = None

class AzureEmailService:
    """Service for processing emails from Microsoft Graph API"""
    
    def __init__(self):
        # Azure App Registration credentials
        self.client_id = os.getenv("AZURE_CLIENT_ID", "your-client-id-here")
        self.client_secret = os.getenv("AZURE_CLIENT_SECRET", "your-client-secret-here")
        self.tenant_id = os.getenv("AZURE_TENANT_ID", "your-tenant-id")  # You'll need to provide this
        self.mailbox_email = os.getenv("AZURE_MAILBOX_EMAIL", "cv@alphadatarecruitment.ae")
        
        # Microsoft Graph API endpoints
        self.graph_base_url = "https://graph.microsoft.com/v1.0"
        self.auth_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        
        # Email processing settings
        self.processed_emails_file = "/data/processed_emails.json"
        self.max_emails_per_batch = 50
        self.supported_attachment_types = ['.pdf', '.docx', '.doc', '.txt']
        
        # Initialize processed emails tracking
        self._load_processed_emails()
        
        logger.info("🔗 AzureEmailService initialized")
        logger.info(f"📧 Monitoring mailbox: {self.mailbox_email}")
    
    def _load_processed_emails(self):
        """Load list of already processed email IDs"""
        try:
            if os.path.exists(self.processed_emails_file):
                with open(self.processed_emails_file, 'r') as f:
                    self.processed_emails = set(json.load(f))
            else:
                self.processed_emails = set()
        except Exception as e:
            logger.warning(f"⚠️ Failed to load processed emails: {e}")
            self.processed_emails = set()
    
    def _save_processed_emails(self):
        """Save list of processed email IDs"""
        try:
            os.makedirs(os.path.dirname(self.processed_emails_file), exist_ok=True)
            with open(self.processed_emails_file, 'w') as f:
                json.dump(list(self.processed_emails), f)
        except Exception as e:
            logger.warning(f"⚠️ Failed to save processed emails: {e}")
    
    async def get_access_token(self) -> str:
        """Get access token for Microsoft Graph API"""
        try:
            token_data = {
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'scope': 'https://graph.microsoft.com/.default',
                'grant_type': 'client_credentials'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(self.auth_url, data=token_data) as response:
                    if response.status == 200:
                        token_response = await response.json()
                        access_token = token_response.get('access_token')
                        if access_token:
                            logger.info("✅ Successfully obtained Azure access token")
                            return access_token
                        else:
                            raise Exception("No access token in response")
                    else:
                        error_text = await response.text()
                        raise Exception(f"Token request failed: {response.status} - {error_text}")
        
        except Exception as e:
            logger.error(f"❌ Failed to get Azure access token: {e}")
            raise
    
    async def get_unread_emails(self, access_token: str, max_emails: int = None) -> List[EmailMessage]:
        """Get unread emails from the mailbox"""
        try:
            if max_emails is None:
                max_emails = self.max_emails_per_batch
            
            # Build Graph API URL for mailbox
            mailbox_url = f"{self.graph_base_url}/users/{self.mailbox_email}/messages"
            
            # Simplified filter - remove orderby to avoid "InefficientFilter" error
            filter_params = {
                '$filter': "isRead eq false and hasAttachments eq true",
                '$top': max_emails,
                '$select': 'id,subject,sender,receivedDateTime,hasAttachments,bodyPreview'
            }
            
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(mailbox_url, params=filter_params, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        emails = []
                        
                        for email_data in data.get('value', []):
                            # Skip already processed emails
                            email_id = email_data.get('id')
                            if email_id in self.processed_emails:
                                continue
                            
                            # Parse sender email
                            sender_info = email_data.get('sender', {}).get('emailAddress', {})
                            sender_email = sender_info.get('address', 'unknown@email.com')
                            
                            # Parse received datetime
                            received_str = email_data.get('receivedDateTime')
                            received_datetime = datetime.fromisoformat(received_str.replace('Z', '+00:00'))
                            
                            email = EmailMessage(
                                id=email_id,
                                subject=email_data.get('subject', ''),
                                sender=sender_email,
                                received_datetime=received_datetime,
                                has_attachments=email_data.get('hasAttachments', False),
                                attachments=[],  # Will be loaded separately
                                body_preview=email_data.get('bodyPreview', '')
                            )
                            emails.append(email)
                        
                        logger.info(f"📧 Found {len(emails)} unread emails with attachments")
                        return emails
                    else:
                        error_text = await response.text()
                        raise Exception(f"Failed to get emails: {response.status} - {error_text}")
        
        except Exception as e:
            logger.error(f"❌ Failed to get unread emails: {e}")
            raise
    
    async def get_email_attachments(self, access_token: str, email_id: str) -> List[Dict[str, Any]]:
        """Get attachments for a specific email"""
        try:
            attachments_url = f"{self.graph_base_url}/users/{self.mailbox_email}/messages/{email_id}/attachments"
            
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(attachments_url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        attachments = []
                        
                        for attachment_data in data.get('value', []):
                            # Check if it's a file attachment (not inline)
                            if attachment_data.get('@odata.type') == '#microsoft.graph.fileAttachment':
                                name = attachment_data.get('name', '')
                                content_type = attachment_data.get('contentType', '')
                                size = attachment_data.get('size', 0)
                                content_bytes = attachment_data.get('contentBytes', '')
                                
                                # Check if it's a supported CV file type
                                file_ext = Path(name).suffix.lower()
                                if file_ext in self.supported_attachment_types:
                                    attachments.append({
                                        'name': name,
                                        'content_type': content_type,
                                        'size': size,
                                        'content_bytes': content_bytes,
                                        'file_extension': file_ext
                                    })
                        
                        logger.info(f"📎 Found {len(attachments)} CV attachments in email {email_id}")
                        return attachments
                    else:
                        error_text = await response.text()
                        raise Exception(f"Failed to get attachments: {response.status} - {error_text}")
        
        except Exception as e:
            logger.error(f"❌ Failed to get email attachments: {e}")
            return []
    
    async def get_email_body(self, access_token: str, email_id: str) -> Optional[str]:
        """Get the full body text of an email"""
        try:
            email_url = f"{self.graph_base_url}/users/{self.mailbox_email}/messages/{email_id}"
            
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            # Request body content
            params = {
                '$select': 'body'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(email_url, params=params, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        body_data = data.get('body', {})
                        body_content = body_data.get('content', '')
                        
                        # Remove HTML tags if it's HTML content
                        if body_data.get('contentType') == 'html':
                            # Simple HTML stripping
                            body_content = re.sub(r'<[^>]+>', '', body_content)
                            body_content = body_content.replace('&nbsp;', ' ')
                            body_content = body_content.replace('&amp;', '&')
                        
                        return body_content.strip()
                    else:
                        logger.warning(f"⚠️ Failed to get email body: {response.status}")
                        return None
        
        except Exception as e:
            logger.error(f"❌ Error getting email body: {e}")
            return None
    
    def extract_expected_salary(self, email_body: str) -> Optional[float]:
        """Extract expected salary from email body"""
        if not email_body:
            return None
        
        try:
            # Patterns to match salary mentions
            # Examples: "Expected Salary: 5000 AED", "Salary: AED 5,000", "expecting 5000", etc.
            patterns = [
                r'(?:expected\s+salary|salary\s+expectation|expecting)[\s:]+(?:AED\s*)?([0-9,]+)',
                r'(?:AED|aed)\s+([0-9,]+)(?:\s+(?:per\s+month|monthly|expected))?',
                r'salary[\s:]+([0-9,]+)',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, email_body, re.IGNORECASE)
                if match:
                    salary_str = match.group(1).replace(',', '')
                    try:
                        salary = float(salary_str)
                        # Sanity check: salary should be reasonable (1000 - 1000000 AED)
                        if 1000 <= salary <= 1000000:
                            logger.info(f"💰 Extracted salary: AED {salary}")
                            return salary
                    except ValueError:
                        continue
            
            logger.info("💰 No salary found in email body")
            return None
        
        except Exception as e:
            logger.error(f"❌ Error extracting salary: {e}")
            return None
    
    def parse_email_subject(self, subject: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Parse email subject to extract job title and subject ID
        Expected format: "Job Title | ID-YYYY-NNN"
        Example: "Software Engineer | SE-2025-001"
        """
        try:
            # Remove Re:/Fwd: prefixes (case insensitive, multiple possible)
            cleaned_subject = re.sub(r'^(re|fwd|fw):\s*', '', subject.strip(), flags=re.IGNORECASE)
            cleaned_subject = re.sub(r'^(re|fwd|fw):\s*', '', cleaned_subject, flags=re.IGNORECASE)
            
            # Look for pattern: "Job Title | ID-YYYY-NNN"
            match = re.match(r'^(.+?)\s*\|\s*([A-Z]{2,4}-\d{4}-\d{3})$', cleaned_subject.strip())
            
            if match:
                job_title = match.group(1).strip()
                subject_id = match.group(2).strip()
                logger.info(f"✅ Parsed email subject: '{job_title}' | '{subject_id}'")
                return job_title, subject_id
            
            logger.warning(f"⚠️ Could not parse email subject: '{subject}'")
            return None, None
        
        except Exception as e:
            logger.error(f"❌ Error parsing email subject '{subject}': {e}")
            return None, None
    
    async def find_job_posting_by_subject_id(self, subject_id: str) -> Optional[Dict[str, Any]]:
        """Find job posting by email subject ID"""
        try:
            from app.utils.qdrant_utils import get_qdrant_utils
            
            qdrant = get_qdrant_utils()
            
            # Search for job posting with matching email_subject_id
            # This would need to be implemented in qdrant_utils
            # For now, we'll search through all job postings
            job_postings = qdrant.get_all_job_postings(include_inactive=False)
            
            for job in job_postings:
                if job.get('email_subject_id') == subject_id:
                    logger.info(f"✅ Found job posting for subject ID: {subject_id}")
                    return job
            
            logger.warning(f"⚠️ No job posting found for subject ID: {subject_id}")
            return None
        
        except Exception as e:
            logger.error(f"❌ Error finding job posting for subject ID {subject_id}: {e}")
            return None
    
    async def process_email(self, email: EmailMessage, access_token: str) -> ProcessedEmail:
        """Process a single email and extract CV attachments"""
        try:
            logger.info(f"📧 Processing email: {email.id} - '{email.subject}'")
            
            # Parse email subject to get job title and subject ID
            job_title, subject_id = self.parse_email_subject(email.subject)
            
            # Find matching job posting
            job_posting = None
            if subject_id:
                job_posting = await self.find_job_posting_by_subject_id(subject_id)
            
            # Get email body for salary extraction
            email_body = await self.get_email_body(access_token, email.id)
            
            # Get email attachments
            attachments = await self.get_email_attachments(access_token, email.id)
            
            # Filter for CV attachments
            cv_attachments = []
            for attachment in attachments:
                if attachment['file_extension'] in self.supported_attachment_types:
                    cv_attachments.append(attachment)
            
            if not cv_attachments:
                logger.warning(f"⚠️ No CV attachments found in email {email.id}")
                return ProcessedEmail(
                    email_id=email.id,
                    job_title=job_title,
                    subject_id=subject_id,
                    job_posting_id=job_posting.get('id') if job_posting else None,
                    applicant_email=email.sender,
                    cv_attachments=[],
                    processing_status="no_cv_attachments",
                    email_body=email_body,
                    error_message="No CV attachments found"
                )
            
            # Mark email as processed
            self.processed_emails.add(email.id)
            self._save_processed_emails()
            
            logger.info(f"✅ Successfully processed email {email.id} with {len(cv_attachments)} CV attachments")
            
            return ProcessedEmail(
                email_id=email.id,
                job_title=job_title,
                subject_id=subject_id,
                job_posting_id=job_posting.get('id') if job_posting else None,
                applicant_email=email.sender,
                cv_attachments=cv_attachments,
                processing_status="ready_for_cv_processing",
                email_body=email_body
            )
        
        except Exception as e:
            logger.error(f"❌ Error processing email {email.id}: {e}")
            return ProcessedEmail(
                email_id=email.id,
                job_title=None,
                subject_id=None,
                job_posting_id=None,
                applicant_email=email.sender,
                cv_attachments=[],
                processing_status="error",
                error_message=str(e)
            )
    
    async def process_all_unread_emails(self) -> List[ProcessedEmail]:
        """Process all unread emails with CV attachments"""
        try:
            logger.info("🔄 Starting email processing batch")
            
            # Get access token
            access_token = await self.get_access_token()
            
            # Get unread emails
            emails = await self.get_unread_emails(access_token)
            
            if not emails:
                logger.info("📧 No unread emails with attachments found")
                return []
            
            # Process each email
            processed_emails = []
            for email in emails:
                try:
                    processed_email = await self.process_email(email, access_token)
                    processed_emails.append(processed_email)
                except Exception as e:
                    logger.error(f"❌ Failed to process email {email.id}: {e}")
                    continue
            
            logger.info(f"✅ Processed {len(processed_emails)} emails")
            return processed_emails
        
        except Exception as e:
            logger.error(f"❌ Failed to process emails: {e}")
            return []
    
    async def mark_email_as_read(self, access_token: str, email_id: str) -> bool:
        """Mark an email as read"""
        try:
            mark_read_url = f"{self.graph_base_url}/users/{self.mailbox_email}/messages/{email_id}"
            
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            data = {'isRead': True}
            
            async with aiohttp.ClientSession() as session:
                async with session.patch(mark_read_url, json=data, headers=headers) as response:
                    if response.status == 200:
                        logger.info(f"✅ Marked email {email_id} as read")
                        return True
                    else:
                        error_text = await response.text()
                        logger.warning(f"⚠️ Failed to mark email as read: {response.status} - {error_text}")
                        return False
        
        except Exception as e:
            logger.error(f"❌ Error marking email {email_id} as read: {e}")
            return False

# Singleton instance
_azure_email_service: Optional[AzureEmailService] = None

def get_azure_email_service() -> AzureEmailService:
    """Get singleton instance of Azure email service"""
    global _azure_email_service
    if _azure_email_service is None:
        _azure_email_service = AzureEmailService()
    return _azure_email_service

