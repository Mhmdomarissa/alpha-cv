# app/schemas/matching.py
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict

class MatchWeights(BaseModel):
    skills: float = 80
    responsibilities: float = 15
    job_title: float = 2.5
    experience: float = 2.5

class MatchRequest(BaseModel):
    # Provide one of: jd_id OR jd_text
    jd_id: Optional[str] = None
    jd_text: Optional[str] = None
    # Optional scoping of candidates; if absent, use all CVs in DB
    cv_ids: Optional[List[str]] = None
    # Optional custom weights
    weights: Optional[MatchWeights] = None
    # Optional: limits for explainability
    top_alternatives: int = 3

class AssignmentItem(BaseModel):
    type: Literal["skill", "responsibility"]
    jd_index: int
    jd_item: str
    cv_index: int
    cv_item: str
    score: float

class AlternativesItem(BaseModel):
    jd_index: int
    items: List[Dict]  # [{cv_index, cv_item, score}...]

class CandidateBreakdown(BaseModel):
    cv_id: str
    cv_name: str
    cv_job_title: Optional[str] = None
    cv_years: int = 0
    skills_score: float = 0.0
    responsibilities_score: float = 0.0
    job_title_score: float = 0.0
    years_score: float = 0.0
    overall_score: float = 0.0
    skills_assignments: List[AssignmentItem] = []
    responsibilities_assignments: List[AssignmentItem] = []
    skills_alternatives: List[AlternativesItem] = []
    responsibilities_alternatives: List[AlternativesItem] = []

class MatchResponse(BaseModel):
    jd_id: Optional[str] = None
    jd_job_title: Optional[str] = None
    jd_years: int = 0
    normalized_weights: MatchWeights
    candidates: List[CandidateBreakdown]
