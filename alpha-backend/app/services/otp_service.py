"""OTP Service for email-based authentication.

Generates, stores, and validates OTPs for user authentication.
"""

import logging
import random
import os
from typing import Optional, Tuple
from datetime import datetime, timedelta

from app.utils.redis_cache import get_redis_cache

logger = logging.getLogger(__name__)

class OTPService:
    """Service for managing OTP generation and validation."""
    
    def __init__(self):
        self.redis_cache = get_redis_cache()
        self.otp_length = 6
        self.otp_ttl = int(os.getenv("OTP_TTL_SECONDS", "300"))  # 5 minutes default
        # Allow a few retries without immediately invalidating a still-valid OTP.
        # Kept as an env var so you can tune security/UX per environment.
        self.max_attempts = int(os.getenv("OTP_MAX_ATTEMPTS", "10"))
        
    def generate_otp(self) -> str:
        """Generate a random 6-digit OTP."""
        return str(random.randint(100000, 999999))
    
    def store_otp(self, email: str, otp: str, username: Optional[str] = None) -> bool:
        """
        Store OTP in Redis with TTL.
        
        Args:
            email: User's email address
            otp: Generated OTP
            username: Optional username for verification
            
        Returns:
            True if stored successfully
        """
        try:
            otp_key = f"otp:{email}"
            otp_data = {
                "otp": otp,
                "username": username,
                "created_at": datetime.utcnow().isoformat(),
                "attempts": 0
            }
            
            success = self.redis_cache.set(
                key=otp_key,
                value=otp_data,
                ttl_seconds=self.otp_ttl,
                namespace="auth"
            )
            
            if success:
                logger.info(f"✅ OTP stored for email: {email}")
            else:
                logger.error(f"❌ Failed to store OTP for email: {email}")
            
            return success
            
        except Exception as e:
            logger.error(f"❌ Error storing OTP: {e}")
            return False
    
    def verify_otp(self, email: str, otp: str) -> Tuple[bool, Optional[str]]:
        """
        Verify OTP for an email.
        
        Args:
            email: User's email address
            otp: OTP to verify
            
        Returns:
            Tuple of (is_valid, username) or (False, None)
        """
        try:
            otp_key = f"otp:{email}"
            otp_data = self.redis_cache.get(key=otp_key, namespace="auth")
            
            if not otp_data:
                logger.warning(f"⚠️ No OTP found for email: {email}")
                return False, None
            
            # Check attempts
            attempts = otp_data.get("attempts", 0)
            if attempts >= self.max_attempts:
                logger.warning(f"⚠️ Max attempts reached for email: {email}")
                # Delete OTP after max attempts
                self.redis_cache.delete(key=otp_key, namespace="auth")
                return False, None
            
            # Verify OTP
            stored_otp = otp_data.get("otp")
            if stored_otp != otp:
                # Increment attempts
                otp_data["attempts"] = attempts + 1
                self.redis_cache.set(
                    key=otp_key,
                    value=otp_data,
                    ttl_seconds=self.otp_ttl,
                    namespace="auth"
                )
                logger.warning(f"⚠️ Invalid OTP for email: {email} (attempt {attempts + 1}/{self.max_attempts})")
                return False, None
            
            # OTP is valid, get username and delete OTP
            username = otp_data.get("username")
            self.redis_cache.delete(key=otp_key, namespace="auth")
            logger.info(f"✅ OTP verified for email: {email}")
            return True, username
            
        except Exception as e:
            logger.error(f"❌ Error verifying OTP: {e}")
            return False, None
    
    def get_otp_info(self, email: str) -> Optional[dict]:
        """Get OTP information without verifying."""
        try:
            otp_key = f"otp:{email}"
            otp_data = self.redis_cache.get(key=otp_key, namespace="auth")
            return otp_data
        except Exception as e:
            logger.error(f"❌ Error getting OTP info: {e}")
            return None

# Singleton instance
_otp_service: Optional[OTPService] = None

def get_otp_service() -> OTPService:
    """Get singleton instance of OTP service."""
    global _otp_service
    if _otp_service is None:
        _otp_service = OTPService()
    return _otp_service
