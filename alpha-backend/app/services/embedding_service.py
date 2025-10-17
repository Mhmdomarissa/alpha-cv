# embedding_service.py
import logging
import time
import threading
from typing import List, Dict, Any, Optional
import numpy as np
import torch
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# Global shared model instance (Singleton pattern)
_shared_model = None
_model_lock = threading.Lock()
_model_device = None

class EmbeddingService:
    """
    Consolidated service for all embedding operations.
    Uses all-mpnet-base-v2 model (768 dimensions) for consistent, high-quality embeddings.
    """
    
    # Lowered similarity thresholds for better matching
    SIMILARITY_THRESHOLDS = {
        "skills": {
            "excellent": 0.80,
            "good": 0.70,
            "moderate": 0.60,
            "minimum": 0.50
        },
        "responsibilities": {
            "excellent": 0.75,
            "good": 0.65,
            "moderate": 0.55,
            "minimum": 0.45
        }
    }
    
    def __init__(self, model_name: str = "all-mpnet-base-v2"):
        """
        Initialize the embedding service with shared GPU model (Singleton pattern).
        All workers share a single model instance to reduce GPU memory usage.
        
        Args:
            model_name: Sentence transformer model to use
        """
        global _shared_model, _model_device
            
        self.model_name = model_name
        self._embedding_cache = {}  # Fallback in-memory cache
        
        # GPU/CPU device selection (once for all workers)
        if torch.cuda.is_available():
            self.device = "cuda"
        else:
            self.device = "cpu"
        
        # Initialize Redis cache
        try:
            from app.utils.redis_cache import get_redis_cache
            self.redis_cache = get_redis_cache()
            logger.info("✅ Redis cache initialized for embeddings")
        except Exception as e:
            logger.warning(f"⚠️ Redis cache not available: {e}")
            self.redis_cache = None
        
        # Use shared model instance (thread-safe initialization)
        self._initialize_shared_model()
        
        # Reference the shared model
        self.model = _shared_model
        
        # Verify model is properly loaded
        if self.model is None:
            raise Exception("❌ CRITICAL: Shared model failed to initialize!")
        
        logger.info(f"🔥 EmbeddingService initialized - Using shared model instance on {self.device}")
        logger.info(f"✅ Model verification: {type(self.model).__name__} loaded successfully")
    
    def _initialize_shared_model(self) -> None:
        """
        Initialize the shared model instance (thread-safe, singleton pattern).
        Only one model instance is created and shared across all workers.
        """
        global _shared_model, _model_lock, _model_device
        
        # Thread-safe initialization
        if _shared_model is None:
            with _model_lock:
                # Double-check after acquiring lock
                if _shared_model is None:
                    try:
                        logger.info(f"🚀 Initializing SHARED model instance: {self.model_name}")
                        
                        # Clear GPU cache before loading
                        if self.device == "cuda":
                            torch.cuda.empty_cache()
                            logger.info(f"🧹 GPU cache cleared before model load")
                        
                        # Load model with device specification
                        _shared_model = SentenceTransformer(self.model_name, device=self.device)
                        _model_device = self.device
                        
                        # Move model to GPU if available
                        if self.device == "cuda":
                            _shared_model = _shared_model.cuda()
                            
                            # Enable mixed precision for faster processing
                            if hasattr(torch.cuda, 'amp'):
                                _shared_model.half()
                                logger.info(f"⚡ Mixed precision (FP16) enabled for faster processing")
                            
                            logger.info(f"🚀 SHARED model loaded on GPU: {torch.cuda.get_device_name(0)}")
                            logger.info(f"📊 GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB total")
                            logger.info(f"📊 GPU Memory Used: {torch.cuda.memory_allocated() / 1024**3:.2f}GB")
                        else:
                            logger.info(f"💻 SHARED model loaded on CPU")
                        
                        logger.info(f"✅ SHARED model {self.model_name} initialized successfully on {self.device}")
                        logger.info(f"🎯 All workers will share this single model instance")
                        
                    except Exception as e:
                        logger.error(f"❌ Failed to initialize shared model: {str(e)}")
                        # Fallback to CPU if GPU fails
                        if self.device == "cuda":
                            logger.warning("⚠️ GPU initialization failed, falling back to CPU")
                            self.device = "cpu"
                            _model_device = "cpu"
                            try:
                                _shared_model = SentenceTransformer(self.model_name, device="cpu")
                                logger.info(f"💻 SHARED model {self.model_name} loaded on CPU (fallback)")
                            except Exception as cpu_e:
                                logger.error(f"❌ CPU fallback also failed: {str(cpu_e)}")
                                raise Exception(f"Both GPU and CPU model initialization failed: GPU={str(e)}, CPU={str(cpu_e)}")
                        else:
                            raise Exception(f"Shared model initialization failed: {str(e)}")
                else:
                    logger.info(f"✅ Using existing SHARED model instance on {_model_device}")
        else:
            logger.info(f"✅ Using existing SHARED model instance on {_model_device}")
    
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
        
        # Check Redis cache first
        if self.redis_cache:
            try:
                cached_embedding = self.redis_cache.get(f"embedding:{hash(clean_text)}", "embeddings")
                if cached_embedding is not None:
                    logger.debug("Using Redis cached embedding")
                    return np.array(cached_embedding, dtype=np.float32)
            except Exception as e:
                logger.warning(f"Redis cache read failed: {e}")
        
        # Check in-memory cache
        if clean_text in self._embedding_cache:
            logger.debug("Using in-memory cached embedding")
            return self._embedding_cache[clean_text]
        
        try:
            logger.debug(f"Generating embedding for: {clean_text[:50]}...")
            start_time = time.time()
            
            embedding = self.model.encode(clean_text, convert_to_tensor=False)
            
            # Convert to numpy if needed
            if isinstance(embedding, torch.Tensor):
                embedding = embedding.cpu().numpy()
            
            # Cache in Redis (1 hour TTL)
            if self.redis_cache:
                try:
                    self.redis_cache.set(f"embedding:{hash(clean_text)}", embedding.tolist(), 3600, "embeddings")
                except Exception as e:
                    logger.warning(f"Redis cache write failed: {e}")
            
            # Cache in memory as fallback
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
            # Batch processing for performance (larger batch size with shared model)
            embeddings = self.model.encode(clean_skills, convert_to_tensor=False, batch_size=64, show_progress_bar=False)
            
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
            embeddings = self.model.encode(clean_responsibilities, convert_to_tensor=False, batch_size=64, show_progress_bar=False)
            
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
        Uses GPU acceleration when available, falls back to CPU.
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Cosine similarity score (0-1)
        """
        try:
            # Try GPU acceleration first if available
            if self.device == "cuda" and torch.cuda.is_available():
                return self._calculate_cosine_similarity_gpu(vec1, vec2)
            else:
                return self._calculate_cosine_similarity_cpu(vec1, vec2)
                
        except Exception as e:
            logger.error(f"❌ Similarity calculation failed: {str(e)}")
            return 0.0
    
    def _calculate_cosine_similarity_cpu(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        CPU-based cosine similarity calculation (original implementation).
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
            logger.error(f"❌ CPU similarity calculation failed: {str(e)}")
            return 0.0
    
    def _calculate_cosine_similarity_gpu(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        GPU-accelerated cosine similarity calculation.
        """
        try:
            # Convert numpy arrays to PyTorch tensors on GPU
            tensor1 = torch.from_numpy(vec1).float().cuda()
            tensor2 = torch.from_numpy(vec2).float().cuda()
            
            # Calculate cosine similarity on GPU
            cosine_sim = torch.cosine_similarity(tensor1, tensor2, dim=0)
            
            # Convert back to float and clamp
            result = float(cosine_sim.cpu().item())
            return max(0.0, min(1.0, result))
            
        except Exception as e:
            logger.warning(f"⚠️ GPU similarity calculation failed, falling back to CPU: {str(e)}")
            return self._calculate_cosine_similarity_cpu(vec1, vec2)
    
    def calculate_batch_cosine_similarity_gpu(self, matrix_a: np.ndarray, matrix_b: np.ndarray) -> np.ndarray:
        """
        GPU-accelerated batch cosine similarity calculation with bulletproof safety.
        Calculates similarity between all pairs of vectors in two matrices.
        
        Args:
            matrix_a: First matrix of vectors (n_a x dim)
            matrix_b: Second matrix of vectors (n_b x dim)
            
        Returns:
            Similarity matrix (n_a x n_b)
        """
        try:
            # SAFETY CHECK 1: Size limits to prevent GPU memory overflow
            max_matrix_size = 50  # Limit to 50x50 to prevent GPU memory issues
            if matrix_a.shape[0] > max_matrix_size or matrix_b.shape[0] > max_matrix_size:
                logger.warning(f"⚠️ Matrix too large for GPU ({matrix_a.shape[0]}x{matrix_b.shape[1]}), using CPU")
                return self._calculate_batch_cosine_similarity_cpu(matrix_a, matrix_b)
            
            # SAFETY CHECK 2: GPU availability and memory
            if self.device != "cuda" or not torch.cuda.is_available():
                logger.debug("🖥️ Using CPU batch similarity calculation (GPU not available)")
                return self._calculate_batch_cosine_similarity_cpu(matrix_a, matrix_b)
            
            # SAFETY CHECK 3: GPU memory check
            try:
                gpu_memory_free = torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated()
                required_memory = matrix_a.nbytes + matrix_b.nbytes + (matrix_a.shape[0] * matrix_b.shape[0] * 4)  # Rough estimate
                if required_memory > gpu_memory_free * 0.8:  # Use only 80% of available memory
                    logger.warning(f"⚠️ Insufficient GPU memory ({required_memory} needed, {gpu_memory_free} available), using CPU")
                    return self._calculate_batch_cosine_similarity_cpu(matrix_a, matrix_b)
            except Exception as mem_e:
                logger.warning(f"⚠️ GPU memory check failed: {mem_e}, using CPU")
                return self._calculate_batch_cosine_similarity_cpu(matrix_a, matrix_b)
            
            # Log GPU batch processing
            logger.info(f"🚀 GPU batch similarity: {matrix_a.shape[0]}x{matrix_b.shape[0]} vectors")
            
            # SAFETY CHECK 4: Clear GPU cache before processing
            torch.cuda.empty_cache()
            
            # Convert to PyTorch tensors on GPU with error handling
            try:
                tensor_a = torch.from_numpy(matrix_a).float().cuda()
                tensor_b = torch.from_numpy(matrix_b).float().cuda()
            except Exception as tensor_e:
                logger.warning(f"⚠️ Failed to create GPU tensors: {tensor_e}, using CPU")
                return self._calculate_batch_cosine_similarity_cpu(matrix_a, matrix_b)
            
            # Normalize vectors with error handling
            try:
                tensor_a_norm = torch.nn.functional.normalize(tensor_a, p=2, dim=1)
                tensor_b_norm = torch.nn.functional.normalize(tensor_b, p=2, dim=1)
            except Exception as norm_e:
                logger.warning(f"⚠️ Failed to normalize tensors: {norm_e}, using CPU")
                return self._calculate_batch_cosine_similarity_cpu(matrix_a, matrix_b)
            
            # Calculate cosine similarity matrix on GPU with error handling
            try:
                similarity_matrix = torch.mm(tensor_a_norm, tensor_b_norm.t())
                similarity_matrix = torch.clamp(similarity_matrix, 0.0, 1.0)
            except Exception as calc_e:
                logger.warning(f"⚠️ Failed GPU calculation: {calc_e}, using CPU")
                return self._calculate_batch_cosine_similarity_cpu(matrix_a, matrix_b)
            
            # Convert back to numpy with error handling
            try:
                result = similarity_matrix.cpu().numpy()
                logger.info(f"✅ GPU batch similarity completed: {result.shape}")
                
                # SAFETY CHECK 5: Clear GPU cache after processing
                torch.cuda.empty_cache()
                
                return result
            except Exception as convert_e:
                logger.warning(f"⚠️ Failed to convert GPU result to numpy: {convert_e}, using CPU")
                return self._calculate_batch_cosine_similarity_cpu(matrix_a, matrix_b)
            
        except Exception as e:
            logger.warning(f"⚠️ GPU batch similarity calculation failed, falling back to CPU: {str(e)}")
            return self._calculate_batch_cosine_similarity_cpu(matrix_a, matrix_b)
    
    def _calculate_batch_cosine_similarity_cpu(self, matrix_a: np.ndarray, matrix_b: np.ndarray) -> np.ndarray:
        """
        CPU-based batch cosine similarity calculation (fallback).
        """
        try:
            # Normalize vectors
            norm_a = np.linalg.norm(matrix_a, axis=1, keepdims=True)
            norm_b = np.linalg.norm(matrix_b, axis=1, keepdims=True)
            
            # Avoid division by zero
            norm_a = np.where(norm_a == 0, 1, norm_a)
            norm_b = np.where(norm_b == 0, 1, norm_b)
            
            # Normalize matrices
            matrix_a_norm = matrix_a / norm_a
            matrix_b_norm = matrix_b / norm_b
            
            # Calculate cosine similarity matrix
            similarity_matrix = np.dot(matrix_a_norm, matrix_b_norm.T)
            
            # Clamp values between 0 and 1
            return np.clip(similarity_matrix, 0.0, 1.0)
            
        except Exception as e:
            logger.error(f"❌ CPU batch similarity calculation failed: {str(e)}")
            # Return zero matrix as fallback
            return np.zeros((matrix_a.shape[0], matrix_b.shape[0]))
    
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

def get_model() -> SentenceTransformer:
    """Get the loaded SentenceTransformer model for direct use."""
    service = get_embedding_service()
    return service.model