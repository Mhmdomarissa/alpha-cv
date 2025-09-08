from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlmodel import Session, select
from app.db.auth_db import get_session
from app.models.user import User
from app.schemas.auth import UserCreate, UserRead, UserUpdate
from app.utils.security import hash_password
from app.deps.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/users", response_model=List[UserRead])
def list_users(_: User = Depends(require_admin), session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return [UserRead(id=u.id, username=u.username, role=u.role, is_active=u.is_active) for u in users]

@router.post("/users", response_model=UserRead, status_code=201)
def create_user(data: UserCreate, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.username == data.username)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        role=data.role,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserRead(id=user.id, username=user.username, role=user.role, is_active=user.is_active)

@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(user_id: str, data: UserUpdate, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if data.password:
        user.password_hash = hash_password(data.password)
    if data.role:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserRead(id=user.id, username=user.username, role=user.role, is_active=user.is_active)

@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    session.delete(user)
    session.commit()
    return {}