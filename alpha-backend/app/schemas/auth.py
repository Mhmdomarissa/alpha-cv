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
    otp_mode: str = "real"
    team_location: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[EmailStr] = None  # Required for non-admin users
    otp_mode: str = Field(default="real", pattern="^(real|fixed)$")
    # Roles:
    # - admin: full access
    # - manager: tracker requirements + candidates
    # - user: recruiter persona (same as literal role "recruiter" in tracker; candidate write, not requirement write)
    role: str = Field(default="user", pattern="^(user|manager|admin|evp)$")
    team_location: Optional[str] = Field(default=None, max_length=100)

class UserUpdate(BaseModel):
    password: Optional[str] = None
    email: Optional[EmailStr] = None
    otp_mode: Optional[str] = Field(default=None, pattern="^(real|fixed)$")
    role: Optional[str] = Field(default=None, pattern="^(user|manager|admin|evp)$")
    team_location: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None