from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class TrackerJobOpeningCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    requirement: Optional[str] = Field(None, max_length=200)
    department: Optional[str] = Field(None, max_length=200)
    client: Optional[str] = Field(None, max_length=200)
    status: str = Field("Open", max_length=50)
    hiring_manager: Optional[str] = Field(None, max_length=200)
    recruitment_manager: Optional[str] = Field(None, max_length=200)
    req_date: Optional[date] = None
    submission_date: Optional[date] = None
    cvs_submitted_count: Optional[int] = Field(None, ge=0, le=100000)
    comments: Optional[str] = Field(None, max_length=4000)


class TrackerJobOpeningUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    requirement: Optional[str] = Field(None, max_length=200)
    department: Optional[str] = Field(None, max_length=200)
    client: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, max_length=50)
    hiring_manager: Optional[str] = Field(None, max_length=200)
    recruitment_manager: Optional[str] = Field(None, max_length=200)
    req_date: Optional[date] = None
    submission_date: Optional[date] = None
    cvs_submitted_count: Optional[int] = Field(None, ge=0, le=100000)
    comments: Optional[str] = Field(None, max_length=4000)


class TrackerJobOpeningRead(BaseModel):
    id: str
    title: str
    requirement: Optional[str] = None
    department: Optional[str]
    client: Optional[str] = None
    status: str
    hiring_manager: Optional[str]
    recruitment_manager: Optional[str] = None
    req_date: Optional[date] = None
    submission_date: Optional[date] = None
    cvs_submitted_count: Optional[int] = None
    comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TrackerCandidateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    email: Optional[str] = Field(None, max_length=300)
    phone: Optional[str] = Field(None, max_length=50)
    current_company: Optional[str] = Field(None, max_length=300)
    experience_years: Optional[int] = Field(None, ge=0, le=80)


class TrackerCandidateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=300)
    email: Optional[str] = Field(None, max_length=300)
    phone: Optional[str] = Field(None, max_length=50)
    current_company: Optional[str] = Field(None, max_length=300)
    experience_years: Optional[int] = Field(None, ge=0, le=80)


class TrackerCandidateRead(BaseModel):
    id: str
    name: str
    email: Optional[str]
    phone: Optional[str]
    current_company: Optional[str]
    experience_years: Optional[int]
    created_at: datetime
    updated_at: datetime


class TrackerApplicationCreate(BaseModel):
    candidate_id: str
    job_opening_id: Optional[str] = None
    applied_date: Optional[date] = None
    position: Optional[str] = Field(None, max_length=300)
    client: Optional[str] = Field(None, max_length=300)
    status: str = Field("MRF Pending", max_length=100)
    recruiter: Optional[str] = Field(None, max_length=100)
    account_manager: Optional[str] = Field(None, max_length=100)
    recruitment_manager: Optional[str] = Field(None, max_length=100)
    comment: Optional[str] = Field(None, max_length=2000)


class TrackerApplicationUpdate(BaseModel):
    applied_date: Optional[date] = None
    position: Optional[str] = Field(None, max_length=300)
    client: Optional[str] = Field(None, max_length=300)
    status: Optional[str] = Field(None, max_length=100)
    recruiter: Optional[str] = Field(None, max_length=100)
    account_manager: Optional[str] = Field(None, max_length=100)
    recruitment_manager: Optional[str] = Field(None, max_length=100)
    comment: Optional[str] = Field(None, max_length=2000)


class TrackerApplicationRead(BaseModel):
    id: str
    candidate_id: str
    job_opening_id: Optional[str] = None
    applied_date: Optional[date] = None
    position: Optional[str] = None
    client: Optional[str] = None
    status: str
    recruiter: Optional[str] = None
    account_manager: Optional[str] = None
    recruitment_manager: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TrackerCandidateRowRead(BaseModel):
    candidate: TrackerCandidateRead
    application: Optional[TrackerApplicationRead] = None


class TrackerOptionCreate(BaseModel):
    kind: str = Field(..., min_length=1, max_length=50)
    value: str = Field(..., min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=300)
    email_enabled: Optional[bool] = True


class TrackerOptionUpdate(BaseModel):
    value: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=300)
    email_enabled: Optional[bool] = None


class TrackerOptionRead(BaseModel):
    id: str
    kind: str
    value: str
    email: Optional[str] = None
    email_enabled: bool = True
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime


class TrackerFeaturesResponse(BaseModel):
    enable_candidate_tracker: bool
    allowed_roles: List[str]
    user_role: Optional[str] = None


class TrackerFollowUpCreate(BaseModel):
    client_name: str = Field(..., min_length=1, max_length=300)
    position: Optional[str] = Field(None, max_length=300)
    recruiter_name: Optional[str] = Field(None, max_length=300)
    account_manager: Optional[str] = Field(None, max_length=300)
    recruitment_manager: Optional[str] = Field(None, max_length=300)
    cv_submitted_date: Optional[date] = None
    current_stage: str = Field("Feedback Pending", min_length=1, max_length=50)
    last_follow_up_date: Optional[date] = None
    next_follow_up_date: Optional[date] = None
    interview_date: Optional[date] = None
    client_feedback: Optional[str] = Field(None, max_length=4000)
    interview_feedback: Optional[str] = Field(None, max_length=4000)
    remarks: Optional[str] = Field(None, max_length=4000)


class TrackerFollowUpUpdate(BaseModel):
    client_name: Optional[str] = Field(None, min_length=1, max_length=300)
    position: Optional[str] = Field(None, max_length=300)
    recruiter_name: Optional[str] = Field(None, max_length=300)
    account_manager: Optional[str] = Field(None, max_length=300)
    recruitment_manager: Optional[str] = Field(None, max_length=300)
    cv_submitted_date: Optional[date] = None
    current_stage: Optional[str] = Field(None, min_length=1, max_length=50)
    last_follow_up_date: Optional[date] = None
    next_follow_up_date: Optional[date] = None
    interview_date: Optional[date] = None
    client_feedback: Optional[str] = Field(None, max_length=4000)
    interview_feedback: Optional[str] = Field(None, max_length=4000)
    remarks: Optional[str] = Field(None, max_length=4000)


class TrackerFollowUpRead(BaseModel):
    id: str
    client_name: str
    position: Optional[str] = None
    recruiter_name: Optional[str] = None
    account_manager: Optional[str] = None
    recruitment_manager: Optional[str] = None
    cv_submitted_date: Optional[date] = None
    current_stage: str
    last_follow_up_date: Optional[date] = None
    next_follow_up_date: Optional[date] = None
    interview_date: Optional[date] = None
    client_feedback: Optional[str] = None
    interview_feedback: Optional[str] = None
    remarks: Optional[str] = None
    reminder_last_sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

