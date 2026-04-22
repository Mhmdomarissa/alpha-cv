"""Authentication API routes.

Adds docstrings, import ordering, and minor formatting improvements.
Behavior remains identical.
"""

import os
import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.config import get_otp_fixed_code, is_otp_email_sending_disabled
from app.db.auth_db import get_session
from app.deps.auth import require_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest, TokenResponse, UserRead,
    SendOTPRequest, VerifyOTPRequest, VerifyPasswordRequest, VerifyPasswordResponse, OTPResponse
)
from app.utils.security import create_access_token, verify_password as verify_password_hash
from app.services.otp_service import get_otp_service
from app.services.email_otp_service import get_email_otp_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, session: Session = Depends(get_session)) -> TokenResponse:
    """
    Direct login endpoint (for admin users or legacy support).
    For regular users, use verify-password -> send-otp -> verify-otp flow.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Local development authentication check
    if (
        os.getenv("NODE_ENV") == "development"
        or os.getenv("LOCAL_AUTH", "").lower() == "true"
    ):
        if data.username == "syed" and data.password == "Faizan123":
            # Create a real token for the local development user
            token = create_access_token(sub="syed", role="admin")
            return TokenResponse(
                access_token=token, 
                token_type="bearer", 
                username="syed", 
                role="admin"
            )
    
    # Continue with existing server-side authentication flow
    user = session.exec(select(User).where(User.username == data.username)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    if not verify_password_hash(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    # Only allow direct login for admin users
    if user.role != "admin":
        logger.warning(f"⚠️ Direct login attempted for non-admin user: {data.username}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regular users must use OTP authentication. Please use the verify-password endpoint."
        )
    
    token = create_access_token(sub=user.username, role=user.role)
    logger.info(f"✅ Direct login successful for admin user: {user.username}")
    return TokenResponse(access_token=token, token_type="bearer", username=user.username, role=user.role)

@router.post("/verify-password", response_model=VerifyPasswordResponse)
def verify_password_endpoint(data: VerifyPasswordRequest, session: Session = Depends(get_session)) -> VerifyPasswordResponse:
    """
    Verify username and password.
    Returns success and whether OTP is required based on user role.
    - Admin users: requires_otp = False (login directly)
    - Regular users: requires_otp = True (need OTP)
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Local development authentication check (bypass DB for local dev admin)
        if (
            os.getenv("NODE_ENV") == "development"
            or os.getenv("ENVIRONMENT") == "development"
            or os.getenv("LOCAL_AUTH", "").lower() == "true"
        ):
            if data.username == "syed" and data.password == "Faizan123":
                logger.info("✅ Local dev password verified for syed (OTP not required)")
                return VerifyPasswordResponse(
                    success=True,
                    requires_otp=False,
                    message="Password verified. Admin login successful.",
                )

        logger.info(f"🔐 Password verification request for user: {data.username}")
        
        # Verify user exists and password is correct
        user = session.exec(select(User).where(User.username == data.username)).first()
        logger.info(f"👤 User lookup result: {'found' if user else 'not found'}")
        
        if not user or not user.is_active:
            logger.warning(f"❌ User not found or inactive: {data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Verify password
        logger.info(f"🔑 Verifying password for user: {data.username}")
        if not verify_password_hash(data.password, user.password_hash):
            logger.warning(f"❌ Invalid password for user: {data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Check if user is admin (skip OTP) or regular user (requires OTP)
        if user.role == "admin":
            logger.info(f"✅ Password verified for admin user: {data.username} - OTP not required")
            return VerifyPasswordResponse(
                success=True,
                requires_otp=False,
                message="Password verified. Admin login successful."
            )
        else:
            # Regular user - check if email exists
            if not user.email:
                logger.error(f"❌ Regular user {data.username} does not have email configured")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email not configured for user. Please contact administrator."
                )
            
            logger.info(f"✅ Password verified for regular user: {data.username} - OTP required")
            return VerifyPasswordResponse(
                success=True,
                requires_otp=True,
                message="Password verified. OTP will be sent to your email."
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error verifying password: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verifying password: {str(e)}"
        )

@router.post("/send-otp", response_model=OTPResponse)
async def send_otp(data: SendOTPRequest, session: Session = Depends(get_session)) -> OTPResponse:
    """
    Send OTP to user's email.
    Uses stored email from user record. Verifies password first before sending OTP.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"📧 OTP send request for user: {data.username}")
        
        # Verify user exists and password is correct
        user = session.exec(select(User).where(User.username == data.username)).first()
        if not user or not user.is_active:
            logger.warning(f"❌ User not found or inactive for OTP request: {data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Verify password
        if not verify_password_hash(data.password, user.password_hash):
            logger.warning(f"❌ Invalid password for OTP request for user: {data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Check if user has email configured
        if not user.email:
            logger.error(f"❌ User {data.username} does not have email configured")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not configured for user. Please contact administrator."
            )
        
        # Admin users should not need OTP (this should not be called for admin, but check anyway)
        if user.role == "admin":
            logger.warning(f"⚠️ OTP requested for admin user {data.username} - this should not happen")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin users do not require OTP"
            )
        
        otp_service = get_otp_service()
        # Real email OTP: OTP_DISABLE_EMAIL unset/false + Azure Graph credentials (see env.example).
        # Dev-only: OTP_DISABLE_EMAIL=1 uses OTP_FIXED_CODE and skips sendMail.
        use_fixed_otp = is_otp_email_sending_disabled()
        fixed_otp = get_otp_fixed_code()

        otp_mode = (getattr(user, "otp_mode", None) or "real").strip().lower()
        if otp_mode not in ("real", "fixed"):
            otp_mode = "real"

        if otp_mode == "fixed":
            otp = fixed_otp
            logger.info(
                f"🔐 OTP mode is fixed for user {data.username}; using OTP_FIXED_CODE and skipping email send"
            )
        elif use_fixed_otp:
            otp = fixed_otp
            logger.info(f"📧 OTP email disabled: using fixed OTP for user {data.username}")
        else:
            otp = otp_service.generate_otp()
        
        # Store OTP with username (using stored email)
        otp_service.store_otp(email=user.email, otp=otp, username=data.username)
        
        if otp_mode == "fixed" or use_fixed_otp:
            email_sent = True  # Skip sending email
        else:
            email_otp_service = get_email_otp_service()
            logger.info(f"📧 Sending OTP to {user.email} for user {data.username}")
            email_sent = await email_otp_service.send_otp_email(
                to_email=user.email,
                otp=otp,
                username=data.username
            )
        
        if email_sent:
            # Mask email for display (e.g., "syed****@example.com")
            email_parts = user.email.split('@')
            if len(email_parts) == 2:
                local_part = email_parts[0]
                domain = email_parts[1]
                # Show first 4 characters, then mask the rest
                if len(local_part) > 4:
                    masked_local = local_part[:4] + '****'
                else:
                    masked_local = local_part[0] + '****'
                masked_email = f"{masked_local}@{domain}"
            else:
                masked_email = user.email  # Fallback if email format is unexpected
            
            logger.info(f"✅ OTP sent successfully to {user.email} for user {data.username}")
            return OTPResponse(
                message=f"OTP sent successfully",
                success=True,
                masked_email=masked_email
            )
        else:
            logger.error(f"❌ Failed to send OTP email to {user.email} for user {data.username}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send OTP email. Please check Azure email configuration. See backend logs for details."
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error sending OTP: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sending OTP: {str(e)}"
        )

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(data: VerifyOTPRequest, session: Session = Depends(get_session)) -> TokenResponse:
    """
    Verify OTP and login user.
    Requires username and OTP. Email is retrieved from user record.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"🔑 OTP verification request for user: {data.username}")
        
        # Find user by username
        user = session.exec(select(User).where(User.username == data.username)).first()
        if not user or not user.is_active:
            logger.warning(f"❌ User not found or inactive: {data.username}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found or inactive"
            )
        
        # Get user's email
        if not user.email:
            logger.error(f"❌ User {data.username} does not have email configured")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not configured for user"
            )
        
        otp_service = get_otp_service()
        
        # Verify OTP using user's email
        is_valid, stored_username = otp_service.verify_otp(email=user.email, otp=data.otp)
        
        if not is_valid:
            logger.warning(f"❌ Invalid or expired OTP for user: {data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired OTP"
            )
        
        # Verify username matches
        if stored_username != data.username:
            logger.warning(f"❌ Username mismatch: expected {data.username}, got {stored_username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid OTP"
            )
        
        # Create access token
        token = create_access_token(sub=user.username, role=user.role)
        logger.info(f"✅ OTP verified and user logged in: {user.username} ({user.role})")
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            username=user.username,
            role=user.role
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error verifying OTP: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verifying OTP: {str(e)}"
        )

@router.get("/me", response_model=UserRead)
def get_me(user: User = Depends(require_user)) -> UserRead:
    return UserRead(id=user.id, username=user.username, role=user.role, is_active=user.is_active, email=user.email)
