# embedding_service.py
import logging
import time
from typing import List, Dict, Any, Optional
import numpy as np
import torch
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

class EmbeddingService:
    """
    Consolidated service for all embedding operations.
    Uses all-mpnet-base-v2 model (768 dimensions) for consistent, high-quality embeddings.
    """
    
    # Optimal similarity thresholds for matching
    SIMILARITY_THRESHOLDS = {
        "skills": {
            "excellent": 0.85,
            "good": 0.75,
            "moderate": 0.65,
            "minimum": 0.60
        },
        "responsibilities": {
            "excellent": 0.80,
            "good": 0.70,
            "moderate": 0.60,
            "minimum": 0.55
        }
    }
    
    def __init__(self, model_name: str = "all-mpnet-base-v2"):
        """
        Initialize the embedding service.
        
        Args:
            model_name: Sentence transformer model to use
        """
        self.model_name = model_name
        self.model = None
        self.device = None
        self._embedding_cache = {}
        
        self._initialize_model()
        logger.info(f"🔥 EmbeddingService initialized with {model_name}")
    
    def _initialize_model(self) -> None:
        """Initialize the sentence transformer model."""
        try:
            # Determine device
            if torch.cuda.is_available():
                self.device = "cuda"
                logger.info("🚀 Using GPU for embeddings")
            else:
                self.device = "cpu"
                logger.info("💻 Using CPU for embeddings")
            
            # Load model
            self.model = SentenceTransformer(self.model_name, device=self.device)
            logger.info(f"✅ Model {self.model_name} loaded successfully on {self.device}")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize embedding model: {str(e)}")
            raise Exception(f"Embedding model initialization failed: {str(e)}")
    
    def generate_document_embeddings(self, structured_data: dict) -> dict:
        """
        Generate EXACTLY 32 vectors per document as specified.
        
        Args:
            structured_data: Dict containing skills, responsibilities, experience_years, job_title
            
        Returns:
            Dict with exactly 32 vectors:
            - skill_vectors: [20 vectors - one per skill]
            - responsibility_vectors: [10 vectors - one per responsibility]
            - experience_vector: [1 vector for experience]
            - job_title_vector: [1 vector for job title]
        """
        try:
            logger.info(f"🔢 Generating EXACTLY 32 vectors per document")
            
            embeddings = {}
            
            # Generate 20 skill vectors (one per skill)
            skills = structured_data.get("skills", [])[:20]  # Ensure exactly 20
            if len(skills) < 20:
                # Pad with generic skills if needed
                while len(skills) < 20:
                    skills.append("General professional skills and competencies")
            
            skill_vectors = []
            for i, skill in enumerate(skills):
                if skill and skill.strip():
                    vector = self.generate_single_embedding(skill)
                    skill_vectors.append(vector.tolist())
                    logger.debug(f"Generated skill vector {i+1}/20")
                else:
                    # Fallback for empty skills
                    vector = self.generate_single_embedding("General professional skills")
                    skill_vectors.append(vector.tolist())
            
            embeddings["skill_vectors"] = skill_vectors
            embeddings["skills"] = skills  # Store the actual skills for reference
            
            # Generate 10 responsibility vectors (one per responsibility)
            responsibilities = structured_data.get("responsibilities", [])[:10]  # Ensure exactly 10
            if len(responsibilities) < 10:
                # Pad with generic responsibilities if needed
                while len(responsibilities) < 10:
                    responsibilities.append("General professional responsibilities and duties")
            
            responsibility_vectors = []
            for i, resp in enumerate(responsibilities):
                if resp and resp.strip():
                    vector = self.generate_single_embedding(resp)
                    responsibility_vectors.append(vector.tolist())
                    logger.debug(f"Generated responsibility vector {i+1}/10")
                else:
                    # Fallback for empty responsibilities
                    vector = self.generate_single_embedding("General professional responsibilities")
                    responsibility_vectors.append(vector.tolist())
            
            embeddings["responsibility_vectors"] = responsibility_vectors
            embeddings["responsibilities"] = responsibilities  # Store for reference
            
            # Generate 1 experience vector
            experience_text = structured_data.get("experience_years", "0")
            if not experience_text or not experience_text.strip():
                experience_text = "0 years"
            experience_vector = self.generate_single_embedding(f"Experience: {experience_text} years")
            embeddings["experience_vector"] = [experience_vector.tolist()]
            embeddings["experience_years"] = experience_text
            
            # Generate 1 job title vector
            job_title = structured_data.get("job_title", "")
            if not job_title or not job_title.strip():
                job_title = "Professional"
            job_title_vector = self.generate_single_embedding(job_title)
            embeddings["job_title_vector"] = [job_title_vector.tolist()]
            embeddings["job_title"] = job_title
            
            # Verify we have exactly 32 vectors
            total_vectors = len(embeddings["skill_vectors"]) + len(embeddings["responsibility_vectors"]) + len(embeddings["experience_vector"]) + len(embeddings["job_title_vector"])
            
            logger.info(f"✅ Generated exactly {total_vectors} vectors per document (20 skills + 10 resp + 1 exp + 1 title = 32)")
            
            if total_vectors != 32:
                raise ValueError(f"Expected exactly 32 vectors, got {total_vectors}")
            
            return embeddings
            
        except Exception as e:
            logger.error(f"❌ Failed to generate document embeddings: {str(e)}")
            raise Exception(f"Document embedding generation failed: {str(e)}")
    
    def generate_single_embedding(self, text: str) -> np.ndarray:
        """
        Generate single embedding for experience/title or any single text.
        
        Args:
            text: Text to embed
            
        Returns:
            Numpy array representing the embedding vector
        """
        if not text or not text.strip():
            raise ValueError("Empty text provided for embedding")
        
        # Clean text
        clean_text = self._prepare_text(text)
        
        # Check cache
        if clean_text in self._embedding_cache:
            logger.debug("Using cached embedding")
            return self._embedding_cache[clean_text]
        
        try:
            logger.debug(f"Generating embedding for: {clean_text[:50]}...")
            start_time = time.time()
            
            embedding = self.model.encode(clean_text, convert_to_tensor=False)
            
            # Convert to numpy if needed
            if isinstance(embedding, torch.Tensor):
                embedding = embedding.cpu().numpy()
            
            # Cache the result
            self._embedding_cache[clean_text] = embedding
            
            processing_time = time.time() - start_time
            logger.debug(f"✅ Embedding generated in {processing_time:.3f}s: {len(embedding)} dimensions")
            
            return embedding
            
        except Exception as e:
            logger.error(f"❌ Embedding generation failed: {str(e)}")
            raise Exception(f"Embedding generation failed: {str(e)}")
    
    def generate_skill_embeddings(self, skills: List[str]) -> Dict[str, np.ndarray]:
        """
        Generate individual embeddings for each skill using batch processing.
        
        Args:
            skills: List of skills to embed
            
        Returns:
            Dictionary mapping each skill to its embedding vector
        """
        if not skills:
            return {}
        
        logger.info(f"🚀 Generating embeddings for {len(skills)} skills")
        start_time = time.time()
        
        # Clean and prepare skills
        clean_skills = []
        skill_mapping = {}
        
        for i, skill in enumerate(skills):
            if skill and skill.strip():
                clean_skill = self._prepare_text(skill)
                clean_skills.append(clean_skill)
                skill_mapping[len(clean_skills) - 1] = skill
        
        if not clean_skills:
            return {}
        
        try:
            # Batch processing for performance
            embeddings = self.model.encode(clean_skills, convert_to_tensor=False, batch_size=32)
            
            # Convert to numpy if needed
            if isinstance(embeddings, torch.Tensor):
                embeddings = embeddings.cpu().numpy()
            
            # Create result dictionary
            skill_embeddings = {}
            for i, embedding in enumerate(embeddings):
                if i in skill_mapping:
                    original_skill = skill_mapping[i]
                    skill_embeddings[original_skill] = embedding
                    # Cache individual embeddings
                    self._embedding_cache[clean_skills[i]] = embedding
            
            processing_time = time.time() - start_time
            logger.info(f"✅ Generated {len(skill_embeddings)} skill embeddings in {processing_time:.3f}s "
                       f"(~{processing_time/len(skill_embeddings)*1000:.1f}ms per skill)")
            
            return skill_embeddings
            
        except Exception as e:
            logger.error(f"❌ Batch skill embedding failed: {str(e)}")
            # Fallback to individual processing
            return self._generate_individual_skill_embeddings(skills)
    
    def generate_responsibility_embeddings(self, responsibilities: List[str]) -> Dict[str, np.ndarray]:
        """
        Generate individual embeddings for each responsibility using batch processing.
        
        Args:
            responsibilities: List of responsibilities to embed
            
        Returns:
            Dictionary mapping each responsibility to its embedding vector
        """
        if not responsibilities:
            return {}
        
        logger.info(f"🚀 Generating embeddings for {len(responsibilities)} responsibilities")
        start_time = time.time()
        
        # Clean and prepare responsibilities
        clean_responsibilities = []
        responsibility_mapping = {}
        
        for i, responsibility in enumerate(responsibilities):
            if responsibility and responsibility.strip():
                clean_responsibility = self._prepare_text(responsibility)
                clean_responsibilities.append(clean_responsibility)
                responsibility_mapping[len(clean_responsibilities) - 1] = responsibility
        
        if not clean_responsibilities:
            return {}
        
        try:
            # Batch processing for performance
            embeddings = self.model.encode(clean_responsibilities, convert_to_tensor=False, batch_size=32)
            
            # Convert to numpy if needed
            if isinstance(embeddings, torch.Tensor):
                embeddings = embeddings.cpu().numpy()
            
            # Create result dictionary
            responsibility_embeddings = {}
            for i, embedding in enumerate(embeddings):
                if i in responsibility_mapping:
                    original_responsibility = responsibility_mapping[i]
                    responsibility_embeddings[original_responsibility] = embedding
                    # Cache individual embeddings
                    self._embedding_cache[clean_responsibilities[i]] = embedding
            
            processing_time = time.time() - start_time
            logger.info(f"✅ Generated {len(responsibility_embeddings)} responsibility embeddings in {processing_time:.3f}s "
                       f"(~{processing_time/len(responsibility_embeddings)*1000:.1f}ms per responsibility)")
            
            return responsibility_embeddings
            
        except Exception as e:
            logger.error(f"❌ Batch responsibility embedding failed: {str(e)}")
            # Fallback to individual processing
            return self._generate_individual_responsibility_embeddings(responsibilities)
    
    def calculate_cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two vectors.
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Cosine similarity score (0-1)
        """
        try:
            # Normalize vectors
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            # Calculate cosine similarity
            dot_product = np.dot(vec1, vec2)
            cosine_sim = dot_product / (norm1 * norm2)
            
            # Clamp between 0 and 1
            return max(0.0, min(1.0, float(cosine_sim)))
            
        except Exception as e:
            logger.error(f"❌ Similarity calculation failed: {str(e)}")
            return 0.0
    
    def calculate_similarity_matrix(self, embeddings1: Dict[str, np.ndarray], embeddings2: Dict[str, np.ndarray]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Calculate similarity matrix between two sets of embeddings.
        
        Args:
            embeddings1: First set of embeddings (e.g., JD skills)
            embeddings2: Second set of embeddings (e.g., CV skills)
            
        Returns:
            Dictionary mapping each item from set 1 to similarity scores with set 2
        """
        logger.info(f"🔍 Calculating similarity matrix: {len(embeddings1)} x {len(embeddings2)}")
        
        similarity_matrix = {}
        
        for key1, vec1 in embeddings1.items():
            similarities = []
            
            for key2, vec2 in embeddings2.items():
                similarity = self.calculate_cosine_similarity(vec1, vec2)
                similarities.append({
                    "item": key2,
                    "similarity": similarity
                })
            
            # Sort by similarity (highest first)
            similarities.sort(key=lambda x: x["similarity"], reverse=True)
            similarity_matrix[key1] = similarities
        
        logger.info(f"✅ Similarity matrix calculated")
        return similarity_matrix
    
    def get_match_quality(self, similarity: float, category: str) -> str:
        """
        Get match quality based on similarity score and category.
        
        Args:
            similarity: Cosine similarity score
            category: 'skills' or 'responsibilities'
            
        Returns:
            Quality level string
        """
        if category not in self.SIMILARITY_THRESHOLDS:
            category = "skills"  # Default fallback
        
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
    
    def _prepare_text(self, text: str) -> str:
        """Clean and prepare text for embedding."""
        # Remove excessive whitespace
        clean_text = " ".join(text.split())
        
        # Truncate if too long (model limit)
        max_length = 512
        if len(clean_text) > max_length:
            clean_text = clean_text[:max_length]
            logger.warning(f"Text truncated to {max_length} characters for embedding")
        
        return clean_text
    
    def _generate_individual_skill_embeddings(self, skills: List[str]) -> Dict[str, np.ndarray]:
        """Fallback method for individual skill embedding if batch processing fails."""
        logger.warning("Using individual skill embedding fallback")
        skill_embeddings = {}
        
        for skill in skills:
            if skill and skill.strip():
                try:
                    embedding = self.generate_single_embedding(skill)
                    skill_embeddings[skill] = embedding
                except Exception as e:
                    logger.error(f"❌ Failed to embed skill '{skill}': {str(e)}")
                    continue
        
        return skill_embeddings
    
    def _generate_individual_responsibility_embeddings(self, responsibilities: List[str]) -> Dict[str, np.ndarray]:
        """Fallback method for individual responsibility embedding if batch processing fails."""
        logger.warning("Using individual responsibility embedding fallback")
        responsibility_embeddings = {}
        
        for responsibility in responsibilities:
            if responsibility and responsibility.strip():
                try:
                    embedding = self.generate_single_embedding(responsibility)
                    responsibility_embeddings[responsibility] = embedding
                except Exception as e:
                    logger.error(f"❌ Failed to embed responsibility: {str(e)}")
                    continue
        
        return responsibility_embeddings
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings produced by this service."""
        if self.model:
            return self.model.get_sentence_embedding_dimension()
        else:
            return 768  # Default for all-mpnet-base-v2
    
    def health_check(self) -> Dict[str, Any]:
        """Check health of embedding service."""
        return {
            "service": "embedding_service",
            "model": self.model_name,
            "device": str(self.device),
            "embedding_dimension": self.get_embedding_dimension(),
            "cache_size": len(self._embedding_cache),
            "model_loaded": self.model is not None
        }
    
    def clear_cache(self) -> None:
        """Clear embedding cache."""
        self._embedding_cache.clear()
        logger.info("🧹 Embedding cache cleared")

# Global instance
_embedding_service: Optional[EmbeddingService] = None

def get_embedding_service() -> EmbeddingService:
    """Get global embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service