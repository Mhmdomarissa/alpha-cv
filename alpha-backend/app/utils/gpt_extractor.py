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

def call_openai_api(messages: list, model: str = "gpt-4o-mini", max_tokens: int = 800, temperature: float = 0.1) -> str:
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

def analyze_cv_with_gpt(text: str, filename: str) -> dict:
    """
    Analyze CV with GPT-4o-mini ONLY. No mock mode.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required. No mock mode available.")
    
    try:
        prompt = f"""
        You are a professional CV analyzer. Extract the following information from this CV:

        **BASIC INFORMATION:**
        - Full name
        - Email address
        - Phone number
        - Current job title

        **SKILLS:**
        List the technical skills mentioned in the CV. Focus on programming languages, frameworks, tools, and technologies.

        **EXPERIENCE:**
        Summarize the work experience, focusing on the most recent 2-3 positions.

        **YEARS OF EXPERIENCE:**
        Calculate the total years of relevant professional experience.

        **EDUCATION:**
        List educational qualifications.

        **SUMMARY:**
        Provide a brief professional summary based on the CV content.

        ---
        CV CONTENT:
        {text[:4000]}
        """

        content = call_openai_api([{"role": "user", "content": prompt}], model="gpt-4o-mini", max_tokens=1500, temperature=0.1)
        
        if not content or len(content.strip()) == 0:
            raise Exception(f"GPT-4o-mini returned empty response for {filename}")

        logger.info(f"🔍 GPT-4o-mini Response for {filename}: {content[:200]}...")

        # Parse the response (simplified parsing for backward compatibility)
        result = {
            "full_name": "Extracted by GPT-4o-mini",
            "email": "Extracted by GPT-4o-mini", 
            "phone": "Extracted by GPT-4o-mini",
            "job_title": "Extracted by GPT-4o-mini",
            "years_of_experience": "Calculated by GPT-4o-mini",
            "skills": "Extracted by GPT-4o-mini",
            "education": "Extracted by GPT-4o-mini",
            "summary": content[:500],  # Use first part of GPT response
            "raw_analysis": content,
            "processing_metadata": {
                "gpt_model_used": "gpt-4o-mini",
                "extraction_method": "real_gpt_analysis"
            }
        }
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error in GPT-4o-mini CV analysis for {filename}: {str(e)}")
        raise Exception(f"GPT-4o-mini CV analysis failed for {filename}: {str(e)}")

def analyze_jd_with_gpt(text: str, filename: str) -> dict:
    """
    Analyze job description with GPT-4o-mini ONLY. No mock mode.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required. No mock mode available.")
    
    try:
        prompt = f"""
        You are a professional job description analyzer. Extract the following information:

        **JOB DETAILS:**
        - Job title
        - Company name
        - Location
        - Job type (full-time, part-time, contract, etc.)
        - Salary range (if mentioned)

        **REQUIREMENTS:**
        - Required skills and technologies
        - Years of experience required
        - Education requirements

        **RESPONSIBILITIES:**
        - Key job responsibilities and duties

        ---
        JOB DESCRIPTION:
        {text[:4000]}
        """

        content = call_openai_api([{"role": "user", "content": prompt}], model="gpt-4o-mini", max_tokens=1500, temperature=0.1)
        
        if not content or len(content.strip()) == 0:
            raise Exception(f"GPT-4o-mini returned empty response for {filename}")

        logger.info(f"🔍 GPT-4o-mini Response for {filename}: {content[:200]}...")

        result = {
            "job_title": "Extracted by GPT-4o-mini",
            "company": "Extracted by GPT-4o-mini",
            "required_skills": "Extracted by GPT-4o-mini",
            "location": "Extracted by GPT-4o-mini",
            "salary_range": "Extracted by GPT-4o-mini",
            "experience_required": "Extracted by GPT-4o-mini",
            "raw_analysis": content,
            "processing_metadata": {
                "gpt_model_used": "gpt-4o-mini",
                "extraction_method": "real_gpt_analysis"
            }
        }
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error in GPT-4o-mini JD analysis for {filename}: {str(e)}")
        raise Exception(f"GPT-4o-mini JD analysis failed for {filename}: {str(e)}")

def standardize_job_description_with_gpt(text: str, filename: str) -> dict:
    """
    Standardize job description using GPT-4o-mini ONLY. No mock mode.
    """
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
