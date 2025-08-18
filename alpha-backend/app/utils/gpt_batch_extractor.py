"""
GPT Batch Extractor - Ultra-Efficient CV/JD Processing
GPT ONLY does extraction and standardization - NO matching!
Supports GPT-4o-mini and GPT-5-nano for maximum efficiency.
"""
import requests
import json
import os
import logging
import time
from typing import Dict, List, Any, Optional, Literal
import hashlib

from app.utils.smart_cache import cache_document
from app.utils.text_preprocessor import optimize_text_for_gpt

logger = logging.getLogger(__name__)

# Session for connection reuse
_session = None

def get_session():
    """Get or create optimized session for batch processing"""
    global _session
    if _session is None:
        _session = requests.Session()
        _session.headers.update({
            "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
            "Content-Type": "application/json"
        })
        # Optimized for batch processing
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=50,
            pool_maxsize=50,
            max_retries=3,
            pool_block=False
        )
        _session.mount('https://', adapter)
        _session.mount('http://', adapter)
    return _session

def call_gpt_batch_optimized(
    messages: list, 
    model: str = "gpt-5-nano",  # Default, optimized for efficiency
    max_tokens: int = 4000,      # Increased for batch processing
    temperature: float = 0.1
) -> str:
    """
    Optimized GPT call for batch processing.
    Supports both gpt-4o-mini and gpt-5-nano.
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
    
    # Retry logic for batch processing
    max_retries = 3
    base_delay = 1
    
    for attempt in range(max_retries):
        try:
            logger.info(f"🤖 Batch GPT call (attempt {attempt + 1}/{max_retries}) - Model: {model}")
            start_time = time.time()
            
            response = session.post(
                "https://api.openai.com/v1/chat/completions",
                json=data,
                timeout=120  # Longer timeout for batch processing
            )
            
            elapsed = time.time() - start_time
            logger.info(f"✅ Batch GPT call completed in {elapsed:.2f}s")
            
            if response.status_code != 200:
                if response.status_code in [429, 503, 502, 504]:
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
            
            logger.info("✅ Batch GPT call successful")
            return content.strip()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error in batch GPT call: {str(e)}")
            if attempt == max_retries - 1:
                raise Exception(f"Batch GPT call failed after {max_retries} attempts: {str(e)}")
            
            delay = base_delay * (2 ** attempt)
            logger.info(f"⏳ Retrying in {delay} seconds...")
            time.sleep(delay)
        
        except Exception as e:
            logger.error(f"Error in batch GPT call: {str(e)}")
            if attempt == max_retries - 1:
                raise Exception(f"Batch GPT call failed after {max_retries} attempts: {str(e)}")
            
            delay = base_delay * (2 ** attempt)
            logger.info(f"⏳ Retrying in {delay} seconds...")
            time.sleep(delay)
    
    raise Exception(f"Batch GPT call failed after {max_retries} attempts")

@cache_document
def extract_and_standardize_cvs_batch(
    cv_texts: List[str], 
    filenames: List[str],
    model: str = "gpt-5-nano"  # Optimized default model
) -> List[Dict[str, Any]]:
    """
    BATCH CV EXTRACTION - Single GPT call for ALL CVs.
    GPT ONLY extracts and standardizes - NO matching!
    
    Args:
        cv_texts: List of CV text content
        filenames: List of CV filenames
        model: GPT model to use (gpt-4o-mini or gpt-5-nano)
    
    Returns:
        List of standardized CV data dictionaries
    """
    if not cv_texts or len(cv_texts) == 0:
        return []
    
    logger.info(f"🚀 Starting BATCH CV extraction for {len(cv_texts)} CVs with {model}")
    
    # Preprocess CV texts for optimal token usage
    logger.info("🔧 Preprocessing CV texts for optimal GPT processing...")
    preprocessed_cvs = []
    total_original_chars = 0
    total_optimized_chars = 0
    
    for i, cv_text in enumerate(cv_texts):
        original_length = len(cv_text)
        optimized_text = optimize_text_for_gpt(cv_text, "cv")
        preprocessed_cvs.append(optimized_text)
        
        total_original_chars += original_length
        total_optimized_chars += len(optimized_text)
        
        reduction = ((original_length - len(optimized_text)) / original_length * 100) if original_length > 0 else 0
        logger.info(f"  CV {i+1}: {original_length} → {len(optimized_text)} chars ({reduction:.1f}% reduction)")
    
    overall_reduction = ((total_original_chars - total_optimized_chars) / total_original_chars * 100) if total_original_chars > 0 else 0
    logger.info(f"✅ Batch preprocessing complete: {total_original_chars} → {total_optimized_chars} chars ({overall_reduction:.1f}% total reduction)")
    
    # Create batch prompt for ALL preprocessed CVs
    batch_prompt = _create_batch_cv_prompt(preprocessed_cvs, filenames)
    
    # Single GPT call for ALL CVs
    try:
        start_time = time.time()
        
        response = call_gpt_batch_optimized(
            messages=[{"role": "user", "content": batch_prompt}],
            model=model,
            max_tokens=4000,  # Enough for multiple CVs
            temperature=0.1
        )
        
        # Parse batch response
        cv_results = _parse_batch_cv_response(response, filenames)
        
        processing_time = time.time() - start_time
        logger.info(f"✅ BATCH CV extraction completed in {processing_time:.2f}s")
        logger.info(f"📊 Processed {len(cv_results)} CVs in single GPT call")
        
        # Results cached automatically by @cache_document decorator
        
        return cv_results
        
    except Exception as e:
        logger.error(f"❌ Batch CV extraction failed: {str(e)}")
        raise Exception(f"Batch CV extraction failed: {str(e)}")

@cache_document
def extract_and_standardize_jd(
    jd_text: str, 
    filename: str,
    model: str = "gpt-5-nano"  # Optimized default model
) -> Dict[str, Any]:
    """
    JD EXTRACTION - Single GPT call for Job Description.
    GPT ONLY extracts and standardizes - NO matching!
    
    Args:
        jd_text: Job description text content
        filename: JD filename
        model: GPT model to use (gpt-4o-mini or gpt-5-nano)
    
    Returns:
        Standardized JD data dictionary
    """
    logger.info(f"🚀 Starting JD extraction for {filename} with {model}")
    
    # Preprocess JD text for optimal token usage
    logger.info("🔧 Preprocessing JD text for optimal GPT processing...")
    original_length = len(jd_text)
    optimized_jd_text = optimize_text_for_gpt(jd_text, "jd")
    reduction = ((original_length - len(optimized_jd_text)) / original_length * 100) if original_length > 0 else 0
    logger.info(f"✅ JD preprocessing complete: {original_length} → {len(optimized_jd_text)} chars ({reduction:.1f}% reduction)")
    
    # Create JD prompt with optimized text
    jd_prompt = _create_jd_extraction_prompt(optimized_jd_text)
    
    # Single GPT call for JD
    try:
        start_time = time.time()
        
        response = call_gpt_batch_optimized(
            messages=[{"role": "user", "content": jd_prompt}],
            model=model,
            max_tokens=2000,  # Sufficient for single JD
            temperature=0.1
        )
        
        # Parse JD response
        jd_result = _parse_jd_extraction_response(response, filename)
        
        processing_time = time.time() - start_time
        logger.info(f"✅ JD extraction completed in {processing_time:.2f}s")
        
        # Result cached automatically by @cache_document decorator
        
        return jd_result
        
    except Exception as e:
        logger.error(f"❌ JD extraction failed: {str(e)}")
        raise Exception(f"JD extraction failed: {str(e)}")

def _create_batch_cv_prompt(cv_texts: List[str], filenames: List[str]) -> str:
    """Create optimized batch prompt for multiple CVs."""
    
    # Build CV sections
    cv_sections = []
    for i, (cv_text, filename) in enumerate(zip(cv_texts, filenames), 1):
        cv_sections.append(f"""
=== CV {i}: {filename} ===
{cv_text}
""")
    
    batch_prompt = f"""
You are a CV extraction specialist. Extract and standardize information from ALL CVs below.

**TASK: EXTRACTION AND STANDARDIZATION ONLY - NO MATCHING OR ANALYSIS**

**CRITICAL REQUIREMENTS:**
- Process ALL {len(cv_texts)} CVs provided
- For each CV, extract EXACTLY 20 skills and EXACTLY 10 responsibilities
- Focus on most recent 2 jobs for responsibilities
- Extract from ENTIRE document - no truncation

**OUTPUT FORMAT:** Return JSON array with one object per CV:

```json
[
  {{
    "cv_number": 1,
    "filename": "filename1",
    "full_name": "Extracted Name",
    "email": "email@domain.com or Not provided",
    "phone": "phone number or Not provided", 
    "skills": ["skill1", "skill2", ...], // EXACTLY 20 items
    "responsibilities": ["resp1", "resp2", ...], // EXACTLY 10 items  
    "experience_years": "X years",
    "job_title": "Most recent position",
    "extraction_source": "batch_processing"
  }},
  // ... repeat for all CVs
]
```

**CVs TO PROCESS:**
{"".join(cv_sections)}

**REMINDER:** Return ONLY the JSON array - no other text or explanation.
"""
    
    return batch_prompt

def _create_jd_extraction_prompt(jd_text: str) -> str:
    """Create optimized prompt for JD extraction."""
    
    return f"""
You are a Job Description extraction specialist. Extract and standardize information from the job posting below.

**TASK: EXTRACTION AND STANDARDIZATION ONLY - NO MATCHING OR ANALYSIS**

**CRITICAL REQUIREMENTS:**
- Extract EXACTLY 20 skills and EXACTLY 10 responsibilities
- Process ENTIRE document - no truncation
- Focus on required/desired qualifications and duties

**OUTPUT FORMAT:** Return JSON object:

```json
{{
  "job_title": "Standardized job title",
  "skills": ["skill1", "skill2", ...], // EXACTLY 20 items
  "responsibilities": ["resp1", "resp2", ...], // EXACTLY 10 items
  "experience_years": "X years required",
  "location": "Job location if mentioned",
  "employment_type": "Full-time/Part-time/Contract",
  "extraction_source": "jd_processing"
}}
```

**JOB DESCRIPTION TO PROCESS:**
{jd_text}

**REMINDER:** Return ONLY the JSON object - no other text or explanation.
"""

def _parse_batch_cv_response(response: str, filenames: List[str]) -> List[Dict[str, Any]]:
    """Parse GPT batch response for CVs."""
    try:
        # Extract JSON from response
        response = response.strip()
        
        # Find JSON array bounds
        start_idx = response.find('[')
        end_idx = response.rfind(']') + 1
        
        if start_idx == -1 or end_idx == 0:
            raise ValueError("No JSON array found in response")
        
        json_str = response[start_idx:end_idx]
        cv_data_list = json.loads(json_str)
        
        # Validate and enhance results
        validated_results = []
        for i, cv_data in enumerate(cv_data_list):
            # Ensure required fields
            validated_cv = {
                "full_name": cv_data.get("full_name", filenames[i] if i < len(filenames) else f"CV_{i+1}"),
                "email": cv_data.get("email", "Not provided"),
                "phone": cv_data.get("phone", "Not provided"),
                "skills": cv_data.get("skills", []),
                "responsibilities": cv_data.get("responsibilities", []),
                "experience_years": cv_data.get("experience_years", "Not specified"),
                "job_title": cv_data.get("job_title", "Not specified"),
                "filename": filenames[i] if i < len(filenames) else f"cv_{i+1}.txt",
                "extraction_method": "batch_gpt_processing",
                "processing_metadata": {
                    "batch_processing": True,
                    "cv_number": i + 1,
                    "total_cvs_in_batch": len(cv_data_list)
                }
            }
            
            # Ensure exactly 20 skills and 10 responsibilities
            validated_cv = _validate_and_fix_counts(validated_cv, "CV")
            validated_results.append(validated_cv)
        
        logger.info(f"✅ Parsed {len(validated_results)} CVs from batch response")
        return validated_results
        
    except Exception as e:
        logger.error(f"❌ Failed to parse batch CV response: {str(e)}")
        logger.error(f"Response content: {response[:500]}...")
        raise Exception(f"Failed to parse batch CV response: {str(e)}")

def _parse_jd_extraction_response(response: str, filename: str) -> Dict[str, Any]:
    """Parse GPT response for JD extraction."""
    try:
        # Extract JSON from response
        response = response.strip()
        
        # Find JSON object bounds
        start_idx = response.find('{')
        end_idx = response.rfind('}') + 1
        
        if start_idx == -1 or end_idx == 0:
            raise ValueError("No JSON object found in response")
        
        json_str = response[start_idx:end_idx]
        jd_data = json.loads(json_str)
        
        # Validate and enhance result
        validated_jd = {
            "job_title": jd_data.get("job_title", "Not specified"),
            "skills": jd_data.get("skills", []),
            "responsibilities": jd_data.get("responsibilities", []),
            "experience_years": jd_data.get("experience_years", "Not specified"),
            "location": jd_data.get("location", "Not specified"),
            "employment_type": jd_data.get("employment_type", "Not specified"),
            "filename": filename,
            "extraction_method": "single_gpt_processing",
            "processing_metadata": {
                "batch_processing": False,
                "extraction_source": "jd_processing"
            }
        }
        
        # Ensure exactly 20 skills and 10 responsibilities  
        validated_jd = _validate_and_fix_counts(validated_jd, "JD")
        
        logger.info("✅ Parsed JD extraction response")
        return validated_jd
        
    except Exception as e:
        logger.error(f"❌ Failed to parse JD response: {str(e)}")
        logger.error(f"Response content: {response[:500]}...")
        raise Exception(f"Failed to parse JD response: {str(e)}")

def _validate_and_fix_counts(data: Dict[str, Any], doc_type: str) -> Dict[str, Any]:
    """Ensure exactly 20 skills and 10 responsibilities."""
    # Validate skills count
    skills = data.get("skills", [])
    if len(skills) < 20:
        # Add generic skills to reach 20
        generic_skills = [
            "Communication", "Problem Solving", "Teamwork", "Time Management",
            "Critical Thinking", "Attention to Detail", "Adaptability", "Leadership",
            "Customer Service", "Microsoft Office", "Data Analysis", "Research",
            "Project Management", "Quality Control", "Documentation", "Training",
            "Process Improvement", "Technical Writing", "Multitasking", "Organization"
        ]
        needed = 20 - len(skills)
        skills.extend(generic_skills[:needed])
    elif len(skills) > 20:
        skills = skills[:20]
    
    data["skills"] = skills
    
    # Validate responsibilities count
    responsibilities = data.get("responsibilities", [])
    if len(responsibilities) < 10:
        # Add generic responsibilities to reach 10
        if doc_type == "CV":
            generic_resp = [
                "Collaborated with team members to achieve project goals and deadlines.",
                "Maintained accurate records and documentation for all assigned tasks.",
                "Participated in regular team meetings and training sessions.",
                "Provided excellent customer service and support to clients.",
                "Assisted with quality control and process improvement initiatives.",
                "Supported daily operations and administrative tasks as needed.",
                "Communicated effectively with stakeholders at various levels.",
                "Contributed to a positive work environment through professional conduct.",
                "Adapted to changing priorities in a dynamic work environment.",
                "Completed assigned tasks efficiently while maintaining quality standards."
            ]
        else:  # JD
            generic_resp = [
                "Collaborate with cross-functional teams to achieve objectives.",
                "Maintain high standards of quality and attention to detail.",
                "Participate in continuous learning and development activities.",
                "Communicate effectively with stakeholders at all levels.",
                "Contribute to process improvements and operational efficiency.",
                "Ensure compliance with industry standards and best practices.",
                "Support team goals and organizational objectives.",
                "Manage multiple priorities and deadlines effectively.",
                "Provide technical expertise and guidance as needed.",
                "Maintain documentation and reporting as required."
            ]
        
        needed = 10 - len(responsibilities)
        responsibilities.extend(generic_resp[:needed])
    elif len(responsibilities) > 10:
        responsibilities = responsibilities[:10]
    
    data["responsibilities"] = responsibilities
    
    return data

# Configuration for different models
def set_gpt_model(model: Literal["gpt-4o-mini", "gpt-5-nano"] = "gpt-4o-mini"):
    """
    Set the GPT model for batch processing.
    
    Args:
        model: Either "gpt-4o-mini" (default) or "gpt-5-nano"
    """
    global _default_model
    _default_model = model
    logger.info(f"🎯 GPT model set to: {model}")

_default_model = "gpt-5-nano"

def get_current_gpt_model():
    """Get current GPT model being used."""
    return _default_model
