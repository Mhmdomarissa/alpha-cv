from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
import uuid

class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    email: Optional[str] = Field(default=None, index=True)  # Email for OTP (required for non-admin users)
    # OTP mode:
    # - real: generate random OTP and email it
    # - fixed: always use 123456 and do NOT email OTP (admin-controlled)
    otp_mode: str = Field(default="real")
    # Role is stored as plain text for flexibility (no DB migration needed to add roles).
    # Supported: "admin" | "manager" | "evp" | "user"
    role: str = Field(default="user")
    # Optional team/location scope for row-level filtering (e.g., "Abu Dhabi" | "Dubai").
    team_location: Optional[str] = Field(default=None, index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)