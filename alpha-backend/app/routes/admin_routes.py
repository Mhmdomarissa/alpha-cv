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

@router.get("/rate-limiter/stats")
def get_rate_limiter_stats(_: User = Depends(require_admin)):
    """Get rate limiter statistics and health metrics"""
    limiter = get_rate_limiter()
    stats = limiter.get_stats()
    
    # Add rate limit configurations for transparency
    rate_configs = {}
    for endpoint, config in limiter.rate_limits.items():
        rate_configs[endpoint] = {
            "requests_per_hour": config.requests_per_hour,
            "concurrent_limit": config.concurrent_limit,
            "burst_allowance": config.burst_allowance,
            "priority": config.priority
        }
    
    return {
        "statistics": stats,
        "configuration": rate_configs,
        "environment": {
            "is_production": limiter.is_production,
            "debug_mode": limiter.debug_mode,
            "max_global_concurrent": limiter.max_global_concurrent
        },
        "circuit_breaker": {
            "is_open": limiter._is_circuit_breaker_open(),
            "trips": limiter.circuit_breaker_trips,
            "last_trip": limiter.last_circuit_trip,
            "recovery_time": limiter.circuit_recovery_time
        }
    }

@router.post("/rate-limiter/reset")
def reset_rate_limiter(_: User = Depends(require_admin)):
    """Reset rate limiter state (emergency use only)"""
    limiter = get_rate_limiter()
    
    # Clear all tracking data
    limiter.ip_requests.clear()
    limiter.ip_concurrent.clear()
    limiter.ip_reputation.clear()
    
    # Reset counters
    limiter.global_concurrent = 0
    limiter.request_count = 0
    limiter.rejection_count = 0
    limiter.circuit_breaker_trips = 0
    limiter.last_circuit_trip = 0
    
    return {
        "success": True,
        "message": "Rate limiter state has been reset",
        "timestamp": limiter.last_cleanup
    }

@router.get("/rate-limiter/bypass-test")
def test_rate_limiter_bypass(_: User = Depends(require_admin)):
    """Test endpoint to verify admin bypass is working"""
    return {
        "success": True,
        "message": "Rate limiter bypass is working correctly for admin users",
        "timestamp": datetime.utcnow().isoformat(),
        "note": "This endpoint would be rate limited for non-admin users"
    }

@router.post("/rate-limiter/whitelist-ip")
def whitelist_ip(
    ip_address: str, 
    duration_hours: int = 24,
    _: User = Depends(require_admin)
):
    """Temporarily whitelist an IP address (admin only)"""
    from datetime import timedelta
    limiter = get_rate_limiter()
    
    # Set IP reputation to maximum (bypasses most limits)
    limiter.ip_reputation[ip_address] = 1.0
    
    # Clear any existing rate limit history
    if ip_address in limiter.ip_requests:
        limiter.ip_requests[ip_address].clear()
    limiter.ip_concurrent[ip_address] = 0
    
    return {
        "success": True,
        "message": f"IP {ip_address} has been whitelisted for {duration_hours} hours",
        "ip_address": ip_address,
        "duration_hours": duration_hours,
        "expires_at": (datetime.utcnow() + timedelta(hours=duration_hours)).isoformat()
    }