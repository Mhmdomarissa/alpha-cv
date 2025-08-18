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
# REAL GPT-4o-mini ONLY - NO MOCK MODE
# ============================================================================
# All mock functions have been removed - only real GPT-4o-mini analysis available

def call_openai_api(messages: list, model: str = "gpt-4o-mini", max_tokens: int = 2000, temperature: float = 0.1) -> str:
    """Call OpenAI API with robust error handling, retry logic with exponential backoff, and caching."""
    import time
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required")
    
    # Check cache first
    cache_key = get_gpt_cache_key(str(messages), model)
    cached_response = gpt_response_cache.get(cache_key)
    if cached_response:
        logger.info("💾 Using cached GPT response")
        return cached_response
    
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
                
                # Cache the response
                gpt_response_cache.set(cache_key, content.strip())
                
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
    """Process a single chunk of CV text with the new standardized prompt."""
    
    prompt = f"""Review this CV and extract the following information in a structured format:

Skills: List the clearly mentioned skills that are directly supported by the candidate's described experience. Only include skills with a strong correlation (95%+) to the actual work done. Write each skill in full-word format (e.g., JavaScript instead of JS, .NET instead of Dot Net). Limit to a maximum of 20 relevant skills.

Experience: Review the most recent two jobs in the CV. Write a numbered list of exactly 10 responsibilities that describe what the candidate did in these roles, focusing more on the most recent one. Do not include any introduction or summary text before the list. Use clear, concise job-description style language that highlights technical expertise, leadership, or ownership when visible.

Years of Experience: Calculate the total number of years of experience relevant to the most recent two roles. Do not count unrelated earlier roles.

Job Title: Suggest a clear, industry-standard job title based primarily on the most recent position and aligned with the extracted skills.

Return the response in JSON format:
{{
  "skills": ["skill1", "skill2", "skill3"],
  "responsibilities": ["responsibility1", "responsibility2", "responsibility3", "responsibility4", "responsibility5", "responsibility6", "responsibility7", "responsibility8", "responsibility9", "responsibility10"],
  "years_of_experience": "X years",
  "job_title": "Standardized Job Title",
  "full_name": "Full Name",
  "email": "Email Address", 
  "phone": "Phone Number"
}}

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
            
            # Validate required fields
            required_fields = ["skills", "responsibilities", "years_of_experience", "job_title"]
            for field in required_fields:
                if field not in result:
                    result[field] = [] if field in ["skills", "responsibilities"] else "Not specified"
            
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
    """Process a single chunk of JD text with the new standardized prompt."""
    
    prompt = f"""Take this job description and, without removing any original information, reformat it into the following standardized structure:

Skills: Provide a concise list (maximum 20 items) of only the specific technologies, platforms, or tools that the employee must be highly proficient in to perform this job at a very high level. Do not include general skills, soft skills, or experience references. If the job description is sparse, add relevant technologies based on industry standards for similar roles.

Responsibilities: Summarize the experience the employee should already have in order to do the job very well upon joining. If the job description includes detailed responsibilities, use its style and content. If not, add relevant content based on industry standards. This section should be written in exactly 10 full sentences.

Years of Experience: Note any specific mention of required years of experience.

Job Title: Suggest a standard job title based on the description, unless a clear title is already mentioned—if so, retain it with at least 90% weighting.

Return the response in JSON format:
{{
  "skills": ["skill1", "skill2", "skill3"],
  "responsibility_sentences": ["responsibility1", "responsibility2", "responsibility3", "responsibility4", "responsibility5", "responsibility6", "responsibility7", "responsibility8", "responsibility9", "responsibility10"],
  "years_of_experience": "X years",
  "job_title": "Standardized Job Title"
}}

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
            
            # Validate required fields
            required_fields = ["skills", "responsibility_sentences", "years_of_experience", "job_title"]
            for field in required_fields:
                if field not in result:
                    result[field] = [] if field in ["skills", "responsibility_sentences"] else "Not specified"
            
            # Ensure skills are individual terms, not sentences (max 20)
            if isinstance(result.get("skills"), list):
                result["skills"] = [skill.strip() for skill in result["skills"] 
                                 if skill.strip() and len(skill.strip().split()) <= 3][:20]
            
            # Ensure we have exactly 10 responsibility sentences
            if isinstance(result.get("responsibility_sentences"), list):
                responsibilities = result["responsibility_sentences"]
                if len(responsibilities) < 10:
                    # Pad with generic responsibilities if needed
                    while len(responsibilities) < 10:
                        responsibilities.append("Work collaboratively with team members on assigned projects.")
                elif len(responsibilities) > 10:
                    responsibilities = responsibilities[:10]
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


    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required. No mock mode available.")
    
    try:
        # 🚀 USER'S EXACT JD PROMPT SPECIFICATION
        prompt = f"""Take this job description and, without removing any original information, reformat it into the following standardized structure:

Skills: Provide a concise list (maximum 20 items) of only the specific technologies, platforms, or tools that the employee must be highly proficient in to perform this job at a very high level. Do not include general skills, soft skills, or experience references. If the job description is sparse, add relevant technologies based on industry standards for similar roles.

Responsibilities: Summarize the experience the employee should already have in order to do the job very well upon joining. If the job description includes detailed responsibilities, use its style and content. If not, add relevant content based on industry standards. This section should be written in exactly 10 full sentences.

Years of Experience: Note any specific mention of required years of experience.

Job Title: Suggest a standard job title based on the description, unless a clear title is already mentioned—if so, retain it with at least 90% weighting.

JOB DESCRIPTION:
{text[:4000]}"""

        content = call_openai_api([{"role": "user", "content": prompt}], model="gpt-4o-mini", max_tokens=800, temperature=0.05)
        
        if not content or len(content.strip()) == 0:
            raise Exception(f"GPT-4o-mini returned empty response for {filename}")

        logger.info(f"🔍 GPT-4o-mini Response for {filename}: {content[:200]}...")

        # Parse the structured response
        try:
            result = parse_standardized_jd_response(content, filename)
            
            # Add metadata
            result["processing_metadata"] = {
                "gpt_model_used": "gpt-4o-mini",
                "processing_time": "calculated",
                "extraction_method": "real_standardized_jd_analysis",
                "standardization_version": "2.0",
                "optimization": "consistent_output_format"
            }
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Standardized JD parsing failed for {filename}: {str(e)}")
            logger.error(f"Raw response: {content}")
            raise Exception(f"GPT-4o-mini standardized JD analysis failed for {filename}: {str(e)}")
            
    except Exception as e:
        logger.error(f"❌ Error in standardized JD analysis for {filename}: {str(e)}")
        raise Exception(f"GPT-4o-mini standardized JD analysis failed for {filename}: {str(e)}")

def standardize_cv_with_gpt(text: str, filename: str) -> dict:
    """
    Standardize CV using GPT-4o-mini ONLY. No mock mode.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required. No mock mode available.")
    
    try:
        # 🚀 USER'S EXACT CV PROMPT SPECIFICATION
        prompt = f"""Review this CV and extract the following information in a structured format:

Skills: List the clearly mentioned skills that are directly supported by the candidate's described experience. Only include skills with a strong correlation (95%+) to the actual work done. Write each skill in full-word format (e.g., Java Script instead of JS, .Net instead of Dot Net). Limit to a maximum of 20 relevant skills.

Experience: Review the most recent two jobs in the CV. Write a numbered list of exactly 10 responsibilities that describe what the candidate did in these roles, focusing more on the most recent one. Do not include any introduction or summary text before the list. Use clear, concise job-description style language that highlights technical expertise, leadership, or ownership when visible.

Years of Experience: Calculate the total number of years of experience relevant to the most recent two roles. Do not count unrelated earlier roles.

Job Title: Suggest a clear, industry-standard job title based primarily on the most recent position and aligned with the extracted skills.

CV CONTENT:
{text[:4000]}"""

        content = call_openai_api([{"role": "user", "content": prompt}], model="gpt-4o-mini", max_tokens=800, temperature=0.05)
        
        if not content or len(content.strip()) == 0:
            raise Exception(f"GPT-4o-mini returned empty response for {filename}")

        logger.info(f"🔍 GPT-4o-mini Response for {filename}: {content[:200]}...")

        # Parse the structured response
        try:
            result = parse_standardized_cv_response(content, filename)
            
            # Add metadata
            result["processing_metadata"] = {
                "gpt_model_used": "gpt-4o-mini",
                "processing_time": "calculated",
                "extraction_method": "real_standardized_cv_analysis",
                "standardization_version": "2.0",
                "optimization": "consistent_output_format"
            }
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Standardized CV parsing failed for {filename}: {str(e)}")
            logger.error(f"Raw response: {content}")
            raise Exception(f"GPT-4o-mini standardized CV analysis failed for {filename}: {str(e)}")
            
    except Exception as e:
        logger.error(f"❌ Error in standardized CV analysis for {filename}: {str(e)}")
        raise Exception(f"GPT-4o-mini standardized CV analysis failed for {filename}: {str(e)}")

def parse_standardized_jd_response(content: str, filename: str) -> dict:
    """
    Parse the standardized job description response into structured format.
    """
    try:
        # Extract sections using regex patterns
        import re
        
        # NEW: Parse the user's exact prompt format (no ** markers)
        
        # Extract job title (new format: "Job Title: ...")
        title_match = re.search(r'Job Title:\s*(.+?)(?=\n\n|\nSkills:|\nResponsibilities:|\Z)', content, re.DOTALL)
        job_title = title_match.group(1).strip() if title_match else "Not specified"
        
        # Extract skills section (new format: "Skills: ...")
        skills_match = re.search(r'Skills:\s*(.*?)(?=\n\nResponsibilities:|\nResponsibilities:|\nYears of Experience:|\Z)', content, re.DOTALL)
        skills_text = skills_match.group(1).strip() if skills_match else ""
        
        # Parse skills - handle numbered list format from GPT (JD Parser)
        skills = []
        if skills_text:
            # Clean up markdown formatting
            skills_text = skills_text.replace('**', '').strip()
            
            # Try numbered list format first (most common with our prompt)
            numbered_skills = re.findall(r'\d+\.\s*([^\d\n]+?)(?=\d+\.|$)', skills_text, re.DOTALL)
            if numbered_skills:
                for skill in numbered_skills:
                    skill = skill.strip().replace('\n', ' ').strip()
                    if skill and skill not in skills and len(skill) > 1:
                        skills.append(skill)
            else:
                # Fallback to line-by-line parsing
                for line in skills_text.split('\n'):
                    line = line.strip()
                    if line and not line.lower().startswith('skills:'):
                        # Remove bullet points or numbers
                        line = re.sub(r'^[-*•\d+\.\s]+', '', line).strip()
                        if line and line not in skills and len(line) > 1:
                            skills.append(line)
        
        # Extract responsibilities section (new format: "Responsibilities: ...")
        resp_match = re.search(r'Responsibilities:\s*(.*?)(?=\n\nYears of Experience:|\nYears of Experience:|\nJob Title:|\Z)', content, re.DOTALL)
        responsibilities_text = resp_match.group(1).strip() if resp_match else ""
        
        # Parse responsibilities - should be 10 full sentences
        responsibilities = []
        if responsibilities_text:
            # Split by periods followed by space or newline, or by numbered items
            sentences = re.split(r'(?<=\.)\s+(?=[A-Z])|(?<=\.)\n+|^\d+\.\s*', responsibilities_text)
            for sentence in sentences:
                sentence = sentence.strip()
                if sentence and len(sentence) > 10:  # Filter out very short fragments
                    # Remove any leading numbers or bullets
                    sentence = re.sub(r'^\d+\.\s*', '', sentence).strip()
                    if sentence and sentence not in responsibilities:
                        responsibilities.append(sentence)
        
        # For backward compatibility, also keep as text
        if not responsibilities and responsibilities_text:
            responsibilities = responsibilities_text
        
        # Extract years of experience (new format: "Years of Experience: ...")
        years_match = re.search(r'Years of Experience:\s*(.+?)(?=\n\n|\nJob Title:|\Z)', content, re.DOTALL)
        years_of_experience = years_match.group(1).strip() if years_match else "Not specified"
        
        # Clean up common formatting issues from markdown
        if job_title.startswith('**') or job_title.endswith('**'):
            job_title = job_title.replace('**', '').strip()
        if job_title.lower() in ['not specified', 'not provided', 'n/a']:
            job_title = "Not specified"
        
        # Clean years of experience
        if years_of_experience.startswith('**') or years_of_experience.endswith('**'):
            years_of_experience = years_of_experience.replace('**', '').strip()
        
        # Clean responsibilities text 
        if isinstance(responsibilities, str):
            responsibilities = responsibilities.replace('**', '').strip()
        
        return {
            "skills": skills,
            "responsibilities": responsibilities,
            "responsibility_sentences": responsibilities,  # Same as responsibilities in new format
            "years_of_experience": years_of_experience,
            "job_title": job_title,
            "filename": filename,
            "standardization_method": "real_standardized"
        }
        
    except Exception as e:
        logger.error(f"❌ Error parsing standardized JD response for {filename}: {str(e)}")
        raise Exception(f"Failed to parse standardized JD response: {str(e)}")

def parse_standardized_cv_response(content: str, filename: str) -> dict:
    """
    Parse the standardized CV response into structured format.
    """
    try:
        # Extract sections using regex patterns
        import re
        
        # NEW: Parse the user's exact prompt format (no ** markers)
        
        # Extract basic info from the free-form text (no specific sections expected)
        full_name = "Not provided in the CV"
        email = "Not provided in the CV" 
        phone = "Not provided in the CV"
        
        # Try to extract name, email, phone from any format in the content
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', content)
        if email_match:
            email = email_match.group(0)
        
        phone_match = re.search(r'[\+]?[\d\s\-\(\)]{10,}', content)
        if phone_match:
            phone = phone_match.group(0).strip()
        
        # Try to extract name from the beginning of content
        lines = content.split('\n')
        for line in lines[:5]:  # Check first 5 lines
            line = line.strip()
            if line and not line.lower().startswith(('skills:', 'experience:', 'years of experience:', 'job title:')):
                # Likely the name
                if len(line.split()) >= 2 and not '@' in line and not any(char.isdigit() for char in line):
                    full_name = line
                    break
        
        # Extract skills (new format: "Skills: ...")
        skills_match = re.search(r'Skills:\s*(.*?)(?=\n\nExperience:|\nExperience:|\nYears of Experience:|\nJob Title:|\Z)', content, re.DOTALL)
        skills_text = skills_match.group(1).strip() if skills_match else ""
        
        # Parse skills - handle numbered list format from GPT (CV Parser)
        skills = []
        if skills_text:
            # Clean up markdown formatting
            skills_text = skills_text.replace('**', '').strip()
            
            # Try numbered list format first (most common with our prompt)
            numbered_skills = re.findall(r'\d+\.\s*([^\d\n]+?)(?=\d+\.|$)', skills_text, re.DOTALL)
            if numbered_skills:
                for skill in numbered_skills:
                    skill = skill.strip().replace('\n', ' ').strip()
                    if skill and skill not in skills and len(skill) > 1:
                        skills.append(skill)
            else:
                # Fallback to line-by-line parsing
                for line in skills_text.split('\n'):
                    line = line.strip()
                    if line and not line.lower().startswith('skills:'):
                        # Remove bullet points or numbers
                        line = re.sub(r'^[-*•\d+\.\s]+', '', line).strip()
                        if line and line not in skills and len(line) > 1:
                            skills.append(line)
        
        # Extract experience (new format: "Experience: ...")
        exp_match = re.search(r'Experience:\s*(.*?)(?=\n\nYears of Experience:|\nYears of Experience:|\nJob Title:|\Z)', content, re.DOTALL)
        experience_text = exp_match.group(1).strip() if exp_match else ""
        
        # Parse experience as numbered responsibilities (exactly 10)
        responsibilities = []
        if experience_text:
            # Split by numbered items
            numbered_items = re.findall(r'\d+\.\s*([^0-9]+?)(?=\d+\.|$)', experience_text, re.DOTALL)
            for item in numbered_items:
                item = item.strip()
                if item and len(item) > 5:
                    responsibilities.append(item)
        
        experience = experience_text  # Keep original for backward compatibility
        
        # Extract years of experience (new format: "Years of Experience: ...")
        years_match = re.search(r'Years of Experience:\s*(.+?)(?=\n\nJob Title:|\nJob Title:|\Z)', content, re.DOTALL)
        years_of_experience = years_match.group(1).strip() if years_match else "Not specified"
        
        # Extract job title (new format: "Job Title: ...")
        title_match = re.search(r'Job Title:\s*(.+?)(?=\n\n|\Z)', content, re.DOTALL)
        job_title = title_match.group(1).strip() if title_match else "Not specified"
        
        # Clean up common formatting issues from markdown (CV)
        if job_title.startswith('**') or job_title.endswith('**'):
            job_title = job_title.replace('**', '').strip()
        if job_title.lower() in ['not specified', 'not provided', 'n/a']:
            job_title = "Not specified"
        
        # Clean years of experience
        if years_of_experience.startswith('**') or years_of_experience.endswith('**'):
            years_of_experience = years_of_experience.replace('**', '').strip()
        
        # Clean experience text 
        if isinstance(experience, str):
            experience = experience.replace('**', '').strip()
        
        return {
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "skills": skills,
            "experience": experience,
            "responsibilities": responsibilities,  # Add parsed responsibilities
            "years_of_experience": years_of_experience,
            "job_title": job_title,
            "filename": filename,
            "standardization_method": "real_standardized"
        }
        
    except Exception as e:
        logger.error(f"❌ Error parsing standardized CV response for {filename}: {str(e)}")
        raise Exception(f"Failed to parse standardized CV response: {str(e)}")
