from pydantic import BaseModel, Field
from typing import Optional

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str

class UserRead(BaseModel):
    id: str
    username: str
    role: str
    is_active: bool

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = Field(default="user", pattern="^(user|admin)$")

class UserUpdate(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = Field(default=None, pattern="^(user|admin)$")
    is_active: Optional[bool] = None