from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
import os
from app.utils.security import decode_token
from app.db.auth_db import get_session
from app.models.user import User

bearer = HTTPBearer(auto_error=True)

def get_current_user(token: HTTPAuthorizationCredentials = Depends(bearer),
                     session: Session = Depends(get_session)) -> User:
    try:
        data = decode_token(token.credentials)
        username = data.get("sub")
        role = data.get("role")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Handle local development user
    if (os.getenv("NODE_ENV") == "development" or 
        os.getenv("LOCAL_AUTH", "").lower() == "true"):
        if username == "syed":
            # Create a mock user object for the local development user
            class MockUser:
                def __init__(self):
                    self.id = "local-dev-1"
                    self.username = "syed"
                    self.role = "admin"
                    self.is_active = True
            return MockUser()

    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or unknown user")
    return user

def require_user(user: User = Depends(get_current_user)) -> User:
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user