# qdrant_utils.py
import logging
import time
import uuid
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter
from qdrant_client.http.models import CollectionInfo

logger = logging.getLogger(__name__)

class QdrantUtils:
    """
    Utility class for all Qdrant database operations.
    Handles document storage, retrieval, and search operations.
    """
    
    def __init__(self, host: str = "qdrant", port: int = 6333):
        """Initialize Qdrant client with connection details."""
        self.host = host
        self.port = port
        self.client = QdrantClient(host=host, port=port)
        logger.info(f"🗄 Connected to Qdrant at {host}:{port}")
        
        # Initialize collections
        self._ensure_collections_exist()
    
    def _ensure_collections_exist(self):
        """Ensure all 6 required collections exist in Qdrant."""
        
        # Define EXACT 6 collections as specified
        collections_config = {
            # Document Storage (Full Documents)
            "cv_documents": {
                "description": "Store complete CV files and metadata",
                "config": VectorParams(size=768, distance=Distance.COSINE)
            },
            "jd_documents": {
                "description": "Store complete JD files and metadata", 
                "config": VectorParams(size=768, distance=Distance.COSINE)
            },
            
            # Structured Data Storage  
            "cv_structured": {
                "description": "Store standardized CV data",
                "config": VectorParams(size=768, distance=Distance.COSINE)
            },
            "jd_structured": {
                "description": "Store standardized JD data",
                "config": VectorParams(size=768, distance=Distance.COSINE)
            },
            
            # Vector Storage (Embeddings)
            "cv_embeddings": {
                "description": "Store CV vector embeddings (32 vectors per CV)",
                "config": VectorParams(size=768, distance=Distance.COSINE)
            },
            "jd_embeddings": {
                "description": "Store JD vector embeddings (32 vectors per JD)",
                "config": VectorParams(size=768, distance=Distance.COSINE)
            }
        }
        
        for collection_name, config in collections_config.items():
            if not self.client.collection_exists(collection_name):
                logger.info(f"📋 Creating collection: {collection_name} - {config['description']}")
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=config["config"]
                )
                logger.info(f"✅ Collection created: {collection_name}")
            else:
                logger.info(f"✅ Collection exists: {collection_name}")
    
    def _convert_embeddings_to_vector_format(self, embeddings: Dict[str, Any]) -> Dict[str, List[float]]:
        """Convert embeddings from dictionary format to list format for Qdrant."""
        result = {}
        
        for key, value in embeddings.items():
            if isinstance(value, dict):
                # This is a dictionary of skill/responsibility to embedding
                # We need to average all embeddings to create a single vector
                embedding_vectors = list(value.values())
                if embedding_vectors:
                    # Stack all embeddings and compute the mean
                    stacked = np.stack(embedding_vectors)
                    avg_embedding = np.mean(stacked, axis=0)
                    result[key] = avg_embedding.tolist()
                else:
                    result[key] = []
            elif isinstance(value, list) and all(isinstance(x, (int, float)) for x in value):
                # Already in the correct format
                result[key] = value
            else:
                # Handle other cases (like numpy arrays)
                try:
                    result[key] = value.tolist() if hasattr(value, 'tolist') else list(value)
                except:
                    result[key] = []
        
        return result
    
    def store_cv_embeddings(self, cv_id: str, embeddings: Dict[str, Any], cv_data: Dict[str, Any]) -> str:
        """
        Store CV embeddings and metadata in Qdrant.
        
        Args:
            cv_id: Unique identifier for the CV
            embeddings: Dictionary of embeddings for different aspects
            cv_data: CV metadata and structured data
            
        Returns:
            The CV ID if successful
        """
        try:
            logger.info(f"💾 Storing CV embeddings: {cv_id}")
            
            # Extract structured data
            structured_info = cv_data.get("structured_info", {})
            
            # Convert embeddings to the correct format
            converted_embeddings = self._convert_embeddings_to_vector_format(embeddings)
            
            # Prepare point with all metadata
            point = PointStruct(
                id=cv_id,
                vector=converted_embeddings,
                payload={
                    "id": cv_id,
                    "filename": cv_data.get("filename", ""),
                    "upload_date": datetime.utcnow().isoformat(),
                    "document_type": "cv",
                    "extracted_text": cv_data.get("extracted_text", ""),
                    # Store structured data at the top level for easy retrieval
                    "full_name": structured_info.get("full_name", "Not specified"),
                    "email": structured_info.get("email", "Not specified"),
                    "phone": structured_info.get("phone", "Not specified"),
                    "job_title": structured_info.get("job_title", "Not specified"),
                    "years_of_experience": structured_info.get("experience_years", "Not specified"),
                    "skills": structured_info.get("skills", []),
                    "responsibilities": structured_info.get("responsibilities", []),
                    # Store the full structured info as well
                    "structured_info": structured_info
                }
            )
            
            # Store in Qdrant
            self.client.upsert(
                collection_name="cv",
                points=[point]
            )
            
            logger.info(f"✅ CV embeddings stored successfully: {cv_id}")
            return cv_id
            
        except Exception as e:
            logger.error(f"❌ Failed to store CV embeddings: {str(e)}")
            raise Exception(f"Failed to store CV embeddings: {str(e)}")
    
    def store_jd_embeddings(self, jd_id: str, embeddings: Dict[str, Any], jd_data: Dict[str, Any]) -> str:
        """
        Store JD embeddings and metadata in Qdrant.
        
        Args:
            jd_id: Unique identifier for the job description
            embeddings: Dictionary of embeddings for different aspects
            jd_data: JD metadata and structured data
            
        Returns:
            The JD ID if successful
        """
        try:
            logger.info(f"💾 Storing JD embeddings: {jd_id}")
            
            # Extract structured data
            structured_info = jd_data.get("structured_info", {})
            
            # Convert embeddings to the correct format
            converted_embeddings = self._convert_embeddings_to_vector_format(embeddings)
            
            # Prepare point with all metadata
            point = PointStruct(
                id=jd_id,
                vector=converted_embeddings,
                payload={
                    "id": jd_id,
                    "filename": jd_data.get("filename", ""),
                    "upload_date": datetime.utcnow().isoformat(),
                    "document_type": "jd",
                    "extracted_text": jd_data.get("extracted_text", ""),
                    # Store structured data at the top level for easy retrieval
                    "job_title": structured_info.get("job_title", "Not specified"),
                    "years_of_experience": structured_info.get("experience_years", "Not specified"),
                    "skills": structured_info.get("skills", []),
                    "responsibilities": structured_info.get("responsibilities", []),
                    "responsibility_sentences": structured_info.get("responsibilities", []),
                    # Store the full structured info as well
                    "structured_info": structured_info
                }
            )
            
            # Store in Qdrant
            self.client.upsert(
                collection_name="jd",
                points=[point]
            )
            
            logger.info(f"✅ JD embeddings stored successfully: {jd_id}")
            return jd_id
            
        except Exception as e:
            logger.error(f"❌ Failed to store JD embeddings: {str(e)}")
            raise Exception(f"Failed to store JD embeddings: {str(e)}")
    
    def store_embeddings(self, doc_id: str, embeddings: Dict[str, Any], doc_type: str) -> bool:
        """
        Store embeddings for a document.
        
        Args:
            doc_id: Document ID
            embeddings: Dictionary of embeddings
            doc_type: "cv" or "jd"
            
        Returns:
            True if successful
        """
        try:
            if doc_type == "cv":
                cv_data = self.retrieve_document(doc_id, doc_type)
                if cv_data:
                    self.store_cv_embeddings(doc_id, embeddings, cv_data)
                    return True
            elif doc_type == "jd":
                jd_data = self.retrieve_document(doc_id, doc_type)
                if jd_data:
                    self.store_jd_embeddings(doc_id, embeddings, jd_data)
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Failed to store embeddings: {str(e)}")
            return False
    
    def retrieve_document(self, doc_id: str, doc_type: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve document metadata from Qdrant.
        
        Args:
            doc_id: Document ID to retrieve
            doc_type: "cv" or "jd"
            
        Returns:
            Document metadata or None if not found
        """
        try:
            logger.debug(f"🔍 Retrieving document: {doc_id} ({doc_type})")
            
            result = self.client.retrieve(
                collection_name=doc_type,
                ids=[doc_id]
            )
            
            if result and len(result) > 0:
                return result[0].payload
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to retrieve document: {str(e)}")
            return None
    
    def retrieve_embeddings(self, doc_id: str, doc_type: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve embeddings for a document.
        
        Args:
            doc_id: Document ID
            doc_type: "cv" or "jd"
            
        Returns:
            Dictionary of embeddings or None if not found
        """
        try:
            logger.debug(f"🔍 Retrieving embeddings: {doc_id} ({doc_type})")
            
            result = self.client.retrieve(
                collection_name=doc_type,
                ids=[doc_id],
                with_vectors=True
            )
            
            if result and len(result) > 0:
                return result[0].vector
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to retrieve embeddings: {str(e)}")
            return None
    
    def list_documents(self, doc_type: str) -> List[Dict[str, Any]]:
        """
        List all documents of a specific type.
        
        Args:
            doc_type: "cv" or "jd"
            
        Returns:
            List of document metadata
        """
        try:
            logger.info(f"📋 Listing {doc_type} documents")
            
            # Use scroll to get all documents
            all_points = []
            offset = None
            limit = 100  # Process in batches
            
            while True:
                result = self.client.scroll(
                    collection_name=doc_type,
                    limit=limit,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False
                )
                
                points, next_offset = result
                all_points.extend(points)
                
                if next_offset is None:
                    break
                    
                offset = next_offset
            
            # Extract payloads
            documents = [point.payload for point in all_points]
            
            logger.info(f"📋 Found {len(documents)} {doc_type} documents")
            return documents
            
        except Exception as e:
            logger.error(f"❌ Failed to list documents: {str(e)}")
            return []
    
    def delete_document(self, doc_id: str, doc_type: str) -> bool:
        """
        Delete a document from Qdrant.
        
        Args:
            doc_id: Document ID to delete
            doc_type: "cv" or "jd"
            
        Returns:
            True if successful
        """
        try:
            logger.info(f"🗑 Deleting document: {doc_id} ({doc_type})")
            
            self.client.delete(
                collection_name=doc_type,
                points_selector=[doc_id]
            )
            
            logger.info(f"✅ Document deleted successfully: {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete document: {str(e)}")
            return False
    
    def clear_all_data(self) -> bool:
        """
        Clear all data from all collections.
        
        Returns:
            True if successful
        """
        try:
            logger.warning("🧹 Clearing all data from database")
            
            collections = ["cv", "jd"]
            
            for collection_name in collections:
                if self.client.collection_exists(collection_name):
                    logger.info(f"🗑 Clearing collection: {collection_name}")
                    self.client.delete_collection(collection_name)
                    logger.info(f"✅ Collection cleared: {collection_name}")
                    
                    # Recreate the collection
                    self._ensure_collections_exist()
            
            logger.warning("⚠ All data cleared from database")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to clear database: {str(e)}")
            return False
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check the health of the Qdrant connection.
        
        Returns:
            Health status information
        """
        try:
            logger.debug("🏥 Checking Qdrant health")
            
            # Try to get collection info
            collections = self.client.get_collections()
            collection_names = [collection.name for collection in collections.collections]
            
            return {
                "status": "healthy",
                "collections": collection_names,
                "host": self.host,
                "port": self.port
            }
            
        except Exception as e:
            logger.error(f"❌ Qdrant health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "host": self.host,
                "port": self.port
            }
    
    def store_document(self, doc_id: str, doc_type: str, filename: str, file_format: str, raw_content: str, upload_date: str) -> bool:
        """
        Store document in appropriate collection (cv_documents/jd_documents).
        
        Args:
            doc_id: Document ID ("cv_123" or "jd_123")
            doc_type: "cv" or "jd"
            filename: Original filename
            file_format: File format (pdf, doc, docx, txt, image)
            raw_content: Full extracted text
            upload_date: Upload timestamp
        """
        try:
            collection_name = f"{doc_type}_documents"
            
            # Create a simple embedding of the raw content for indexing
            # This is just for storage/retrieval, not for matching
            import hashlib
            content_hash = hashlib.md5(raw_content.encode()).hexdigest()
            dummy_vector = [0.0] * 768  # Placeholder vector for storage
            
            document_data = {
                "id": doc_id,
                "filename": filename,
                "file_format": file_format,
                "raw_content": raw_content,
                "upload_date": upload_date,
                "content_hash": content_hash
            }
            
            self.client.upsert(
                collection_name=collection_name,
                points=[
                    PointStruct(
                        id=doc_id,
                        vector=dummy_vector,
                        payload=document_data
                    )
                ]
            )
            
            logger.info(f"✅ Document stored in {collection_name}: {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to store document {doc_id}: {str(e)}")
            return False
    
    def store_structured_data(self, doc_id: str, doc_type: str, structured_data: Dict[str, Any]) -> bool:
        """
        Store structured data in appropriate collection (cv_structured/jd_structured).
        
        Args:
            doc_id: Document ID ("cv_123" or "jd_123")
            doc_type: "cv" or "jd"
            structured_data: Standardized data from LLM
        """
        try:
            collection_name = f"{doc_type}_structured"
            
            # Create embedding of the structured data for indexing
            dummy_vector = [0.0] * 768  # Placeholder vector for storage
            
            self.client.upsert(
                collection_name=collection_name,
                points=[
                    PointStruct(
                        id=doc_id,
                        vector=dummy_vector,
                        payload={
                            "id": doc_id,
                            **structured_data
                        }
                    )
                ]
            )
            
            logger.info(f"✅ Structured data stored in {collection_name}: {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to store structured data {doc_id}: {str(e)}")
            return False
    
    def store_embeddings_exact(self, doc_id: str, doc_type: str, embeddings_data: Dict[str, Any]) -> bool:
        """
        Store EXACTLY 32 vectors per document in embeddings collection.
        
        Args:
            doc_id: Document ID (UUID)
            doc_type: "cv" or "jd"
            embeddings_data: Dict containing:
                - skill_vectors: [20 vectors - one per skill]
                - responsibility_vectors: [10 vectors - one per responsibility]  
                - experience_vector: [1 vector for experience]
                - job_title_vector: [1 vector for job title]
                Total: 32 vectors per document
        """
        try:
            import uuid
            collection_name = f"{doc_type}_embeddings"
            
            # Store each vector as a separate point with metadata
            points = []
            
            # Store 20 skill vectors
            for i, skill_vector in enumerate(embeddings_data.get("skill_vectors", [])[:20]):
                points.append(PointStruct(
                    id=str(uuid.uuid4()),  # Generate unique UUID for each vector
                    vector=skill_vector,
                    payload={
                        "document_id": doc_id,
                        "vector_type": "skill",
                        "vector_index": i,
                        "content": embeddings_data.get("skills", [])[i] if i < len(embeddings_data.get("skills", [])) else ""
                    }
                ))
            
            # Store 10 responsibility vectors
            for i, resp_vector in enumerate(embeddings_data.get("responsibility_vectors", [])[:10]):
                points.append(PointStruct(
                    id=str(uuid.uuid4()),  # Generate unique UUID for each vector
                    vector=resp_vector,
                    payload={
                        "document_id": doc_id,
                        "vector_type": "responsibility",
                        "vector_index": i,
                        "content": embeddings_data.get("responsibilities", [])[i] if i < len(embeddings_data.get("responsibilities", [])) else ""
                    }
                ))
            
            # Store 1 experience vector
            if embeddings_data.get("experience_vector"):
                points.append(PointStruct(
                    id=str(uuid.uuid4()),  # Generate unique UUID for each vector
                    vector=embeddings_data["experience_vector"][0],
                    payload={
                        "document_id": doc_id,
                        "vector_type": "experience",
                        "vector_index": 0,
                        "content": embeddings_data.get("experience_years", "")
                    }
                ))
            
            # Store 1 job title vector
            if embeddings_data.get("job_title_vector"):
                points.append(PointStruct(
                    id=str(uuid.uuid4()),  # Generate unique UUID for each vector
                    vector=embeddings_data["job_title_vector"][0],
                    payload={
                        "document_id": doc_id,
                        "vector_type": "job_title",
                        "vector_index": 0,
                        "content": embeddings_data.get("job_title", "")
                    }
                ))
            
            # Batch upsert all vectors
            if points:
                self.client.upsert(
                    collection_name=collection_name,
                    points=points
                )
                
                logger.info(f"✅ Stored {len(points)} embedding vectors in {collection_name}: {doc_id}")
                return True
            else:
                logger.warning(f"⚠️ No embedding vectors to store for {doc_id}")
                return False
            
        except Exception as e:
            logger.error(f"❌ Failed to store embeddings {doc_id}: {str(e)}")
            return False

    def get_structured_cv(self, cv_id: str) -> Optional[Dict[str, Any]]:
        """Get structured CV data by ID."""
        try:
            result = self.client.scroll(
                collection_name="cv_structured",
                scroll_filter=Filter(
                    must=[{"key": "document_id", "match": {"value": cv_id}}]
                ),
                limit=1,
                with_payload=True
            )
            
            if result[0]:
                point = result[0][0]
                structured_data = point.payload.get("structured_info", {})
                return {
                    "id": cv_id,
                    "name": structured_data.get("name", cv_id),
                    "job_title": structured_data.get("job_title"),
                    "years_of_experience": structured_data.get("years_of_experience", 0),
                    "skills_sentences": structured_data.get("skills", [])[:20],  # Limit to 20
                    "responsibility_sentences": structured_data.get("responsibilities", [])[:10]  # Limit to 10
                }
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to get structured CV {cv_id}: {str(e)}")
            return None

    def get_structured_jd(self, jd_id: str) -> Optional[Dict[str, Any]]:
        """Get structured JD data by ID."""
        try:
            result = self.client.scroll(
                collection_name="jd_structured",
                scroll_filter=Filter(
                    must=[{"key": "document_id", "match": {"value": jd_id}}]
                ),
                limit=1,
                with_payload=True
            )
            
            if result[0]:
                point = result[0][0]
                structured_data = point.payload.get("structured_info", {})
                return {
                    "id": jd_id,
                    "job_title": structured_data.get("job_title"),
                    "years_of_experience": structured_data.get("years_of_experience", 0),
                    "skills_sentences": structured_data.get("skills", [])[:20],  # Limit to 20
                    "responsibility_sentences": structured_data.get("responsibilities", [])[:10]  # Limit to 10
                }
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to get structured JD {jd_id}: {str(e)}")
            return None

    def list_all_cvs(self) -> List[Dict[str, str]]:
        """List all CVs with minimal metadata."""
        try:
            result = self.client.scroll(
                collection_name="cv_structured",
                limit=1000,  # Reasonable limit
                with_payload=True
            )
            
            cvs = []
            for point in result[0]:
                structured_data = point.payload.get("structured_info", {})
                cvs.append({
                    "id": point.payload.get("document_id", str(point.id)),
                    "name": structured_data.get("name", point.payload.get("document_id", str(point.id)))
                })
            
            return cvs
            
        except Exception as e:
            logger.error(f"❌ Failed to list CVs: {str(e)}")
            return []

# Global instance
_qdrant_utils: Optional[QdrantUtils] = None

def get_qdrant_utils() -> QdrantUtils:
    """Get global Qdrant utils instance."""
    global _qdrant_utils
    if _qdrant_utils is None:
        _qdrant_utils = QdrantUtils()
    return _qdrant_utils