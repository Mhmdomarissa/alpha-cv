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
    Uses OpenAI Chat Completions endpoint (via requests.Session).
    """

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")

        # We use the HTTP endpoint directly to avoid SDK differences
        self.base_url = "https://api.openai.com/v1/chat/completions"
        self.default_model = "gpt-4o-mini"  # keep in sync with infra
        self.max_retries = 2
        self.base_delay = 0.5

        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        })

        logger.info("🧠 LLMService initialized")

    # ------------ Public: standardization ------------

    def standardize_cv(self, raw_text: str, filename: str = "cv.txt") -> Dict[str, Any]:
        """Extract and standardize CV content to a normalized JSON."""
        try:
            logger.info(f"🔍 Standardizing CV: {filename} ({len(raw_text):,} chars)")
            if len(raw_text) > 50000:
                logger.warning(f"⚠️ Large CV detected ({len(raw_text):,}); truncating to 50k")
                raw_text = raw_text[:50000] + "\n\n[TRUNCATED FOR PROCESSING]"

            messages = self._build_cv_prompt(raw_text)
            self._log_llm_outbound("CV", filename, raw_text, messages)
            response = self._call_openai_api(messages)

            self._log_llm_inbound("CV", response)
            if not response.success:
                raise Exception(response.error_message or "Unknown LLM error")

            normalized = self._validate_cv_response(response.data)
            # attach processing metadata
            normalized["processing_metadata"] = {
                "filename": filename,
                "processing_time": response.processing_time,
                "model_used": response.model_used,
                "text_length": len(raw_text),
            }
            logger.info(f"✅ CV standardized: {len(normalized.get('skills', []))} skills, "
                        f"{len(normalized.get('responsibilities', []))} responsibilities")
            return normalized
        except Exception as e:
            logger.error(f"❌ CV standardization failed: {e}")
            raise

    def standardize_jd(self, raw_text: str, filename: str = "jd.txt") -> Dict[str, Any]:
        """Extract and standardize JD content to a normalized JSON."""
        try:
            logger.info(f"🔍 Standardizing JD: {filename} ({len(raw_text):,} chars)")
            if len(raw_text) > 30000:
                logger.warning(f"⚠️ Large JD detected ({len(raw_text):,}); truncating to 30k")
                raw_text = raw_text[:30000] + "\n\n[TRUNCATED FOR PROCESSING]"

            messages = self._build_jd_prompt(raw_text)
            self._log_llm_outbound("JD", filename, raw_text, messages)
            response = self._call_openai_api(messages)

            self._log_llm_inbound("JD", response)
            if not response.success:
                raise Exception(response.error_message or "Unknown LLM error")

            normalized = self._validate_jd_response(response.data)
            normalized["processing_metadata"] = {
                "filename": filename,
                "processing_time": response.processing_time,
                "model_used": response.model_used,
                "text_length": len(raw_text),
            }
            logger.info(f"✅ JD standardized: {len(normalized.get('skills', []))} skills, "
                        f"{len(normalized.get('responsibilities', []))} responsibilities")
            return normalized
        except Exception as e:
            logger.error(f"❌ JD standardization failed: {e}")
            raise

    # ------------ Internal: OpenAI call ------------

    def _call_openai_api(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        max_tokens: int = 1500,
        temperature: float = 0.0
    ) -> LLMResponse:
        if not model:
            model = self.default_model

        body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
        start = time.time()

        for attempt in range(self.max_retries):
            try:
                logger.info(f"🤖 OpenAI API call (attempt {attempt + 1}/{self.max_retries}) - Model: {model}")
                r = self.session.post(self.base_url, json=body, timeout=60)
                if r.status_code == 200:
                    payload = r.json()
                    if not payload.get("choices"):
                        raise Exception(f"Invalid API response: {payload}")
                    content = payload["choices"][0]["message"]["content"]
                    if not content or not content.strip():
                        raise Exception("Empty response from OpenAI")

                    try:
                        data = self._parse_json_response(content)
                        return LLMResponse(
                            success=True,
                            data=data,
                            processing_time=time.time() - start,
                            model_used=model,
                        )
                    except json.JSONDecodeError as je:
                        logger.error(f"JSON parsing failed: {je}")
                        logger.error(f"Raw response: {content}")
                        raise

                # retryable errors
                if r.status_code in (429, 502, 503, 504):
                    if attempt < self.max_retries - 1:
                        delay = self.base_delay * (2 ** attempt)
                        logger.warning(f"⏳ API error {r.status_code}, retrying in {delay}s...")
                        time.sleep(delay)
                        continue
                raise Exception(f"API error: {r.status_code} - {r.text}")
            except requests.exceptions.Timeout:
                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(f"⏳ Timeout, retrying in {delay}s...")
                    time.sleep(delay)
                    continue
                return LLMResponse(False, {}, time.time() - start, model, "Timeout")
            except Exception as e:
                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(f"⏳ Error: {e}, retrying in {delay}s...")
                    time.sleep(delay)
                    continue
                return LLMResponse(False, {}, time.time() - start, model, str(e))

        return LLMResponse(False, {}, time.time() - start, model, "All retries failed")

    # ------------ Prompt builders ------------

    def _build_cv_prompt(self, text: str) -> List[Dict[str, str]]:
        prompt = f"""Extract from CV and return JSON with EXACTLY this structure:

Skills: EXACTLY 20 skills as complete sentences starting with action verbs.
Responsibilities: EXACTLY 10 responsibilities from recent positions.
Experience Years: Number only (e.g., "5" or "3-5")
Job Title: Current/most recent title
Contact Info: Extract name, email, phone

Return JSON with EXACTLY this format:
{{
  "skills": ["... 20 items exactly ..."],
  "responsibilities": ["... 10 items exactly ..."],
  "experience_years": "5",
  "job_title": "Senior Software Engineer",
  "contact_info": {{"name": "John Doe", "email": "john@email.com", "phone": "+1234567890"}}
}}

CV CONTENT:
{text}"""
        return [{"role": "user", "content": prompt}]

    def _build_jd_prompt(self, text: str) -> List[Dict[str, str]]:
        prompt = f"""Extract from Job Description and return JSON with EXACTLY this structure:

Skills: EXACTLY 20 required skills as complete sentences starting with action verbs.
Responsibilities: EXACTLY 10 job responsibilities.
Experience Years: Required experience (e.g., "5" or "3-5")
Job Title: Position title

Return JSON with EXACTLY this format:
{{
  "skills": ["... 20 items exactly ..."],
  "responsibilities": ["... 10 items exactly ..."],
  "experience_years": "5",
  "job_title": "Senior Software Engineer"
}}

JOB DESCRIPTION:
{text}"""
        return [{"role": "user", "content": prompt}]

    # ------------ Parsing & validation ------------

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        cleaned = re.sub(r'```(json)?', '', content, flags=re.IGNORECASE).strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1:
            raise json.JSONDecodeError("No valid JSON found", content, 0)
        return json.loads(cleaned[start:end + 1])

    def _validate_cv_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        out = data.copy()

        # Normalize key names (we standardize on "experience_years")
        if "experience_years" not in out and "years_of_experience" in out:
            out["experience_years"] = out.get("years_of_experience")
        if "years_of_experience" not in out and "experience_years" in out:
            out["years_of_experience"] = out.get("experience_years")

        out.setdefault("skills", [])
        out.setdefault("responsibilities", [])
        out.setdefault("experience_years", "Not specified")
        out.setdefault("job_title", "Not specified")

        # Force counts
        skills = [s.strip() for s in (out.get("skills") or []) if s and s.strip()]
        out["skills"] = (skills + ["General professional skills and competencies"] * 20)[:20]

        resps = [r.strip() for r in (out.get("responsibilities") or []) if r and r.strip()]
        if len(resps) < 10:
            resps += ["Collaborated with team members on project deliverables"] * (10 - len(resps))
        out["responsibilities"] = resps[:10]

        return out

    def _validate_jd_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        out = data.copy()

        # Normalize key names
        if "experience_years" not in out and "years_of_experience" in out:
            out["experience_years"] = out.get("years_of_experience")
        if "years_of_experience" not in out and "experience_years" in out:
            out["years_of_experience"] = out.get("experience_years")

        out.setdefault("skills", [])
        out.setdefault("responsibilities", [])
        out.setdefault("experience_years", "Not specified")
        out.setdefault("job_title", "Not specified")

        # Force exact counts
        skills = [s.strip() for s in (out.get("skills") or []) if s and s.strip()]
        while len(skills) < 20:
            skills.append("General professional skills and competencies")
        out["skills"] = skills[:20]

        resps = [r.strip() for r in (out.get("responsibilities") or []) if r and r.strip()]
        while len(resps) < 10:
            resps.append("Work collaboratively with team members on assigned projects.")
        out["responsibilities"] = resps[:10]

        # Back-compat field
        out["responsibility_sentences"] = out["responsibilities"]
        return out

    # ------------ Logging helpers ------------

    def _log_llm_outbound(self, kind: str, filename: str, raw_text: str, messages: List[Dict[str, str]]):
        logger.info(f"---------- DATA SENT TO LLM ({kind}) ----------")
        logger.info(f"Filename: {filename}")
        logger.info(f"Text length: {len(raw_text)} characters")
        logger.info(f"Prompt:\n{messages[0]['content'][:1500]}")
        logger.info("----------------------------------------------")

    def _log_llm_inbound(self, kind: str, response: LLMResponse):
        logger.info(f"---------- RESPONSE FROM LLM ({kind}) ----------")
        logger.info(f"Success: {response.success}")
        logger.info(f"Processing time: {response.processing_time:.2f}s")
        logger.info(f"Model used: {response.model_used}")
        if response.success:
            logger.info(f"Response data keys: {list(response.data.keys())}")
        else:
            logger.info(f"Error message: {response.error_message}")
        logger.info("-----------------------------------------------")


# -------- Thin helpers used by routes/special endpoints --------

_llm_service: Optional[LLMService] = None

def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service

async def extract_jd(jd_text: str) -> Dict[str, Any]:
    """
    Extract JD structure from raw text (no DB). Returns SAME shape as our DB-structured JD:
      { job_title, years_of_experience, skills_sentences[20], responsibility_sentences[10] }
    """
    service = get_llm_service()
    data = service.standardize_jd(jd_text, "jd_input.txt")
    # Normalize to expected keys
    return {
        "job_title": data.get("job_title", ""),
        "years_of_experience": data.get("experience_years", data.get("years_of_experience", 0)),
        "skills_sentences": (data.get("skills") or [])[:20],
        "responsibility_sentences": (data.get("responsibilities") or data.get("responsibility_sentences") or [])[:10],
    }
