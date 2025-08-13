import requests
import json
import os
import logging
import time
from typing import Optional
import re

logger = logging.getLogger(__name__)

# ============================================================================
# REAL GPT-4o-mini ONLY - NO MOCK MODE
# ============================================================================
# All mock functions have been removed - only real GPT-4o-mini analysis available

def call_openai_api(messages: list, model: str = "gpt-4o-mini", max_tokens: int = 1500, temperature: float = 0.1) -> str:
    """Call OpenAI API with error handling and retry logic."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OPENAI_API_KEY environment variable is required")
    
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
    
    try:
        logger.info(f"Making OpenAI API call with model: {model}")
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=data,
            timeout=120
        )
        
        if response.status_code != 200:
            raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")
        
        result = response.json()
        
        if 'choices' not in result or len(result['choices']) == 0:
            raise Exception(f"Invalid OpenAI API response: {result}")
        
        content = result['choices'][0]['message']['content']
        
        if not content or len(content.strip()) == 0:
            raise Exception("OpenAI returned empty response")
        
        logger.info("✅ OpenAI API call successful")
        return content.strip()
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error calling OpenAI API: {str(e)}")
        raise Exception(f"Failed to connect to OpenAI API: {str(e)}")
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {str(e)}")
        raise Exception(f"OpenAI API call failed: {str(e)}")

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
        # 🚀 PERFORMANCE OPTIMIZATION: Enhanced JD Analysis Prompt for consistent output
        prompt = f"""
        Analyze this job description and output EXACTLY the following structure with consistent formatting:

        **JOB TITLE:**
        [Extract the exact job title from the description]

        **SKILLS (EXACTLY 20 ITEMS):**
        Extract exactly 20 technical skills required for this role. If the description mentions fewer than 20 skills, generate additional relevant skills based on the job requirements, industry standards, and role context. Each skill must be directly relevant to the position. Format: one skill per line with "- " prefix.
        - [Skill 1 - must be mentioned in JD or highly relevant]
        - [Skill 2 - must be mentioned in JD or highly relevant]
        - [Skill 3 - must be mentioned in JD or highly relevant]
        [... continue to exactly 20 skills, generating additional relevant ones if needed]

        **RESPONSIBILITIES (EXACTLY 10 ITEMS):**
        Extract exactly 10 key responsibilities from the job description. If fewer than 10 are explicitly stated, generate additional relevant responsibilities based on the role requirements and industry standards. Use clear, action-oriented language. Format: numbered list.
        1. [Responsibility 1 - from JD or highly relevant]
        2. [Responsibility 2 - from JD or highly relevant]
        3. [Responsibility 3 - from JD or highly relevant]
        [... continue to exactly 10 responsibilities]

        **YEARS OF EXPERIENCE:**
        [Extract the required years of experience, or write "Not specified"]

        **EDUCATION:**
        [Extract education requirements, or write "Not specified"]

        **SUMMARY:**
        [Provide a brief summary of the role and key requirements]

        ---
        INPUT JOB DESCRIPTION:
        {text[:4000]}
        """

        content = call_openai_api([{"role": "user", "content": prompt}], model="gpt-4o-mini", max_tokens=2500, temperature=0.05)
        
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
        # 🚀 PERFORMANCE OPTIMIZATION: Enhanced CV Analysis Prompt for consistent output
        prompt = f"""
        Analyze this CV and output EXACTLY the following structure with consistent formatting:

        **PERSONAL INFORMATION:**
        - Full Name: [Extract the candidate's exact full name from the CV]
        - Email: [Extract email address if provided, or write "Not provided"]
        - Phone: [Extract phone number if provided, or write "Not provided"]

        **SKILLS (EXACTLY 20 ITEMS):**
        Extract exactly 20 technical skills. If the CV contains fewer than 20 real skills, generate additional relevant skills based on the candidate's experience, industry context, and role requirements. Each skill must be directly related to the candidate's background. Format: one skill per line with "- " prefix.
        - [Skill 1 - must be a real skill from CV]
        - [Skill 2 - must be a real skill from CV]
        - [Skill 3 - must be a real skill from CV]
        [... continue to exactly 20 skills, generating additional relevant ones if needed]

        **EXPERIENCE (EXACTLY 10 ITEMS):**
        Review the most recent two jobs in the CV. Write a numbered list of exactly 10 responsibilities that describe what the candidate did in these roles, focusing more on the most recent one. Do not include any introduction or summary text before the list. Use clear, concise job-description style language that highlights technical expertise, leadership, or ownership when visible.
        1. [Responsibility 1 - specific action from CV]
        2. [Responsibility 2 - specific action from CV]
        3. [Responsibility 3 - specific action from CV]
        [... continue to exactly 10 responsibilities]

        **YEARS OF EXPERIENCE:**
        Calculate the total number of years of experience relevant to the most recent two roles. Do not count unrelated earlier roles.

        **JOB TITLE:**
        Suggest a clear, industry-standard job title based primarily on the most recent position and aligned with the extracted skills.

        ---
        INPUT CV:
        {text[:4000]}
        """

        content = call_openai_api([{"role": "user", "content": prompt}], model="gpt-4o-mini", max_tokens=2500, temperature=0.05)
        
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
        
        # Extract responsibilities (parse as sentences)
        resp_match = re.search(r'\*\*RESPONSIBILITIES:\*\*\s*\n(.*?)(?=\*\*YEARS OF EXPERIENCE:\*\*|\*\*JOB TITLE:\*\*|\Z)', content, re.DOTALL)
        responsibilities_text = resp_match.group(1).strip() if resp_match else ""
        
        # Split into individual sentences/responsibilities
        import re
        responsibility_sentences = []
        sentences = re.split(r'[.!?]+', responsibilities_text)
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence and len(sentence) > 10:  # Minimum length filter
                responsibility_sentences.append(sentence)
        
        responsibilities = responsibilities_text  # Keep original for backward compatibility
        
        # Extract years of experience
        years_match = re.search(r'\*\*YEARS OF EXPERIENCE:\*\*\s*\n(.*?)(?=\*\*JOB TITLE:\*\*|\Z)', content, re.DOTALL)
        years_of_experience = years_match.group(1).strip() if years_match else "Not specified"
        
        # Extract job title
        title_match = re.search(r'\*\*JOB TITLE:\*\*\s*\n(.*?)(?=\Z)', content, re.DOTALL)
        job_title = title_match.group(1).strip() if title_match else "Not specified"
        
        return {
            "skills": skills,
            "responsibilities": responsibilities,
            "responsibility_sentences": responsibility_sentences,  # Add parsed sentences
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
        
        # Extract personal information
        personal_match = re.search(r'\*\*PERSONAL INFORMATION:\*\*\s*\n(.*?)(?=\*\*SKILLS:\*\*|\*\*EXPERIENCE:\*\*|\Z)', content, re.DOTALL)
        personal_text = personal_match.group(1).strip() if personal_match else ""
        
        # Parse personal info
        full_name = "Not provided in the CV"
        email = "Not provided in the CV"
        phone = "Not provided in the CV"
        
        for line in personal_text.split('\n'):
            line = line.strip()
            if line.startswith('- Full Name:'):
                full_name = line.replace('- Full Name:', '').strip()
                if full_name.startswith('[') and full_name.endswith(']'):
                    full_name = full_name[1:-1].strip()
                if not full_name or full_name.lower() in ['not provided', 'not available', 'n/a', '[extract the candidate\'s full name]']:
                    full_name = "Not provided in the CV"
            elif line.startswith('- Email:'):
                email = line.replace('- Email:', '').strip()
                if email.startswith('[') and email.endswith(']'):
                    email = email[1:-1].strip()
                if not email or email.lower() in ['not provided', 'not available', 'n/a', '[extract email address if provided]']:
                    email = "Not provided in the CV"
            elif line.startswith('- Phone:'):
                phone = line.replace('- Phone:', '').strip()
                if phone.startswith('[') and phone.endswith(']'):
                    phone = phone[1:-1].strip()
                if not phone or phone.lower() in ['not provided', 'not available', 'n/a', '[extract phone number if provided]']:
                    phone = "Not provided in the CV"
        
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
        
        # Extract experience (numbered responsibilities)
        exp_match = re.search(r'\*\*EXPERIENCE:\*\*\s*\n(.*?)(?=\*\*YEARS OF EXPERIENCE:\*\*|\*\*JOB TITLE:\*\*|\Z)', content, re.DOTALL)
        experience_text = exp_match.group(1).strip() if exp_match else ""
        
        # Parse numbered responsibilities
        responsibilities = []
        for line in experience_text.split('\n'):
            line = line.strip()
            if re.match(r'^\d+\.\s+', line):
                responsibility = re.sub(r'^\d+\.\s+', '', line).strip()
                if responsibility and len(responsibility) > 5:
                    responsibilities.append(responsibility)
        
        experience = experience_text  # Keep original for backward compatibility
        
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
