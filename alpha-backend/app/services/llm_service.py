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

# ----------------- Updated Prompts -----------------
DEFAULT_CV_PROMPT = """You are an information-extraction engine. You will receive the full plain text of ONE resume/CV.
Your job is to output STRICT JSON with the following schema, extracting:
Candidate NAME
Exactly 20 SKILL PHRASES (by reviewing the full CV and understanding the skills possessed by this candidate; if fewer than 20 exist, leave the remaining slots as "").
Exactly 10 RESPONSIBILITY PHRASES (from WORK EXPERIENCE / PROFESSIONAL EXPERIENCE sections; if fewer than 10, derive the remaining from CERTIFICATIONS or other professional sections, but never from skills).
The most recent JOB TITLE.
YEARS OF EXPERIENCE (total professional experience by seeing the date the candidate started working and taking a general calculation from start to present. do not calculate using code and you may infer from the text in the CV if you find phrases such as "15 years of experience").
General Rules:
Output valid JSON only. No markdown, no comments, no trailing commas.
Use English only.
Do not invent facts. If something is missing, leave empty strings "" or null.
Arrays must be fixed length: skills_sentences = 20, responsibility_sentences = 10.
De-duplicate near-duplicates (case-insensitive). Keep the most informative version.
Each skill/responsibility must be a concise, descriptive phrase (not a full sentence).
Example: "active directory security assessments to strengthen authentication and access controls"
Avoid: "Performs active directory security assessments to strengthen authentication and access controls."
Remove filler verbs such as performs, provides, carries out, responsible for, manages, oversees.
Skills must be derived by reviewing the full document and understanding what skills the candidate possesses.
Responsibilities must come only from EXPERIENCE/WORK HISTORY sections (and CERTIFICATIONS if needed).
Expand acronyms into their full professional terms (e.g., AWS → Amazon Web Services, SQL → Structured Query Language). Apply consistently.
Ensure skill and responsibility lists are domain-specific phrases only without generic wording.
No duplication across skills and responsibilities.
Output Format:
{
  "doc_type": "resume",
  "name": string | null,
  "job_title": string | null,
  "years_of_experience": number | null,
  "skills_sentences": [
    "<Skill phrase 1>",
    "... (total 20 items)",
    ""
  ],
  "responsibility_sentences": [
    "<Responsibility phrase 1>",
    "... (total 10 items)",
    ""
  ],
  "contact_info": {"name": string | null}
}
"""

DEFAULT_JD_PROMPT = """You are an information-extraction engine. You will receive the full plain text of ONE job description (JD).
Your job is to output STRICT JSON with the following schema, extracting:
Exactly 20 SKILL PHRASES (by preferring SKILLS, REQUIREMENTS, QUALIFICATIONS, TECHNOLOGY STACK sections, however read the full document and suggest what skills are required for this position; if fewer than 20 exist, create additional descriptive phrases from related requirements until 20 are filled).
Exactly 10 RESPONSIBILITY PHRASES (from RESPONSIBILITIES, DUTIES, WHAT YOU’LL DO sections; if fewer than 10 exist, expand implied responsibilities until 10 are filled).
The JOB TITLE of the role.
YEARS OF EXPERIENCE (minimum required, if explicitly stated; if a range is given, use the minimum).
General Rules:
Output valid JSON only. No markdown, no comments, no trailing commas.
Use English only.
Do not invent facts. If something is missing, leave empty strings "" or null.
Arrays must be fixed length: skills_sentences = 20, responsibility_sentences = 10.
De-duplicate near-duplicates (case-insensitive). Keep the most informative version.
Each skill/responsibility must be a concise, descriptive phrase (not a full sentence).
Example: "structured query language database administration"
Avoid: "Uses Structured Query Language to administer relational databases."
Remove filler verbs such as develops, implements, provides, generates, manages, responsible for.
Skills should come from SKILLS/REQUIREMENTS/QUALIFICATIONS sections, however review the full document and suggest the skills required for this position.
Responsibilities should come from RESPONSIBILITIES/DUTIES/WHAT YOU’LL DO sections.
Expand acronyms into their full professional terms (e.g., CRM → Customer Relationship Management, API → Application Programming Interface). Apply consistently.
Ensure skills and responsibilities remain short, embedding-friendly phrases with no generic filler wording.
Skills and responsibilities must remain distinct, with no overlap.
Output Format:
{
  "doc_type": "job_description",
  "job_title": string | null,
  "years_of_experience": number | null,
  "skills_sentences": [
    "<Skill phrase 1>",
    "... (total 20 items)",
    ""
  ],
  "responsibility_sentences": [
    "<Responsibility phrase 1>",
    "... (total 10 items)",
    ""
  ]
}
"""

# ----------------- Data structures -----------------
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
        self.default_model = "gpt-4.1-mini"  # keep in sync with infra
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
            logger.info(
                f"✅ CV standardized: {len(normalized.get('skills_sentences', []))} skills, "
                f"{len(normalized.get('responsibility_sentences', []))} responsibilities"
            )
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
            logger.info(
                f"✅ JD standardized: {len(normalized.get('skills_sentences', []))} skills, "
                f"{len(normalized.get('responsibility_sentences', []))} responsibilities"
            )
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
        return [{"role": "user", "content": f"{DEFAULT_CV_PROMPT}\n\nCV CONTENT:\n{text}"}]

    def _build_jd_prompt(self, text: str) -> List[Dict[str, str]]:
        return [{"role": "user", "content": f"{DEFAULT_JD_PROMPT}\n\nJOB DESCRIPTION:\n{text}"}]

    # ------------ Parsing & validation ------------

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        cleaned = re.sub(r'```(json)?', '', content, flags=re.IGNORECASE).strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1:
            raise json.JSONDecodeError("No valid JSON found", content, 0)
        return json.loads(cleaned[start:end + 1])

    @staticmethod
    def _normalize_fixed_list(items: Optional[List[Any]], target_len: int) -> List[str]:
        """
        Trim whitespace, drop empties, de-duplicate case-insensitively,
        then pad to target_len with "" and truncate if needed.
        """
        cleaned: List[str] = []
        seen = set()
        for x in (items or []):
            s = ("" if x is None else str(x)).strip()
            if not s:
                continue
            key = s.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(s)
        # pad / trim
        if len(cleaned) < target_len:
            cleaned.extend([""] * (target_len - len(cleaned)))
        return cleaned[:target_len]

    def _validate_cv_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        # prefer new keys, fall back to legacy if present
        skills_src = data.get("skills_sentences") or data.get("skills") or []
        resp_src = data.get("responsibility_sentences") or data.get("responsibilities") or []

        skills = self._normalize_fixed_list(skills_src, 20)
        resps  = self._normalize_fixed_list(resp_src, 10)

        out = {
            "doc_type": "resume",
            "name": data.get("name"),
            "job_title": data.get("job_title"),
            "years_of_experience": data.get("years_of_experience"),
            "skills_sentences": skills,
            "responsibility_sentences": resps,
            # Back-compat aliases so existing UI/DB that reads 'skills' / 'responsibilities' still works
            "skills": skills,
            "responsibilities": resps,
            "contact_info": {"name": data.get("name")},
        }
        return out

    def _validate_jd_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        skills_src = data.get("skills_sentences") or data.get("skills") or []
        resp_src   = data.get("responsibility_sentences") or data.get("responsibilities") or []

        skills = self._normalize_fixed_list(skills_src, 20)
        resps  = self._normalize_fixed_list(resp_src, 10)

        out = {
            "doc_type": "job_description",
            "job_title": data.get("job_title"),
            "years_of_experience": data.get("years_of_experience"),
            "skills_sentences": skills,
            "responsibility_sentences": resps,
            # Back-compat aliases
            "skills": skills,
            "responsibilities": resps,
        }
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
    skills = data.get("skills_sentences") or data.get("skills") or []
    resps  = data.get("responsibility_sentences") or data.get("responsibilities") or []
    return {
        "job_title": data.get("job_title", ""),
        "years_of_experience": data.get("years_of_experience", 0),
        "skills_sentences": skills[:20],
        "responsibility_sentences": resps[:10],
    }