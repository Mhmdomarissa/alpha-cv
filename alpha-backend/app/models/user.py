from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
import uuid

class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    role: str = Field(default="user")  # "admin" or "user"
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)