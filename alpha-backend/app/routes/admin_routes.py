from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlmodel import Session, select
from datetime import datetime
from app.db.auth_db import get_session
from app.models.user import User
from app.schemas.auth import UserCreate, UserRead, UserUpdate
from app.utils.security import hash_password
from app.deps.auth import require_admin
from app.middleware.rate_limiter import get_rate_limiter

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/users", response_model=List[UserRead])
def list_users(_: User = Depends(require_admin), session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return [
        UserRead(
            id=u.id,
            username=u.username,
            role=u.role,
            is_active=u.is_active,
            email=u.email,
            otp_mode=getattr(u, "otp_mode", "real") or "real",
            team_location=getattr(u, "team_location", None),
        )
        for u in users
    ]

@router.post("/users", response_model=UserRead, status_code=201)
def create_user(data: UserCreate, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.username == data.username)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")
    
    # Validate: non-admin users must have email when using real OTP.
    if data.role != "admin" and data.otp_mode != "fixed" and not data.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required for non-admin users when OTP mode is real"
        )
    
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        email=data.email,
        otp_mode=data.otp_mode or "real",
        role=data.role,
        team_location=getattr(data, "team_location", None),
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserRead(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        email=user.email,
        otp_mode=getattr(user, "otp_mode", "real") or "real",
        team_location=getattr(user, "team_location", None),
    )

@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(user_id: str, data: UserUpdate, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if data.password:
        user.password_hash = hash_password(data.password)
    if data.otp_mode:
        user.otp_mode = data.otp_mode
    if data.email is not None:
        # Validate: non-admin users must have email when using real OTP
        new_role = data.role if data.role else user.role
        new_otp_mode = data.otp_mode if data.otp_mode else getattr(user, "otp_mode", "real")
        if new_role != "admin" and new_otp_mode != "fixed" and not data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required for non-admin users when OTP mode is real"
            )
        user.email = data.email
    if data.role:
        # Validate: if changing to non-admin, ensure email exists when using real OTP
        new_otp_mode = data.otp_mode if data.otp_mode else getattr(user, "otp_mode", "real")
        if data.role != "admin" and new_otp_mode != "fixed" and not user.email and not data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required for non-admin users when OTP mode is real"
            )
        user.role = data.role
    if data.team_location is not None:
        user.team_location = data.team_location
    if data.is_active is not None:
        user.is_active = data.is_active
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserRead(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        email=user.email,
        otp_mode=getattr(user, "otp_mode", "real") or "real",
        team_location=getattr(user, "team_location", None),
    )

@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    session.delete(user)
    session.commit()
    return {}
