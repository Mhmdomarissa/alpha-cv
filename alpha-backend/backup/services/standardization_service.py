"""
Enterprise-grade data standardization service with structured JSON output.
Provides consistent, structured data extraction from CVs and Job Descriptions.
"""

import logging
import json
import time
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field, validator
from enum import Enum

from app.utils.gpt_extractor import call_openai_api

logger = logging.getLogger(__name__)

class ExperienceLevel(str, Enum):
    """Standard experience levels."""
    ENTRY = "entry"
    JUNIOR = "junior" 
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    PRINCIPAL = "principal"

class EducationLevel(str, Enum):
    """Standard education levels."""
    HIGH_SCHOOL = "high_school"
    ASSOCIATE = "associate"
    BACHELOR = "bachelor"
    MASTER = "master"
    PHD = "phd"
    CERTIFICATE = "certificate"
    BOOTCAMP = "bootcamp"

class StandardizedCV(BaseModel):
    """Structured CV data model."""
    # Personal Information
    full_name: str = Field(..., description="Full name of the candidate")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    location: Optional[str] = Field(None, description="Current location/city")
    
    # Professional Information
    job_title: str = Field(..., description="Current or most recent job title")
    experience_level: ExperienceLevel = Field(..., description="Professional experience level")
    years_of_experience: float = Field(..., description="Total years of relevant experience")
    
    # Skills (structured and categorized)
    technical_skills: List[str] = Field(default=[], description="Technical skills and technologies")
    soft_skills: List[str] = Field(default=[], description="Soft skills and interpersonal abilities")
    tools_and_platforms: List[str] = Field(default=[], description="Tools, platforms, and software")
    programming_languages: List[str] = Field(default=[], description="Programming languages")
    frameworks_libraries: List[str] = Field(default=[], description="Frameworks and libraries")
    
    # Education
    education_level: EducationLevel = Field(..., description="Highest education level")
    degrees: List[str] = Field(default=[], description="Degrees and certifications")
    institutions: List[str] = Field(default=[], description="Educational institutions")
    
    # Experience
    work_experience: List[Dict[str, Any]] = Field(default=[], description="Work experience entries")
    projects: List[Dict[str, Any]] = Field(default=[], description="Notable projects")
    
    # Summary
    professional_summary: str = Field(..., description="Professional summary/objective")
    key_achievements: List[str] = Field(default=[], description="Key achievements and accomplishments")
    
    # Industry and Domain
    industry_experience: List[str] = Field(default=[], description="Industry domains")
    specializations: List[str] = Field(default=[], description="Areas of specialization")

    @validator('years_of_experience')
    def validate_experience(cls, v):
        return max(0, min(50, v))  # Reasonable bounds

class StandardizedJD(BaseModel):
    """Structured Job Description data model."""
    # Basic Information
    job_title: str = Field(..., description="Job title/position")
    company: Optional[str] = Field(None, description="Company name")
    location: Optional[str] = Field(None, description="Job location")
    employment_type: Optional[str] = Field(None, description="Full-time, part-time, contract, etc.")
    
    # Experience Requirements
    required_experience_level: ExperienceLevel = Field(..., description="Required experience level")
    min_years_experience: float = Field(0, description="Minimum years of experience required")
    max_years_experience: Optional[float] = Field(None, description="Maximum years of experience")
    
    # Skills Requirements (structured and categorized)
    required_technical_skills: List[str] = Field(default=[], description="Must-have technical skills")
    preferred_technical_skills: List[str] = Field(default=[], description="Nice-to-have technical skills")
    required_soft_skills: List[str] = Field(default=[], description="Required soft skills")
    required_tools: List[str] = Field(default=[], description="Required tools and platforms")
    programming_languages: List[str] = Field(default=[], description="Required programming languages")
    frameworks_libraries: List[str] = Field(default=[], description="Required frameworks/libraries")
    
    # Education Requirements
    required_education: EducationLevel = Field(..., description="Minimum education requirement")
    preferred_degrees: List[str] = Field(default=[], description="Preferred degrees")
    
    # Job Details
    responsibilities: List[str] = Field(default=[], description="Key responsibilities")
    requirements: List[str] = Field(default=[], description="Job requirements")
    benefits: List[str] = Field(default=[], description="Benefits and perks")
    
    # Industry and Domain
    industry: Optional[str] = Field(None, description="Industry/sector")
    department: Optional[str] = Field(None, description="Department/team")
    
    # Compensation (if available)
    salary_range: Optional[Dict[str, Any]] = Field(None, description="Salary range information")

class StandardizationService:
    """
    Production-grade service for standardizing CV and JD data.
    
    Features:
    - Structured JSON output with validated schemas
    - Consistent data extraction prompts
    - Error handling and validation
    - Performance monitoring
    """
    
    def __init__(self):
        """Initialize the standardization service."""
        logger.info("StandardizationService initialized")
    
    def standardize_cv(self, cv_text: str, filename: str = "unknown") -> StandardizedCV:
        """
        Standardize CV text into structured format.
        
        Args:
            cv_text: Raw CV text content
            filename: Original filename for reference
            
        Returns:
            StandardizedCV object with structured data
        """
        if not cv_text or not cv_text.strip():
            raise ValueError("Empty CV text provided")
        
        logger.info(f"Standardizing CV: {filename}")
        start_time = time.time()
        
        try:
            # Create structured prompt
            prompt = self._create_cv_standardization_prompt(cv_text)
            
            # Call GPT-4 for extraction
            messages = [
                {
                    "role": "system",
                    "content": "You are an expert HR data analyst. Extract and standardize CV information into the exact JSON format specified. Be precise and comprehensive."
                },
                {
                    "role": "user", 
                    "content": prompt
                }
            ]
            
            response = call_openai_api(messages, model="gpt-4", max_tokens=2000, temperature=0.1)
            
            # Parse JSON response
            try:
                cv_data = json.loads(response)
                standardized_cv = StandardizedCV(**cv_data)
                
                processing_time = time.time() - start_time
                logger.info(f"✅ CV standardization completed in {processing_time:.3f}s: {standardized_cv.full_name}")
                
                return standardized_cv
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse CV JSON response: {str(e)}")
                logger.error(f"Response content: {response}")
                raise Exception(f"Invalid JSON response from GPT-4: {str(e)}")
                
            except Exception as e:
                logger.error(f"Failed to validate CV data: {str(e)}")
                raise Exception(f"CV data validation failed: {str(e)}")
        
        except Exception as e:
            logger.error(f"CV standardization failed for {filename}: {str(e)}")
            raise
    
    def standardize_jd(self, jd_text: str, filename: str = "unknown") -> StandardizedJD:
        """
        Standardize Job Description text into structured format.
        
        Args:
            jd_text: Raw JD text content
            filename: Original filename for reference
            
        Returns:
            StandardizedJD object with structured data
        """
        if not jd_text or not jd_text.strip():
            raise ValueError("Empty JD text provided")
        
        logger.info(f"Standardizing JD: {filename}")
        start_time = time.time()
        
        try:
            # Create structured prompt
            prompt = self._create_jd_standardization_prompt(jd_text)
            
            # Call GPT-4 for extraction
            messages = [
                {
                    "role": "system",
                    "content": "You are an expert HR data analyst. Extract and standardize Job Description information into the exact JSON format specified. Be precise and comprehensive."
                },
                {
                    "role": "user", 
                    "content": prompt
                }
            ]
            
            response = call_openai_api(messages, model="gpt-4", max_tokens=2000, temperature=0.1)
            
            # Parse JSON response
            try:
                jd_data = json.loads(response)
                standardized_jd = StandardizedJD(**jd_data)
                
                processing_time = time.time() - start_time
                logger.info(f"✅ JD standardization completed in {processing_time:.3f}s: {standardized_jd.job_title}")
                
                return standardized_jd
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JD JSON response: {str(e)}")
                logger.error(f"Response content: {response}")
                raise Exception(f"Invalid JSON response from GPT-4: {str(e)}")
                
            except Exception as e:
                logger.error(f"Failed to validate JD data: {str(e)}")
                raise Exception(f"JD data validation failed: {str(e)}")
        
        except Exception as e:
            logger.error(f"JD standardization failed for {filename}: {str(e)}")
            raise
    
    def _create_cv_standardization_prompt(self, cv_text: str) -> str:
        """Create a structured prompt for CV standardization."""
        return f"""
Extract and standardize the following CV information into a structured JSON format. 

**IMPORTANT**: Respond ONLY with valid JSON - no additional text, explanations, or formatting.

Required JSON structure:
```json
{{
    "full_name": "string - Full name of candidate",
    "email": "string or null - Email address",
    "phone": "string or null - Phone number", 
    "location": "string or null - Current location/city",
    "job_title": "string - Current or most recent job title",
    "experience_level": "entry|junior|mid|senior|lead|principal",
    "years_of_experience": number - Total years of relevant experience,
    "technical_skills": ["array of technical skills"],
    "soft_skills": ["array of soft skills"],
    "tools_and_platforms": ["array of tools/platforms"],
    "programming_languages": ["array of programming languages"],
    "frameworks_libraries": ["array of frameworks/libraries"],
    "education_level": "high_school|associate|bachelor|master|phd|certificate|bootcamp",
    "degrees": ["array of degrees/certifications"],
    "institutions": ["array of schools/universities"],
    "work_experience": [
        {{
            "title": "Job title",
            "company": "Company name", 
            "duration": "Duration string",
            "description": "Brief description"
        }}
    ],
    "projects": [
        {{
            "name": "Project name",
            "description": "Project description",
            "technologies": ["technologies used"]
        }}
    ],
    "professional_summary": "string - Professional summary",
    "key_achievements": ["array of achievements"],
    "industry_experience": ["array of industries"],
    "specializations": ["array of specializations"]
}}
```

CV Content:
{cv_text}

Extract the information and respond with the JSON only:
"""

    def _create_jd_standardization_prompt(self, jd_text: str) -> str:
        """Create a structured prompt for JD standardization."""
        return f"""
Extract and standardize the following Job Description information into a structured JSON format.

**IMPORTANT**: Respond ONLY with valid JSON - no additional text, explanations, or formatting.

Required JSON structure:
```json
{{
    "job_title": "string - Job title/position",
    "company": "string or null - Company name",
    "location": "string or null - Job location",
    "employment_type": "string or null - Employment type",
    "required_experience_level": "entry|junior|mid|senior|lead|principal",
    "min_years_experience": number - Minimum years required,
    "max_years_experience": number or null - Maximum years,
    "required_technical_skills": ["array of must-have technical skills"],
    "preferred_technical_skills": ["array of nice-to-have technical skills"],
    "required_soft_skills": ["array of required soft skills"],
    "required_tools": ["array of required tools/platforms"],
    "programming_languages": ["array of programming languages"],
    "frameworks_libraries": ["array of frameworks/libraries"],
    "required_education": "high_school|associate|bachelor|master|phd|certificate|bootcamp",
    "preferred_degrees": ["array of preferred degrees"],
    "responsibilities": ["array of key responsibilities"],
    "requirements": ["array of job requirements"],
    "benefits": ["array of benefits/perks"],
    "industry": "string or null - Industry/sector",
    "department": "string or null - Department/team",
    "salary_range": {{
        "min": number or null,
        "max": number or null,
        "currency": "string or null"
    }}
}}
```

Job Description Content:
{jd_text}

Extract the information and respond with the JSON only:
"""

# Global instance
_standardization_service: Optional[StandardizationService] = None

def get_standardization_service() -> StandardizationService:
    """Get global standardization service instance."""
    global _standardization_service
    if _standardization_service is None:
        _standardization_service = StandardizationService()
    return _standardization_service