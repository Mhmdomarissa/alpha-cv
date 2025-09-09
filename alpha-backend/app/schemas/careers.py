"""
Careers Schemas - Public Job Postings & Applications
Pydantic models for the careers page functionality where:
- HR posts jobs and gets public links
- Public users view jobs and apply without authentication
- Applications are processed through existing CV pipeline
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime


class JobPostingCreate(BaseModel):
    """Request model for creating a new job posting"""
    company_name: Optional[str] = Field(None, max_length=200, description="Company name for branding")
    additional_info: Optional[str] = Field(None, max_length=1000, description="Additional context for job posting")


class JobPostingResponse(BaseModel):
    """Response model after successful job posting creation"""
    job_id: str = Field(..., description="Unique identifier for the job posting")
    public_link: str = Field(..., description="Public URL where candidates can view and apply")
    public_token: str = Field(..., description="Public token for the job posting")  # Add this line
    job_title: Optional[str] = Field(None, description="Extracted job title from the job description")
    upload_date: str = Field(..., description="ISO timestamp when job was posted")
    filename: str = Field(..., description="Original filename of uploaded job description")
    is_active: bool = Field(True, description="Whether the job posting is currently accepting applications")
    company_name: Optional[str] = Field(None, description="Company name associated with posting")

class PublicJobView(BaseModel):
    """Public-facing model for job postings (no sensitive data)"""
    job_id: str = Field(..., description="Unique identifier for the job posting")
    job_title: Optional[str] = Field("Position Available", description="Job title or position name")
    company_name: Optional[str] = Field("Our Company", description="Company name for branding")
    job_description: str = Field(..., description="Full job description text")
    upload_date: str = Field(..., description="When this job was posted")
    requirements: Optional[List[str]] = Field([], description="List of required skills and qualifications")
    responsibilities: Optional[List[str]] = Field([], description="List of job responsibilities and duties")
    experience_required: Optional[str] = Field("Not specified", description="Required years of experience")
    is_active: bool = Field(True, description="Whether the job is currently accepting applications")


class JobApplicationRequest(BaseModel):
    """Request model for job applications"""
    job_id: str = Field(..., description="ID of the job being applied to")
    applicant_name: str = Field(..., min_length=2, max_length=100, description="Full name of the applicant")
    applicant_email: EmailStr = Field(..., description="Valid email address for contact")
    applicant_phone: Optional[str] = Field(None, max_length=20, description="Phone number (optional)")
    cover_letter: Optional[str] = Field(None, max_length=2000, description="Optional cover letter or message")


class JobApplicationResponse(BaseModel):
    """Response model after application submission"""
    success: bool = Field(..., description="Whether the application was successfully submitted")
    application_id: str = Field(..., description="Unique identifier for this application")
    message: str = Field(..., description="Confirmation message for the applicant")
    next_steps: Optional[str] = Field(None, description="Information about what happens next")


class JobApplicationSummary(BaseModel):
    """Summary model for applications (for HR dashboard)"""
    application_id: str = Field(..., description="Unique application identifier")
    job_id: str = Field(..., description="Job this application is for")
    applicant_name: str = Field(..., description="Name of the applicant")
    applicant_email: str = Field(..., description="Email of the applicant")
    application_date: str = Field(..., description="When the application was submitted")
    cv_filename: str = Field(..., description="Original filename of submitted CV")
    match_score: Optional[float] = Field(None, description="AI-calculated match score if available")
    status: str = Field("pending", description="Application status (pending, reviewed, etc.)")


class JobPostingSummary(BaseModel):
    """Summary model for job postings (for HR dashboard)"""
    job_id: str = Field(..., description="Unique job identifier")
    job_title: Optional[str] = Field(None, description="Job title")
    company_name: Optional[str] = Field(None, description="Company name")
    upload_date: str = Field(..., description="When job was posted")
    filename: str = Field(..., description="Original filename")
    is_active: bool = Field(..., description="Whether job is active")
    application_count: int = Field(0, description="Number of applications received")
    public_token: str = Field(..., description="Public access token for the job")  # Add this line

class JobStatusUpdate(BaseModel):
    """Request model for updating job posting status"""
    is_active: bool = Field(..., description="New active status for the job")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for status change")


class ApplicationStatusUpdate(BaseModel):
    """Request model for updating application status"""
    status: str = Field(..., description="New status for the application")
    notes: Optional[str] = Field(None, max_length=1000, description="HR notes about the application")


class JobMatchingRequest(BaseModel):
    """Request model for matching applications to a job"""
    job_id: str = Field(..., description="Job to match applications against")
    include_inactive: bool = Field(False, description="Whether to include inactive applications")
    min_score: Optional[float] = Field(None, description="Minimum match score threshold")


class JobMatchingResponse(BaseModel):
    """Response model for job matching results"""
    job_id: str = Field(..., description="Job ID that was matched")
    job_title: Optional[str] = Field(None, description="Job title")
    total_applications: int = Field(..., description="Total number of applications")
    matched_applications: List[JobApplicationSummary] = Field(..., description="Applications with match scores")
    top_candidates: List[JobApplicationSummary] = Field(..., description="Top 10 candidates by score")


# Error response models
class CareersErrorResponse(BaseModel):
    """Standard error response for careers endpoints"""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[str] = Field(None, description="Additional error details")
    status_code: int = Field(..., description="HTTP status code")


# Health check model
class CareersHealthResponse(BaseModel):
    """Health check response for careers functionality"""
    status: str = Field(..., description="Overall health status")
    job_postings_count: int = Field(..., description="Total number of job postings")
    applications_count: int = Field(..., description="Total number of applications")
    active_jobs_count: int = Field(..., description="Number of active job postings")
    collections_status: dict = Field(..., description="Status of Qdrant collections")