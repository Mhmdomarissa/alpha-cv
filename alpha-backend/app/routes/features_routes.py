from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.deps.auth import require_user
from app.models.user import User
from app.schemas.tracker import TrackerFeaturesResponse


router = APIRouter(prefix="/api", tags=["features"])


@router.get("/features", response_model=TrackerFeaturesResponse)
def get_features(user: User = Depends(require_user)) -> TrackerFeaturesResponse:
    # Tracker is visible to recruiters ("user") and managers; write access is enforced on tracker endpoints.
    allowed_roles = ["admin", "user", "manager", "recruiter"]
    return TrackerFeaturesResponse(
        enable_candidate_tracker=bool(settings.ENABLE_CANDIDATE_TRACKER),
        allowed_roles=allowed_roles,
        user_role=getattr(user, "role", None),
    )

