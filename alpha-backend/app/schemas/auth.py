from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class LoginRequest(BaseModel):
    username: str
    password: str

class VerifyPasswordRequest(BaseModel):
    username: str
    password: str

class VerifyPasswordResponse(BaseModel):
    success: bool
    requires_otp: bool  # True for regular users, False for admin
    message: str

class SendOTPRequest(BaseModel):
    username: str
    password: str  # Still verify password for security

class VerifyOTPRequest(BaseModel):
    username: str  # Username instead of email
    otp: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str

class OTPResponse(BaseModel):
    message: str
    success: bool
    masked_email: Optional[str] = None  # Masked email for display (e.g., "syed****@example.com")

class UserRead(BaseModel):
    id: str
    username: str
    role: str
    is_active: bool
    email: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[EmailStr] = None  # Required for non-admin users
    # Roles:
    # - admin: full access
    # - manager: tracker read/write
    # - user: recruiter (tracker read-only)
    role: str = Field(default="user", pattern="^(user|manager|admin)$")

class UserUpdate(BaseModel):
    password: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = Field(default=None, pattern="^(user|manager|admin)$")
    is_active: Optional[bool] = None