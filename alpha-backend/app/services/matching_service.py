"""Matching Service - Consolidated CV-JD Matching Operations.

Uses EXACT 32-vector storage in {cv,jd}_embeddings and structured JSON in
{cv,jd}_structured. Edits here improve readability only.
"""
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
from scipy.optimize import linear_sum_assignment

from app.services.embedding_service import get_embedding_service
from app.utils.qdrant_utils import get_qdrant_utils
logger = logging.getLogger(__name__)

# ----------------------------
# Utilities
# ----------------------------
# normalize_weights function removed - no longer used with enhanced matching system

def years_score(jd_years: int, cv_years: int) -> float:
    if jd_years <= 0:
        return 1.0
    return min(1.0, float(cv_years) / float(jd_years))

def hungarian_mean(sim_matrix: np.ndarray) -> Tuple[float, List[Tuple[int, int, float]]]:
    """
    Hungarian algorithm - ALWAYS use CPU for EXACT results.
    GPU is used only for similarity calculations, not Hungarian algorithm.
    This ensures 100% identical results to the original CPU version.
    """
    if sim_matrix.size == 0:
        return 0.0, []
    
    # ALWAYS use CPU Hungarian algorithm for exact results
    # GPU is used for similarity matrix calculation, but Hungarian stays on CPU
    r_idx, c_idx = linear_sum_assignment(-sim_matrix)  # maximize
    
    pairs = [(int(r), int(c), float(sim_matrix[r, c])) for r, c in zip(r_idx, c_idx)]
    score = float(np.mean([p[2] for p in pairs])) if pairs else 0.0
    return score, pairs

def safe_parse_years(years_value) -> int:
    """Safely parse years of experience, handling string values like 'Not specified' or '5-8'."""
    if not years_value:
        return 0
    if isinstance(years_value, int):
        return years_value
    if isinstance(years_value, str):
        s = years_value.strip()
        if not s or s.lower() in {"not specified", "x years", "not applicable", "n/a"}:
            return 0
        if "-" in s:
            try:
                return int(s.split("-")[0].strip())
            except Exception:
                return 0
        try:
            s = s.replace(" years", "").replace("+", "").strip()
            return int(s)
        except Exception:
            return 0
    return 0

# ----------------------------
# Response models
# ----------------------------
@dataclass
class MatchResult:
    cv_id: str
    jd_id: str
    overall_score: float
    skills_score: float
    responsibilities_score: float
    title_score: float
    experience_score: float
    explanation: str
    match_details: Dict[str, Any]
    processing_time: float

# ----------------------------
# Matching Service
# ----------------------------
class MatchingService:
    # Enhanced scoring weights for logical job matching
    SCORING_WEIGHTS = {"job_title": 0.20, "skills": 0.50, "experience": 0.10, "responsibilities": 0.20}
    
    # Domain-based universal job title similarity system
    DOMAIN_KEYWORDS = {
        'sharepoint': ['sharepoint', 'sp', 'sharepoint online', 'sharepoint server', 'moss'],
        'azure': ['azure', 'microsoft cloud', 'azure infrastructure', 'azure solution', 'cloud engineer'],
        'business_intelligence': ['business intelligence', 'bi', 'data analytics', 'reporting', 'data visualization', 'data analyst', 'data specialist'],
        'power_platform': ['power platform', 'powerapps', 'power bi', 'power automate', 'dynamics', 'power platform developer'],
        'oracle': ['oracle', 'oracle ebs', 'oracle cloud', 'oracle database', 'plsql', 'oracle applications'],
        'data': ['data', 'database', 'sql', 'analytics', 'data science', 'big data', 'data engineer', 'data warehouse'],
        'cloud': ['cloud', 'aws', 'azure', 'gcp', 'google cloud', 'cloud infrastructure', 'cloud architect'],
        'systems': ['systems', 'infrastructure', 'network', 'server', 'hardware', 'systems engineer'],
        'development': ['developer', 'development', 'programming', 'coding', 'software', 'engineer'],
        'management': ['manager', 'lead', 'director', 'head', 'supervisor', 'team lead'],
        'consulting': ['consultant', 'consulting', 'advisory', 'specialist', 'expert'],
        'analysis': ['analyst', 'analysis', 'research', 'specialist', 'business analyst'],
        'devops': ['devops', 'site reliability', 'platform engineer', 'infrastructure', 'automation'],
        'security': ['security', 'cybersecurity', 'information security', 'security analyst'],
        'qa': ['qa', 'quality assurance', 'testing', 'test', 'quality'],
        'finance': ['finance', 'financial', 'accounting', 'budget', 'treasury'],
        'hr': ['hr', 'human resources', 'recruiting', 'talent', 'people'],
        'sales': ['sales', 'account', 'business development', 'revenue', 'commercial'],
        'marketing': ['marketing', 'brand', 'content', 'digital marketing', 'campaign']
    }

    ROLE_TYPES = {
        'developer': ['developer', 'engineer', 'programmer', 'architect', 'coder'],
        'analyst': ['analyst', 'specialist', 'consultant', 'advisor', 'researcher'],
        'manager': ['manager', 'lead', 'director', 'head', 'supervisor'],
        'engineer': ['engineer', 'developer', 'architect', 'specialist'],
        'specialist': ['specialist', 'analyst', 'consultant', 'expert', 'advisor'],
        'administrator': ['administrator', 'admin', 'manager', 'specialist'],
        'lead': ['lead', 'senior', 'principal', 'manager', 'head'],
        'senior': ['senior', 'sr', 'lead', 'principal', 'expert'],
        'team_lead': ['team lead', 'technical lead', 'lead', 'manager']
    }

    SENIORITY_LEVELS = {
        'entry': ['junior', 'jr', 'entry', 'associate', 'trainee', 'graduate'],
        'mid': ['', 'mid', 'regular', 'standard'],
        'senior': ['senior', 'sr', 'principal', 'staff', 'expert'],
        'lead': ['lead', 'team lead', 'tech lead', 'technical lead'],
        'management': ['manager', 'head', 'director', 'supervisor'],
        'executive': ['vp', 'vice president', 'ceo', 'cto', 'cfo', 'president']
    }
    
    # Business rules for bonuses and penalties
    BUSINESS_RULES = {
        'exact_title_match_bonus': 0.25,        # +25% for exact job title match
        'same_family_bonus': 0.15,              # +15% for same job family
        'related_role_bonus': 0.10,             # +10% for related roles (similarity > 0.8)
        'cross_functional_bonus': 0.05,         # +5% for cross-functional moves (similarity 0.6-0.8)
        'unrelated_field_penalty': -0.20,       # -20% for unrelated fields (similarity < 0.4)
        'wrong_seniority_penalty': -0.10,       # -10% for wrong seniority level
        'management_vs_ic_penalty': -0.15,      # -15% when IC applies for management or vice versa
    }


    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.qdrant = get_qdrant_utils()
        
        # SAFETY: System resource monitoring
        self.max_cpu_usage = 85.0  # Maximum CPU usage before throttling
        self.max_memory_usage = 90.0  # Maximum memory usage before throttling
        
        logger.info("🎯 MatchingService initialized (uses *_structured & *_embeddings)")
        logger.info("🛡️ Safety limits: CPU < 85%, Memory < 90%, GPU memory checks enabled")

    def _check_system_resources(self) -> bool:
        """
        Check if system resources are within safe limits.
        Returns True if safe to proceed, False if should throttle.
        """
        try:
            import psutil
            
            # Check CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            if cpu_percent > self.max_cpu_usage:
                logger.warning(f"⚠️ High CPU usage detected: {cpu_percent}% > {self.max_cpu_usage}%")
                return False
            
            # Check memory usage
            memory = psutil.virtual_memory()
            if memory.percent > self.max_memory_usage:
                logger.warning(f"⚠️ High memory usage detected: {memory.percent}% > {self.max_memory_usage}%")
                return False
            
            return True
            
        except Exception as e:
            logger.warning(f"⚠️ System resource check failed: {e}, proceeding with caution")
            return True  # Proceed if check fails

    # ---------- Universal Dynamic Job Title Similarity Methods ----------
    
    def extract_domains_from_title(self, title):
        """Extract all relevant domains from job title"""
        if not title:
            return []
        
        title_lower = title.lower()
        found_domains = []
        
        for domain, keywords in self.DOMAIN_KEYWORDS.items():
            for keyword in keywords:
                if keyword in title_lower:
                    found_domains.append(domain)
                    break
        
        return found_domains

    def extract_role_type(self, title):
        """Extract core role type from title"""
        if not title:
            return 'unknown'
        
        title_lower = title.lower()
        
        for role_type, synonyms in self.ROLE_TYPES.items():
            for synonym in synonyms:
                if synonym in title_lower:
                    return role_type
        
        return 'general'

    def extract_seniority_level(self, title):
        """Extract seniority level from title"""
        if not title:
            return 'mid'
        
        title_lower = title.lower()
        
        for level, keywords in self.SENIORITY_LEVELS.items():
            for keyword in keywords:
                if keyword and keyword in title_lower:
                    return level
        
        return 'mid'

    def calculate_domain_similarity(self, jd_domains, cv_domains):
        """Calculate similarity based on shared domains"""
        if not jd_domains or not cv_domains:
            return 0.0
        
        # Exact domain matches get highest score
        common_domains = set(jd_domains).intersection(set(cv_domains))
        total_domains = set(jd_domains).union(set(cv_domains))
        
        if len(total_domains) == 0:
            return 0.0
        
        # Jaccard similarity with heavy bonus for exact matches
        jaccard_score = len(common_domains) / len(total_domains)
        
        # Major bonus for multiple domain matches
        if len(common_domains) >= 2:
            jaccard_score += 0.2
        elif len(common_domains) >= 1:
            jaccard_score += 0.1
        
        return min(1.0, jaccard_score)

    def calculate_role_type_similarity(self, jd_role, cv_role):
        """Calculate similarity between role types"""
        if jd_role == cv_role:
            return 1.0
        
        # Check if roles are synonyms
        jd_synonyms = self.ROLE_TYPES.get(jd_role, [jd_role])
        cv_synonyms = self.ROLE_TYPES.get(cv_role, [cv_role])
        
        # Check for overlap in synonyms
        if any(syn in cv_synonyms for syn in jd_synonyms):
            return 0.9
        
        # Related role scoring
        role_relationships = {
            ('developer', 'engineer'): 0.95,
            ('analyst', 'specialist'): 0.90,
            ('manager', 'lead'): 0.85,
            ('developer', 'analyst'): 0.4,
            ('engineer', 'manager'): 0.5,
            ('analyst', 'manager'): 0.6,
            ('specialist', 'analyst'): 0.85,
            ('lead', 'manager'): 0.80,
            ('senior', 'lead'): 0.75
        }
        
        relationship_key = tuple(sorted([jd_role, cv_role]))
        return role_relationships.get(relationship_key, 0.2)

    def calculate_seniority_similarity(self, jd_seniority, cv_seniority):
        """Calculate similarity between seniority levels"""
        seniority_order = ['entry', 'mid', 'senior', 'lead', 'management', 'executive']
        
        if jd_seniority == cv_seniority:
            return 1.0
        
        try:
            jd_idx = seniority_order.index(jd_seniority)
            cv_idx = seniority_order.index(cv_seniority)
            
            # Adjacent levels are quite similar
            diff = abs(jd_idx - cv_idx)
            if diff == 1:
                return 0.8
            elif diff == 2:
                return 0.6
            elif diff == 3:
                return 0.4
            else:
                return 0.2
        except ValueError:
            return 0.5

    def get_enhanced_title_similarity(self, jd_title: str, cv_title: str) -> float:
        """
        COMPLETELY NEW: Universal dynamic job title similarity
        """
        # Handle None values explicitly
        if jd_title is None:
            jd_title = ""
        if cv_title is None:
            cv_title = ""
            
        if not jd_title or not cv_title:
            return 0.0
        
        # Normalize titles
        jd_clean = jd_title.lower().strip()
        cv_clean = cv_title.lower().strip()
        
        # Exact match
        if jd_clean == cv_clean:
            return 1.0
        
        # Extract components
        jd_domains = self.extract_domains_from_title(jd_title)
        cv_domains = self.extract_domains_from_title(cv_title)
        jd_role = self.extract_role_type(jd_title)
        cv_role = self.extract_role_type(cv_title)
        jd_seniority = self.extract_seniority_level(jd_title)
        cv_seniority = self.extract_seniority_level(cv_title)
        
        # Calculate component similarities
        domain_sim = self.calculate_domain_similarity(jd_domains, cv_domains)
        role_sim = self.calculate_role_type_similarity(jd_role, cv_role)
        seniority_sim = self.calculate_seniority_similarity(jd_seniority, cv_seniority)
        
        # Weight components (domain expertise is most important)
        final_similarity = (domain_sim * 0.6 + role_sim * 0.3 + seniority_sim * 0.1)
        
        # Bonus for exact domain + role matches
        if domain_sim > 0.8 and role_sim > 0.8:
            final_similarity += 0.1
        
        return min(1.0, final_similarity)

    def apply_business_rules(self, cv_title: str, jd_title: str, title_similarity: float) -> float:
        """Enhanced business rules with domain-specific bonuses"""
        modifier = 0.0
        
        # Extract domains for bonus calculation
        cv_domains = self.extract_domains_from_title(cv_title)
        jd_domains = self.extract_domains_from_title(jd_title)
        common_domains = set(cv_domains).intersection(set(jd_domains))
        
        # Exact title match super bonus
        if cv_title and jd_title and cv_title.lower().strip() == jd_title.lower().strip():
            modifier += 0.30  # +30% for exact match
        
        # Domain expertise bonuses
        elif len(common_domains) >= 2:
            modifier += 0.25  # +25% for multiple domain match
        elif len(common_domains) >= 1:
            modifier += 0.15  # +15% for single domain match
        
        # High similarity bonus
        elif title_similarity >= 0.8:
            modifier += 0.15  # +15% for high similarity
        elif title_similarity >= 0.6:
            modifier += 0.10  # +10% for good similarity
        elif title_similarity >= 0.4:
            modifier += 0.05  # +5% for moderate similarity
        
        # Unrelated field penalty
        elif title_similarity < 0.3:
            modifier -= 0.20  # -20% for unrelated fields
        
        # Seniority mismatch penalties
        cv_seniority = self.extract_seniority_level(cv_title)
        jd_seniority = self.extract_seniority_level(jd_title)
        seniority_sim = self.calculate_seniority_similarity(cv_seniority, jd_seniority)
        
        if seniority_sim < 0.4:
            modifier -= 0.10  # -10% for wrong seniority
        
        return modifier

    # ---------- Public APIs ----------
    def match_cv_against_jd_exact(self, cv_id: str, jd_id: str) -> dict:
        """
        EXACT vector matching (32 vectors) using {cv,jd}_embeddings.
        Enhanced weights: 50% skills, 20% responsibilities, 20% title, 10% experience.
        """
        try:
            logger.info(f"🎯 EXACT 32-vector matching: CV {cv_id} vs JD {jd_id}")
            t0 = time.time()
            cv_vecs = self._get_exact_vectors(cv_id, "cv")
            jd_vecs = self._get_exact_vectors(jd_id, "jd")
            if not cv_vecs or not jd_vecs:
                raise Exception("Missing embeddings for CV or JD")
            # 50% - Skills (average best alignment of each CV skill to JD skills)
            skills_score = self._avg_best_similarity(cv_vecs["skill_vectors"], jd_vecs["skill_vectors"])
            # 20% - Responsibilities
            resp_score = self._avg_best_similarity(cv_vecs["responsibility_vectors"], jd_vecs["responsibility_vectors"])
            # 10% - Experience (1 vs 1)
            exp_score = self._cos_sim_list(cv_vecs["experience_vector"][0], jd_vecs["experience_vector"][0]) if (cv_vecs["experience_vector"] and jd_vecs["experience_vector"]) else 0.0
            # 20% - Title (1 vs 1)
            title_score = self._cos_sim_list(cv_vecs["job_title_vector"][0], jd_vecs["job_title_vector"][0]) if (cv_vecs["job_title_vector"] and jd_vecs["job_title_vector"]) else 0.0
            final = skills_score * self.SCORING_WEIGHTS["skills"] + resp_score * self.SCORING_WEIGHTS["responsibilities"] + exp_score * self.SCORING_WEIGHTS["experience"] + title_score * self.SCORING_WEIGHTS["job_title"]
            dt = time.time() - t0
            return {
                "cv_id": cv_id,
                "jd_id": jd_id,
                "final_score": final,
                "final_score_percentage": final * 100.0,
                "breakdown": {
                    "skills_score": skills_score * self.SCORING_WEIGHTS["skills"],
                    "responsibilities_score": resp_score * self.SCORING_WEIGHTS["responsibilities"],
                    "experience_score": exp_score * self.SCORING_WEIGHTS["experience"],
                    "job_title_score": title_score * self.SCORING_WEIGHTS["job_title"],
                },
                "processing_time": dt,
                "vector_counts": {
                    "cv_skill_vectors": len(cv_vecs.get("skill_vectors", [])),
                    "cv_responsibility_vectors": len(cv_vecs.get("responsibility_vectors", [])),
                    "jd_skill_vectors": len(jd_vecs.get("skill_vectors", [])),
                    "jd_responsibility_vectors": len(jd_vecs.get("responsibility_vectors", [])),
                },
            }
        except Exception as e:
            logger.error(f"❌ EXACT matching failed: {e}")
            raise Exception(f"CV-JD exact matching failed: {e}")

    def match_cv_against_jd(self, cv_id: str, jd_id: str) -> MatchResult:
        """
        Explainable matching:
        - Pulls structured text from {cv,jd}_structured
        - Uses vectors from {cv,jd}_embeddings if present; else generates & stores exact 32 vectors.
        - Produces % scores for skills/responsibilities and combines with title/experience into weighted overall.
        """
        try:
            logger.info("---------- MATCHING START ----------")
            logger.info(f"CV ID: {cv_id} | JD ID: {jd_id}")
            t0 = time.time()
            # ---- structured JSON ----
            cv_std = self._get_structured(cv_id, "cv")
            jd_std = self._get_structured(jd_id, "jd")
            if not cv_std:
                raise Exception(f"CV not found: {cv_id}")
            if not jd_std:
                raise Exception(f"JD not found: {jd_id}")
            # ---- embeddings (prefer stored; otherwise generate + persist exact 32) ----
            cv_emb = self._get_or_generate_embeddings(cv_id, "cv", cv_std)
            jd_emb = self._get_or_generate_embeddings(jd_id, "jd", jd_std)
            # ---- similarities ----
            skills_analysis = self._skills_similarity(
                jd_emb["skills"], cv_emb["skills"],
                jd_std.get("skills_sentences", []),
                cv_std.get("skills_sentences", [])
            )
            responsibilities_analysis = self._responsibilities_similarity(
                jd_emb["responsibilities"], cv_emb["responsibilities"],
                jd_std.get("responsibility_sentences", []),
                cv_std.get("responsibility_sentences", [])
            )
            # ---- Enhanced title similarity using semantic mappings ----
            cv_title = cv_std.get("job_title", "") or ""
            jd_title = jd_std.get("job_title", "") or ""
            title_sim = self.get_enhanced_title_similarity(jd_title, cv_title)
            
            meets, exp_score_pct = self._experience_match(
                jd_std.get("years_of_experience", "") or jd_std.get("experience_years", ""),
                cv_std.get("years_of_experience", "") or cv_std.get("experience_years", "")
            )
            
            # ---- Calculate base scores ----
            skills_pct = skills_analysis["skill_match_percentage"]
            resp_pct = responsibilities_analysis["responsibility_match_percentage"]
            title_pct = title_sim * 100.0
            
            # ---- Apply enhanced weighted scoring ----
            base_score = (
                skills_pct * self.SCORING_WEIGHTS["skills"] +
                resp_pct * self.SCORING_WEIGHTS["responsibilities"] +
                title_pct * self.SCORING_WEIGHTS["job_title"] +
                exp_score_pct * self.SCORING_WEIGHTS["experience"]
            )
            
            # ---- Apply business rules and bonuses ----
            business_rule_modifier = self.apply_business_rules(cv_title, jd_title, title_sim)
            overall = base_score + (business_rule_modifier * 100.0)  # Convert to percentage
            
            # Ensure score stays within bounds
            overall = max(0.0, min(100.0, overall))
            explanation = self._build_explanation(
                skills_pct, skills_analysis, resp_pct, responsibilities_analysis, title_sim, meets
            )
            match_details = self._build_details(cv_std, jd_std, skills_analysis, responsibilities_analysis, title_sim, exp_score_pct)
            return MatchResult(
                cv_id=cv_id, jd_id=jd_id, overall_score=overall,
                skills_score=skills_pct, responsibilities_score=resp_pct,
                title_score=title_pct, experience_score=exp_score_pct,
                explanation=explanation, match_details=match_details,
                processing_time=time.time() - t0
            )
        except Exception as e:
            logger.error(f"❌ Matching failed: {e}")
            raise Exception(f"CV-JD matching failed: {e}")

    def match_by_ids(self, cv_id: str, jd_id: str, weights: dict = None) -> MatchResult:
        """
        Match CV against JD using stored embeddings from Qdrant (OPTIMIZED).
        This is the preferred method as it uses pre-computed embeddings.
        """
        try:
            logger.info("---------- MATCHING START (using stored embeddings) ----------")
            logger.info(f"CV ID: {cv_id} | JD ID: {jd_id}")
            t0 = time.time()
            
            # Use provided weights or default
            if weights is None:
                weights = self.SCORING_WEIGHTS
            else:
                # Normalize weights if needed
                total = sum(weights.values())
                if total > 0:
                    weights = {k: v/total for k, v in weights.items()}
                else:
                    weights = self.SCORING_WEIGHTS
            
            # Retrieve stored embeddings from Qdrant
            cv_embeddings = self.qdrant.retrieve_embeddings(cv_id, "cv")
            jd_embeddings = self.qdrant.retrieve_embeddings(jd_id, "jd")
            
            # Fallback: if embeddings not found, get structured data and generate them
            if not cv_embeddings:
                logger.warning(f"⚠️ CV embeddings not found for {cv_id}, falling back to generation")
                cv_structured = self.qdrant.get_structured_cv(cv_id)
                if not cv_structured:
                    raise ValueError(f"CV {cv_id} not found in database")
                cv_embeddings = self._generate_embeddings_from_structured(cv_structured, "cv")
            
            if not jd_embeddings:
                logger.warning(f"⚠️ JD embeddings not found for {jd_id}, falling back to generation")
                jd_structured = self.qdrant.get_structured_jd(jd_id)
                if not jd_structured:
                    raise ValueError(f"JD {jd_id} not found in database")
                jd_embeddings = self._generate_embeddings_from_structured(jd_structured, "jd")
            
            # Get structured data for text content (needed for similarity calculations)
            cv_structured = self.qdrant.get_structured_cv(cv_id)
            jd_structured = self.qdrant.get_structured_jd(jd_id)
            
            if not cv_structured or not jd_structured:
                raise ValueError("Structured data not found for CV or JD")
            
            # Parse years properly to handle string values like "3-7"
            jd_years = safe_parse_years(jd_structured.get("years_of_experience", 0))
            cv_years = safe_parse_years(cv_structured.get("years_of_experience", 0))
            
            # Convert stored embeddings to the format expected by similarity functions
            cv_emb = self._convert_stored_embeddings_to_format(cv_embeddings, cv_structured)
            jd_emb = self._convert_stored_embeddings_to_format(jd_embeddings, jd_structured)
            
            # Calculate similarities
            skills_analysis = self._skills_similarity(
                jd_emb["skills"], cv_emb["skills"],
                jd_structured.get("skills_sentences", []),
                cv_structured.get("skills_sentences", [])
            )
            responsibilities_analysis = self._responsibilities_similarity(
                jd_emb["responsibilities"], cv_emb["responsibilities"],
                jd_structured.get("responsibility_sentences", []),
                cv_structured.get("responsibility_sentences", [])
            )
            
            # ---- Enhanced title similarity using semantic mappings ----
            cv_title = cv_structured.get("job_title", "") or ""
            jd_title = jd_structured.get("job_title", "") or ""
            title_sim = self.get_enhanced_title_similarity(jd_title, cv_title)
            
            # Calculate experience match (use same method as legacy)
            meets, exp_score_pct = self._experience_match(
                str(jd_years),  # Convert to string for the experience_match method
                str(cv_years)   # Convert to string for the experience_match method
            )
            
            # ---- Calculate base scores (same as legacy method) ----
            skills_pct = skills_analysis["skill_match_percentage"]
            resp_pct = responsibilities_analysis["responsibility_match_percentage"]
            title_pct = title_sim * 100.0
            
            # ---- Apply enhanced weighted scoring (same as legacy method) ----
            base_score = (
                skills_pct * weights.get("skills", self.SCORING_WEIGHTS["skills"]) +
                resp_pct * weights.get("responsibilities", self.SCORING_WEIGHTS["responsibilities"]) +
                title_pct * weights.get("job_title", self.SCORING_WEIGHTS["job_title"]) +
                exp_score_pct * weights.get("experience", self.SCORING_WEIGHTS["experience"])
            )
            
            # ---- Apply business rules and bonuses (same as legacy method) ----
            business_rule_modifier = self.apply_business_rules(cv_title, jd_title, title_sim)
            overall_score = base_score + (business_rule_modifier * 100.0)  # Convert to percentage
            
            # Ensure score stays within bounds
            overall_score = max(0.0, min(100.0, overall_score))
            
            # Build explanation
            explanation = self._build_explanation(
                skills_analysis["skill_match_percentage"], skills_analysis,
                responsibilities_analysis["responsibility_match_percentage"], responsibilities_analysis,
                title_sim, meets  # Use the meets boolean from _experience_match
            )
            
            # Build match details
            match_details = {
                "skills_analysis": skills_analysis,
                "responsibilities_analysis": responsibilities_analysis,
                "title_similarity": title_sim,
                "experience_score": exp_score_pct,
                "weights_used": weights,
                "cv_years": cv_years,
                "jd_years": jd_years
            }
            
            processing_time = time.time() - t0
            logger.info(f"✅ MATCHING COMPLETED in {processing_time:.3f}s - Overall Score: {overall_score:.3f}")
            
            return MatchResult(
                cv_id=cv_id,
                jd_id=jd_id,
                overall_score=overall_score,
                skills_score=skills_pct,
                responsibilities_score=resp_pct,
                title_score=title_pct,
                experience_score=exp_score_pct,
                explanation=explanation,
                match_details=match_details,
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"❌ Matching failed: {str(e)}")
            raise Exception(f"Matching failed: {str(e)}")

    def match_structured_data(self, cv_structured: dict, jd_structured: dict, weights: dict = None) -> MatchResult:
        """
        Match CV against JD using structured data directly (LEGACY METHOD).
        This method generates embeddings on-the-fly and should be used only when
        structured data is available but embeddings are not stored.
        """
        try:
            logger.info("---------- MATCHING START (structured data - legacy) ----------")
            logger.info(f"CV: {cv_structured.get('name', 'unknown')} | JD: {jd_structured.get('job_title', 'unknown')}")
            t0 = time.time()
            
            # Use provided weights or default
            if weights is None:
                weights = self.SCORING_WEIGHTS
            else:
                # Normalize weights if needed
                total = sum(weights.values())
                if total > 0:
                    weights = {k: v/total for k, v in weights.items()}
                else:
                    weights = self.SCORING_WEIGHTS
            
            # Parse years properly to handle string values like "3-7"
            jd_years = safe_parse_years(jd_structured.get("years_of_experience", 0))
            cv_years = safe_parse_years(cv_structured.get("years_of_experience", 0))
            
            # Update structured data with parsed years
            jd_structured["years_of_experience"] = jd_years
            cv_structured["years_of_experience"] = cv_years
            
            # Generate embeddings for CV and JD (LEGACY - should use stored embeddings when possible)
            cv_emb = self._generate_embeddings_from_structured(cv_structured, "cv")
            jd_emb = self._generate_embeddings_from_structured(jd_structured, "jd")
            
            # Calculate similarities
            skills_analysis = self._skills_similarity(
                jd_emb["skills"], cv_emb["skills"],
                jd_structured.get("skills_sentences", jd_structured.get("skills", [])),
                cv_structured.get("skills_sentences", cv_structured.get("skills", []))
            )
            responsibilities_analysis = self._responsibilities_similarity(
                jd_emb["responsibilities"], cv_emb["responsibilities"],
                jd_structured.get("responsibility_sentences", jd_structured.get("responsibilities", [])),
                cv_structured.get("responsibility_sentences", cv_structured.get("responsibilities", []))
            )
            
            # ---- Enhanced title similarity using semantic mappings ----
            cv_title = cv_structured.get("job_title", "") or ""
            jd_title = jd_structured.get("job_title", "") or ""
            title_sim = self.get_enhanced_title_similarity(jd_title, cv_title)
            
            # Calculate experience match
            meets, exp_score_pct = self._experience_match(
                str(jd_years),  # Convert to string for the experience_match method
                str(cv_years)   # Convert to string for the experience_match method
            )
            
            # ---- Calculate base scores ----
            skills_pct = skills_analysis["skill_match_percentage"]
            resp_pct = responsibilities_analysis["responsibility_match_percentage"]
            title_pct = title_sim * 100.0
            
            # ---- Apply enhanced weighted scoring ----
            base_score = (
                skills_pct * weights.get("skills", self.SCORING_WEIGHTS["skills"]) +
                resp_pct * weights.get("responsibilities", self.SCORING_WEIGHTS["responsibilities"]) +
                title_pct * weights.get("job_title", self.SCORING_WEIGHTS["job_title"]) +
                exp_score_pct * weights.get("experience", self.SCORING_WEIGHTS["experience"])
            )
            
            # ---- Apply business rules and bonuses ----
            business_rule_modifier = self.apply_business_rules(cv_title, jd_title, title_sim)
            overall = base_score + (business_rule_modifier * 100.0)  # Convert to percentage
            
            # Ensure score stays within bounds
            overall = max(0.0, min(100.0, overall))
            
            # Build explanation
            explanation = self._build_explanation(
                skills_pct, skills_analysis, resp_pct, responsibilities_analysis, title_sim, meets
            )
            
            # Build match details
            match_details = self._build_details(
                cv_structured, jd_structured, skills_analysis, responsibilities_analysis, title_sim, exp_score_pct
            )
            
            return MatchResult(
                cv_id=cv_structured.get("id", "unknown"),
                jd_id=jd_structured.get("id", "unknown"),
                overall_score=overall,
                skills_score=skills_pct,
                responsibilities_score=resp_pct,
                title_score=title_pct,
                experience_score=exp_score_pct,
                explanation=explanation,
                match_details=match_details,
                processing_time=time.time() - t0
            )
        except Exception as e:
            logger.error(f"❌ Matching failed: {e}")
            raise Exception(f"CV-JD matching failed: {e}")

    def bulk_match(self, jd_id: str, cv_ids: List[str], top_k: int = 10) -> List[MatchResult]:
        try:
            # SAFETY CHECK: Limit bulk matching size to prevent system overload
            max_bulk_size = 200  # Maximum CVs to process in one bulk operation
            if len(cv_ids) > max_bulk_size:
                logger.warning(f"⚠️ Bulk match size too large ({len(cv_ids)} CVs), limiting to {max_bulk_size}")
                cv_ids = cv_ids[:max_bulk_size]
            
            # SAFETY CHECK: Add timeout protection for individual matches
            import time
            start_time = time.time()
            max_processing_time = 300  # 5 minutes max for bulk operation
            
            results: List[MatchResult] = []
            processed_count = 0
            
            for cid in cv_ids:
                try:
                    # Check timeout
                    if time.time() - start_time > max_processing_time:
                        logger.warning(f"⚠️ Bulk matching timeout after {processed_count} CVs, returning partial results")
                        break
                    
                    # SAFETY CHECK: Monitor system resources every 10 CVs
                    if processed_count > 0 and processed_count % 10 == 0:
                        if not self._check_system_resources():
                            logger.warning(f"⚠️ System resources exceeded, stopping bulk matching after {processed_count} CVs")
                            break
                    
                    # Process individual match with error handling
                    result = self.match_cv_against_jd(cid, jd_id)
                    results.append(result)
                    processed_count += 1
                    
                    # Log progress for large batches
                    if len(cv_ids) > 50 and processed_count % 10 == 0:
                        logger.info(f"📊 Bulk matching progress: {processed_count}/{len(cv_ids)} CVs processed")
                        
                except Exception as e:
                    logger.warning(f"⚠️ Failed to match CV {cid}: {e}")
                    continue
            
            # Sort results and return top_k
            results.sort(key=lambda x: x.overall_score, reverse=True)
            final_results = results[:top_k]
            
            logger.info(f"✅ Bulk matching completed: {processed_count}/{len(cv_ids)} CVs processed, {len(final_results)} results returned")
            return final_results
            
        except Exception as e:
            logger.error(f"❌ Bulk matching failed: {e}")
            raise

    def find_top_candidates(self, jd_id: str, limit: int = 10, category_filter: str = None) -> List[MatchResult]:
        try:
            cv_ids = self._list_all_cv_ids(category_filter)
            return self.bulk_match(jd_id, cv_ids, top_k=limit)
        except Exception as e:
            logger.error(f"❌ Top candidate search failed: {e}")
            raise

    def find_top_candidates_by_jd_category(self, jd_id: str, limit: int = 10) -> List[MatchResult]:
        """
        Find top candidates by automatically detecting JD category and filtering CVs by same category.
        Enhanced with smart load balancing and performance optimization.
        """
        try:
            # Get JD structured data to extract category
            jd_structured = self._get_structured(jd_id, "jd")
            jd_category = jd_structured.get("category", "General")
            
            logger.info(f"🎯 JD category detected: {jd_category}")
            
            # Find CVs with matching category
            cv_ids = self._list_all_cv_ids(jd_category)
            logger.info(f"📊 Found {len(cv_ids)} CVs in category: {jd_category}")
            
            # Smart batch processing for large CV sets
            if len(cv_ids) > 100:
                return self._smart_bulk_match(jd_id, cv_ids, top_k=limit, category=jd_category)
            else:
                return self.bulk_match(jd_id, cv_ids, top_k=limit)
                
        except Exception as e:
            logger.error(f"❌ Category-based candidate search failed: {e}")
            raise

    def _smart_bulk_match(self, jd_id: str, cv_ids: List[str], top_k: int = 10, category: str = "General") -> List[MatchResult]:
        """
        Smart bulk matching with optimized processing for large CV sets.
        Uses batch processing and parallel execution for better performance.
        """
        try:
            import asyncio
            from concurrent.futures import ThreadPoolExecutor
            import math
            
            # Calculate optimal batch size based on category (with safety limits)
            batch_sizes = {
                "Software Engineering": 15,  # Reduced for safety
                "AI/ML Engineering": 10,     # Smaller batches for GPU-intensive processing
                "Security Engineering": 15,  # Reduced for safety
                "Cloud/DevOps Engineering": 15,  # Reduced for safety
                "Data Science": 10,          # Smaller batches for GPU-intensive processing
                "General": 20                # Reduced for safety
            }
            
            batch_size = batch_sizes.get(category, 20)
            total_batches = math.ceil(len(cv_ids) / batch_size)
            
            logger.info(f"🚀 Smart bulk matching: {len(cv_ids)} CVs in {total_batches} batches of {batch_size}")
            
            all_results = []
            
            # Process batches in parallel (limited concurrency)
            max_workers = min(3, total_batches)  # Limit concurrent batches
            
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = []
                
                for i in range(0, len(cv_ids), batch_size):
                    batch_cv_ids = cv_ids[i:i + batch_size]
                    future = executor.submit(self._process_batch, jd_id, batch_cv_ids)
                    futures.append(future)
                
                # Collect results from all batches
                for future in futures:
                    try:
                        batch_results = future.result(timeout=60)  # 60 second timeout per batch
                        all_results.extend(batch_results)
                    except Exception as e:
                        logger.warning(f"⚠️ Batch processing failed: {e}")
                        continue
            
            # Sort all results by score and return top_k
            all_results.sort(key=lambda x: x.overall_score, reverse=True)
            final_results = all_results[:top_k]
            
            logger.info(f"✅ Smart bulk matching completed: {len(final_results)} results from {len(cv_ids)} CVs")
            return final_results
            
        except Exception as e:
            logger.error(f"❌ Smart bulk matching failed: {e}")
            # Fallback to regular bulk matching
            return self.bulk_match(jd_id, cv_ids, top_k=top_k)

    def _process_batch(self, jd_id: str, cv_ids: List[str]) -> List[MatchResult]:
        """Process a batch of CVs for matching."""
        try:
            results = []
            for cv_id in cv_ids:
                try:
                    result = self.match_cv_against_jd(cv_id, jd_id)
                    results.append(result)
                except Exception as e:
                    logger.warning(f"⚠️ Failed to match CV {cv_id}: {e}")
                    continue
            return results
        except Exception as e:
            logger.error(f"❌ Batch processing failed: {e}")
            return []

    # ---------- Data access helpers ----------
    def _get_structured(self, doc_id: str, doc_type: str) -> Dict[str, Any]:
        """
        Fetch structured JSON from {doc_type}_structured by id.
        """
        try:
            res = self.qdrant.client.retrieve(f"{doc_type}_structured", ids=[doc_id], with_payload=True, with_vectors=False)
            if not res:
                return {}
            payload = res[0].payload or {}
            return payload.get("structured_info", payload)
        except Exception as e:
            logger.error(f"❌ Structured fetch failed for {doc_type} {doc_id}: {e}")
            return {}

    def _get_exact_vectors(self, doc_id: str, doc_type: str) -> Dict[str, Any]:
        """
        Pull vectors from {doc_type}_embeddings using optimized single-point retrieval.
        Returns dict with lists: skill_vectors[20], responsibility_vectors[10], experience_vector[1], job_title_vector[1].
        """
        try:
            # Try optimized single-point retrieval first
            try:
                point = self.qdrant.client.retrieve(
                    collection_name=f"{doc_type}_embeddings",
                    ids=[doc_id],
                    with_payload=True,
                    with_vectors=False
                )
                
                if point and len(point) > 0:
                    payload = point[0].payload
                    if payload and "vector_structure" in payload:
                        logger.info(f"✅ OPTIMIZED: Retrieved 32 vectors as single point for {doc_id}")
                        return payload["vector_structure"]
            except Exception as e:
                logger.debug(f"Optimized retrieval failed for {doc_id}, trying legacy method: {e}")
            
            # Fallback to legacy method for backward compatibility
            logger.info(f"🔄 FALLBACK: Using legacy retrieval for {doc_id}")
            points, _ = self.qdrant.client.scroll(
                collection_name=f"{doc_type}_embeddings",
                scroll_filter={"must": [{"key": "document_id", "match": {"value": doc_id}}]},
                limit=2000,
                with_payload=True,
                with_vectors=True
            )
            if not points:
                return {}
            out = {
                "skill_vectors": [],
                "responsibility_vectors": [],
                "experience_vector": [],
                "job_title_vector": []
            }
            # Pre-size arrays to keep ordering if indices exist
            skill_temp: Dict[int, List[float]] = {}
            resp_temp: Dict[int, List[float]] = {}
            for p in points:
                pl = p.payload or {}
                vtype = pl.get("vector_type")
                vidx = int(pl.get("vector_index", 0))
                vec = p.vector if isinstance(p.vector, list) else p.vector  # already list
                if vtype == "skill":
                    skill_temp[vidx] = vec
                elif vtype == "responsibility":
                    resp_temp[vidx] = vec
                elif vtype == "experience":
                    out["experience_vector"] = [vec]
                elif vtype == "job_title":
                    out["job_title_vector"] = [vec]
            # Order by index and clip to required counts
            out["skill_vectors"] = [skill_temp[i] for i in sorted(skill_temp.keys())][:20]
            out["responsibility_vectors"] = [resp_temp[i] for i in sorted(resp_temp.keys())][:10]
            return out
        except Exception as e:
            logger.error(f"❌ Exact vectors fetch failed for {doc_type} {doc_id}: {e}")
            return {}

    def _get_or_generate_embeddings(self, doc_id: str, doc_type: str, std: Dict[str, Any]) -> Dict[str, Any]:
        """
        Returns sentence->vector maps for skills/responsibilities + single vectors for title/experience.
        Prefers stored {doc_type}_embeddings; if absent, generates and stores exactly 32 vectors.
        """
        # Try to reconstruct maps from stored embeddings first
        points, _ = self.qdrant.client.scroll(
            collection_name=f"{doc_type}_embeddings",
            scroll_filter={"must": [{"key": "document_id", "match": {"value": doc_id}}]},
            limit=2000,
            with_payload=True,
            with_vectors=True
        )
        if points:
            skills_map: Dict[str, np.ndarray] = {}
            resp_map: Dict[str, np.ndarray] = {}
            title_vec: Optional[np.ndarray] = None
            exp_vec: Optional[np.ndarray] = None
            for p in points:
                pl = p.payload or {}
                vtype = pl.get("vector_type")
                content = pl.get("content", "")
                vec = np.array(p.vector) if isinstance(p.vector, list) else np.array(p.vector)
                if vtype == "skill" and content:
                    skills_map[content] = vec
                elif vtype == "responsibility" and content:
                    resp_map[content] = vec
                elif vtype == "job_title":
                    title_vec = vec
                elif vtype == "experience":
                    exp_vec = vec
            return {"skills": skills_map, "responsibilities": resp_map, "title": title_vec, "experience": exp_vec}
        # No stored vectors? Generate and persist exact 32
        emb = self.embedding_service
        doc_emb = emb.generate_document_embeddings(std)
        self.qdrant.store_embeddings_exact(doc_id, doc_type, doc_emb)
        # Build maps from generated content lists
        skills_map = {}
        for s, v in zip(doc_emb.get("skills", []), doc_emb.get("skill_vectors", [])):
            # Skip empty skills to avoid false matches
            if s and s.strip():
                skills_map[s] = np.array(v)
        resp_map = {}
        for r, v in zip(doc_emb.get("responsibilities", []), doc_emb.get("responsibility_vectors", [])):
            # Skip empty responsibilities to avoid false matches
            if r and r.strip():
                resp_map[r] = np.array(v)
        title_vec = np.array(doc_emb["job_title_vector"][0]) if doc_emb.get("job_title_vector") else None
        exp_vec = np.array(doc_emb["experience_vector"][0]) if doc_emb.get("experience_vector") else None
        return {"skills": skills_map, "responsibilities": resp_map, "title": title_vec, "experience": exp_vec}

    def _convert_stored_embeddings_to_format(self, stored_embeddings: dict, structured_data: dict) -> dict:
        """
        Convert stored embeddings from Qdrant format to the format expected by similarity functions.
        """
        # Build skills map from stored vectors and structured data
        skills_map = {}
        # Use the correct field names from get_structured_cv/get_structured_jd
        skills = structured_data.get("skills_sentences", [])[:20]  # Ensure exactly 20
        skill_vectors = stored_embeddings.get("skill_vectors", [])
        
        for i, skill in enumerate(skills):
            # Skip empty skills to avoid false matches
            if not skill or not skill.strip():
                continue
            if i < len(skill_vectors) and skill_vectors[i] is not None:
                skills_map[skill] = np.array(skill_vectors[i])
            else:
                # Fallback for missing vectors
                skills_map[skill] = np.zeros(768)  # Default embedding dimension for all-mpnet-base-v2
        
        # Build responsibilities map from stored vectors and structured data
        resp_map = {}
        # Use the correct field names from get_structured_cv/get_structured_jd
        responsibilities = structured_data.get("responsibility_sentences", [])[:10]  # Ensure exactly 10
        resp_vectors = stored_embeddings.get("responsibility_vectors", [])
        
        for i, resp in enumerate(responsibilities):
            # Skip empty responsibilities to avoid false matches
            if not resp or not resp.strip():
                continue
            if i < len(resp_vectors) and resp_vectors[i] is not None:
                resp_map[resp] = np.array(resp_vectors[i])
            else:
                # Fallback for missing vectors
                resp_map[resp] = np.zeros(768)  # Default embedding dimension for all-mpnet-base-v2
        
        # Get title and experience vectors
        title_vec = None
        if stored_embeddings.get("job_title_vector") and len(stored_embeddings["job_title_vector"]) > 0:
            title_vec = np.array(stored_embeddings["job_title_vector"][0])
        
        exp_vec = None
        if stored_embeddings.get("experience_vector") and len(stored_embeddings["experience_vector"]) > 0:
            exp_vec = np.array(stored_embeddings["experience_vector"][0])
        
        return {
            "skills": skills_map,
            "responsibilities": resp_map,
            "title": title_vec,
            "experience": exp_vec
        }

    def _generate_embeddings_from_structured(self, structured_data: dict, doc_type: str) -> dict:
        """
        Generate embeddings from structured data without storing to database (LEGACY METHOD).
        """
        # Generate document embeddings using the embedding service
        doc_emb = self.embedding_service.generate_document_embeddings(structured_data)
        
        # Build maps from generated content lists
        skills_map = {}
        for s, v in zip(doc_emb.get("skills", []), doc_emb.get("skill_vectors", [])):
            skills_map[s] = np.array(v)
        
        resp_map = {}
        for r, v in zip(doc_emb.get("responsibilities", []), doc_emb.get("responsibility_vectors", [])):
            resp_map[r] = np.array(v)
        
        title_vec = np.array(doc_emb["job_title_vector"][0]) if doc_emb.get("job_title_vector") else None
        exp_vec = np.array(doc_emb["experience_vector"][0]) if doc_emb.get("experience_vector") else None
        
        return {
            "skills": skills_map,
            "responsibilities": resp_map,
            "title": title_vec,
            "experience": exp_vec
        }

    def _list_all_cv_ids(self, category_filter: str = None) -> List[str]:
        """
        Returns all CV ids from cv_structured, optionally filtered by category.
        """
        ids: List[str] = []
        offset = None
        
        # Build filter if category is specified
        scroll_filter = None
        if category_filter:
            from qdrant_client.http.models import Filter, FieldCondition, MatchValue
            scroll_filter = Filter(
                must=[FieldCondition(key="structured_info.category", match=MatchValue(value=category_filter))]
            )
        
        while True:
            points, next_off = self.qdrant.client.scroll(
                collection_name="cv_structured",
                scroll_filter=scroll_filter,
                limit=500,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            for p in points:
                pl = p.payload or {}
                ids.append(pl.get("id") or pl.get("document_id") or str(p.id))
            if not next_off:
                break
            offset = next_off
        return ids

    # ---------- Similarity helpers ----------
    def _avg_best_similarity(self, A: List[List[float]], B: List[List[float]]) -> float:
        """
        For each vector in A, take the best cosine similarity against all vectors in B; then average.
        Uses GPU acceleration when available.
        """
        if not A or not B:
            return 0.0
        
        # Enforce GPU-only path
        if self.embedding_service.device == "cuda" and torch.cuda.is_available():
            return self._avg_best_similarity_gpu(A, B)
        raise RuntimeError("CUDA GPU not available for avg_best_similarity (GPU-only mode)")
    
    def _avg_best_similarity_gpu(self, A: List[List[float]], B: List[List[float]]) -> float:
        """
        GPU-accelerated average best similarity calculation.
        """
        try:
            # Convert to numpy matrices
            matrix_a = np.array(A)
            matrix_b = np.array(B)
            
            # Calculate similarity matrix on GPU
            similarity_matrix = self.embedding_service.calculate_batch_cosine_similarity_gpu(matrix_a, matrix_b)
            
            # Find best similarity for each vector in A
            best_similarities = np.max(similarity_matrix, axis=1)
            
            # Return average of best similarities
            return float(np.mean(best_similarities))
            
        except Exception as e:
            logger.warning(f"⚠️ GPU avg best similarity calculation failed (GPU-only mode): {str(e)}")
            raise
    
    def _avg_best_similarity_cpu(self, A: List[List[float]], B: List[List[float]]) -> float:
        """
        CPU-based average best similarity calculation (original implementation).
        """
        sims = []
        for va in A:
            va_np = np.array(va)
            best = 0.0
            for vb in B:
                vb_np = np.array(vb)
                num = float(np.dot(va_np, vb_np))
                den = float(np.linalg.norm(va_np) * np.linalg.norm(vb_np)) or 1.0
                sim = max(0.0, min(1.0, num / den))
                if sim > best:
                    best = sim
            sims.append(best)
        return float(np.mean(sims)) if sims else 0.0

    def _cos_sim_list(self, v1: List[float], v2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.
        Uses GPU acceleration when available.
        """
        # Enforce GPU-only path
        # Convert to numpy arrays
        vec1 = np.array(v1)
        vec2 = np.array(v2)
        return self.embedding_service.calculate_cosine_similarity(vec1, vec2)

    def _skills_similarity(self, jd_emb: Dict[str, np.ndarray], cv_emb: Dict[str, np.ndarray],
                           jd_skills: List[str], cv_skills: List[str]) -> Dict[str, Any]:
        if not jd_emb or not cv_emb:
            return {"skill_match_percentage": 0.0, "matched_skills": 0, "total_jd_skills": len(jd_skills), 
                    "matches": [], "unmatched_jd_skills": jd_skills}
        
        # Use GPU-accelerated batch similarity calculation
        return self._skills_similarity_gpu_batch(jd_emb, cv_emb, jd_skills, cv_skills)
    
    def _skills_similarity_gpu_batch(self, jd_emb: Dict[str, np.ndarray], cv_emb: Dict[str, np.ndarray],
                                     jd_skills: List[str], cv_skills: List[str]) -> Dict[str, Any]:
        """
        GPU-accelerated skills similarity calculation using GPU Hungarian algorithm.
        """
        try:
            # SAFETY CHECK: Limit batch size to prevent GPU memory issues
            max_batch_size = 30  # Conservative limit for skills matching
            if len(jd_skills) > max_batch_size or len(cv_skills) > max_batch_size:
                logger.warning(f"⚠️ Skills batch too large ({len(jd_skills)}x{len(cv_skills)}), using CPU fallback")
                return self._skills_similarity_cpu_fallback(jd_emb, cv_emb, jd_skills, cv_skills)
            
            logger.info(f"🚀 GPU-Hungarian skills similarity: {len(jd_skills)} JD skills vs {len(cv_skills)} CV skills")
            # Prepare matrices for batch processing
            jd_vectors = []
            cv_vectors = []
            jd_skill_mapping = []
            cv_skill_mapping = []
            
            # Build JD vectors matrix with mapping
            for jd_s in jd_skills:
                v1 = jd_emb.get(jd_s)
                if v1 is not None:
                    jd_vectors.append(v1)
                    jd_skill_mapping.append(jd_s)
            
            # Build CV vectors matrix with mapping
            for cv_s in cv_skills:
                v2 = cv_emb.get(cv_s)
                if v2 is not None:
                    cv_vectors.append(v2)
                    cv_skill_mapping.append(cv_s)
            
            if not jd_vectors or not cv_vectors:
                return {"skill_match_percentage": 0.0, "matched_skills": 0, "total_jd_skills": len(jd_skills), 
                        "matches": [], "unmatched_jd_skills": jd_skills}
            
            # Convert to numpy matrices
            jd_matrix = np.array(jd_vectors)
            cv_matrix = np.array(cv_vectors)
            
            # Calculate similarity matrix on GPU
            similarity_matrix = self.embedding_service.calculate_batch_cosine_similarity_gpu(jd_matrix, cv_matrix)
            
            # Use GPU Hungarian algorithm for optimal matching (same as CPU version)
            avg_score, pairs = hungarian_mean(similarity_matrix)
            
            # Build detailed matches using Hungarian results
            matches = []
            matched_jd_indices = set()
            matched_cv_indices = set()
            
            for jd_idx, cv_idx, sim_score in pairs:
                if jd_idx < len(jd_skill_mapping) and cv_idx < len(cv_skill_mapping):
                    jd_s = jd_skill_mapping[jd_idx]
                    cv_s = cv_skill_mapping[cv_idx]
                    
                    # Only include matches above threshold
                    if sim_score >= self.embedding_service.SIMILARITY_THRESHOLDS["skills"]["minimum"]:
                        matches.append({
                            "jd_skill": jd_s, 
                            "cv_skill": cv_s, 
                            "similarity": float(sim_score), 
                            "quality": self.embedding_service.get_match_quality(sim_score, "skills"),
                            "jd_index": jd_idx,
                            "cv_index": cv_idx
                        })
                        matched_jd_indices.add(jd_idx)
                        matched_cv_indices.add(cv_idx)
            
            # Find unmatched JD skills
            unmatched_jd_skills = []
            for i, skill in enumerate(jd_skill_mapping):
                if i not in matched_jd_indices:
                    unmatched_jd_skills.append(skill)
            
            # Calculate match percentage (same logic as CPU version)
            match_percentage = (len(matches) / len(jd_skills)) * 100.0 if jd_skills else 0.0
            
            return {
                "skill_match_percentage": match_percentage, 
                "matched_skills": len(matches), 
                "total_jd_skills": len(jd_skills), 
                "matches": matches, 
                "unmatched_jd_skills": unmatched_jd_skills
            }
            
        except Exception as e:
            logger.warning(f"⚠️ GPU-Hungarian skills similarity failed: {str(e)}")
            # Fallback to CPU version
            return self._skills_similarity_cpu_fallback(jd_emb, cv_emb, jd_skills, cv_skills)
    
    def _skills_similarity_cpu_fallback(self, jd_emb: Dict[str, np.ndarray], cv_emb: Dict[str, np.ndarray],
                                        jd_skills: List[str], cv_skills: List[str]) -> Dict[str, Any]:
        """
        CPU fallback for skills similarity calculation (original implementation).
        """
        matches, matched = [], 0
        for idx, jd_s in enumerate(jd_skills):
            v1 = jd_emb.get(jd_s)
            if v1 is None:
                continue
            
            best_item, best_sim = None, 0.0
            best_idx = -1
            
            for cv_idx, cv_s in enumerate(cv_skills):
                v2 = cv_emb.get(cv_s)
                if v2 is None:
                    continue
                    
                sim = self.embedding_service.calculate_cosine_similarity(v1, v2)
                if sim > best_sim:
                    best_sim, best_item, best_idx = sim, cv_s, cv_idx
            
            if best_item and best_sim >= self.embedding_service.SIMILARITY_THRESHOLDS["skills"]["minimum"]:
                matched += 1
                matches.append({
                    "jd_skill": jd_s, 
                    "cv_skill": best_item, 
                    "similarity": best_sim, 
                    "quality": self.embedding_service.get_match_quality(best_sim, "skills"),
                    "jd_index": idx,
                    "cv_index": best_idx
                })
        
        total = len(jd_skills) or 1
        pct = matched / total * 100.0
        unmatched = [s for s in jd_skills if s not in [m["jd_skill"] for m in matches]]
        
        return {
            "skill_match_percentage": pct, 
            "matched_skills": matched, 
            "total_jd_skills": len(jd_skills), 
            "matches": matches, 
            "unmatched_jd_skills": unmatched
        }

    def _responsibilities_similarity(self, jd_emb: Dict[str, np.ndarray], cv_emb: Dict[str, np.ndarray],
                                     jd_resps: List[str], cv_resps: List[str]) -> Dict[str, Any]:
        if not jd_emb or not cv_emb:
            return {"responsibility_match_percentage": 0.0, "matched_responsibilities": 0, 
                    "total_jd_responsibilities": len(jd_resps), "matches": [], 
                    "unmatched_jd_responsibilities": jd_resps}
        
        # Use GPU-accelerated batch similarity calculation
        return self._responsibilities_similarity_gpu_batch(jd_emb, cv_emb, jd_resps, cv_resps)
    
    def _responsibilities_similarity_gpu_batch(self, jd_emb: Dict[str, np.ndarray], cv_emb: Dict[str, np.ndarray],
                                               jd_resps: List[str], cv_resps: List[str]) -> Dict[str, Any]:
        """
        GPU-accelerated responsibilities similarity calculation using GPU Hungarian algorithm.
        """
        try:
            # SAFETY CHECK: Limit batch size to prevent GPU memory issues
            max_batch_size = 20  # Conservative limit for responsibilities matching
            if len(jd_resps) > max_batch_size or len(cv_resps) > max_batch_size:
                logger.warning(f"⚠️ Responsibilities batch too large ({len(jd_resps)}x{len(cv_resps)}), using CPU fallback")
                return self._responsibilities_similarity_cpu_fallback(jd_emb, cv_emb, jd_resps, cv_resps)
            
            logger.info(f"🚀 GPU-Hungarian responsibilities similarity: {len(jd_resps)} JD resp vs {len(cv_resps)} CV resp")
            # Prepare matrices for batch processing
            jd_vectors = []
            cv_vectors = []
            jd_resp_mapping = []
            cv_resp_mapping = []
            
            # Build JD vectors matrix with mapping
            for jd_r in jd_resps:
                v1 = jd_emb.get(jd_r)
                if v1 is not None:
                    jd_vectors.append(v1)
                    jd_resp_mapping.append(jd_r)
            
            # Build CV vectors matrix with mapping
            for cv_r in cv_resps:
                v2 = cv_emb.get(cv_r)
                if v2 is not None:
                    cv_vectors.append(v2)
                    cv_resp_mapping.append(cv_r)
            
            if not jd_vectors or not cv_vectors:
                return {"responsibility_match_percentage": 0.0, "matched_responsibilities": 0, 
                        "total_jd_responsibilities": len(jd_resps), "matches": [], 
                        "unmatched_jd_responsibilities": jd_resps}
            
            # Convert to numpy matrices
            jd_matrix = np.array(jd_vectors)
            cv_matrix = np.array(cv_vectors)
            
            # Calculate similarity matrix on GPU
            similarity_matrix = self.embedding_service.calculate_batch_cosine_similarity_gpu(jd_matrix, cv_matrix)
            
            # Use GPU Hungarian algorithm for optimal matching (same as CPU version)
            avg_score, pairs = hungarian_mean(similarity_matrix)
            
            # Build detailed matches using Hungarian results
            matches = []
            matched_jd_indices = set()
            matched_cv_indices = set()
            
            for jd_idx, cv_idx, sim_score in pairs:
                if jd_idx < len(jd_resp_mapping) and cv_idx < len(cv_resp_mapping):
                    jd_r = jd_resp_mapping[jd_idx]
                    cv_r = cv_resp_mapping[cv_idx]
                    
                    # Only include matches above threshold
                    if sim_score >= self.embedding_service.SIMILARITY_THRESHOLDS["responsibilities"]["minimum"]:
                        matches.append({
                            "jd_responsibility": jd_r, 
                            "cv_responsibility": cv_r, 
                            "similarity": float(sim_score), 
                            "quality": self.embedding_service.get_match_quality(sim_score, "responsibilities"),
                            "jd_index": jd_idx,
                            "cv_index": cv_idx
                        })
                        matched_jd_indices.add(jd_idx)
                        matched_cv_indices.add(cv_idx)
            
            # Find unmatched JD responsibilities
            unmatched_jd_responsibilities = []
            for i, resp in enumerate(jd_resp_mapping):
                if i not in matched_jd_indices:
                    unmatched_jd_responsibilities.append(resp)
            
            # Calculate match percentage (same logic as CPU version)
            match_percentage = (len(matches) / len(jd_resps)) * 100.0 if jd_resps else 0.0
            
            return {
                "responsibility_match_percentage": match_percentage, 
                "matched_responsibilities": len(matches), 
                "total_jd_responsibilities": len(jd_resps), 
                "matches": matches, 
                "unmatched_jd_responsibilities": unmatched_jd_responsibilities
            }
            
        except Exception as e:
            logger.warning(f"⚠️ GPU-Hungarian responsibilities similarity failed: {str(e)}")
            # Fallback to CPU version
            return self._responsibilities_similarity_cpu_fallback(jd_emb, cv_emb, jd_resps, cv_resps)
    
    def _responsibilities_similarity_cpu_fallback(self, jd_emb: Dict[str, np.ndarray], cv_emb: Dict[str, np.ndarray],
                                                  jd_resps: List[str], cv_resps: List[str]) -> Dict[str, Any]:
        """
        CPU fallback for responsibilities similarity calculation (original implementation).
        """
        matches, matched = [], 0
        for idx, jd_r in enumerate(jd_resps):
            v1 = jd_emb.get(jd_r)
            if v1 is None:
                continue
                
            best_item, best_sim = None, 0.0
            best_idx = -1
            
            for cv_idx, cv_r in enumerate(cv_resps):
                v2 = cv_emb.get(cv_r)
                if v2 is None:
                    continue
                    
                sim = self.embedding_service.calculate_cosine_similarity(v1, v2)
                if sim > best_sim:
                    best_sim, best_item, best_idx = sim, cv_r, cv_idx
            
            if best_item and best_sim >= self.embedding_service.SIMILARITY_THRESHOLDS["responsibilities"]["minimum"]:
                matched += 1
                matches.append({
                    "jd_responsibility": jd_r, 
                    "cv_responsibility": best_item, 
                    "similarity": best_sim, 
                    "quality": self.embedding_service.get_match_quality(best_sim, "responsibilities"),
                    "jd_index": idx,
                    "cv_index": best_idx
                })
        
        total = len(jd_resps) or 1
        pct = matched / total * 100.0
        unmatched = [r for r in jd_resps if r not in [m["jd_responsibility"] for m in matches]]
        
        return {
            "responsibility_match_percentage": pct, 
            "matched_responsibilities": matched, 
            "total_jd_responsibilities": len(jd_resps), 
            "matches": matches, 
            "unmatched_jd_responsibilities": unmatched
        }

    def _experience_match(self, jd_exp: str, cv_exp: str) -> Tuple[bool, float]:
        try:
            import re
            jd_nums = re.findall(r'(\d+)', jd_exp or "")
            cv_nums = re.findall(r'(\d+)', cv_exp or "")
            if jd_nums and cv_nums:
                req, cand = int(jd_nums[0]), int(cv_nums[0])
                if cand >= req:
                    return True, min(100.0, 80.0 + (cand - req) * 5.0)
                else:
                    return False, max(30.0, (cand / max(req, 1)) * 60.0)
            return True, 75.0
        except Exception:
            return True, 75.0

    def _build_explanation(self, skills_pct: float, skills_analysis: Dict[str, Any],
                           resp_pct: float, resp_analysis: Dict[str, Any],
                           title_sim: float, meets: bool) -> str:
        parts = []
        if skills_pct >= 80:
            parts.append(f"Excellent skills match: {skills_analysis['matched_skills']}/{skills_analysis['total_jd_skills']} ({skills_pct:.0f}%)")
        elif skills_pct >= 60:
            parts.append(f"Good skills match: {skills_analysis['matched_skills']}/{skills_analysis['total_jd_skills']} ({skills_pct:.0f}%)")
        else:
            parts.append(f"Limited skills match: {skills_analysis['matched_skills']}/{skills_analysis['total_jd_skills']} ({skills_pct:.0f}%)")
        if resp_pct >= 70:
            parts.append(f"Strong experience alignment: {resp_analysis['matched_responsibilities']}/{resp_analysis['total_jd_responsibilities']} ({resp_pct:.0f}%)")
        elif resp_pct >= 50:
            parts.append(f"Moderate experience alignment: {resp_analysis['matched_responsibilities']}/{resp_analysis['total_jd_responsibilities']} ({resp_pct:.0f}%)")
        else:
            parts.append(f"Limited experience alignment: {resp_analysis['matched_responsibilities']}/{resp_analysis['total_jd_responsibilities']} ({resp_pct:.0f}%)")
        if title_sim >= 0.8:
            parts.append("Job title strongly aligned")
        elif title_sim >= 0.6:
            parts.append("Job title moderately aligned")
        else:
            parts.append("Job title limited alignment")
        parts.append("Experience requirements satisfied" if meets else "Experience requirements may not be fully met")
        return ". ".join(parts) + "."

    def _build_details(self, cv_std: Dict[str, Any], jd_std: Dict[str, Any],
                       skills_analysis: Dict[str, Any], resp_analysis: Dict[str, Any],
                       title_sim: float, exp_score: float) -> Dict[str, Any]:
        return {
            "skills_analysis": {
                "total_required": skills_analysis["total_jd_skills"],
                "matched": skills_analysis["matched_skills"],
                "match_percentage": skills_analysis["skill_match_percentage"],
                "matches": skills_analysis["matches"][:5],
                "unmatched": skills_analysis["unmatched_jd_skills"],
            },
            "responsibilities_analysis": {
                "total_required": resp_analysis["total_jd_responsibilities"],
                "matched": resp_analysis["matched_responsibilities"],
                "match_percentage": resp_analysis["responsibility_match_percentage"],
                "matches": resp_analysis["matches"][:5],
                "unmatched": resp_analysis["unmatched_jd_responsibilities"],
            },
            "title_analysis": {
                "jd_title": jd_std.get("job_title", "") or "",
                "cv_title": cv_std.get("job_title", "") or "",
                "similarity": title_sim,
                "match_quality": self.embedding_service.get_match_quality(title_sim, "skills"),
            },
            "experience_analysis": {
                "jd_requirement": jd_std.get("years_of_experience", "") or jd_std.get("experience_years", ""),
                "cv_experience": cv_std.get("years_of_experience", "") or cv_std.get("experience_years", ""),
                "meets_requirement": exp_score >= 75.0,
                "score": exp_score,
            },
            "scoring_weights": self.SCORING_WEIGHTS,
        }

# Singleton accessor
_matching_service: Optional[MatchingService] = None
def get_matching_service() -> MatchingService:
    global _matching_service
    if _matching_service is None:
        _matching_service = MatchingService()
    return _matching_service