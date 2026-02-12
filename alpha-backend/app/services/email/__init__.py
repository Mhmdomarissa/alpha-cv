"""
Email Services Module
=====================
Services for email processing, OTP, scheduling, and Azure integration.
"""

from app.services.email.azure_email_service import AzureEmailService, get_azure_email_service
from app.services.email.email_cv_processor import EmailCVProcessor, get_email_cv_processor
from app.services.email.email_database_service import EmailDatabaseService, get_email_database_service
from app.services.email.email_otp_service import EmailOTPService, get_email_otp_service
from app.services.email.email_scheduler import EmailScheduler, get_email_scheduler

__all__ = [
    "AzureEmailService",
    "get_azure_email_service",
    "EmailCVProcessor",
    "get_email_cv_processor",
    "EmailDatabaseService",
    "get_email_database_service",
    "EmailOTPService",
    "get_email_otp_service",
    "EmailScheduler",
    "get_email_scheduler",
]
