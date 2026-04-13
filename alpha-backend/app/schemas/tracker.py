from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class TrackerJobOpeningCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    department: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)
    status: str = Field("Open", max_length=50)
    hiring_manager: Optional[str] = Field(None, max_length=200)
    req_date: Optional[date] = None


class TrackerJobOpeningUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    department: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, max_length=50)
    hiring_manager: Optional[str] = Field(None, max_length=200)
    req_date: Optional[date] = None


class TrackerJobOpeningRead(BaseModel):
    id: str
    title: str
    department: Optional[str]
    location: Optional[str]
    status: str
    hiring_manager: Optional[str]
    req_date: Optional[date] = None
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
    comment: Optional[str] = Field(None, max_length=2000)


class TrackerApplicationUpdate(BaseModel):
    applied_date: Optional[date] = None
    position: Optional[str] = Field(None, max_length=300)
    client: Optional[str] = Field(None, max_length=300)
    status: Optional[str] = Field(None, max_length=100)
    recruiter: Optional[str] = Field(None, max_length=100)
    account_manager: Optional[str] = Field(None, max_length=100)
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
    comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TrackerSkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class TrackerSkillRead(BaseModel):
    id: str
    name: str
    created_at: datetime


class TrackerDocumentCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=300)
    url: Optional[str] = Field(None, max_length=2000)
    storage_key: Optional[str] = Field(None, max_length=500)
    doc_type: Optional[str] = Field(None, max_length=100)


class TrackerDocumentRead(BaseModel):
    id: str
    candidate_id: str
    label: str
    url: Optional[str]
    storage_key: Optional[str]
    doc_type: Optional[str]
    created_at: datetime


class TrackerCandidateSkillsUpdate(BaseModel):
    skill_names: List[str] = Field(default_factory=list)


class TrackerFeaturesResponse(BaseModel):
    enable_candidate_tracker: bool
    allowed_roles: List[str]
    user_role: Optional[str] = None

