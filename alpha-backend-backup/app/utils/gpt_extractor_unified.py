"""
Unified GPT Extractor - Single LLM System for CV Analyzer
Combines original and optimized systems into one efficient implementation.
Processes full documents without truncation, optimized token usage.
"""
import requests
import json
import os
import logging
import time
from typing import Optional, List, Dict, Any
import re
import hashlib

logger = logging.getLogger(__name__)

# Session for connection reuse
_session = None

# Smart caching with document hashing
_document_cache = {}

def get_session():
    """Get or create a global session for HTTP connection reuse with optimizations"""
    global _session
    if _session is None:
        _session = requests.Session()
        _session.headers.update({
            "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
            "Content-Type": "application/json"
        })
        # Connection pooling optimizations
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=100,  # Pool size
            pool_maxsize=100,      # Max connections per pool
            max_retries=3,         # Retry logic
            pool_block=False       # Don't block when pool is full
        )
        _session.mount('https://', adapter)
        _session.mount('http://', adapter)
    return _session

def call_openai_api_unified(messages: list, model: str = "gpt-5-nano", max_tokens: int = 1200, temperature: float = 0.1) -> str:
    """
    Unified OpenAI API call combining best practices from both systems.
    Features: Connection reuse, retry logic, optimal token usage, error handling.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required")
    
    session = get_session()
    
    # Handle different parameter names for different models
    if "gpt-5" in model:
        data = {
            "model": model,
            "messages": messages,
            "max_completion_tokens": max_tokens,  # GPT-5 uses this parameter
            # GPT-5-nano only supports temperature=1 (default)
        }
    else:
        data = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,  # GPT-4 uses this parameter
            "temperature": temperature
        }
    
    # Retry logic with exponential backoff
    max_retries = 3
    base_delay = 1
    
    for attempt in range(max_retries):
        try:
            logger.info(f"🤖 Making unified OpenAI API call (attempt {attempt + 1}/{max_retries}) with model: {model} (GPT-5-nano)")
            start_time = time.time()
            
            response = session.post(
                "https://api.openai.com/v1/chat/completions",
                json=data,
                timeout=60
            )
            
            elapsed = time.time() - start_time
            logger.info(f"✅ Unified API call completed in {elapsed:.2f}s")
            
            if response.status_code != 200:
                if response.status_code in [429, 503, 502, 504]:
                    # Rate limit or server errors - retry with backoff
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"⚠️ Rate limit/server error {response.status_code}, retrying in {delay}s...")
                    time.sleep(delay)
                    continue
                else:
                    raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")
            
            result = response.json()
            
            if 'choices' not in result or len(result['choices']) == 0:
                raise Exception(f"Invalid OpenAI API response: {result}")
            
            content = result['choices'][0]['message']['content']
            
            if not content or len(content.strip()) == 0:
                raise Exception("OpenAI returned empty response")
            
            logger.info("✅ Unified OpenAI API call successful")
            return content.strip()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error calling OpenAI API: {str(e)}")
            if attempt == max_retries - 1:
                raise Exception(f"Failed to connect to OpenAI API after {max_retries} attempts: {str(e)}")
            
            delay = base_delay * (2 ** attempt)
            logger.info(f"⏳ Retrying in {delay} seconds...")
            time.sleep(delay)
        
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {str(e)}")
            if attempt == max_retries - 1:
                raise Exception(f"OpenAI API call failed after {max_retries} attempts: {str(e)}")
            
            delay = base_delay * (2 ** attempt)
            logger.info(f"⏳ Retrying in {delay} seconds...")
            time.sleep(delay)
    
    raise Exception(f"OpenAI API call failed after {max_retries} attempts")

def standardize_document_unified(text: str, filename: str, document_type: str) -> dict:
    """
    UNIFIED document standardization function for both CVs and Job Descriptions.
    
    Features:
    - Single function handles both CVs and JDs
    - Full document processing (no truncation)
    - Optimized token usage (1200 tokens)
    - Exactly 20 skills, 10 responsibilities
    - Consistent results across all routes
    
    Args:
        text: Complete document text (no truncation)
        filename: Document filename
        document_type: "CV" or "JD"
    
    Returns:
        Standardized data dictionary with skills, responsibilities, etc.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required")
    
    try:
        logger.info(f"🚀 Starting unified {document_type} standardization for {filename}")
        
        # Smart caching: Check if we've already processed this exact document
        document_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
        cache_key = f"{document_type}_{document_hash}"
        
        if cache_key in _document_cache:
            logger.info(f"✅ Using cached standardization for {filename}")
            cached_result = _document_cache[cache_key].copy()
            cached_result["filename"] = filename  # Update filename
            return cached_result
        
        # Process complete document without truncation
        # For very large documents (>100k chars), chunk intelligently
        if len(text) > 100000:
            logger.info(f"📄 Large document detected ({len(text)} chars), using intelligent chunking")
            result = _process_large_document(text, filename, document_type)
        else:
            result = _process_standard_document(text, filename, document_type)
        
        # Cache the result for future use
        _document_cache[cache_key] = result.copy()
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Unified {document_type} standardization failed for {filename}: {str(e)}")
        raise Exception(f"Unified standardization failed for {filename}: {str(e)}")

def _process_standard_document(text: str, filename: str, document_type: str) -> dict:
    """Process standard-sized documents (under 100k chars)."""
    # Create unified prompt for both CVs and JDs
    if document_type.upper() == "CV":
        prompt = _create_cv_unified_prompt(text)
    elif document_type.upper() == "JD":
        prompt = _create_jd_unified_prompt(text)
    else:
        raise ValueError(f"Invalid document_type: {document_type}. Must be 'CV' or 'JD'")
    
    # Single API call with optimized settings
    content = call_openai_api_unified(
        messages=[{"role": "user", "content": prompt}], 
        model="gpt-4o-mini", 
        max_tokens=1200,  # Balanced cost/quality
        temperature=0.1   # Consistent results
    )
    
    # Parse and validate response
    result = _parse_unified_response(content, filename, document_type)
    
    # Ensure exactly 20 skills and 10 responsibilities
    result = _validate_and_fix_counts(result, document_type)
    
    # Add processing metadata
    result["processing_metadata"] = {
                    "gpt_model_used": "gpt-5-nano",
        "processing_method": "unified_standardization",
        "document_type": document_type,
        "standardization_version": "3.0-unified",
        "skills_count": len(result.get("skills", [])),
        "responsibilities_count": len(result.get("responsibilities", []))
    }
    
    logger.info(f"✅ Unified {document_type} standardization completed for {filename}")
    return result

def _create_cv_unified_prompt(text: str) -> str:
    """Create unified prompt for CV processing."""
    return f"""
Extract CV information in this EXACT format. You MUST provide exactly 20 skills and exactly 10 responsibility statements.

**CRITICAL**: Process the ENTIRE document - do not truncate or limit analysis.

**PERSONAL INFORMATION:**
- Full Name: [Extract or use filename if not found]
- Email: [Extract if available]
- Phone: [Extract if available]

**SKILLS:**
List exactly 20 skills from this CV. Focus on the most recent 2 jobs for 95%+ correlation to actual work done. If fewer than 20 explicit skills are mentioned, add relevant skills based on the candidate's experience and role to reach exactly 20. Include technical, professional, and transferable skills.
- [Skill 1]
- [Skill 2]
- [Continue until exactly 20 skills]

**EXPERIENCE:**
Write exactly 10 numbered statements describing what the candidate has done in their most recent 2 positions. Focus on actual accomplishments and responsibilities from recent work. If the CV has fewer than 10 clear responsibilities, create additional relevant ones based on typical duties for their roles.
1. [Responsibility 1]
2. [Responsibility 2]
[Continue until exactly 10 numbered items]

**YEARS OF EXPERIENCE:**
[Calculate total relevant years from recent positions]

**JOB TITLE:**
[Current or most recent position]

INPUT CV:
{text}
"""

def _create_jd_unified_prompt(text: str) -> str:
    """Create unified prompt for Job Description processing."""
    return f"""
Extract job requirements in this EXACT format. You MUST provide exactly 20 skills and exactly 10 responsibility sentences.

**CRITICAL**: Process the ENTIRE document - do not truncate or limit analysis.

**SKILLS:**
List exactly 20 technical skills, tools, or technologies required for this job. If the job description has fewer than 20 explicit skills, add relevant skills based on the job role and industry standards to reach exactly 20. Each skill should be specific, relevant, and actionable.
- [Skill 1]
- [Skill 2]
- [Continue until exactly 20 skills]

**RESPONSIBILITIES:**
Write exactly 10 complete sentences describing job responsibilities and requirements. If the original has fewer than 10, expand based on typical duties for this role. Focus on key expectations and deliverables.
1. [Responsibility 1]
2. [Responsibility 2]
[Continue until exactly 10 numbered sentences]

**YEARS OF EXPERIENCE:**
[Required years of experience mentioned]

**JOB TITLE:**
[Standardized job title]

INPUT JOB DESCRIPTION:
{text}
"""

def _process_large_document(text: str, filename: str, document_type: str) -> dict:
    """Process very large documents using intelligent chunking."""
    logger.info(f"📑 Processing large {document_type} document with chunking: {filename}")
    
    # Split into chunks of ~100k characters with overlap
    chunk_size = 100000
    overlap = 5000
    chunks = []
    
    for i in range(0, len(text), chunk_size - overlap):
        chunk = text[i:i + chunk_size]
        chunks.append(chunk)
    
    logger.info(f"📄 Split into {len(chunks)} chunks for processing")
    
    # Process each chunk
    chunk_results = []
    for i, chunk in enumerate(chunks):
        logger.info(f"🔍 Processing chunk {i+1}/{len(chunks)}")
        try:
            result = standardize_document_unified(chunk, f"{filename}_chunk_{i+1}", document_type)
            chunk_results.append(result)
        except Exception as e:
            logger.warning(f"⚠️ Chunk {i+1} failed: {str(e)}")
            continue
    
    if not chunk_results:
        raise Exception("All chunks failed to process")
    
    # Merge results from all chunks
    return _merge_chunk_results(chunk_results, document_type)

def _merge_chunk_results(chunk_results: List[dict], document_type: str) -> dict:
    """Merge results from multiple chunks into unified result."""
    if not chunk_results:
        raise Exception("No chunk results to merge")
    
    # Start with first chunk
    merged = chunk_results[0].copy()
    
    # Collect all skills and responsibilities
    all_skills = set()
    all_responsibilities = []
    
    for result in chunk_results:
        # Merge skills (deduplicate)
        if "skills" in result:
            all_skills.update(result["skills"])
        
        # Merge responsibilities (maintain order, deduplicate)
        if "responsibilities" in result:
            for resp in result["responsibilities"]:
                if resp not in all_responsibilities:
                    all_responsibilities.append(resp)
    
    # Update merged result
    merged["skills"] = list(all_skills)[:20]  # Limit to 20
    merged["responsibilities"] = all_responsibilities[:10]  # Limit to 10
    
    # Ensure counts are correct
    merged = _validate_and_fix_counts(merged, document_type)
    
    return merged

def _parse_unified_response(content: str, filename: str, document_type: str) -> dict:
    """Parse unified response for both CVs and JDs."""
    try:
        # Extract sections using regex
        result = {}
        
        if document_type.upper() == "CV":
            # Parse CV response
            result = _parse_cv_response(content, filename)
        else:
            # Parse JD response
            result = _parse_jd_response(content, filename)
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error parsing unified response for {filename}: {str(e)}")
        raise Exception(f"Failed to parse unified response: {str(e)}")

def _parse_cv_response(content: str, filename: str) -> dict:
    """Parse CV response into structured format."""
    # Extract personal information
    personal_match = re.search(r'\*\*PERSONAL INFORMATION:\*\*\s*\n(.*?)(?=\*\*SKILLS:\*\*|\*\*EXPERIENCE:\*\*|\Z)', content, re.DOTALL)
    personal_text = personal_match.group(1).strip() if personal_match else ""
    
    # Parse personal info
    full_name = "Not provided"
    email = "Not provided"  
    phone = "Not provided"
    
    for line in personal_text.split('\n'):
        line = line.strip()
        if line.startswith('- Full Name:'):
            full_name = line.replace('- Full Name:', '').strip()
            if full_name.startswith('[') and full_name.endswith(']'):
                full_name = full_name[1:-1].strip()
            if not full_name or full_name.lower() in ['not provided', 'not available', 'n/a']:
                full_name = filename.replace('.pdf', '').replace('.docx', '').replace('.txt', '').replace('_', ' ').replace('-', ' ').title()
        elif line.startswith('- Email:'):
            email = line.replace('- Email:', '').strip()
            if email.startswith('[') and email.endswith(']'):
                email = email[1:-1].strip()
        elif line.startswith('- Phone:'):
            phone = line.replace('- Phone:', '').strip()
            if phone.startswith('[') and phone.endswith(']'):
                phone = phone[1:-1].strip()
    
    # Extract skills
    skills_match = re.search(r'\*\*SKILLS:\*\*\s*\n(.*?)(?=\*\*EXPERIENCE:\*\*|\*\*YEARS OF EXPERIENCE:\*\*|\*\*JOB TITLE:\*\*|\Z)', content, re.DOTALL)
    skills_text = skills_match.group(1).strip() if skills_match else ""
    skills = []
    for line in skills_text.split('\n'):
        line = line.strip()
        if line.startswith('- '):
            skill = line[2:].strip()
            if skill and len(skill) > 1:
                skills.append(skill)
    
    # Extract experience (responsibilities)
    exp_match = re.search(r'\*\*EXPERIENCE:\*\*\s*\n(.*?)(?=\*\*YEARS OF EXPERIENCE:\*\*|\*\*JOB TITLE:\*\*|\Z)', content, re.DOTALL)
    experience_text = exp_match.group(1).strip() if exp_match else ""
    
    responsibilities = []
    for line in experience_text.split('\n'):
        line = line.strip()
        if re.match(r'^\d+\.\s+', line):
            responsibility = re.sub(r'^\d+\.\s+', '', line).strip()
            if responsibility and len(responsibility) > 5:
                responsibilities.append(responsibility)
    
    # Extract years of experience
    years_match = re.search(r'\*\*YEARS OF EXPERIENCE:\*\*\s*\n(.*?)(?=\*\*JOB TITLE:\*\*|\Z)', content, re.DOTALL)
    years_of_experience = years_match.group(1).strip() if years_match else "Not specified"
    
    # Extract job title
    title_match = re.search(r'\*\*JOB TITLE:\*\*\s*\n(.*?)(?=\Z)', content, re.DOTALL)
    job_title = title_match.group(1).strip() if title_match else "Not specified"
    
    return {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "skills": skills,
        "responsibilities": responsibilities,
        "years_of_experience": years_of_experience,
        "job_title": job_title,
        "filename": filename,
        "standardization_method": "unified_cv"
    }

def _parse_jd_response(content: str, filename: str) -> dict:
    """Parse JD response into structured format."""
    # Extract skills
    skills_match = re.search(r'\*\*SKILLS:\*\*\s*\n(.*?)(?=\*\*RESPONSIBILITIES:\*\*|\*\*YEARS OF EXPERIENCE:\*\*|\*\*JOB TITLE:\*\*|\Z)', content, re.DOTALL)
    skills_text = skills_match.group(1).strip() if skills_match else ""
    skills = []
    for line in skills_text.split('\n'):
        line = line.strip()
        if line.startswith('- '):
            skill = line[2:].strip()
            if skill and len(skill) > 1:
                skills.append(skill)
    
    # Extract responsibilities
    resp_match = re.search(r'\*\*RESPONSIBILITIES:\*\*\s*\n(.*?)(?=\*\*YEARS OF EXPERIENCE:\*\*|\*\*JOB TITLE:\*\*|\Z)', content, re.DOTALL)
    responsibilities_text = resp_match.group(1).strip() if resp_match else ""
    
    responsibilities = []
    for line in responsibilities_text.split('\n'):
        line = line.strip()
        if re.match(r'^\d+\.\s+', line):
            responsibility = re.sub(r'^\d+\.\s+', '', line).strip()
            if responsibility and len(responsibility) > 10:
                responsibilities.append(responsibility)
    
    # Extract years of experience
    years_match = re.search(r'\*\*YEARS OF EXPERIENCE:\*\*\s*\n(.*?)(?=\*\*JOB TITLE:\*\*|\Z)', content, re.DOTALL)
    years_of_experience = years_match.group(1).strip() if years_match else "Not specified"
    
    # Extract job title
    title_match = re.search(r'\*\*JOB TITLE:\*\*\s*\n(.*?)(?=\Z)', content, re.DOTALL)
    job_title = title_match.group(1).strip() if title_match else "Not specified"
    
    return {
        "skills": skills,
        "responsibilities": responsibilities,
        "responsibility_sentences": responsibilities,  # For backward compatibility
        "years_of_experience": years_of_experience,
        "job_title": job_title,
        "filename": filename,
        "standardization_method": "unified_jd"
    }

def _validate_and_fix_counts(result: dict, document_type: str) -> dict:
    """Ensure exactly 20 skills and 10 responsibilities."""
    # Fix skills count
    skills = result.get("skills", [])
    if len(skills) < 20:
        # Add generic skills to reach 20
        if document_type.upper() == "CV":
            generic_skills = [
                "Communication", "Problem Solving", "Teamwork", "Time Management",
                "Critical Thinking", "Attention to Detail", "Adaptability", "Leadership",
                "Customer Service", "Microsoft Office", "Email Management", "Research",
                "Data Entry", "Project Coordination", "Quality Control", "Documentation",
                "Process Improvement", "Training", "Multitasking", "Organization"
            ]
        else:  # JD
            generic_skills = [
                "Communication", "Problem Solving", "Teamwork", "Time Management",
                "Critical Thinking", "Attention to Detail", "Adaptability", "Leadership",
                "Analytical Skills", "Project Management", "Technical Documentation",
                "Quality Assurance", "Process Improvement", "Client Relations",
                "Data Analysis", "Research", "Planning", "Organization",
                "Innovation", "Strategic Thinking"
            ]
        
        needed = 20 - len(skills)
        skills.extend(generic_skills[:needed])
    elif len(skills) > 20:
        skills = skills[:20]
    
    result["skills"] = skills
    
    # Fix responsibilities count
    responsibilities = result.get("responsibilities", [])
    if len(responsibilities) < 10:
        # Add generic responsibilities to reach 10
        if document_type.upper() == "CV":
            generic_responsibilities = [
                "Collaborated with team members to achieve project goals and deadlines.",
                "Maintained accurate records and documentation for all assigned tasks.",
                "Participated in regular team meetings and training sessions.",
                "Provided excellent customer service and support to clients and colleagues.",
                "Assisted with quality control and process improvement initiatives.",
                "Supported daily operations and administrative tasks as needed.",
                "Communicated effectively with stakeholders at various organizational levels.",
                "Contributed to a positive work environment through professional conduct.",
                "Adapted to changing priorities and requirements in a dynamic work environment.",
                "Completed assigned tasks efficiently while maintaining high quality standards."
            ]
        else:  # JD
            generic_responsibilities = [
                "Collaborate with cross-functional teams to achieve project objectives.",
                "Maintain high standards of quality and attention to detail in all work.",
                "Participate in continuous learning and professional development activities.",
                "Communicate effectively with stakeholders at all levels.",
                "Contribute to process improvements and operational efficiency.",
                "Ensure compliance with industry standards and best practices.",
                "Support team goals and organizational objectives.",
                "Manage multiple priorities and deadlines effectively.",
                "Provide technical expertise and guidance as needed.",
                "Maintain documentation and reporting as required."
            ]
        
        needed = 10 - len(responsibilities)
        responsibilities.extend(generic_responsibilities[:needed])
    elif len(responsibilities) > 10:
        responsibilities = responsibilities[:10]
    
    result["responsibilities"] = responsibilities
    
    # For JDs, also update responsibility_sentences for backward compatibility
    if document_type.upper() == "JD":
        result["responsibility_sentences"] = responsibilities
    
    return result

# Convenience functions for backward compatibility
def standardize_cv_unified(text: str, filename: str) -> dict:
    """Unified CV standardization function."""
    return standardize_document_unified(text, filename, "CV")

def standardize_jd_unified(text: str, filename: str) -> dict:
    """Unified JD standardization function."""
    return standardize_document_unified(text, filename, "JD")
