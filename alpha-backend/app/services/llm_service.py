"""
LLM Service - Consolidated Large Language Model Operations
Handles ALL OpenAI GPT interactions for standardization and analysis.
Single responsibility: Convert raw text into structured, standardized data.
"""

import logging
import os
import json
import re
import time
import requests
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class LLMResponse:
    """Structured response from LLM processing."""
    success: bool
    data: Dict[str, Any]
    processing_time: float
    model_used: str
    error_message: Optional[str] = None

class LLMService:
    """
    Consolidated service for all LLM operations.
    Combines OpenAI API calls, prompt management, and response processing.
    """
    
    def __init__(self):
        """Initialize the LLM service."""
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
            
        self.base_url = "https://api.openai.com/v1/chat/completions"
        self.default_model = "gpt-4o-mini"
        self.max_retries = 3
        self.base_delay = 1
        
        # Session for connection reuse
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        })
        
        logger.info("🧠 LLMService initialized")
    
    def standardize_cv(self, raw_text: str, filename: str = "cv.txt") -> Dict[str, Any]:
        """
        Single LLM call to extract and standardize CV data.
        
        Args:
            raw_text: Raw extracted text from CV
            filename: Original filename for context
            
        Returns:
            Standardized CV data: {skills: [], responsibilities: [], experience_years: "", job_title: "", ...}
        """
        try:
            logger.info(f"🔍 Standardizing CV: {filename} ({len(raw_text):,} chars)")
            
            # Handle very long documents with chunking
            if len(raw_text) > 120000:
                return self._process_large_cv(raw_text, filename)
            
            prompt = self._build_cv_prompt(raw_text)
            response = self._call_openai_api(prompt)
            
            if response.success:
                # Validate and clean the response
                validated_data = self._validate_cv_response(response.data)
                validated_data["processing_metadata"] = {
                    "filename": filename,
                    "processing_time": response.processing_time,
                    "model_used": response.model_used,
                    "text_length": len(raw_text)
                }
                
                logger.info(f"✅ CV standardized: {len(validated_data.get('skills', []))} skills, {len(validated_data.get('responsibilities', []))} responsibilities")
                return validated_data
            else:
                raise Exception(f"LLM processing failed: {response.error_message}")
                
        except Exception as e:
            logger.error(f"❌ CV standardization failed: {str(e)}")
            raise Exception(f"CV standardization failed: {str(e)}")
    
    def standardize_jd(self, raw_text: str, filename: str = "jd.txt") -> Dict[str, Any]:
        """
        Single LLM call to extract and standardize Job Description data.
        
        Args:
            raw_text: Raw extracted text from JD
            filename: Original filename for context
            
        Returns:
            Standardized JD data: {skills: [], responsibilities: [], experience_years: "", job_title: ""}
        """
        try:
            logger.info(f"🔍 Standardizing JD: {filename} ({len(raw_text):,} chars)")
            
            # Handle very long documents with chunking
            if len(raw_text) > 120000:
                return self._process_large_jd(raw_text, filename)
            
            prompt = self._build_jd_prompt(raw_text)
            response = self._call_openai_api(prompt)
            
            if response.success:
                # Validate and clean the response
                validated_data = self._validate_jd_response(response.data)
                validated_data["processing_metadata"] = {
                    "filename": filename,
                    "processing_time": response.processing_time,
                    "model_used": response.model_used,
                    "text_length": len(raw_text)
                }
                
                logger.info(f"✅ JD standardized: {len(validated_data.get('skills', []))} skills, {len(validated_data.get('responsibilities', []))} responsibilities")
                return validated_data
            else:
                raise Exception(f"LLM processing failed: {response.error_message}")
                
        except Exception as e:
            logger.error(f"❌ JD standardization failed: {str(e)}")
            raise Exception(f"JD standardization failed: {str(e)}")
    
    def _call_openai_api(self, messages: List[Dict[str, str]], model: str = None, max_tokens: int = 2000, temperature: float = 0.1) -> LLMResponse:
        """
        Core OpenAI API call with robust error handling and retry logic.
        """
        if model is None:
            model = self.default_model
            
        data = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        start_time = time.time()
        
        for attempt in range(self.max_retries):
            try:
                logger.info(f"🤖 OpenAI API call (attempt {attempt + 1}/{self.max_retries}) - Model: {model}")
                
                response = self.session.post(
                    self.base_url,
                    json=data,
                    timeout=120
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    if 'choices' not in result or len(result['choices']) == 0:
                        raise Exception(f"Invalid API response: {result}")
                    
                    content = result['choices'][0]['message']['content']
                    
                    if not content or len(content.strip()) == 0:
                        raise Exception("Empty response from OpenAI")
                    
                    # Parse JSON response
                    try:
                        parsed_data = self._parse_json_response(content)
                        processing_time = time.time() - start_time
                        
                        return LLMResponse(
                            success=True,
                            data=parsed_data,
                            processing_time=processing_time,
                            model_used=model
                        )
                    except json.JSONDecodeError as json_error:
                        logger.error(f"JSON parsing failed: {str(json_error)}")
                        logger.error(f"Raw response: {content}")
                        raise Exception(f"JSON parsing failed: {str(json_error)}")
                
                elif response.status_code in [429, 503, 502, 504]:
                    # Rate limit or server errors - retry with backoff
                    if attempt < self.max_retries - 1:
                        delay = self.base_delay * (2 ** attempt)
                        logger.warning(f"⏳ API error {response.status_code}, retrying in {delay}s...")
                        time.sleep(delay)
                        continue
                    else:
                        raise Exception(f"API error after {self.max_retries} attempts: {response.status_code}")
                else:
                    raise Exception(f"API error: {response.status_code} - {response.text}")
                    
            except requests.exceptions.Timeout:
                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(f"⏳ Timeout, retrying in {delay}s...")
                    time.sleep(delay)
                    continue
                else:
                    raise Exception(f"Timeout after {self.max_retries} attempts")
                    
            except Exception as e:
                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(f"⏳ Error: {str(e)}, retrying in {delay}s...")
                    time.sleep(delay)
                    continue
                else:
                    processing_time = time.time() - start_time
                    return LLMResponse(
                        success=False,
                        data={},
                        processing_time=processing_time,
                        model_used=model,
                        error_message=str(e)
                    )
        
        # Should never reach here
        processing_time = time.time() - start_time
        return LLMResponse(
            success=False,
            data={},
            processing_time=processing_time,
            model_used=model,
            error_message="All retry attempts failed"
        )
    
    def _build_cv_prompt(self, text: str) -> List[Dict[str, str]]:
        """Build CV standardization prompt."""
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

        return [{"role": "user", "content": prompt}]
    
    def _build_jd_prompt(self, text: str) -> List[Dict[str, str]]:
        """Build JD standardization prompt."""
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

        return [{"role": "user", "content": prompt}]
    
    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """Parse JSON response from LLM, handling various formats."""
        # Clean the response
        cleaned_content = re.sub(r'```(json)?', '', content, flags=re.IGNORECASE).strip()
        
        # Find JSON boundaries
        json_start = cleaned_content.find('{')
        json_end = cleaned_content.rfind('}')
        
        if json_start != -1 and json_end != -1:
            json_str = cleaned_content[json_start:json_end + 1]
            return json.loads(json_str)
        else:
            raise json.JSONDecodeError("No valid JSON found in response", content, 0)
    
    def _validate_cv_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean CV response data."""
        validated = data.copy()
        
        # Ensure required fields exist
        required_fields = ["skills", "responsibilities", "experience_years", "job_title", "document_type"]
        for field in required_fields:
            if field not in validated:
                if field in ["skills", "responsibilities"]:
                    validated[field] = []
                elif field == "document_type":
                    validated[field] = "CV"
                else:
                    validated[field] = "Not specified"
        
        # Clean and validate skills (max 20)
        skills = validated.get("skills", [])
        if isinstance(skills, list):
            clean_skills = [skill.strip() for skill in skills if skill.strip() and len(skill.strip().split()) <= 3]
            validated["skills"] = clean_skills[:20]  # Limit to 20
        
        # Ensure exactly 10 responsibilities
        responsibilities = validated.get("responsibilities", [])
        if isinstance(responsibilities, list):
            if len(responsibilities) < 10:
                # Pad with generic responsibilities
                while len(responsibilities) < 10:
                    responsibilities.append("Collaborated with team members on project deliverables")
            elif len(responsibilities) > 10:
                responsibilities = responsibilities[:10]
            validated["responsibilities"] = responsibilities
        
        # Ensure backward compatibility
        validated["years_of_experience"] = validated.get("experience_years", "Not specified")
        
        return validated
    
    def _validate_jd_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean JD response data."""
        validated = data.copy()
        
        # Ensure required fields exist
        required_fields = ["skills", "responsibilities", "experience_years", "job_title", "document_type"]
        for field in required_fields:
            if field not in validated:
                if field in ["skills", "responsibilities"]:
                    validated[field] = []
                elif field == "document_type":
                    validated[field] = "JD"
                else:
                    validated[field] = "Not specified"
        
        # Ensure exactly 20 skills for JDs
        skills = validated.get("skills", [])
        if isinstance(skills, list):
            clean_skills = [skill.strip() for skill in skills if skill.strip() and len(skill.strip().split()) <= 3]
            if len(clean_skills) < 20:
                # Generate additional skills if needed
                generic_skills = self._generate_generic_skills(validated.get("job_title", ""), 20 - len(clean_skills))
                clean_skills.extend(generic_skills)
            elif len(clean_skills) > 20:
                clean_skills = clean_skills[:20]
            validated["skills"] = clean_skills
        
        # Ensure exactly 10 responsibilities
        responsibilities = validated.get("responsibilities", [])
        if isinstance(responsibilities, list):
            if len(responsibilities) < 10:
                # Pad with generic responsibilities
                while len(responsibilities) < 10:
                    responsibilities.append("Work collaboratively with team members on assigned projects.")
            elif len(responsibilities) > 10:
                responsibilities = responsibilities[:10]
            validated["responsibilities"] = responsibilities
        
        # Ensure backward compatibility
        validated["years_of_experience"] = validated.get("experience_years", "Not specified")
        validated["responsibility_sentences"] = validated.get("responsibilities", [])
        
        return validated
    
    def _generate_generic_skills(self, job_title: str, count_needed: int) -> List[str]:
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
        
        return base_skills[:count_needed]
    
    def _process_large_cv(self, text: str, filename: str) -> Dict[str, Any]:
        """Process very large CV documents using chunking strategy."""
        logger.info(f"⚠️ Processing large CV document ({len(text):,} chars) with chunking")
        
        # Split into chunks
        chunk_size = 120000
        chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
        
        all_results = []
        for i, chunk in enumerate(chunks):
            logger.info(f"📄 Processing CV chunk {i+1}/{len(chunks)}")
            prompt = self._build_cv_prompt(chunk)
            response = self._call_openai_api(prompt)
            
            if response.success:
                chunk_data = self._validate_cv_response(response.data)
                chunk_data["chunk_number"] = i + 1
                all_results.append(chunk_data)
        
        # Combine results from all chunks
        return self._combine_cv_chunks(all_results, filename)
    
    def _process_large_jd(self, text: str, filename: str) -> Dict[str, Any]:
        """Process very large JD documents using chunking strategy."""
        logger.info(f"⚠️ Processing large JD document ({len(text):,} chars) with chunking")
        
        # Split into chunks
        chunk_size = 120000
        chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
        
        all_results = []
        for i, chunk in enumerate(chunks):
            logger.info(f"📄 Processing JD chunk {i+1}/{len(chunks)}")
            prompt = self._build_jd_prompt(chunk)
            response = self._call_openai_api(prompt)
            
            if response.success:
                chunk_data = self._validate_jd_response(response.data)
                chunk_data["chunk_number"] = i + 1
                all_results.append(chunk_data)
        
        # Combine results from all chunks
        return self._combine_jd_chunks(all_results, filename)
    
    def _combine_cv_chunks(self, chunk_results: List[Dict[str, Any]], filename: str) -> Dict[str, Any]:
        """Combine CV results from multiple chunks."""
        if not chunk_results:
            raise Exception("No chunk results to combine")
        
        combined = chunk_results[0].copy()
        
        if len(chunk_results) > 1:
            all_skills = set()
            all_responsibilities = []
            
            for chunk in chunk_results:
                if isinstance(chunk.get("skills"), list):
                    all_skills.update(chunk["skills"])
                if isinstance(chunk.get("responsibilities"), list):
                    all_responsibilities.extend(chunk["responsibilities"])
            
            # Deduplicate and limit
            combined["skills"] = list(all_skills)[:20]
            
            # Deduplicate responsibilities and limit to 10
            unique_responsibilities = []
            for resp in all_responsibilities:
                if resp not in unique_responsibilities:
                    unique_responsibilities.append(resp)
            combined["responsibilities"] = unique_responsibilities[:10]
            
            # Pad to exactly 10 if needed
            while len(combined["responsibilities"]) < 10:
                combined["responsibilities"].append("Additional responsibility from document analysis")
        
        combined["processing_metadata"]["total_chunks"] = len(chunk_results)
        combined["processing_metadata"]["combined_processing"] = True
        
        return combined
    
    def _combine_jd_chunks(self, chunk_results: List[Dict[str, Any]], filename: str) -> Dict[str, Any]:
        """Combine JD results from multiple chunks."""
        if not chunk_results:
            raise Exception("No chunk results to combine")
        
        combined = chunk_results[0].copy()
        
        if len(chunk_results) > 1:
            all_skills = set()
            all_responsibilities = []
            
            for chunk in chunk_results:
                if isinstance(chunk.get("skills"), list):
                    all_skills.update(chunk["skills"])
                if isinstance(chunk.get("responsibilities"), list):
                    all_responsibilities.extend(chunk["responsibilities"])
            
            # Deduplicate and limit to exactly 20 skills
            combined["skills"] = list(all_skills)[:20]
            
            # Deduplicate responsibilities and limit to 10
            unique_responsibilities = []
            for resp in all_responsibilities:
                if resp not in unique_responsibilities:
                    unique_responsibilities.append(resp)
            combined["responsibilities"] = unique_responsibilities[:10]
            
            # Pad to required counts
            while len(combined["skills"]) < 20:
                generic_skills = self._generate_generic_skills(combined.get("job_title", ""), 20 - len(combined["skills"]))
                combined["skills"].extend(generic_skills)
                combined["skills"] = combined["skills"][:20]
            
            while len(combined["responsibilities"]) < 10:
                combined["responsibilities"].append("Additional responsibility identified from job description analysis.")
        
        combined["processing_metadata"]["total_chunks"] = len(chunk_results)
        combined["processing_metadata"]["combined_processing"] = True
        
        return combined

# Global instance
_llm_service: Optional[LLMService] = None

def get_llm_service() -> LLMService:
    """Get global LLM service instance."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
