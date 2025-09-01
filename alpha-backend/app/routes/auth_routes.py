from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.db.auth_db import get_session
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserRead
from app.utils.security import verify_password, create_access_token
from app.deps.auth import require_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == data.username)).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(sub=user.username, role=user.role)
    return TokenResponse(access_token=token, token_type="bearer", username=user.username, role=user.role)

@router.get("/me", response_model=UserRead)
def get_me(user: User = Depends(require_user)):
    return UserRead(id=user.id, username=user.username, role=user.role, is_active=user.is_active)
