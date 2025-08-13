"""
Enterprise-grade embedding service supporting multiple embedding models.
Provides both OpenAI and Sentence Transformers embeddings with fallback mechanisms.
"""

import logging
import os
import time
from typing import List, Dict, Any, Optional, Literal
from enum import Enum
import numpy as np
from sentence_transformers import SentenceTransformer
import requests
import torch

logger = logging.getLogger(__name__)

class EmbeddingProvider(Enum):
    """Supported embedding providers."""
    SENTENCE_TRANSFORMERS = "sentence_transformers"
    OPENAI = "openai"

class EmbeddingService:
    """
    Production-ready embedding service with multiple providers and caching.
    
    Features:
    - Multiple embedding models (Sentence Transformers + OpenAI)
    - Automatic fallback mechanisms
    - Caching for performance
    - Batch processing support
    - Error handling and retry logic
    """
    
    # 🚀 PERFORMANCE OPTIMIZATION: Optimal similarity thresholds
    SIMILARITY_THRESHOLDS = {
        "skills": {
            "excellent": 0.85,    # High-confidence matches
            "good": 0.75,         # Good matches
            "moderate": 0.65,     # Acceptable matches
            "minimum": 0.60       # Lower bound for consideration
        },
        "responsibilities": {
            "excellent": 0.80,    # High responsibility alignment
            "good": 0.70,         # Good responsibility match
            "moderate": 0.60,     # Basic responsibility alignment
            "minimum": 0.55       # Lower bound for consideration
        }
    }
    
    def __init__(
        self, 
        primary_provider: EmbeddingProvider = EmbeddingProvider.SENTENCE_TRANSFORMERS,
        sentence_model: str = "all-mpnet-base-v2",
        openai_model: str = "text-embedding-3-small"
    ):
        """
        Initialize the embedding service.
        
        Args:
            primary_provider: Primary embedding provider to use
            sentence_model: Sentence Transformers model name (default: all-mpnet-base-v2)
            openai_model: OpenAI embedding model name
        """
        self.primary_provider = primary_provider
        self.sentence_model_name = sentence_model
        self.openai_model = openai_model
        
        # Model caching
        self._sentence_model: Optional[SentenceTransformer] = None
        self._embedding_cache: Dict[str, List[float]] = {}
        
        # Initialize models
        self._initialize_models()
        
        logger.info(f"EmbeddingService initialized with primary provider: {primary_provider.value}")
    
    def _get_match_quality(self, similarity: float, category: str) -> str:
        """
        Get match quality based on optimized thresholds.
        
        Args:
            similarity: Cosine similarity score
            category: 'skills' or 'responsibilities'
            
        Returns:
            Quality level string
        """
        thresholds = self.SIMILARITY_THRESHOLDS[category]
        
        if similarity >= thresholds["excellent"]:
            return "excellent"
        elif similarity >= thresholds["good"]:
            return "good"
        elif similarity >= thresholds["moderate"]:
            return "moderate"
        elif similarity >= thresholds["minimum"]:
            return "minimum"
        else:
            return "unmatched"
    
    def _initialize_models(self) -> None:
        """Initialize embedding models based on availability."""
        try:
            # Initialize Sentence Transformers
            if torch.cuda.is_available():
                logger.info("CUDA available - using GPU for Sentence Transformers")
                device = "cuda"
            else:
                logger.info("Using CPU for Sentence Transformers")
                device = "cpu"
                
            self._sentence_model = SentenceTransformer(self.sentence_model_name, device=device)
            logger.info(f"✅ Sentence Transformers model '{self.sentence_model_name}' loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Sentence Transformers: {str(e)}")
            self._sentence_model = None
    
    def get_embedding(
        self, 
        text: str, 
        provider: Optional[EmbeddingProvider] = None,
        use_cache: bool = True
    ) -> List[float]:
        """
        Generate embedding for text using specified or primary provider.
        
        Args:
            text: Text to embed
            provider: Specific provider to use (defaults to primary)
            use_cache: Whether to use caching
            
        Returns:
            List of embedding values
            
        Raises:
            Exception: If all embedding methods fail
        """
        if not text or not text.strip():
            raise ValueError("Empty text provided for embedding")
        
        # Clean and prepare text
        clean_text = self._prepare_text(text)
        
        # Check cache
        if use_cache and clean_text in self._embedding_cache:
            logger.debug("Using cached embedding")
            return self._embedding_cache[clean_text]
        
        # Determine provider
        provider = provider or self.primary_provider
        
        try:
            # Try primary provider
            if provider == EmbeddingProvider.SENTENCE_TRANSFORMERS:
                embedding = self._get_sentence_transformers_embedding(clean_text)
            else:
                embedding = self._get_openai_embedding(clean_text)
                
            # Cache result
            if use_cache:
                self._embedding_cache[clean_text] = embedding
                
            return embedding
            
        except Exception as e:
            logger.warning(f"Primary provider {provider.value} failed: {str(e)}")
            
            # Try fallback
            return self._get_fallback_embedding(clean_text, provider, use_cache)
    
    def get_embeddings_batch(
        self, 
        texts: List[str], 
        provider: Optional[EmbeddingProvider] = None,
        batch_size: int = 32
    ) -> List[List[float]]:
        """
        Generate embeddings for multiple texts efficiently.
        
        Args:
            texts: List of texts to embed
            provider: Embedding provider to use
            batch_size: Batch size for processing
            
        Returns:
            List of embedding vectors
        """
        if not texts:
            return []
        
        provider = provider or self.primary_provider
        
        try:
            if provider == EmbeddingProvider.SENTENCE_TRANSFORMERS and self._sentence_model:
                return self._get_sentence_transformers_batch(texts, batch_size)
            else:
                # OpenAI doesn't have efficient batch processing, so process individually
                return [self.get_embedding(text, provider) for text in texts]
                
        except Exception as e:
            logger.error(f"Batch embedding failed: {str(e)}")
            # Fallback to individual processing
            return [self.get_embedding(text, provider) for text in texts]
    
    def _prepare_text(self, text: str) -> str:
        """Clean and prepare text for embedding."""
        # Remove excessive whitespace
        clean_text = " ".join(text.split())
        
        # Truncate if too long (both models have limits)
        max_length = 512 if self.primary_provider == EmbeddingProvider.SENTENCE_TRANSFORMERS else 8000
        if len(clean_text) > max_length:
            clean_text = clean_text[:max_length]
            logger.warning(f"Text truncated to {max_length} characters for embedding")
        
        return clean_text
    
    def _get_sentence_transformers_embedding(self, text: str) -> List[float]:
        """Generate embedding using Sentence Transformers."""
        if not self._sentence_model:
            raise Exception("Sentence Transformers model not available")
        
        try:
            start_time = time.time()
            embedding = self._sentence_model.encode(text, convert_to_tensor=False)
            
            # Convert to list if numpy array
            if isinstance(embedding, np.ndarray):
                embedding = embedding.tolist()
            
            processing_time = time.time() - start_time
            logger.debug(f"Sentence Transformers embedding generated in {processing_time:.3f}s: {len(embedding)} dimensions")
            
            return embedding
            
        except Exception as e:
            logger.error(f"Sentence Transformers embedding failed: {str(e)}")
            raise
    
    def _get_sentence_transformers_batch(self, texts: List[str], batch_size: int) -> List[List[float]]:
        """Generate embeddings using Sentence Transformers batch processing."""
        if not self._sentence_model:
            raise Exception("Sentence Transformers model not available")
        
        try:
            start_time = time.time()
            
            # Process in batches
            all_embeddings = []
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                batch_embeddings = self._sentence_model.encode(batch, convert_to_tensor=False)
                
                # Convert to list format
                if isinstance(batch_embeddings, np.ndarray):
                    if len(batch_embeddings.shape) == 1:
                        # Single embedding
                        all_embeddings.append(batch_embeddings.tolist())
                    else:
                        # Multiple embeddings
                        all_embeddings.extend([emb.tolist() for emb in batch_embeddings])
                
            processing_time = time.time() - start_time
            logger.info(f"Batch embedding completed: {len(texts)} texts in {processing_time:.3f}s")
            
            return all_embeddings
            
        except Exception as e:
            logger.error(f"Sentence Transformers batch embedding failed: {str(e)}")
            raise
    
    def _get_openai_embedding(self, text: str) -> List[float]:
        """Generate embedding using OpenAI API."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise Exception("OPENAI_API_KEY environment variable is required")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": self.openai_model,
            "input": text
        }
        
        try:
            start_time = time.time()
            response = requests.post(
                "https://api.openai.com/v1/embeddings",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")
            
            result = response.json()
            embedding = result['data'][0]['embedding']
            
            processing_time = time.time() - start_time
            logger.debug(f"OpenAI embedding generated in {processing_time:.3f}s: {len(embedding)} dimensions")
            
            return embedding
            
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {str(e)}")
            raise
    
    def _get_fallback_embedding(
        self, 
        text: str, 
        failed_provider: EmbeddingProvider, 
        use_cache: bool
    ) -> List[float]:
        """Get embedding using fallback provider."""
        fallback_provider = (
            EmbeddingProvider.OPENAI 
            if failed_provider == EmbeddingProvider.SENTENCE_TRANSFORMERS 
            else EmbeddingProvider.SENTENCE_TRANSFORMERS
        )
        
        logger.info(f"Trying fallback provider: {fallback_provider.value}")
        
        try:
            if fallback_provider == EmbeddingProvider.SENTENCE_TRANSFORMERS:
                embedding = self._get_sentence_transformers_embedding(text)
            else:
                embedding = self._get_openai_embedding(text)
            
            # Cache result
            if use_cache:
                self._embedding_cache[text] = embedding
                
            return embedding
            
        except Exception as e:
            logger.error(f"Fallback provider {fallback_provider.value} also failed: {str(e)}")
            raise Exception(f"All embedding providers failed. Primary: {failed_provider.value}, Fallback: {fallback_provider.value}")
    
    def get_embedding_dimension(self, provider: Optional[EmbeddingProvider] = None) -> int:
        """Get embedding dimension for the specified provider."""
        provider = provider or self.primary_provider
        
        if provider == EmbeddingProvider.SENTENCE_TRANSFORMERS:
            if self._sentence_model:
                return self._sentence_model.get_sentence_embedding_dimension()
            else:
                return 384  # Default for all-MiniLM-L6-v2
        else:
            return 1536  # OpenAI text-embedding-3-small
    
    def health_check(self) -> Dict[str, Any]:
        """Check health of embedding service."""
        status = {
            "service": "embedding_service",
            "primary_provider": self.primary_provider.value,
            "sentence_transformers": {
                "available": self._sentence_model is not None,
                "model": self.sentence_model_name,
                "device": str(self._sentence_model.device) if self._sentence_model else None
            },
            "openai": {
                "available": bool(os.getenv("OPENAI_API_KEY")),
                "model": self.openai_model
            },
            "cache_size": len(self._embedding_cache)
        }
        
        return status
    
    def embed_skills_batch_optimized(self, skills: List[str]) -> Dict[str, List[float]]:
        """
        PERFORMANCE OPTIMIZED: Generate embeddings for skills using batch processing.
        
        Args:
            skills: List of skills to embed
            
        Returns:
            Dictionary mapping each skill to its embedding vector
        """
        if not skills:
            return {}
            
        logger.info(f"🚀 OPTIMIZED: Generating batch embeddings for {len(skills)} skills")
        start_time = time.time()
        
        # Clean and prepare skills
        cleaned_skills = []
        skill_mapping = {}  # Maps cleaned index to original skill
        
        for i, skill in enumerate(skills):
            if skill and len(skill.strip()) > 0:
                cleaned_skill = skill.strip()
                cleaned_skills.append(cleaned_skill)
                skill_mapping[len(cleaned_skills) - 1] = skill
        
        if not cleaned_skills:
            return {}
        
        try:
            # Use batch processing for major performance improvement
            batch_embeddings = self.get_embeddings_batch(cleaned_skills, batch_size=32)
            
            # Create result dictionary
            skill_embeddings = {}
            for i, embedding in enumerate(batch_embeddings):
                if i in skill_mapping:
                    original_skill = skill_mapping[i]
                    skill_embeddings[original_skill] = embedding
            
            processing_time = time.time() - start_time
            logger.info(f"✅ OPTIMIZED: Generated {len(skill_embeddings)} skill embeddings in {processing_time:.3f}s "
                       f"(~{processing_time/len(skill_embeddings)*1000:.1f}ms per skill)")
            
            return skill_embeddings
            
        except Exception as e:
            logger.error(f"❌ Batch skill embedding failed, falling back to individual: {str(e)}")
            # Fallback to individual processing if batch fails
            return self._embed_skills_individual_fallback(skills)
    
    def embed_responsibilities_batch_optimized(self, responsibilities: List[str]) -> Dict[str, List[float]]:
        """
        PERFORMANCE OPTIMIZED: Generate embeddings for responsibilities using batch processing.
        
        Args:
            responsibilities: List of responsibilities to embed
            
        Returns:
            Dictionary mapping each responsibility to its embedding vector
        """
        if not responsibilities:
            return {}
            
        logger.info(f"🚀 OPTIMIZED: Generating batch embeddings for {len(responsibilities)} responsibilities")
        start_time = time.time()
        
        # Clean and prepare responsibilities
        cleaned_responsibilities = []
        responsibility_mapping = {}  # Maps cleaned index to original responsibility info
        
        for i, responsibility in enumerate(responsibilities):
            if responsibility and len(responsibility.strip()) > 0:
                cleaned_responsibility = responsibility.strip()
                cleaned_responsibilities.append(cleaned_responsibility)
                # Create key with index for uniqueness
                key = f"{i+1}. {responsibility[:50]}..." if len(responsibility) > 50 else f"{i+1}. {responsibility}"
                responsibility_mapping[len(cleaned_responsibilities) - 1] = key
        
        if not cleaned_responsibilities:
            return {}
        
        try:
            # Use batch processing for major performance improvement
            batch_embeddings = self.get_embeddings_batch(cleaned_responsibilities, batch_size=32)
            
            # Create result dictionary
            responsibility_embeddings = {}
            for i, embedding in enumerate(batch_embeddings):
                if i in responsibility_mapping:
                    key = responsibility_mapping[i]
                    responsibility_embeddings[key] = embedding
            
            processing_time = time.time() - start_time
            logger.info(f"✅ OPTIMIZED: Generated {len(responsibility_embeddings)} responsibility embeddings in {processing_time:.3f}s "
                       f"(~{processing_time/len(responsibility_embeddings)*1000:.1f}ms per responsibility)")
            
            return responsibility_embeddings
            
        except Exception as e:
            logger.error(f"❌ Batch responsibility embedding failed, falling back to individual: {str(e)}")
            # Fallback to individual processing if batch fails
            return self._embed_responsibilities_individual_fallback(responsibilities)
    
    def _embed_skills_individual_fallback(self, skills: List[str]) -> Dict[str, List[float]]:
        """Fallback method for individual skill embedding if batch processing fails."""
        logger.warning("Using individual skill embedding fallback - performance will be slower")
        skill_embeddings = {}
        
        for skill in skills:
            if skill and len(skill.strip()) > 0:
                try:
                    embedding = self.get_embedding(skill.strip())
                    skill_embeddings[skill] = embedding
                except Exception as e:
                    logger.error(f"❌ Failed to embed skill '{skill}': {str(e)}")
                    continue
        
        return skill_embeddings
    
    def _embed_responsibilities_individual_fallback(self, responsibilities: List[str]) -> Dict[str, List[float]]:
        """Fallback method for individual responsibility embedding if batch processing fails."""
        logger.warning("Using individual responsibility embedding fallback - performance will be slower")
        responsibility_embeddings = {}
        
        for i, responsibility in enumerate(responsibilities):
            if responsibility and len(responsibility.strip()) > 0:
                try:
                    embedding = self.get_embedding(responsibility.strip())
                    key = f"{i+1}. {responsibility[:50]}..." if len(responsibility) > 50 else f"{i+1}. {responsibility}"
                    responsibility_embeddings[key] = embedding
                except Exception as e:
                    logger.error(f"❌ Failed to embed responsibility {i+1}: {str(e)}")
                    continue
        
        return responsibility_embeddings

    # Keep original methods for backward compatibility
    def embed_skills_individually(self, skills: List[str]) -> Dict[str, List[float]]:
        """
        DEPRECATED: Use embed_skills_batch_optimized() for better performance.
        Generate embeddings for each individual skill.
        """
        logger.warning("⚠️ Using deprecated individual skill embedding - consider using embed_skills_batch_optimized()")
        return self._embed_skills_individual_fallback(skills)
    
    def embed_responsibilities_individually(self, responsibilities: List[str]) -> Dict[str, List[float]]:
        """
        DEPRECATED: Use embed_responsibilities_batch_optimized() for better performance.
        Generate embeddings for each individual responsibility.
        """
        logger.warning("⚠️ Using deprecated individual responsibility embedding - consider using embed_responsibilities_batch_optimized()")
        return self._embed_responsibilities_individual_fallback(responsibilities)
    
    def calculate_skill_similarity_matrix(self, jd_skills: List[str], cv_skills: List[str]) -> Dict[str, Any]:
        """
        Calculate similarity matrix between JD skills and CV skills.
        
        Args:
            jd_skills: Job description skills
            cv_skills: CV skills
            
        Returns:
            Dictionary containing similarity matrix and match results
        """
        logger.info(f"Calculating skill similarity matrix: {len(jd_skills)} JD skills vs {len(cv_skills)} CV skills")
        
        # 🚀 PERFORMANCE OPTIMIZATION: Use batch processing instead of individual calls
        jd_embeddings = self.embed_skills_batch_optimized(jd_skills)
        cv_embeddings = self.embed_skills_batch_optimized(cv_skills)
        
        # 🚀 PERFORMANCE OPTIMIZATION: Use numpy matrix operations for O(n) instead of O(n²)
        try:
            import numpy as np
            
            # Convert to numpy arrays for vectorized operations
            jd_vectors = np.array([jd_embeddings[skill] for skill in jd_skills])
            cv_vectors = np.array([cv_embeddings[skill] for skill in cv_skills])
            
            # Calculate similarity matrix using dot product (much faster than loops)
            similarity_matrix = np.dot(jd_vectors, cv_vectors.T)
            
            # Apply threshold and find matches
            matches = []
            for i, jd_skill in enumerate(jd_skills):
                best_match_idx = np.argmax(similarity_matrix[i])
                best_similarity = similarity_matrix[i][best_match_idx]
                
                match_quality = self._get_match_quality(best_similarity, "skills")
                
                if match_quality == "excellent":
                    matches.append({
                        "jd_skill": jd_skill,
                        "cv_skill": cv_skills[best_match_idx],
                        "similarity": float(best_similarity),
                        "match_quality": "excellent"
                    })
                elif match_quality == "good":
                    matches.append({
                        "jd_skill": jd_skill,
                        "cv_skill": cv_skills[best_match_idx],
                        "similarity": float(best_similarity),
                        "match_quality": "good"
                    })
                elif match_quality == "moderate":
                    matches.append({
                        "jd_skill": jd_skill,
                        "cv_skill": cv_skills[best_match_idx],
                        "similarity": float(best_similarity),
                        "match_quality": "moderate"
                    })
                elif match_quality == "minimum":
                    matches.append({
                        "jd_skill": jd_skill,
                        "cv_skill": cv_skills[best_match_idx],
                        "similarity": float(best_similarity),
                        "match_quality": "minimum"
                    })
            
            # Calculate overall skill match percentage
            total_jd_skills = len(jd_skills)
            matched_skills = len(matches)
            skill_match_percentage = (matched_skills / total_jd_skills * 100) if total_jd_skills > 0 else 0
            
            logger.info(f"✅ Optimized vector matching completed: {matched_skills}/{total_jd_skills} skills matched")
            
            return {
                "similarity_matrix": similarity_matrix.tolist(),
                "matches": matches,
                "skill_match_percentage": skill_match_percentage,
                "total_jd_skills": total_jd_skills,
                "matched_skills": matched_skills,
                "unmatched_jd_skills": [skill for skill in jd_skills if not any(m["jd_skill"] == skill for m in matches)]
            }
            
        except ImportError:
            logger.warning("NumPy not available, falling back to original algorithm")
            return self._calculate_skill_similarity_matrix_fallback(jd_skills, cv_skills)
        except Exception as e:
            logger.error(f"Optimized vector matching failed: {str(e)}, falling back to original")
            return self._calculate_skill_similarity_matrix_fallback(jd_skills, cv_skills)
    
    def _calculate_skill_similarity_matrix_fallback(self, jd_skills: List[str], cv_skills: List[str]) -> Dict[str, Any]:
        """
        Fallback to original algorithm if optimization fails.
        """
        logger.info("Using fallback similarity calculation method")
        
        # Get embeddings for fallback
        jd_embeddings = self.embed_skills_batch_optimized(jd_skills)
        cv_embeddings = self.embed_skills_batch_optimized(cv_skills)
        
        # Calculate similarity matrix
        similarity_matrix = {}
        matches = []
        
        for jd_skill, jd_embedding in jd_embeddings.items():
            skill_matches = []
            for cv_skill, cv_embedding in cv_embeddings.items():
                similarity = self._calculate_cosine_similarity(jd_embedding, cv_embedding)
                skill_matches.append({
                    "cv_skill": cv_skill,
                    "similarity": float(similarity)
                })
                
            # Sort by similarity and get best match
            skill_matches.sort(key=lambda x: x["similarity"], reverse=True)
            similarity_matrix[jd_skill] = skill_matches
            
            if skill_matches:
                best_match = skill_matches[0]
                if best_match["similarity"] >= self.SIMILARITY_THRESHOLDS["skills"]["minimum"]:
                    matches.append({
                        "jd_skill": jd_skill,
                        "cv_skill": best_match["cv_skill"],
                        "similarity": best_match["similarity"],
                        "match_quality": self._get_match_quality(best_match["similarity"], "skills")
                    })
        
        # Calculate overall skill match percentage
        total_jd_skills = len(jd_skills)
        matched_skills = len(matches)
        skill_match_percentage = (matched_skills / total_jd_skills * 100) if total_jd_skills > 0 else 0
        
        return {
            "similarity_matrix": similarity_matrix,
            "matches": matches,
            "skill_match_percentage": skill_match_percentage,
            "total_jd_skills": total_jd_skills,
            "matched_skills": matched_skills,
            "unmatched_jd_skills": [skill for skill in jd_skills if not any(m["jd_skill"] == skill for m in matches)]
        }
    
    def calculate_responsibility_similarity_matrix(self, jd_responsibilities: List[str], cv_responsibilities: List[str]) -> Dict[str, Any]:
        """
        Calculate similarity matrix between JD responsibilities and CV responsibilities.
        
        Args:
            jd_responsibilities: Job description responsibilities
            cv_responsibilities: CV responsibilities
            
        Returns:
            Dictionary containing similarity matrix and match results
        """
        logger.info(f"Calculating responsibility similarity matrix: {len(jd_responsibilities)} JD vs {len(cv_responsibilities)} CV")
        
        # 🚀 PERFORMANCE OPTIMIZATION: Use batch processing instead of individual calls
        jd_embeddings = self.embed_responsibilities_batch_optimized(jd_responsibilities)
        cv_embeddings = self.embed_responsibilities_batch_optimized(cv_responsibilities)
        
        # 🚀 PERFORMANCE OPTIMIZATION: Use numpy matrix operations for O(n) instead of O(n²)
        try:
            import numpy as np
            
            # Convert to numpy arrays for vectorized operations
            jd_vectors = np.array([jd_embeddings[resp] for resp in jd_responsibilities])
            cv_vectors = np.array([cv_embeddings[resp] for resp in cv_responsibilities])
            
            # Calculate similarity matrix using dot product (much faster than loops)
            similarity_matrix = np.dot(jd_vectors, cv_vectors.T)
            
            # Apply threshold and find matches
            matches = []
            for i, jd_resp_key in enumerate(jd_responsibilities):
                best_match_idx = np.argmax(similarity_matrix[i])
                best_similarity = similarity_matrix[i][best_match_idx]
                
                match_quality = self._get_match_quality(best_similarity, "responsibilities")
                
                if match_quality == "excellent":
                    matches.append({
                        "jd_responsibility": jd_resp_key,
                        "cv_responsibility": cv_responsibilities[best_match_idx],
                        "similarity": float(best_similarity),
                        "match_quality": "excellent"
                    })
                elif match_quality == "good":
                    matches.append({
                        "jd_responsibility": jd_resp_key,
                        "cv_responsibility": cv_responsibilities[best_match_idx],
                        "similarity": float(best_similarity),
                        "match_quality": "good"
                    })
                elif match_quality == "moderate":
                    matches.append({
                        "jd_responsibility": jd_resp_key,
                        "cv_responsibility": cv_responsibilities[best_match_idx],
                        "similarity": float(best_similarity),
                        "match_quality": "moderate"
                    })
                elif match_quality == "minimum":
                    matches.append({
                        "jd_responsibility": jd_resp_key,
                        "cv_responsibility": cv_responsibilities[best_match_idx],
                        "similarity": float(best_similarity),
                        "match_quality": "minimum"
                    })
            
            # Calculate overall responsibility match percentage
            total_jd_responsibilities = len(jd_responsibilities)
            matched_responsibilities = len(matches)
            responsibility_match_percentage = (matched_responsibilities / total_jd_responsibilities * 100) if total_jd_responsibilities > 0 else 0
            
            logger.info(f"✅ Optimized responsibility matching completed: {matched_responsibilities}/{total_jd_responsibilities} responsibilities matched")
            
            return {
                "similarity_matrix": similarity_matrix.tolist(),
                "matches": matches,
                "responsibility_match_percentage": responsibility_match_percentage,
                "total_jd_responsibilities": total_jd_responsibilities,
                "matched_responsibilities": matched_responsibilities,
                "unmatched_jd_responsibilities": [resp for resp in jd_responsibilities if not any(m["jd_responsibility"] == resp for m in matches)]
            }
            
        except ImportError:
            logger.warning("NumPy not available, falling back to original algorithm")
            return self._calculate_responsibility_similarity_matrix_fallback(jd_responsibilities, cv_responsibilities)
        except Exception as e:
            logger.error(f"Optimized responsibility matching failed: {str(e)}, falling back to original")
            return self._calculate_responsibility_similarity_matrix_fallback(jd_responsibilities, cv_responsibilities)
    
    def _calculate_responsibility_similarity_matrix_fallback(self, jd_responsibilities: List[str], cv_responsibilities: List[str]) -> Dict[str, Any]:
        """
        Fallback to original algorithm if optimization fails.
        """
        logger.info("Using fallback responsibility similarity calculation method")
        
        # Get embeddings for fallback
        jd_embeddings = self.embed_responsibilities_batch_optimized(jd_responsibilities)
        cv_embeddings = self.embed_responsibilities_batch_optimized(cv_responsibilities)
        
        # Calculate similarity matrix
        similarity_matrix = {}
        matches = []
        
        for jd_resp_key, jd_embedding in jd_embeddings.items():
            resp_matches = []
            for cv_resp_key, cv_embedding in cv_embeddings.items():
                similarity = self._calculate_cosine_similarity(jd_embedding, cv_embedding)
                resp_matches.append({
                    "cv_responsibility": cv_resp_key,
                    "similarity": float(similarity)
                })
                
            # Sort by similarity and get best match
            resp_matches.sort(key=lambda x: x["similarity"], reverse=True)
            similarity_matrix[jd_resp_key] = resp_matches
            
            if resp_matches:
                best_match = resp_matches[0]
                if best_match["similarity"] >= self.SIMILARITY_THRESHOLDS["responsibilities"]["minimum"]:
                    matches.append({
                        "jd_responsibility": jd_resp_key,
                        "cv_responsibility": best_match["cv_responsibility"],
                        "similarity": best_match["similarity"],
                        "match_quality": self._get_match_quality(best_match["similarity"], "responsibilities")
                    })
        
        # Calculate overall responsibility match percentage
        total_jd_responsibilities = len(jd_responsibilities)
        matched_responsibilities = len(matches)
        responsibility_match_percentage = (matched_responsibilities / total_jd_responsibilities * 100) if total_jd_responsibilities > 0 else 0
        
        return {
            "similarity_matrix": similarity_matrix,
            "matches": matches,
            "responsibility_match_percentage": responsibility_match_percentage,
            "total_jd_responsibilities": total_jd_responsibilities,
            "matched_responsibilities": matched_responsibilities,
            "unmatched_jd_responsibilities": [resp for resp in jd_responsibilities if not any(m["jd_responsibility"] == resp for m in matches)]
        }
    
    def _calculate_cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        import numpy as np
        
        vec1_np = np.array(vec1)
        vec2_np = np.array(vec2)
        
        # Calculate cosine similarity
        dot_product = np.dot(vec1_np, vec2_np)
        norm1 = np.linalg.norm(vec1_np)
        norm2 = np.linalg.norm(vec2_np)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        cosine_sim = dot_product / (norm1 * norm2)
        return max(0.0, min(1.0, float(cosine_sim)))  # Clamp between 0 and 1

# Global instance
_embedding_service: Optional[EmbeddingService] = None

def get_embedding_service() -> EmbeddingService:
    """Get global embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service