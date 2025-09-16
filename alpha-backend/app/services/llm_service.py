
"""
LLM Service - Deterministic, Cached, Structured Extraction
----------------------------------------------------------
- Pinned model snapshot + seed + temp=0, top_p=1, penalties=0
- response_format JSON (or JSON Schema strict mode via env)
- Normalizes source text; caches by (kind, model, seed, prompt, text) SHA256
- Stable, deterministic ordering of phrases by first source occurrence
- JD prompt updated to NOT invent extra phrases (pads with "")
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
import unicodedata
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

# =========================
# ---- Prompts (final) ----
# =========================

DEFAULT_CV_PROMPT = """You are an information-extraction engine. You will receive the full plain text of ONE resume/CV.
Your job is to output STRICT JSON with the following schema, extracting:
Candidate NAME
Exactly 20 SKILL PHRASES (by reviewing the full CV and understanding the skills possessed by this candidate; if fewer than 20 exist, leave the remaining slots as "").
Exactly 10 RESPONSIBILITY PHRASES (from WORK EXPERIENCE / PROFESSIONAL EXPERIENCE sections; if fewer than 10, derive the remaining from CERTIFICATIONS or other professional sections, but never from skills).
The most recent JOB TITLE.
YEARS OF EXPERIENCE (total professional experience by seeing the date the candidate started working and taking a general calculation from start to present; you may infer from phrases like "15 years of experience").
JOB CATEGORY: Classify the candidate's role as one of (Technical/Management/Sales/Finance/HR/Marketing/Operations/Specialized).
SENIORITY LEVEL: Determine the seniority as one of (Entry/Junior/Mid/Senior/Lead/Manager/Director/VP/C-Level).
ROLE FAMILY: Identify the role family such as (Engineering/Management/Sales/Finance/HR/Marketing/Operations/Healthcare/Education/etc).
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
  "job_category": string | null,
  "seniority_level": string | null,
  "role_family": string | null,
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
Exactly 20 SKILL PHRASES (prefer SKILLS, REQUIREMENTS, QUALIFICATIONS, TECHNOLOGY STACK sections; read the full document. If fewer than 20 exist, leave remaining slots as "").
Exactly 10 RESPONSIBILITY PHRASES (from RESPONSIBILITIES, DUTIES, WHAT YOU'LL DO sections; if fewer than 10 exist, leave remaining slots as "").
The JOB TITLE of the role. IMPORTANT: Look for explicit job titles in the document first. If no explicit title is found, intelligently infer based on the primary technologies and skills:
  - SharePoint + .NET/C# skills → "SharePoint Developer" or "SharePoint/.NET Developer"
  - React/Angular + Node.js/ASP.NET → "Full Stack Developer"
  - Python + Data analysis → "Data Analyst" or "Python Developer"
  - Azure + DevOps → "DevOps Engineer"
  - If multiple senior technologies → Add "Senior" prefix
  - NEVER return null - always provide a reasonable job title.
YEARS OF EXPERIENCE (minimum required). Look for explicit mentions like "5+ years", "minimum 3 years". If not found, infer:
  - Junior/Entry skills → 1-2 years
  - Multiple frameworks + integration → 3-5 years  
  - Architecture/DevOps/Leadership indicators → 5+ years
  - NEVER return null - always provide a number.
JOB CATEGORY: Classify the role as one of (Technical/Management/Sales/Finance/HR/Marketing/Operations/Specialized).
SENIORITY LEVEL: Determine the seniority as one of (Entry/Junior/Mid/Senior/Lead/Manager/Director/VP/C-Level).
ROLE FAMILY: Identify the role family such as (Engineering/Management/Sales/Finance/HR/Marketing/Operations/Healthcare/Education/etc).
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
Skills should come from SKILLS/REQUIREMENTS/QUALIFICATIONS sections; also review the full document.
Responsibilities should come from RESPONSIBILITIES/DUTIES/WHAT YOU’LL DO sections.
Expand acronyms into their full professional terms (e.g., CRM → Customer Relationship Management, API → Application Programming Interface). Apply consistently.
Ensure skills and responsibilities remain short, embedding-friendly phrases with no generic filler wording.
Skills and responsibilities must remain distinct, with no overlap.
Output Format:
{
  "doc_type": "job_description",
  "job_title": string | null,
  "years_of_experience": number | null,
  "job_category": string | null,
  "seniority_level": string | null,
  "role_family": string | null,
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

# ===================================
# ---- Optional JSON Schema lock ----
# ===================================

STRICT_SCHEMA_ENABLED = os.getenv("LLM_JSON_SCHEMA_STRICT", "0") not in {"0", "false", "False", ""}

CV_JSON_SCHEMA: Dict[str, Any] = {
    "name": "cv_schema",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "doc_type", "name", "job_title", "years_of_experience",
            "skills_sentences", "responsibility_sentences", "contact_info"
        ],
        "properties": {
            "doc_type": {"type": "string", "const": "resume"},
            "name": {"type": ["string", "null"]},
            "job_title": {"type": ["string", "null"]},
            "years_of_experience": {"type": ["number", "integer", "null"]},
            "skills_sentences": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 20,
                "maxItems": 20
            },
            "responsibility_sentences": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 10,
                "maxItems": 10
            },
            "contact_info": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name"],
                "properties": {"name": {"type": ["string", "null"]}}
            }
        }
    }
}

JD_JSON_SCHEMA: Dict[str, Any] = {
    "name": "jd_schema",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "doc_type", "job_title", "years_of_experience",
            "skills_sentences", "responsibility_sentences"
        ],
        "properties": {
            "doc_type": {"type": "string", "const": "job_description"},
            "job_title": {"type": ["string", "null"]},
            "years_of_experience": {"type": ["number", "integer", "null"]},
            "skills_sentences": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 20,
                "maxItems": 20
            },
            "responsibility_sentences": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 10,
                "maxItems": 10
            }
        }
    }
}

# ============================
# ---- Data structures ----
# ============================

@dataclass
class LLMResponse:
    success: bool
    data: Dict[str, Any]
    processing_time: float
    model_used: str
    error_message: Optional[str] = None
    system_fingerprint: Optional[str] = None


# ============================
# ---- Main service class ----
# ============================

class LLMService:
    """
    Deterministic, cached LLM extraction using OpenAI Chat Completions.
    """

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")

        # Pinned snapshot (override with env). Avoid floating aliases for stability.
        self.default_model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini-2025-04-14")

        # Determinism knobs
        self.seed = int(os.getenv("OPENAI_SEED", "1337"))
        self.max_retries = int(os.getenv("OPENAI_MAX_RETRIES", "2"))
        self.base_delay = float(os.getenv("OPENAI_RETRY_BASE_DELAY", "0.5"))

        # Cache on disk (works across restarts)
        self.cache_dir = os.getenv("LLM_CACHE_DIR", ".llm_cache")
        os.makedirs(self.cache_dir, exist_ok=True)

        # Endpoint & session
        self.base_url = "https://api.openai.com/v1/chat/completions"
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        })

        logger.info("🧠 LLMService initialized (deterministic & cached)")

    # ------------- Public APIs -------------

    def standardize_cv(self, raw_text: str, filename: str = "cv.txt") -> Dict[str, Any]:
        """
        Extract & standardize CV → normalized, stable JSON.
        Caches by (model+seed+prompt+normalized-text) to return identical results for identical content.
        """
        try:
            # Normalize + guard size
            norm = self._normalize_text(raw_text)
            if len(norm) > 50000:
                logger.warning(f"⚠️ Large CV detected ({len(norm):,}); truncating to 50k")
                norm = norm[:50000] + "\n\n[TRUNCATED FOR PROCESSING]"

            cache_key = self._hash_key("cv", norm)
            cached = self._cache_get(cache_key)
            if cached is not None:
                logger.info("📦 Cache hit (CV)")
                return cached

            messages = self._build_cv_prompt(norm)
            self._log_llm_outbound("CV", filename, norm, messages)

            response = self._call_openai_api(messages, json_schema=CV_JSON_SCHEMA if STRICT_SCHEMA_ENABLED else None)
            self._log_llm_inbound("CV", response)

            if not response.success:
                raise Exception(response.error_message or "Unknown LLM error")

            normalized = self._validate_cv_response(response.data, source_text=norm)
            normalized["processing_metadata"] = {
                "filename": filename,
                "processing_time": response.processing_time,
                "model_used": response.model_used,
                "system_fingerprint": response.system_fingerprint,
                "text_length": len(norm),
                "cache_key": cache_key,
            }

            self._cache_put(cache_key, normalized)
            return normalized

        except Exception as e:
            logger.error(f"❌ CV standardization failed: {e}")
            raise

    def standardize_jd(self, raw_text: str, filename: str = "jd.txt") -> Dict[str, Any]:
        """
        Extract & standardize JD → normalized, stable JSON.
        Caches by (model+seed+prompt+normalized-text) to return identical results for identical content.
        """
        try:
            norm = self._normalize_text(raw_text)
            if len(norm) > 30000:
                logger.warning(f"⚠️ Large JD detected ({len(norm):,}); truncating to 30k")
                norm = norm[:30000] + "\n\n[TRUNCATED FOR PROCESSING]"

            cache_key = self._hash_key("jd", norm)
            cached = self._cache_get(cache_key)
            if cached is not None:
                logger.info("📦 Cache hit (JD)")
                return cached

            messages = self._build_jd_prompt(norm)
            self._log_llm_outbound("JD", filename, norm, messages)

            response = self._call_openai_api(messages, json_schema=JD_JSON_SCHEMA if STRICT_SCHEMA_ENABLED else None)
            self._log_llm_inbound("JD", response)

            if not response.success:
                raise Exception(response.error_message or "Unknown LLM error")

            normalized = self._validate_jd_response(response.data, source_text=norm)
            normalized["processing_metadata"] = {
                "filename": filename,
                "processing_time": response.processing_time,
                "model_used": response.model_used,
                "system_fingerprint": response.system_fingerprint,
                "text_length": len(norm),
                "cache_key": cache_key,
            }

            self._cache_put(cache_key, normalized)
            return normalized

        except Exception as e:
            logger.error(f"❌ JD standardization failed: {e}")
            raise

    # ------------- OpenAI call -------------

    def _call_openai_api(
        self,
        messages: List[Dict[str, str]],
        *,
        model: Optional[str] = None,
        max_tokens: int = 1500,
        json_schema: Optional[Dict[str, Any]] = None
    ) -> LLMResponse:
        if not model:
            model = self.default_model

        # response_format: JSON object (or JSON Schema strict)
        if json_schema:
            response_format = {"type": "json_schema", "json_schema": json_schema}
        else:
            response_format = {"type": "json_object"}

        body = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.0,
            "top_p": 1,
            "n": 1,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "seed": self.seed,
            "response_format": response_format
        }

        start = time.time()
        last_err: Optional[str] = None

        for attempt in range(self.max_retries):
            try:
                logger.info(f"🤖 OpenAI API call (attempt {attempt + 1}/{self.max_retries}) - Model: {model}")
                r = self.session.post(self.base_url, json=body, timeout=60)
                if r.status_code == 200:
                    payload = r.json()
                    sys_fp = payload.get("system_fingerprint")
                    content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")

                    if not content or not content.strip():
                        raise Exception("Empty response from OpenAI")

                    data = self._parse_json_response(content)
                    return LLMResponse(
                        success=True,
                        data=data,
                        processing_time=time.time() - start,
                        model_used=model,
                        system_fingerprint=sys_fp
                    )

                # Retryable HTTP statuses
                if r.status_code in (429, 502, 503, 504):
                    last_err = f"API error: {r.status_code} - {r.text}"
                    if attempt < self.max_retries - 1:
                        delay = self.base_delay * (2 ** attempt)
                        logger.warning(f"⏳ {last_err}, retrying in {delay}s...")
                        time.sleep(delay)
                        continue
                # Non-retryable
                return LLMResponse(False, {}, time.time() - start, model, f"API error: {r.status_code} - {r.text}")

            except requests.exceptions.Timeout:
                last_err = "Timeout"
                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(f"⏳ Timeout, retrying in {delay}s...")
                    time.sleep(delay)
                    continue
                return LLMResponse(False, {}, time.time() - start, model, "Timeout")
            except Exception as e:
                last_err = str(e)
                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(f"⏳ Error: {e}, retrying in {delay}s...")
                    time.sleep(delay)
                    continue
                return LLMResponse(False, {}, time.time() - start, model, last_err)

        return LLMResponse(False, {}, time.time() - start, model, last_err or "All retries failed")

    # ------------- Prompt builders -------------

    def _build_cv_prompt(self, text: str) -> List[Dict[str, str]]:
        # Using a single user message keeps prompt hashing simple/stable.
        return [{"role": "user", "content": f"{DEFAULT_CV_PROMPT}\n\nCV CONTENT:\n{text}"}]

    def _build_jd_prompt(self, text: str) -> List[Dict[str, str]]:
        return [{"role": "user", "content": f"{DEFAULT_JD_PROMPT}\n\nJOB DESCRIPTION:\n{text}"}]

    # ------------- Parsing & validation -------------

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        # response_format is JSON, but we still guard against code fences etc.
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
        if len(cleaned) < target_len:
            cleaned.extend([""] * (target_len - len(cleaned)))
        return cleaned[:target_len]

    def _stable_order(self, phrases: List[str], source: str) -> List[str]:
        """
        Deterministic ordering: by first occurrence in source (case-insensitive),
        with blanks last; ties resolved lexicographically.
        """
        src = source.lower()
        tagged = []
        BIG = 10 ** 9
        for p in phrases:
            if not p:
                tagged.append((BIG, ""))  # blanks at end
            else:
                c = self._canonicalize(p)
                idx = src.find(c.lower())
                if idx < 0:
                    idx = BIG - 1
                tagged.append((idx, c))
        tagged.sort(key=lambda t: (t[0], t[1]))
        return [t[1] for t in tagged]

    def _canonicalize(self, s: str) -> str:
        s = unicodedata.normalize("NFKC", s).strip()
        s = re.sub(r"\s+", " ", s)
        return s

    def _validate_cv_response(self, data: Dict[str, Any], *, source_text: str) -> Dict[str, Any]:
        skills_src = data.get("skills_sentences") or data.get("skills") or []
        resp_src = data.get("responsibility_sentences") or data.get("responsibilities") or []

        skills = self._normalize_fixed_list(skills_src, 20)
        resps  = self._normalize_fixed_list(resp_src, 10)

        # deterministic ordering by appearance in source
        skills = self._stable_order(skills, source_text)
        resps  = self._stable_order(resps, source_text)

        out = {
            "doc_type": "resume",
            "name": data.get("name"),
            "job_title": data.get("job_title"),
            "years_of_experience": data.get("years_of_experience"),
            "skills_sentences": skills,
            "responsibility_sentences": resps,
            # Back-compat aliases
            "skills": skills,
            "responsibilities": resps,
            "contact_info": {"name": data.get("name")},
        }
        return out

    def _validate_jd_response(self, data: Dict[str, Any], *, source_text: str) -> Dict[str, Any]:
        skills_src = data.get("skills_sentences") or data.get("skills") or []
        resp_src   = data.get("responsibility_sentences") or data.get("responsibilities") or []

        skills = self._normalize_fixed_list(skills_src, 20)
        resps  = self._normalize_fixed_list(resp_src, 10)

        skills = self._stable_order(skills, source_text)
        resps  = self._stable_order(resps, source_text)

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

    # ------------- Normalization & cache -------------

    def _normalize_text(self, s: str) -> str:
        s = unicodedata.normalize("NFKC", s)
        s = s.replace("\r\n", "\n").replace("\r", "\n")
        s = re.sub(r"[ \t]+", " ", s)
        s = re.sub(r"\n{3,}", "\n\n", s)
        return s.strip()

    def _hash_key(self, kind: str, text: str) -> str:
        # Include prompt + model + seed so any change invalidates cache deterministically
        prompt = DEFAULT_CV_PROMPT if kind == "cv" else DEFAULT_JD_PROMPT
        basis = f"{kind}||{self.default_model}||{self.seed}||{prompt}||{text}"
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()

    def _cache_path(self, key: str) -> str:
        return os.path.join(self.cache_dir, f"{key}.json")

    def _cache_get(self, key: str) -> Optional[Dict[str, Any]]:
        p = self._cache_path(key)
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Cache read failed for {p}: {e}")
        return None

    def _cache_put(self, key: str, obj: Dict[str, Any]) -> None:
        p = self._cache_path(key)
        try:
            with open(p, "w", encoding="utf-8") as f:
                json.dump(obj, f, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Cache write failed for {p}: {e}")

    # ------------- Logging helpers -------------

    def _log_llm_outbound(self, kind: str, filename: str, raw_text: str, messages: List[Dict[str, str]]):
        logger.info(f"---------- DATA SENT TO LLM ({kind}) ----------")
        logger.info(f"Filename: {filename}")
        logger.info(f"Text length: {len(raw_text)} characters")
        logger.info(f"Prompt (first 1500 chars):\n{messages[0]['content'][:1500]}")
        logger.info("----------------------------------------------")

    def _log_llm_inbound(self, kind: str, response: LLMResponse):
        logger.info(f"---------- RESPONSE FROM LLM ({kind}) ----------")
        logger.info(f"Success: {response.success}")
        logger.info(f"Processing time: {response.processing_time:.2f}s")
        logger.info(f"Model used: {response.model_used}")
        logger.info(f"system_fingerprint: {response.system_fingerprint}")
        if response.success:
            logger.info(f"Response data keys: {list(response.data.keys())}")
        else:
            logger.info(f"Error message: {response.error_message}")
        logger.info("-----------------------------------------------")

    def extract_jd_for_ui_display(self, content: str, filename: str) -> Optional[Dict[str, Any]]:
        """
        Extract human-readable, candidate-facing information from JD content.
        This is separate from the matching pipeline and focuses on clear, professional presentation.
        """
        try:
            # New prompt specifically for UI display
            ui_extraction_prompt = f"""
You are a job description parser. Your ONLY job is to extract the EXACT information from the provided job description text below.

DO NOT CREATE, INVENT, OR GENERATE ANY CONTENT. ONLY EXTRACT what is actually written in the text.

If the text says "AI Consultant", return "AI Consultant". If it says "Senior Software Engineer", return "Senior Software Engineer". Extract exactly what is written.

Job Description Text:
{content}

Extract these 5 fields from the text above:

1. job_title: Find the exact job title mentioned in the text (e.g., "AI Consultant", "Senior AI Consultant", "Data Scientist")
2. job_location: Find location information if mentioned, otherwise use "Location not specified"
3. job_summary: Write 2-3 sentences summarizing what this role does based on the text
4. key_responsibilities: List 3-5 main responsibilities mentioned in the text as bullet points
5. qualifications: List 3-5 required skills/qualifications mentioned in the text as bullet points

Return ONLY this JSON format:
{{
    "job_title": "exact title from text",
    "job_location": "location from text or 'Location not specified'",
    "job_summary": "summary based on text content",
    "key_responsibilities": "• responsibility from text\\n• another responsibility from text",
    "qualifications": "• qualification from text\\n• another qualification from text"
}}
"""

            messages = [
                {"role": "system", "content": "You are a text extraction tool. Extract only what is written in the provided text. Do not generate or create any content."},
                {"role": "user", "content": ui_extraction_prompt}
            ]
            
            # Debug: Log what's being sent to LLM
            logger.info(f"🔍 UI Extraction - Content length: {len(content)} characters")
            logger.info(f"🔍 UI Extraction - Content preview: {content[:300]}...")
            
            response = self._call_openai_api(
                messages=messages,
                max_tokens=2000
            )
            
            # Debug: Log what's received from LLM
            if response.success:
                logger.info(f"🔍 UI Extraction - LLM Response: {response.data}")
            else:
                logger.error(f"🔍 UI Extraction - LLM Error: {response.error_message}")
            
            if not response.success:
                logger.error(f"❌ Failed to extract UI data: {response.error_message}")
                return None
            
            ui_data = response.data
            
            # Validate required fields
            required_fields = ["job_title", "job_location", "job_summary", "key_responsibilities", "qualifications"]
            for field in required_fields:
                if field not in ui_data:
                    ui_data[field] = ""
            
            logger.info(f"✅ UI data extracted successfully for {filename}")
            return ui_data
            
        except Exception as e:
            logger.error(f"❌ Failed to extract UI data: {e}")
            return None

    def _infer_job_title_from_skills(self, skills: list) -> str:
        """Infer job title from skills when not explicitly provided"""
        if not skills:
            return "Software Developer"
        
        skills_text = " ".join(skills).lower()
        
        # SharePoint-focused roles
        if "sharepoint" in skills_text and ("asp.net" in skills_text or ".net" in skills_text):
            return "SharePoint/.NET Developer"
        elif "sharepoint" in skills_text:
            return "SharePoint Developer"
        
        # .NET focused roles
        elif "asp.net" in skills_text or (".net" in skills_text and "core" in skills_text):
            return ".NET Developer"
        
        # Full stack indicators
        elif ("react" in skills_text or "angular" in skills_text) and ("node" in skills_text or "asp.net" in skills_text or ".net" in skills_text):
            return "Full Stack Developer"
        
        # Frontend roles
        elif "react" in skills_text or "angular" in skills_text or "vue" in skills_text:
            return "Frontend Developer"
        
        # Backend roles
        elif "api" in skills_text and ("c#" in skills_text or "python" in skills_text or "java" in skills_text):
            return "Backend Developer"
        
        # Data roles
        elif "python" in skills_text and ("data" in skills_text or "analytics" in skills_text):
            return "Data Analyst"
        
        # DevOps roles
        elif "azure" in skills_text and ("devops" in skills_text or "ci/cd" in skills_text):
            return "DevOps Engineer"
        
        # Default fallback
        return "Software Developer"
    
    def _infer_experience_from_skills(self, skills: list) -> int:
        """Infer years of experience from skill complexity"""
        if not skills:
            return 3
        
        skills_text = " ".join(skills).lower()
        
        # Senior indicators (5+ years)
        senior_indicators = ["architecture", "design patterns", "leadership", "mentoring", "azure devops", "microservices"]
        if any(indicator in skills_text for indicator in senior_indicators):
            return 5
        
        # Mid-level indicators (3-5 years)
        mid_indicators = ["framework", "integration", "oauth", "authentication", "deployment", "sql server"]
        if any(indicator in skills_text for indicator in mid_indicators):
            return 3
        
        # Entry level default (1-2 years)
        return 2


# ============================
# ---- Thin helpers / DI  ----
# ============================

_llm_service: Optional[LLMService] = None

def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


# Keep your existing async route helper for JD
async def extract_jd(jd_text: str) -> Dict[str, Any]:
    """
    Extract JD structure from raw text (no DB). Returns:
      { job_title, years_of_experience, skills_sentences[20], responsibility_sentences[10] }
    """
    service = get_llm_service()
    data = service.standardize_jd(jd_text, "jd_input.txt")
    # Normalize keys (already fixed-length and ordered)
    return {
        "job_title": data.get("job_title", ""),
        "years_of_experience": data.get("years_of_experience", 0),
        "skills_sentences": (data.get("skills_sentences") or data.get("skills") or [])[:20],
        "responsibility_sentences": (data.get("responsibility_sentences") or data.get("responsibilities") or [])[:10],
    }


# (Optional) symmetry helper if you want parity with extract_jd
async def extract_cv(cv_text: str) -> Dict[str, Any]:
    """
    Extract CV structure from raw text (no DB). Returns:
      { name, job_title, years_of_experience, skills_sentences[20], responsibility_sentences[10] }
    """
    service = get_llm_service()
    data = service.standardize_cv(cv_text, "cv_input.txt")
    return {
        "name": data.get("name", None),
        "job_title": data.get("job_title", ""),
        "years_of_experience": data.get("years_of_experience", 0),
        "skills_sentences": data.get("skills_sentences", []),
        "responsibility_sentences": data.get("responsibility_sentences", []),
    }