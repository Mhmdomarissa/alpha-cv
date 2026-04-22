from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field

from app.models.tracker.base import TrackerSQLModel


class TrackerOption(TrackerSQLModel, table=True):
    __tablename__ = "tracker_option"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    kind: str = Field(index=True)  # e.g. status | recruiter | account_manager | location
    value: str = Field(index=True)
    email: Optional[str] = Field(default=None, index=True)
    email_enabled: bool = Field(default=True, index=True)
    is_deleted: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerJobOpening(TrackerSQLModel, table=True):
    __tablename__ = "tracker_job_opening"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    title: str = Field(index=True)
    department: Optional[str] = Field(default=None, index=True)
    # Legacy column used as "client" in the UI previously. Kept for backwards compatibility.
    location: Optional[str] = Field(default=None, index=True)
    client: Optional[str] = Field(default=None, index=True)
    work_location: Optional[str] = Field(default=None, index=True)
    status: str = Field(default="Open", index=True)
    hiring_manager: Optional[str] = Field(default=None, index=True)
    recruitment_manager: Optional[str] = Field(default=None, index=True)
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
    location: Optional[str] = Field(default=None, index=True)
    status: str = Field(default="MRF Pending", index=True)
    recruiter: Optional[str] = Field(default=None, index=True)
    account_manager: Optional[str] = Field(default=None, index=True)
    recruitment_manager: Optional[str] = Field(default=None, index=True)
    comment: Optional[str] = Field(default=None)

    # Row-level access support: who created this application row.
    # This is used for team-based visibility and must not be user-editable via the UI.
    created_by_username: Optional[str] = Field(default=None, index=True)
    created_by_role: Optional[str] = Field(default=None, index=True)
    created_by_team_location: Optional[str] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerFollowUp(TrackerSQLModel, table=True):
    __tablename__ = "tracker_follow_up"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)

    client_name: str = Field(index=True)
    position: Optional[str] = Field(default=None, index=True)
    recruiter_name: Optional[str] = Field(default=None, index=True)
    account_manager: Optional[str] = Field(default=None, index=True)
    recruitment_manager: Optional[str] = Field(default=None, index=True)

    cv_submitted_date: Optional[date] = Field(default=None, index=True)
    current_stage: str = Field(default="Feedback Pending", index=True)
    last_follow_up_date: Optional[date] = Field(default=None, index=True)
    next_follow_up_date: Optional[date] = Field(default=None, index=True)
    interview_date: Optional[date] = Field(default=None, index=True)

    client_feedback: Optional[str] = Field(default=None)
    interview_feedback: Optional[str] = Field(default=None)
    remarks: Optional[str] = Field(default=None)

    # Follow-up email reminders: used to prevent duplicate daily sends.
    reminder_last_sent_at: Optional[datetime] = Field(default=None, index=True)

    is_deleted: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


# ──────────────────────────── Abu Dhabi tracker tables ────────────────────────────
# These tables are a parallel storage for the Abu Dhabi team, kept separate from the
# existing (Dubai) tracker tables above.


class TrackerOptionAD(TrackerSQLModel, table=True):
    __tablename__ = "tracker_option_ad"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    kind: str = Field(index=True)
    value: str = Field(index=True)
    email: Optional[str] = Field(default=None, index=True)
    email_enabled: bool = Field(default=True, index=True)
    is_deleted: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerJobOpeningAD(TrackerSQLModel, table=True):
    __tablename__ = "tracker_job_opening_ad"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    title: str = Field(index=True)
    department: Optional[str] = Field(default=None, index=True)
    location: Optional[str] = Field(default=None, index=True)
    client: Optional[str] = Field(default=None, index=True)
    work_location: Optional[str] = Field(default=None, index=True)
    status: str = Field(default="Open", index=True)
    hiring_manager: Optional[str] = Field(default=None, index=True)
    recruitment_manager: Optional[str] = Field(default=None, index=True)
    req_date: Optional[date] = Field(default=None, index=True)

    is_deleted: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerCandidateAD(TrackerSQLModel, table=True):
    __tablename__ = "tracker_candidate_ad"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)

    name: str = Field(index=True)
    email: Optional[str] = Field(default=None, index=True)
    phone: Optional[str] = Field(default=None, index=True)
    current_company: Optional[str] = Field(default=None, index=True)
    experience_years: Optional[int] = Field(default=None, index=True)

    is_deleted: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerApplicationAD(TrackerSQLModel, table=True):
    __tablename__ = "tracker_application_ad"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    candidate_id: str = Field(index=True, foreign_key="tracker_candidate_ad.id")
    job_opening_id: Optional[str] = Field(default=None, index=True, foreign_key="tracker_job_opening_ad.id")

    applied_date: Optional[date] = Field(default=None, index=True)
    position: Optional[str] = Field(default=None, index=True)
    client: Optional[str] = Field(default=None, index=True)
    location: Optional[str] = Field(default=None, index=True)
    status: str = Field(default="MRF Pending", index=True)
    recruiter: Optional[str] = Field(default=None, index=True)
    account_manager: Optional[str] = Field(default=None, index=True)
    recruitment_manager: Optional[str] = Field(default=None, index=True)
    comment: Optional[str] = Field(default=None)

    created_by_username: Optional[str] = Field(default=None, index=True)
    created_by_role: Optional[str] = Field(default=None, index=True)
    created_by_team_location: Optional[str] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TrackerFollowUpAD(TrackerSQLModel, table=True):
    __tablename__ = "tracker_follow_up_ad"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)

    client_name: str = Field(index=True)
    position: Optional[str] = Field(default=None, index=True)
    recruiter_name: Optional[str] = Field(default=None, index=True)
    account_manager: Optional[str] = Field(default=None, index=True)
    recruitment_manager: Optional[str] = Field(default=None, index=True)

    cv_submitted_date: Optional[date] = Field(default=None, index=True)
    current_stage: str = Field(default="Feedback Pending", index=True)
    last_follow_up_date: Optional[date] = Field(default=None, index=True)
    next_follow_up_date: Optional[date] = Field(default=None, index=True)
    interview_date: Optional[date] = Field(default=None, index=True)

    client_feedback: Optional[str] = Field(default=None)
    interview_feedback: Optional[str] = Field(default=None)
    remarks: Optional[str] = Field(default=None)

    # Follow-up email reminders: used to prevent duplicate daily sends.
    reminder_last_sent_at: Optional[datetime] = Field(default=None, index=True)

    is_deleted: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)

