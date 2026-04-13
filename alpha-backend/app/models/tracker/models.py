from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field

from app.models.tracker.base import TrackerSQLModel


class TrackerJobOpening(TrackerSQLModel, table=True):
    __tablename__ = "tracker_job_opening"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    title: str = Field(index=True)
    department: Optional[str] = Field(default=None, index=True)
    location: Optional[str] = Field(default=None, index=True)
    status: str = Field(default="Open", index=True)
    hiring_manager: Optional[str] = Field(default=None, index=True)
    req_date: Optional[date] = Field(default=None, index=True)

    is_deleted: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerCandidate(TrackerSQLModel, table=True):
    __tablename__ = "tracker_candidate"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)

    name: str = Field(index=True)
    email: Optional[str] = Field(default=None, index=True)
    phone: Optional[str] = Field(default=None, index=True)
    current_company: Optional[str] = Field(default=None, index=True)
    experience_years: Optional[int] = Field(default=None, index=True)

    is_deleted: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerApplication(TrackerSQLModel, table=True):
    __tablename__ = "tracker_application"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    candidate_id: str = Field(index=True, foreign_key="tracker_candidate.id")
    # Optional link to a requirement. Many candidates can exist without a requirement row.
    job_opening_id: Optional[str] = Field(default=None, index=True, foreign_key="tracker_job_opening.id")

    # Tracking sheet fields (matches your provided columns)
    applied_date: Optional[date] = Field(default=None, index=True)
    position: Optional[str] = Field(default=None, index=True)
    client: Optional[str] = Field(default=None, index=True)
    status: str = Field(default="MRF Pending", index=True)
    recruiter: Optional[str] = Field(default=None, index=True)
    account_manager: Optional[str] = Field(default=None, index=True)
    comment: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerSkill(TrackerSQLModel, table=True):
    __tablename__ = "tracker_skill"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    name: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerCandidateSkill(TrackerSQLModel, table=True):
    __tablename__ = "tracker_candidate_skill"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    candidate_id: str = Field(index=True, foreign_key="tracker_candidate.id")
    skill_id: str = Field(index=True, foreign_key="tracker_skill.id")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerDocument(TrackerSQLModel, table=True):
    __tablename__ = "tracker_document"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    candidate_id: str = Field(index=True, foreign_key="tracker_candidate.id")
    label: str = Field(index=True)  # what to display in UI chip
    url: Optional[str] = Field(default=None)  # external link or storage URL
    storage_key: Optional[str] = Field(default=None, index=True)  # if stored in-app
    doc_type: Optional[str] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

