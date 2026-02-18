"""Email OTP Service - Send OTP emails via Microsoft Graph API.

Uses the same Azure authentication as the email processing service.
"""

import logging
import os
import aiohttp
from typing import Optional

logger = logging.getLogger(__name__)

class EmailOTPService:
    """Service for sending OTP emails via Microsoft Graph API."""
    
    def __init__(self):
        # Azure App Registration credentials
        self.client_id = os.getenv("AZURE_CLIENT_ID", "your-client-id-here")
        self.client_secret = os.getenv("AZURE_CLIENT_SECRET", "your-client-secret-here")
        self.tenant_id = os.getenv("AZURE_TENANT_ID", "your-tenant-id")
        
        # Email settings (match dev: use defaults; do not set OTP_FROM_* in .env unless needed)
        self.from_email = os.getenv("OTP_FROM_EMAIL", "cv@alphadatarecruitment.ae")
        self.from_name = os.getenv("OTP_FROM_NAME", "Alpha CV System")
        
        # Microsoft Graph API endpoints
        self.graph_base_url = "https://graph.microsoft.com/v1.0"
        self.auth_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        
        logger.info("📧 EmailOTPService initialized")
    
    async def get_access_token(self) -> str:
        """Get access token for Microsoft Graph API."""
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
                            logger.info("✅ Successfully obtained Azure access token for email sending")
                            return access_token
                        else:
                            raise Exception("No access token in response")
                    else:
                        error_text = await response.text()
                        raise Exception(f"Token request failed: {response.status} - {error_text}")
        
        except Exception as e:
            logger.error(f"❌ Failed to get Azure access token for email: {e}")
            raise
    
    async def send_otp_email(self, to_email: str, otp: str, username: Optional[str] = None) -> bool:
        """
        Send OTP email via Microsoft Graph API.
        
        Args:
            to_email: Recipient email address
            otp: OTP code to send
            username: Optional username for personalization
            
        Returns:
            True if email sent successfully
        """
        try:
            # Get access token
            access_token = await self.get_access_token()
            
            # Prepare email message
            subject = "Your Login OTP Code"
            body_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2563eb;">Login Verification Code</h2>
                    <p>Hello{f' {username}' if username else ''},</p>
                    <p>You have requested a login verification code. Please use the following code to complete your login:</p>
                    <div style="background-color: #f3f4f6; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #2563eb; font-size: 32px; margin: 0; letter-spacing: 5px;">{otp}</h1>
                    </div>
                    <p>This code will expire in 5 minutes.</p>
                    <p>If you did not request this code, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">This is an automated message from Alpha CV System. Please do not reply to this email.</p>
                </div>
            </body>
            </html>
            """
            
            body_text = f"""
Login Verification Code

Hello{f' {username}' if username else ''},

You have requested a login verification code. Please use the following code to complete your login:

{otp}

This code will expire in 5 minutes.

If you did not request this code, please ignore this email.

---
This is an automated message from Alpha CV System. Please do not reply to this email.
            """
            
            # Microsoft Graph API: do NOT set "from" when using application permission
            # (sender is the user in the URL). Some tenants drop delivery if "from" is set.
            message = {
                "message": {
                    "subject": subject,
                    "body": {
                        "contentType": "HTML",
                        "content": body_html
                    },
                    "toRecipients": [
                        {
                            "emailAddress": {
                                "address": to_email
                            }
                        }
                    ]
                },
                "saveToSentItems": True
            }
            
            # Send email via Microsoft Graph API
            send_mail_url = f"{self.graph_base_url}/users/{self.from_email}/sendMail"
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(send_mail_url, json=message, headers=headers) as response:
                    if response.status == 202:
                        logger.info(f"✅ OTP email sent successfully to {to_email}")
                        return True
                    elif response.status == 403:
                        # Parse error response
                        try:
                            error_text = await response.text()
                            error_json = await response.json() if 'application/json' in response.headers.get('content-type', '') else {}
                            error_code = error_json.get('error', {}).get('code', 'Unknown')
                            error_message = error_json.get('error', {}).get('message', error_text)
                        except Exception as parse_error:
                            error_text = await response.text()
                            error_code = 'Unknown'
                            error_message = error_text
                            logger.warning(f"⚠️ Could not parse error response: {parse_error}")
                        
                        logger.error(f"❌ Azure permission denied (403): {error_code} - {error_message}")
                        logger.error(f"📋 Azure Configuration Required:")
                        logger.error(f"   1. Go to Azure Portal: https://portal.azure.com")
                        logger.error(f"   2. Navigate to: Azure Active Directory -> App registrations -> Your App")
                        logger.error(f"   3. Go to 'API permissions' tab")
                        logger.error(f"   4. Click 'Add a permission' -> Microsoft Graph -> Application permissions")
                        logger.error(f"   5. Search for and select 'Mail.Send' permission")
                        logger.error(f"   6. Click 'Add permissions'")
                        logger.error(f"   7. Click 'Grant admin consent for [Your Organization]' (requires admin privileges)")
                        logger.error(f"   8. Ensure mailbox '{self.from_email}' exists and is accessible")
                        logger.error(f"   9. Wait a few minutes for permissions to propagate, then restart the backend service")
                        return False
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Failed to send OTP email: {response.status} - {error_text}")
                        return False
        
        except Exception as e:
            logger.error(f"❌ Error sending OTP email to {to_email}: {e}")
            return False

# Singleton instance
_email_otp_service: Optional[EmailOTPService] = None

def get_email_otp_service() -> EmailOTPService:
    """Get singleton instance of email OTP service."""
    global _email_otp_service
    if _email_otp_service is None:
        _email_otp_service = EmailOTPService()
    return _email_otp_service
