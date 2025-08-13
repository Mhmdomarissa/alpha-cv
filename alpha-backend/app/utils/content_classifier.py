"""
Content Classification Utility
Automatically classifies documents as CVs or Job Descriptions based on content analysis.
"""

import re
from typing import Literal, Tuple
import logging

logger = logging.getLogger(__name__)

ContentType = Literal["cv", "jd"]

def classify_document_content(text: str, filename: str = "") -> Tuple[ContentType, float]:
    """
    Classify document content as CV or Job Description.
    
    Args:
        text: The document text content
        filename: Optional filename for additional context
        
    Returns:
        Tuple of (classification, confidence_score)
        confidence_score is between 0.0 and 1.0
    """
    
    # Normalize text for analysis
    text_lower = text.lower()
    
    # CV indicators
    cv_indicators = {
        # Personal information patterns
        'personal_info': [
            r'\b(email|phone|address|mobile|cell)\b.*[@+]',
            r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b',  # Phone patterns
            r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b',  # Email patterns
        ],
        
        # CV-specific sections
        'cv_sections': [
            r'\b(work experience|professional experience|employment history)\b',
            r'\b(education|academic background|qualifications)\b',
            r'\b(skills|technical skills|core competencies)\b',
            r'\b(achievements|accomplishments|awards)\b',
            r'\b(certifications|licenses)\b',
            r'\b(references|portfolio)\b'
        ],
        
        # CV language patterns
        'cv_language': [
            r'\bi (have|am|was|worked|developed|managed|led|created)\b',
            r'\bmy (experience|background|skills|role)\b',
            r'\byears? of experience\b',
            r'\bcurrent (position|role|job)\b'
        ],
        
        # Personal naming patterns
        'personal_names': [
            r'^\s*[A-Z][a-z]+ [A-Z][a-z]+\s*$',  # Name at start
            r'\bcandidate\b',
            r'\bresume\b',
            r'\bcv\b'
        ]
    }
    
    # Job Description indicators
    jd_indicators = {
        # JD-specific sections
        'jd_sections': [
            r'\b(job description|position description|role description)\b',
            r'\b(requirements|qualifications required|must have)\b',
            r'\b(responsibilities|duties|key responsibilities)\b',
            r'\b(company (overview|description|profile))\b',
            r'\b(benefits|compensation|salary)\b',
            r'\b(equal opportunity|diversity)\b'
        ],
        
        # JD language patterns
        'jd_language': [
            r'\bwe are (looking|seeking|hiring)\b',
            r'\bthe (candidate|applicant|successful candidate) (will|must|should)\b',
            r'\brequired (skills|experience|qualifications)\b',
            r'\bideal candidate\b',
            r'\bjoin our team\b',
            r'\bapply (now|today)\b'
        ],
        
        # Company/hiring patterns
        'company_patterns': [
            r'\bour (company|organization|team)\b',
            r'\bwe offer\b',
            r'\bcompany benefits\b',
            r'\bhiring\b'
        ]
    }
    
    # Calculate scores
    cv_score = 0
    jd_score = 0
    
    # Check CV indicators
    for category, patterns in cv_indicators.items():
        for pattern in patterns:
            matches = len(re.findall(pattern, text_lower))
            if category == 'personal_info':
                cv_score += matches * 3  # Strong indicator
            elif category == 'cv_sections':
                cv_score += matches * 2
            else:
                cv_score += matches
    
    # Check JD indicators
    for category, patterns in jd_indicators.items():
        for pattern in patterns:
            matches = len(re.findall(pattern, text_lower))
            if category == 'jd_language':
                jd_score += matches * 3  # Strong indicator
            elif category == 'jd_sections':
                jd_score += matches * 2
            else:
                jd_score += matches
    
    # Filename-based hints
    filename_lower = filename.lower()
    if any(word in filename_lower for word in ['resume', 'cv', 'curriculum']):
        cv_score += 2
    elif any(word in filename_lower for word in ['job', 'position', 'role', 'description', 'jd']):
        jd_score += 2
    
    # Person name patterns in filename (strong CV indicator)
    if re.match(r'^[A-Z][a-z]+ [A-Z][a-z]+', filename):
        cv_score += 3
    
    # Determine classification
    total_score = cv_score + jd_score
    if total_score == 0:
        # Default to CV if no clear indicators
        return "cv", 0.5
    
    if cv_score > jd_score:
        confidence = cv_score / total_score
        return "cv", confidence
    else:
        confidence = jd_score / total_score
        return "jd", confidence

def validate_document_classification(text: str, filename: str, claimed_type: ContentType) -> Tuple[bool, ContentType, float]:
    """
    Validate if a document is correctly classified.
    
    Args:
        text: Document content
        filename: Document filename
        claimed_type: What the document is claimed to be
        
    Returns:
        Tuple of (is_correct, actual_type, confidence)
    """
    actual_type, confidence = classify_document_content(text, filename)
    is_correct = actual_type == claimed_type
    
    logger.info(f"Classification validation for {filename}: "
               f"Claimed={claimed_type}, Detected={actual_type}, "
               f"Confidence={confidence:.2f}, Correct={is_correct}")
    
    return is_correct, actual_type, confidence

# Convenience functions
def is_cv(text: str, filename: str = "") -> bool:
    """Check if content appears to be a CV/Resume."""
    doc_type, confidence = classify_document_content(text, filename)
    return doc_type == "cv" and confidence > 0.6

def is_job_description(text: str, filename: str = "") -> bool:
    """Check if content appears to be a Job Description."""
    doc_type, confidence = classify_document_content(text, filename)
    return doc_type == "jd" and confidence > 0.6 