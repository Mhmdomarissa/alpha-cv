import requests
import json
import os
import logging
import time
from typing import Optional
import re
from app.core.cache import gpt_response_cache, get_gpt_cache_key

logger = logging.getLogger(__name__)

# ============================================================================
# UPDATED GPT EXTRACTOR - FULL TEXT PROCESSING & STANDARDIZED EMBEDDING
# ============================================================================

def call_openai_api(messages: list, model: str = "gpt-4o-mini", max_tokens: int = 2000, temperature: float = 0.1) -> str:
    """Call OpenAI API with robust error handling, retry logic with exponential backoff, and caching."""
    import time
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required")
    
    # TEMPORARILY DISABLE CACHE TO FIX CV EXTRACTION BUG
    # Check cache first
    # cache_key = get_gpt_cache_key(str(messages), model)
    # cached_response = gpt_response_cache.get(cache_key)
    # if cached_response:
    #     logger.info("💾 Using cached GPT response")
    #     return cached_response
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature
    }
    
    # Retry logic with exponential backoff
    max_retries = 3
    base_delay = 1  # Start with 1 second
    
    for attempt in range(max_retries):
        try:
            logger.info(f"🤖 Making OpenAI API call (attempt {attempt + 1}/{max_retries}) with model: {model}")
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=data,
                timeout=120
            )
            
            # Handle different HTTP status codes
            if response.status_code == 200:
                result = response.json()
                
                if 'choices' not in result or len(result['choices']) == 0:
                    raise Exception(f"Invalid OpenAI API response: {result}")
                
                content = result['choices'][0]['message']['content']
                
                if not content or len(content.strip()) == 0:
                    raise Exception("OpenAI returned empty response")
                
                # TEMPORARILY DISABLE CACHE TO FIX CV EXTRACTION BUG
                # Cache the response
                # gpt_response_cache.set(cache_key, content.strip())
                
                logger.info("✅ OpenAI API call successful")
                return content.strip()
                
            elif response.status_code in [429, 503, 502, 504]:  # Rate limit or server errors
                error_msg = f"OpenAI API error: {response.status_code} - {response.text}"
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"⏳ {error_msg}. Retrying in {delay}s...")
                    time.sleep(delay)
                    continue
                else:
                    raise Exception(error_msg)
            else:
                raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")
                
        except requests.exceptions.Timeout as e:
            error_msg = f"Timeout calling OpenAI API: {str(e)}"
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(f"⏳ {error_msg}. Retrying in {delay}s...")
                time.sleep(delay)
                continue
            else:
                logger.error(error_msg)
                raise Exception(f"OpenAI API timeout after {max_retries} attempts: {str(e)}")
                
        except requests.exceptions.ConnectionError as e:
            error_msg = f"Connection error calling OpenAI API: {str(e)}"
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(f"⏳ {error_msg}. Retrying in {delay}s...")
                time.sleep(delay)
                continue
            else:
                logger.error(error_msg)
                raise Exception(f"Failed to connect to OpenAI API after {max_retries} attempts: {str(e)}")
                
        except requests.exceptions.RequestException as e:
            error_msg = f"Network error calling OpenAI API: {str(e)}"
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(f"⏳ {error_msg}. Retrying in {delay}s...")
                time.sleep(delay)
                continue
            else:
                logger.error(error_msg)
                raise Exception(f"Network error after {max_retries} attempts: {str(e)}")
                
        except Exception as e:
            logger.error(f"❌ Unexpected error calling OpenAI API: {str(e)}")
            raise Exception(f"OpenAI API call failed: {str(e)}")
    
    # Should never reach here, but just in case
    raise Exception(f"OpenAI API call failed after {max_retries} attempts")

def standardize_cv_with_gpt(text: str, filename: str) -> dict:
    """
    NEW STANDARDIZED CV ANALYSIS - Process full document without character limits.
    Extracts standardized data for embedding generation (not raw text).
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required")
    
    try:
        # CRITICAL: Process ENTIRE document text - NO character limits
        logger.info(f"🔍 Processing FULL CV content: {len(text):,} characters for {filename}")
        
        # Handle very long documents by implementing chunking if needed
        if len(text) > 120000:  # If text is extremely long, chunk it
            logger.info(f"⚠️ Large document detected ({len(text):,} chars), implementing chunking strategy")
            # Process in chunks and combine results
            chunks = [text[i:i+120000] for i in range(0, len(text), 120000)]
            all_results = []
            
            for i, chunk in enumerate(chunks):
                logger.info(f"📄 Processing chunk {i+1}/{len(chunks)}")
                chunk_result = _process_cv_chunk(chunk, filename, i+1)
                all_results.append(chunk_result)
            
            # Combine results from all chunks
            result = _combine_cv_chunks(all_results, filename)
        else:
            # Process normally for standard-sized documents
            result = _process_cv_chunk(text, filename)
        
        logger.info(f"✅ Standardized CV analysis completed for {filename}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Standardized CV analysis failed for {filename}: {str(e)}")
        raise Exception(f"Standardized CV analysis failed: {str(e)}")

def _process_cv_chunk(text: str, filename: str, chunk_num: int = 1) -> dict:
    """Process a single chunk of CV text with the UPDATED standardized prompt."""
    
    prompt = f"""You are an advanced CV/Job Description analysis system. Your task is to extract and standardize information from the provided document text for accurate matching and scoring.

CRITICAL INSTRUCTIONS:
1. Process the ENTIRE document - do not truncate or limit analysis
2. Extract and standardize all information into structured format
3. Output will be used for embedding generation - ensure consistency and standardization

FOR CVs:
Skills Extraction:
- List clearly mentioned skills directly supported by candidate's described experience
- Only include skills with strong correlation (95%+) to actual work done
- Write each skill in full-word format (e.g., "JavaScript" not "JS", ".NET" not "Dot Net")
- Limit to maximum 20 relevant skills
- Extract individual, atomic skills only
- Standardize to industry-standard terms

Responsibilities Extraction:
- Review the most recent TWO jobs in the CV
- Write exactly 10 numbered responsibilities describing what candidate did
- Focus more heavily on the most recent role
- Do NOT include introduction or summary text before the list
- Use clear, concise job-description style language
- Highlight technical expertise, leadership, or ownership when visible
- Use action-oriented language starting with action verbs

Experience Level:
- Calculate total years of experience relevant to most recent two roles
- Do NOT count unrelated earlier roles
- Format: "X years"

Job Title:
- Suggest clear, industry-standard job title based primarily on most recent position
- Align with extracted skills
- Remove company-specific prefixes/suffixes

Return the response in JSON format:
{{
  "document_type": "CV",
  "skills": ["skill1", "skill2", "skill3"],
  "responsibilities": ["responsibility1", "responsibility2", "responsibility3", "responsibility4", "responsibility5", "responsibility6", "responsibility7", "responsibility8", "responsibility9", "responsibility10"],
  "experience_years": "X years",
  "job_title": "Standardized Job Title",
  "full_name": "Full Name",
  "email": "Email Address", 
  "phone": "Phone Number"
}}

STANDARDIZATION RULES:
- Skills: Individual atomic terms, full standardized names, no abbreviations
- Responsibilities: Complete sentences, action-oriented, exactly 10
- Experience: Numeric format with "years" suffix
- Job Title: Industry-standard format without company specifics

CV CONTENT:
{text}"""

    response = call_openai_api([{"role": "user", "content": prompt}], 
                              model="gpt-4o-mini", 
                              max_tokens=2000, 
                              temperature=0.1)
    
    # Clean and parse JSON response
    try:
        # Remove code blocks and clean response
        cleaned_response = re.sub(r'```(json)?', '', response, flags=re.IGNORECASE).strip()
        json_start = cleaned_response.find('{')
        json_end = cleaned_response.rfind('}')
        
        if json_start != -1 and json_end != -1:
            json_str = cleaned_response[json_start:json_end + 1]
            result = json.loads(json_str)
            
            # Validate required fields for CV
            required_fields = ["skills", "responsibilities", "experience_years", "job_title", "document_type"]
            for field in required_fields:
                if field not in result:
                    if field in ["skills", "responsibilities"]:
                        result[field] = []
                    elif field == "document_type":
                        result[field] = "CV"
                    else:
                        result[field] = "Not specified"
                        
            # Map experience_years to years_of_experience for backward compatibility
            if "experience_years" in result:
                result["years_of_experience"] = result["experience_years"]
            
            # Ensure skills are individual terms, not sentences
            if isinstance(result.get("skills"), list):
                result["skills"] = [skill.strip() for skill in result["skills"] 
                                 if skill.strip() and len(skill.strip().split()) <= 3]
            
            # Ensure we have exactly 10 responsibilities
            if isinstance(result.get("responsibilities"), list):
                responsibilities = result["responsibilities"]
                if len(responsibilities) < 10:
                    # Pad with generic responsibilities if needed
                    while len(responsibilities) < 10:
                        responsibilities.append("Collaborated with team members on project deliverables")
                elif len(responsibilities) > 10:
                    responsibilities = responsibilities[:10]
                result["responsibilities"] = responsibilities
            
            result["processing_metadata"] = {
                "chunk_number": chunk_num,
                "text_length": len(text),
                "extraction_method": "standardized_gpt_analysis",
                "gpt_model": "gpt-4o-mini"
            }
            
            return result
            
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON parsing failed for {filename}: {str(e)}")
        logger.error(f"Raw response: {response}")
        
    # Fallback if JSON parsing fails
    return {
        "skills": [],
        "responsibilities": ["Unable to extract responsibilities due to parsing error"] * 10,
        "years_of_experience": "Not specified",
        "job_title": "Not specified",
        "full_name": "Not specified",
        "email": "Not specified",
        "phone": "Not specified",
        "raw_response": response,
        "processing_metadata": {
            "chunk_number": chunk_num,
            "text_length": len(text),
            "extraction_method": "standardized_gpt_analysis_fallback",
            "gpt_model": "gpt-4o-mini"
        }
    }

def _combine_cv_chunks(chunk_results: list, filename: str) -> dict:
    """Combine results from multiple CV chunks into a single standardized result."""
    if not chunk_results:
        raise Exception("No chunk results to combine")
    
    # Use the first chunk as base and merge others
    combined = chunk_results[0].copy()
    
    if len(chunk_results) > 1:
        all_skills = set()
        all_responsibilities = []
        
        for chunk in chunk_results:
            if isinstance(chunk.get("skills"), list):
                all_skills.update(chunk["skills"])
            if isinstance(chunk.get("responsibilities"), list):
                all_responsibilities.extend(chunk["responsibilities"])
        
        # Deduplicate and limit skills to 20
        combined["skills"] = list(all_skills)[:20]
        
        # Deduplicate responsibilities and limit to 10
        unique_responsibilities = []
        for resp in all_responsibilities:
            if resp not in unique_responsibilities:
                unique_responsibilities.append(resp)
        combined["responsibilities"] = unique_responsibilities[:10]
        
        # Pad responsibilities to exactly 10 if needed
        while len(combined["responsibilities"]) < 10:
            combined["responsibilities"].append("Additional responsibility from document analysis")
    
    combined["processing_metadata"]["total_chunks"] = len(chunk_results)
    combined["processing_metadata"]["combined_processing"] = True
    
    return combined

def standardize_job_description_with_gpt(text: str, filename: str) -> dict:
    """
    NEW STANDARDIZED JD ANALYSIS - Process full document without character limits.
    Extracts standardized data for embedding generation (not raw text).
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required")
    
    try:
        # CRITICAL: Process ENTIRE document text - NO character limits
        logger.info(f"🔍 Processing FULL JD content: {len(text):,} characters for {filename}")
        
        # Handle very long documents by implementing chunking if needed
        if len(text) > 120000:  # If text is extremely long, chunk it
            logger.info(f"⚠️ Large document detected ({len(text):,} chars), implementing chunking strategy")
            # Process in chunks and combine results
            chunks = [text[i:i+120000] for i in range(0, len(text), 120000)]
            all_results = []
            
            for i, chunk in enumerate(chunks):
                logger.info(f"📄 Processing chunk {i+1}/{len(chunks)}")
                chunk_result = _process_jd_chunk(chunk, filename, i+1)
                all_results.append(chunk_result)
            
            # Combine results from all chunks
            result = _combine_jd_chunks(all_results, filename)
        else:
            # Process normally for standard-sized documents
            result = _process_jd_chunk(text, filename)
        
        logger.info(f"✅ Standardized JD analysis completed for {filename}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Standardized JD analysis failed for {filename}: {str(e)}")
        raise Exception(f"Standardized JD analysis failed: {str(e)}")

def _process_jd_chunk(text: str, filename: str, chunk_num: int = 1) -> dict:
    """Process a single chunk of JD text with the UPDATED standardized prompt."""
    
    prompt = f"""You are an advanced CV/Job Description analysis system. Your task is to extract and standardize information from the provided document text for accurate matching and scoring.

CRITICAL INSTRUCTIONS:
1. Process the ENTIRE document - do not truncate or limit analysis
2. Extract and standardize all information into structured format
3. Output will be used for embedding generation - ensure consistency and standardization

FOR JOB DESCRIPTIONS:
Skills Extraction:
- Provide exactly 20 distinct skills required for the position
- Only list actionable, demonstrable skills (technical or soft skills)
- Do NOT include qualifications, years of experience, certifications, or personal traits
- Do not include anything that cannot be demonstrated as a skill
- Make sure each item is phrased as a skill, not a requirement or attribute
- Write all technology names, frameworks, and methodologies in their complete, standardized form
- Examples: "JavaScript" (not "JS"), "Service Level Agreement" (not "SLA"), "Microsoft .NET" (not "DotNET")
- Do not use abbreviations unless you also write out the full term
- If job description is sparse, add relevant technologies based on industry standards

Responsibilities Extraction:
- Summarize the experience the employee should already have to perform the job excellently
- Write exactly 10 full sentences describing required experience/responsibilities
- Use the job description's style and content if detailed
- If sparse, add relevant content based on industry standards for similar roles
- Focus on what experience is needed, not just job duties

Experience Level:
- Note any specific mention of required years of experience
- Format: "X years" where X is a number
- For ranges, use the average (e.g., "3-5 years" → "4 years")

Job Title:
- Suggest a standard job title based on the description
- If clear title already exists, retain it with 90%+ weighting
- Use industry-standard format

Return the response in JSON format:
{{
  "document_type": "JD",
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5", "skill6", "skill7", "skill8", "skill9", "skill10", "skill11", "skill12", "skill13", "skill14", "skill15", "skill16", "skill17", "skill18", "skill19", "skill20"],
  "responsibilities": ["responsibility1", "responsibility2", "responsibility3", "responsibility4", "responsibility5", "responsibility6", "responsibility7", "responsibility8", "responsibility9", "responsibility10"],
  "experience_years": "X years",
  "job_title": "Standardized Job Title"
}}

STANDARDIZATION RULES:
- Skills: Individual atomic terms, full standardized names, no abbreviations - EXACTLY 20
- Responsibilities: Complete sentences, action-oriented, exactly 10
- Experience: Numeric format with "years" suffix
- Job Title: Industry-standard format without company specifics
- Document Type: Identify as "JD"

JOB DESCRIPTION:
{text}"""

    response = call_openai_api([{"role": "user", "content": prompt}], 
                              model="gpt-4o-mini", 
                              max_tokens=2000, 
                              temperature=0.1)
    
    # Clean and parse JSON response
    try:
        # Remove code blocks and clean response
        cleaned_response = re.sub(r'```(json)?', '', response, flags=re.IGNORECASE).strip()
        json_start = cleaned_response.find('{')
        json_end = cleaned_response.rfind('}')
        
        if json_start != -1 and json_end != -1:
            json_str = cleaned_response[json_start:json_end + 1]
            result = json.loads(json_str)
            
            # Validate required fields for JD
            required_fields = ["skills", "responsibilities", "experience_years", "job_title", "document_type"]
            for field in required_fields:
                if field not in result:
                    if field in ["skills", "responsibilities"]:
                        result[field] = []
                    elif field == "document_type":
                        result[field] = "JD"
                    else:
                        result[field] = "Not specified"
                        
            # Map experience_years to years_of_experience for backward compatibility
            if "experience_years" in result:
                result["years_of_experience"] = result["experience_years"]
            
            # Ensure we have EXACTLY 20 skills for JDs
            if isinstance(result.get("skills"), list):
                skills = [skill.strip() for skill in result["skills"] 
                         if skill.strip() and len(skill.strip().split()) <= 3]
                # Ensure exactly 20 skills
                if len(skills) < 20:
                    # Add generic skills based on job title if needed
                    generic_skills = _generate_generic_skills(result.get("job_title", ""), 20 - len(skills))
                    skills.extend(generic_skills)
                elif len(skills) > 20:
                    skills = skills[:20]
                result["skills"] = skills
            
            # Ensure we have exactly 10 responsibility sentences
            if isinstance(result.get("responsibilities"), list):
                responsibilities = result["responsibilities"]
                if len(responsibilities) < 10:
                    # Pad with generic responsibilities if needed
                    while len(responsibilities) < 10:
                        responsibilities.append("Work collaboratively with team members on assigned projects.")
                elif len(responsibilities) > 10:
                    responsibilities = responsibilities[:10]
                result["responsibilities"] = responsibilities
                # Also set responsibility_sentences for backward compatibility
                result["responsibility_sentences"] = responsibilities
            
            result["processing_metadata"] = {
                "chunk_number": chunk_num,
                "text_length": len(text),
                "extraction_method": "standardized_gpt_jd_analysis",
                "gpt_model": "gpt-4o-mini"
            }
            
            return result
            
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON parsing failed for {filename}: {str(e)}")
        logger.error(f"Raw response: {response}")
        
    # Fallback if JSON parsing fails
    return {
        "skills": [],
        "responsibility_sentences": ["Unable to extract responsibilities due to parsing error"] * 10,
        "years_of_experience": "Not specified",
        "job_title": "Not specified",
        "raw_response": response,
        "processing_metadata": {
            "chunk_number": chunk_num,
            "text_length": len(text),
            "extraction_method": "standardized_gpt_jd_analysis_fallback",
            "gpt_model": "gpt-4o-mini"
        }
    }

def _combine_jd_chunks(chunk_results: list, filename: str) -> dict:
    """Combine results from multiple JD chunks into a single standardized result."""
    if not chunk_results:
        raise Exception("No chunk results to combine")
    
    # Use the first chunk as base and merge others
    combined = chunk_results[0].copy()
    
    if len(chunk_results) > 1:
        all_skills = set()
        all_responsibilities = []
        
        for chunk in chunk_results:
            if isinstance(chunk.get("skills"), list):
                all_skills.update(chunk["skills"])
            if isinstance(chunk.get("responsibility_sentences"), list):
                all_responsibilities.extend(chunk["responsibility_sentences"])
        
        # Deduplicate and limit skills to 20
        combined["skills"] = list(all_skills)[:20]
        
        # Deduplicate responsibilities and limit to 10
        unique_responsibilities = []
        for resp in all_responsibilities:
            if resp not in unique_responsibilities:
                unique_responsibilities.append(resp)
        combined["responsibility_sentences"] = unique_responsibilities[:10]
        
        # Pad responsibilities to exactly 10 if needed
        while len(combined["responsibility_sentences"]) < 10:
            combined["responsibility_sentences"].append("Additional responsibility identified from job description analysis.")
    
    combined["processing_metadata"]["total_chunks"] = len(chunk_results)
    combined["processing_metadata"]["combined_processing"] = True
    
    return combined


def _generate_generic_skills(job_title: str, count_needed: int) -> list:
    """Generate generic skills based on job title to ensure exactly 20 skills for JDs."""
    if count_needed <= 0:
        return []
    
    # Common skill categories based on job types
    skill_sets = {
        "software": ["Programming", "Debugging", "Code Review", "Version Control", "Agile Methodology", 
                    "Problem Solving", "System Design", "Testing", "Documentation", "Team Collaboration"],
        "data": ["Data Analysis", "Statistical Analysis", "Machine Learning", "Data Visualization", 
                "Database Management", "ETL Processes", "Big Data", "Python", "SQL", "Data Mining"],
        "manager": ["Leadership", "Project Management", "Strategic Planning", "Team Management", 
                   "Budget Management", "Stakeholder Communication", "Risk Management", "Process Improvement", 
                   "Performance Management", "Decision Making"],
        "marketing": ["Digital Marketing", "Content Creation", "Social Media Marketing", "SEO", 
                     "Analytics", "Brand Management", "Campaign Management", "Market Research", 
                     "Email Marketing", "Customer Acquisition"],
        "sales": ["Lead Generation", "Customer Relationship Management", "Negotiation", "Sales Strategy", 
                 "Territory Management", "Pipeline Management", "Client Retention", "Prospecting", 
                 "Presentation Skills", "Closing Techniques"]
    }
    
    # Determine skill category based on job title
    title_lower = job_title.lower()
    if any(word in title_lower for word in ["developer", "engineer", "programmer", "software", "technical"]):
        base_skills = skill_sets["software"]
    elif any(word in title_lower for word in ["data", "analyst", "scientist", "analytics"]):
        base_skills = skill_sets["data"]
    elif any(word in title_lower for word in ["manager", "director", "lead", "supervisor"]):
        base_skills = skill_sets["manager"]
    elif any(word in title_lower for word in ["marketing", "digital", "content", "brand"]):
        base_skills = skill_sets["marketing"]
    elif any(word in title_lower for word in ["sales", "business development", "account"]):
        base_skills = skill_sets["sales"]
    else:
        # Generic professional skills
        base_skills = ["Communication", "Problem Solving", "Time Management", "Critical Thinking", 
                      "Attention to Detail", "Adaptability", "Teamwork", "Professional Writing", 
                      "Project Coordination", "Quality Assurance"]
    
    # Return the needed number of skills
    return base_skills[:count_needed]
