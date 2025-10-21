# app/utils/qdrant_utils.py
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import hashlib
import uuid
import gzip
import base64

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    MatchAny,
    FilterSelector,
)

logger = logging.getLogger(__name__)

def compress_content(content: str) -> str:
    """Compress content using gzip and encode as base64."""
    if not content:
        return ""
    compressed = gzip.compress(content.encode('utf-8'))
    return base64.b64encode(compressed).decode('ascii')

def decompress_content(compressed_content: str) -> str:
    """Decompress base64-encoded gzip content."""
    if not compressed_content:
        return ""
    try:
        compressed = base64.b64decode(compressed_content.encode('ascii'))
        return gzip.decompress(compressed).decode('utf-8')
    except Exception as e:
        logger.warning(f"Failed to decompress content: {e}")
        return compressed_content  # Return as-is if decompression fails

def get_decompressed_content(payload: Dict[str, Any]) -> str:
    """Get decompressed raw_content from document payload."""
    raw_content = payload.get("raw_content", "")
    if payload.get("raw_content_compressed", False):
        return decompress_content(raw_content)
    return raw_content

class QdrantUtils:
    """
    Qdrant utilities with a CONSISTENT 6-collection layout:

    - cv_documents / jd_documents       : raw text + file metadata (dummy single vector)
    - cv_structured / jd_structured     : standardized JSON (dummy single vector)
    - cv_embeddings / jd_embeddings     : EXACT 32 vectors per doc (20 skills, 10 resp, 1 title, 1 experience)
    """

    def __init__(self, host: str = "qdrant", port: int = 6333):
        self.host = host
        self.port = port
        # Environment-aware connection strategy
        import os
        self.environment = os.getenv("ENVIRONMENT", "development")
        
        # Use connection pool for production, direct client for development
        self._pool = None
        self._client = None
        self._use_pool = self.environment == "production"
        
        logger.info(f"🗄 QdrantUtils initialized for {host}:{port} (environment: {self.environment})")
    
    @property
    def client(self) -> QdrantClient:
        """Get client - optimized for both sync and async contexts"""
        if self._use_pool:
            # Production: Use connection pool with proper async handling
            if self._pool is None:
                try:
                    import asyncio
                    import threading
                    
                    # Check if we're in an async context
                    try:
                        loop = asyncio.get_running_loop()
                        # We're in an async context, use fallback client
                        logger.debug("🔄 Async context detected, using fallback client")
                        return self._get_fallback_client()
                    except RuntimeError:
                        # No event loop running, safe to use sync pool initialization
                        from app.utils.qdrant_pool import get_qdrant_pool
                        self._pool = asyncio.run(get_qdrant_pool())
                        logger.info("✅ Qdrant connection pool initialized")
                        
                except Exception as e:
                    logger.error(f"❌ Failed to get Qdrant pool: {e}, using fallback client")
                    return self._get_fallback_client()
            
            # Return client from pool (sync access)
            try:
                return self._pool.get_client()
            except Exception as e:
                logger.warning(f"⚠️ Pool client access failed: {e}, using fallback")
                return self._get_fallback_client()
        else:
            # Development: Use direct client
            if self._client is None:
                self._client = self._get_fallback_client()
            return self._client
    
    def _get_fallback_client(self) -> QdrantClient:
        """Get a direct Qdrant client as fallback"""
        try:
            return QdrantClient(host=self.host, port=self.port, timeout=10)
        except Exception as e:
            logger.error(f"❌ Failed to create Qdrant client: {e}")
            raise
    
    async def _get_pool(self):
        """Get connection pool for production"""
        from app.utils.qdrant_pool import get_qdrant_pool
        return await get_qdrant_pool()
    
    async def _get_client_async(self):
        """Get client from connection pool (async version)"""
        if self._use_pool:
            if self._pool is None:
                self._pool = await self._get_pool()
            return self._pool
        else:
            # Development: return direct client
            if self._client is None:
                self._client = QdrantClient(host=self.host, port=self.port)
                self._ensure_collections_exist()
            return self._client

    # ---------- collection management ----------

    def _ensure_collections_exist(self):
        collections = {
            "cv_documents":   VectorParams(size=768, distance=Distance.COSINE),
            "jd_documents":   VectorParams(size=768, distance=Distance.COSINE),
            "cv_structured":  VectorParams(size=768, distance=Distance.COSINE),
            "jd_structured":  VectorParams(size=768, distance=Distance.COSINE),
            "cv_embeddings":  VectorParams(size=768, distance=Distance.COSINE),
            "jd_embeddings":  VectorParams(size=768, distance=Distance.COSINE),
            # Keep only job_postings_structured for job posting management
            "job_postings_structured":  VectorParams(size=768, distance=Distance.COSINE),
        }
        for name, cfg in collections.items():
            if not self.client.collection_exists(name):
                logger.info(f"📋 Creating collection: {name}")
                self.client.create_collection(collection_name=name, vectors_config=cfg)
                logger.info(f"✅ Collection created: {name}")
            else:
                logger.info(f"✅ Collection exists: {name}")

    # ---------- basic health ----------

    def health_check(self) -> Dict[str, Any]:
        try:
            cols = self.client.get_collections()
            return {
                "status": "healthy",
                "collections": [c.name for c in cols.collections],
                "host": self.host,
                "port": self.port,
            }
        except Exception as e:
            logger.error(f"❌ Qdrant health check failed: {e}")
            return {"status": "unhealthy", "error": str(e), "host": self.host, "port": self.port}

    # ---------- document + structured storage ----------

    def store_document(
        self,
        doc_id: str,
        doc_type: str,
        filename: str,
        file_format: str,
        raw_content: str,
        upload_date: str,
        file_path: Optional[str] = None,   # 👈 NEW
        mime_type: Optional[str] = None,   # 👈 NEW
    ) -> bool:
        try:
            collection_name = f"{doc_type}_documents"
            dummy_vector = [0.0] * 768
            payload = {
                "id": doc_id,
                "filename": filename,
                "file_format": file_format,
                "raw_content": compress_content(raw_content),
                "raw_content_compressed": True,
                "upload_date": upload_date,
                "content_hash": hashlib.md5(raw_content.encode()).hexdigest(),
                "document_type": doc_type,
            }
            if file_path:
                payload["file_path"] = file_path      # 👈 persist where the file lives
            if mime_type:
                payload["mime_type"] = mime_type      # 👈 optional hint for serving

            self.client.upsert(
                collection_name=collection_name,
                points=[PointStruct(id=doc_id, vector=dummy_vector, payload=payload)],
            )
            logger.info(f"✅ Document stored: {doc_id} → {collection_name}")
            return True
        except Exception as e:
            logger.error(f"❌ store_document({doc_id}) failed: {e}")
            return False

    def store_structured_data(self, doc_id: str, doc_type: str, structured_data: Dict[str, Any]) -> bool:
        """
        Store standardized JSON into {doc_type}_structured with a dummy 768 vector.
        structured_data expected to include "structured_info".
        
        PRESERVES ALL FIELDS from structured_data including:
        - is_job_application, job_posting_id, applicant_email (for career applications)
        - cv_filename, application_id (for email-submitted CVs)
        - Any other metadata fields
        """
        try:
            collection_name = f"{doc_type}_structured"
            dummy_vector = [0.0] * 768
            
            # CRITICAL: Preserve ALL fields from structured_data
            # This ensures job application metadata is not lost
            payload = {
                **structured_data,  # Keep ALL existing fields
                "id": doc_id,  # Ensure ID is set
                "stored_at": datetime.utcnow().isoformat(),  # Update timestamp
            }
            
            # Ensure structured_info is properly nested
            if "structured_info" not in payload:
                payload["structured_info"] = structured_data
            
            self.client.upsert(
                collection_name=collection_name,
                points=[PointStruct(id=doc_id, vector=dummy_vector, payload=payload)],
            )
            
            # Log job application preservation
            if payload.get("is_job_application"):
                logger.info(f"✅ Structured stored: {doc_id} → {collection_name} (job_posting_id={payload.get('job_posting_id')})")
            else:
                logger.info(f"✅ Structured stored: {doc_id} → {collection_name}")
            
            return True
        except Exception as e:
            logger.error(f"❌ store_structured_data({doc_id}) failed: {e}")
            return False

    # ---------- EXACT 32 vectors storage (per doc) ----------

    def store_embeddings_exact(self, doc_id: str, doc_type: str, embeddings_data: Dict[str, Any]) -> bool:
        """
        OPTIMIZED: Store EXACTLY 32 vectors as SINGLE POINT in {doc_type}_embeddings.
        Expected keys in embeddings_data:
          - skill_vectors (20), responsibility_vectors (10), experience_vector (1), job_title_vector (1)
          - plus 'skills', 'responsibilities', 'experience_years', 'job_title' for payload context
        """
        try:
            collection_name = f"{doc_type}_embeddings"
            
            # Prepare the structured vector data
            vector_structure = {
                "skill_vectors": embeddings_data.get("skill_vectors", [])[:20],
                "responsibility_vectors": embeddings_data.get("responsibility_vectors", [])[:10],
                "experience_vector": embeddings_data.get("experience_vector", []),
                "job_title_vector": embeddings_data.get("job_title_vector", [])
            }
            
            # Create a dummy vector for the point (Qdrant requires a vector field)
            # We'll store the actual vectors in the payload
            dummy_vector = [0.0] * 768  # 768-dimensional zero vector
            
            # Create single point with all vectors in payload
            point = PointStruct(
                id=doc_id,  # Use doc_id as the point ID for direct access
                vector=dummy_vector,
                payload={
                    "vector_structure": vector_structure,
                    "metadata": {
                        "experience_years": embeddings_data.get("experience_years", ""),
                        "job_title": embeddings_data.get("job_title", ""),
                        "vector_count": 32,
                        "storage_version": "optimized_v2"
                    }
                }
            )

            self.client.upsert(collection_name=collection_name, points=[point])
            logger.info(f"✅ OPTIMIZED: Stored 32 vectors as single point for {doc_id} → {collection_name}")
            return True
        except Exception as e:
            logger.error(f"❌ store_embeddings_exact({doc_id}) failed: {e}")
            return False

    # ---------- retrieval helpers ----------

    def retrieve_document(self, doc_id: str, doc_type: str) -> Optional[Dict[str, Any]]:
        """
        Merge *_documents and *_structured (if exists) into one payload.
        """
        try:
            # base document
            doc = self.client.retrieve(collection_name=f"{doc_type}_documents", ids=[doc_id])
            payload = doc[0].payload if doc else {}

            # structured (optional)
            st = self.client.retrieve(collection_name=f"{doc_type}_structured", ids=[doc_id])
            if st:
                payload = payload or {}
                payload["structured_info"] = st[0].payload.get("structured_info", {})

            return payload or None
        except Exception as e:
            logger.error(f"❌ retrieve_document({doc_id}) failed: {e}")
            return None

    def retrieve_embeddings(self, doc_id: str, doc_type: str) -> Optional[Dict[str, Any]]:
        """
        OPTIMIZED: Read the EXACT-32 vectors back from {doc_type}_embeddings and return a dict:
          { "skill_vectors": [...], "responsibility_vectors": [...], "experience_vector": [...], "job_title_vector": [...] }
        """
        try:
            # Try optimized single-point retrieval first
            try:
                point = self.client.retrieve(
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
            points, _ = self.client.scroll(
                collection_name=f"{doc_type}_embeddings",
                scroll_filter=Filter(
                    must=[FieldCondition(key="id", match=MatchValue(value=doc_id))]
                ),
                limit=50,
                with_payload=True,
                with_vectors=True,
            )
            if not points:
                return None

            out = {
                "skill_vectors": [],
                "responsibility_vectors": [],
                "experience_vector": [],
                "job_title_vector": [],
            }

            for p in points:
                vt = p.payload.get("vector_type")
                vi = int(p.payload.get("vector_index", 0))
                if vt == "skill":
                    while len(out["skill_vectors"]) <= vi:
                        out["skill_vectors"].append(None)
                    out["skill_vectors"][vi] = p.vector
                elif vt == "responsibility":
                    while len(out["responsibility_vectors"]) <= vi:
                        out["responsibility_vectors"].append(None)
                    out["responsibility_vectors"][vi] = p.vector
                elif vt == "experience":
                    out["experience_vector"] = [p.vector]
                elif vt == "job_title":
                    out["job_title_vector"] = [p.vector]

            out["skill_vectors"] = [v for v in out["skill_vectors"] if v is not None][:20]
            out["responsibility_vectors"] = [v for v in out["responsibility_vectors"] if v is not None][:10]
            return out
        except Exception as e:
            logger.error(f"❌ retrieve_embeddings({doc_id}) failed: {e}")
            return None

    def list_documents(self, doc_type: str) -> List[Dict[str, Any]]:
        """
        List payloads in {doc_type}_documents.
        """
        try:
            all_pts: List[Any] = []
            offset = None
            while True:
                pts, offset = self.client.scroll(
                    collection_name=f"{doc_type}_documents",
                    limit=100,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False,
                )
                all_pts.extend(pts)
                if offset is None:
                    break
            return [p.payload for p in all_pts]
        except Exception as e:
            logger.error(f"❌ list_documents({doc_type}) failed: {e}")
            return []

    def delete_document(self, doc_id: str, doc_type: str) -> bool:
        """
        Delete from *_documents, *_structured, and *_embeddings.
        OPTIMIZED: Handles both single-point and legacy multi-point storage.
        """
        try:
            self.client.delete(collection_name=f"{doc_type}_documents", points_selector=[doc_id])
            self.client.delete(collection_name=f"{doc_type}_structured", points_selector=[doc_id])

            # Try optimized single-point deletion first
            try:
                self.client.delete(collection_name=f"{doc_type}_embeddings", points_selector=[doc_id])
                logger.info(f"✅ OPTIMIZED: Deleted single point {doc_id} from {doc_type}_embeddings")
            except Exception as e:
                logger.debug(f"Single-point deletion failed, trying legacy method: {e}")
                # Fallback to legacy multi-point deletion
                self.client.delete(
                    collection_name=f"{doc_type}_embeddings",
                    points_selector=FilterSelector(
                        filter=Filter(must=[FieldCondition(key="id", match=MatchValue(value=doc_id))])
                    ),
                )
                logger.info(f"✅ LEGACY: Deleted multiple points for {doc_id} from {doc_type}_embeddings")
            
            logger.info(f"✅ Deleted {doc_id} from all {doc_type} collections")
            return True
        except Exception as e:
            logger.error(f"❌ delete_document({doc_id}) failed: {e}")
            return False

    def clear_all_data(self) -> bool:
        """
        Drop and recreate the 6 collections.
        """
        try:
            logger.warning("🧹 Clearing ALL Qdrant data (all 6 collections)")
            for name in ["cv_documents", "jd_documents", "cv_structured", "jd_structured", "cv_embeddings", "jd_embeddings"]:
                if self.client.collection_exists(name):
                    self.client.delete_collection(name)
                    logger.info(f"🗑 Dropped: {name}")
            self._ensure_collections_exist()
            logger.warning("⚠ All collections cleared and recreated")
            return True
        except Exception as e:
            logger.error(f"❌ clear_all_data failed: {e}")
            return False

    # ---------- convenience helpers used by matching ----------

    def list_all_cvs(self) -> List[Dict[str, str]]:
        """
        Minimal list of CV ids + names taken from *_structured when available.
        """
        try:
            pts, _ = self.client.scroll(
                collection_name="cv_structured",
                limit=1000,
                with_payload=True,
                with_vectors=False,
            )
            out = []
            for p in pts:
                si = p.payload.get("structured_info", {})
                out.append({
                    "id": str(p.id),
                    "name": si.get("full_name", si.get("name", str(p.id))),
                    "category": si.get("category", "General"),
                })
            if out:
                return out

            # Fallback to documents if structured is empty
            docs = self.list_documents("cv")
            return [{"id": d.get("id", ""), "name": d.get("filename", d.get("id", "")), "category": "General"} for d in docs]
        except Exception as e:
            logger.error(f"❌ list_all_cvs failed: {e}")
            return []

    def list_cvs_by_category(self, category: str) -> List[Dict[str, Any]]:
        """
        List CVs filtered by category with full details.
        """
        try:
            # Get structured CVs filtered by category
            pts, _ = self.client.scroll(
                collection_name="cv_structured",
                scroll_filter=Filter(
                    must=[FieldCondition(key="structured_info.category", match=MatchValue(value=category))]
                ),
                limit=1000,
                with_payload=True,
                with_vectors=False,
            )
            
            # Get document metadata for all CVs
            doc_ids = [str(p.id) for p in pts]
            docs_map = {}
            if doc_ids:
                docs_pts, _ = self.client.scroll(
                    collection_name="cv_documents",
                    scroll_filter=Filter(
                        must=[FieldCondition(key="id", match=MatchAny(any=doc_ids))]
                    ),
                    limit=1000,
                    with_payload=True,
                    with_vectors=False,
                )
                docs_map = {str(p.id): p.payload for p in docs_pts}
            
            # Build enhanced CV list with full details
            enhanced = []
            for p in pts:
                doc_id = str(p.id)
                payload = p.payload
                structured = payload.get("structured_info", {})
                doc_meta = docs_map.get(doc_id, {})

                skills = structured.get("skills_sentences", structured.get("skills", []))
                resps = structured.get("responsibility_sentences", structured.get("responsibilities", []))

                # Clean up filename - extract just the filename from path
                filename = doc_meta.get("filename", "Unknown")
                if filename and "/" in filename:
                    filename = filename.split("/")[-1]  # Get just the filename, not the full path

                enhanced.append({
                    "id": doc_id,
                    "filename": filename,
                    "upload_date": doc_meta.get("upload_date", "Unknown"),
                    "full_name": structured.get("contact_info", {}).get("name") or structured.get("full_name", "Not specified"),
                    "job_title": structured.get("job_title", "Not specified"),
                    "years_of_experience": structured.get("years_of_experience", structured.get("experience_years", "Not specified")),
                    "skills_count": len(skills),
                    "responsibilities_count": len(resps),
                    "has_structured_data": True,
                    "category": structured.get("category", "General")
                })

            enhanced.sort(key=lambda x: x.get("upload_date", ""), reverse=True)
            return enhanced
            
        except Exception as e:
            logger.error(f"❌ list_cvs_by_category({category}) failed: {e}")
            return []

    def get_categories_with_counts(self) -> Dict[str, int]:
        """
        Get all categories with their CV counts.
        """
        try:
            pts, _ = self.client.scroll(
                collection_name="cv_structured",
                limit=1000,
                with_payload=True,
                with_vectors=False,
            )
            categories = {}
            for p in pts:
                si = p.payload.get("structured_info", {})
                category = si.get("category", "General")
                categories[category] = categories.get(category, 0) + 1
            return categories
        except Exception as e:
            logger.error(f"❌ get_categories_with_counts failed: {e}")
            return {}

    def get_structured_cv(self, cv_id: str) -> Optional[Dict[str, Any]]:
        """
        Return a normalized structured CV for matching.
        """
        try:
            doc = self.retrieve_document(cv_id, "cv")
            if not doc:
                return None
            s = doc.get("structured_info", {})
            return {
                "id": cv_id,
                "name": s.get("full_name", s.get("name", cv_id)),
                "job_title": s.get("job_title", ""),
                "years_of_experience": s.get("years_of_experience", s.get("experience_years", 0)),
                "category": s.get("category", ""),
                "skills_sentences": (s.get("skills_sentences", []) or s.get("skills", []) or [])[:20],
                "responsibility_sentences": (s.get("responsibilities", []) or s.get("responsibility_sentences", []) or [])[:10],
            }
        except Exception as e:
            logger.error(f"❌ get_structured_cv({cv_id}) failed: {e}")
            return None

    def get_structured_jd(self, jd_id: str) -> Optional[Dict[str, Any]]:
        """
        Return a normalized structured JD for matching.
        PRESERVES ORIGINAL STRUCTURE FOR MATCHING COMPATIBILITY.
        """
        try:
            # Try to get from jd_structured directly first
            st = self.client.retrieve(collection_name="jd_structured", ids=[jd_id])
            if st and st[0].payload:
                s = st[0].payload.get("structured_info", st[0].payload)
                return {
                    "id": jd_id,
                    "job_title": s.get("job_title", ""),
                    "years_of_experience": s.get("years_of_experience", s.get("experience_years", 0)),
                    "category": s.get("category", ""),
                    "skills_sentences": (s.get("skills_sentences", []) or s.get("skills", []) or [])[:20],  # Matching system expects this field name
                    "responsibility_sentences": (s.get("responsibilities", []) or s.get("responsibility_sentences", []) or [])[:10],  # Matching system expects this field name
                    "structured_info": s,  # Keep original structure
                }
            
            # Fallback to retrieve_document method
            doc = self.retrieve_document(jd_id, "jd")
            if not doc:
                return None
            s = doc.get("structured_info", doc)
            return {
                "id": jd_id,
                "job_title": s.get("job_title", ""),
                "years_of_experience": s.get("years_of_experience", s.get("experience_years", 0)),
                "category": s.get("category", ""),
                "skills_sentences": (s.get("skills_sentences", []) or s.get("skills", []) or [])[:20],  # Matching system expects this field name
                "responsibility_sentences": (s.get("responsibilities", []) or s.get("responsibility_sentences", []) or [])[:10],  # Matching system expects this field name
                "structured_info": s,  # Keep original structure
            }
        except Exception as e:
            logger.error(f"❌ get_structured_jd({jd_id}) failed: {e}")
            return None

    def get_structured_jd_for_careers(self, jd_id: str) -> Optional[Dict[str, Any]]:
        """
        Return structured JD data specifically for careers/public job display.
        Includes additional fields like job_summary and location.
        """
        try:
            # Try to get from jd_structured directly first
            st = self.client.retrieve(collection_name="jd_structured", ids=[jd_id])
            if st and st[0].payload:
                s = st[0].payload.get("structured_info", st[0].payload)
                return {
                    "id": jd_id,
                    "job_title": s.get("job_title", ""),
                    "years_of_experience": s.get("years_of_experience", s.get("experience_years", 0)),
                    "category": s.get("category", ""),
                    "skills_sentences": (s.get("skills_sentences", []) or s.get("skills", []) or [])[:20],
                    "responsibility_sentences": (s.get("responsibilities", []) or s.get("responsibility_sentences", []) or [])[:10],
                    "job_summary": s.get("job_summary", "") or s.get("summary", ""),
                    "location": s.get("location", "") or s.get("job_location", ""),
                }
            
            # Fallback to retrieve_document method
            doc = self.retrieve_document(jd_id, "jd")
            if not doc:
                return None
            s = doc.get("structured_info", doc)
            return {
                "id": jd_id,
                "job_title": s.get("job_title", ""),
                "years_of_experience": s.get("years_of_experience", s.get("experience_years", 0)),
                "category": s.get("category", ""),
                "skills_sentences": (s.get("skills_sentences", []) or s.get("skills", []) or [])[:20],
                "responsibility_sentences": (s.get("responsibilities", []) or s.get("responsibility_sentences", []) or [])[:10],
                "job_summary": s.get("job_summary", "") or s.get("summary", ""),
                "location": s.get("location", "") or s.get("job_location", ""),
            }
        except Exception as e:
            logger.error(f"❌ get_structured_jd_for_careers({jd_id}) failed: {e}")
            return None

    # ---------- careers functionality methods ----------

    def store_job_posting_metadata(
        self, 
        job_id: str, 
        public_token: str,
        company_name: Optional[str] = None,
        additional_info: Optional[str] = None,
        posted_by_user: Optional[str] = None,
        posted_by_role: Optional[str] = None,
        jd_id: Optional[str] = None,
        email_subject_id: Optional[str] = None,
        email_subject_template: Optional[str] = None
    ) -> bool:
        """
        Store job posting metadata in job_postings_structured collection
        This links to the actual JD data stored in jd_* collections
        """
        try:
            collection_name = "job_postings_structured"
            dummy_vector = [0.0] * 768
            payload = {
                "id": job_id,
                "public_token": public_token,
                "company_name": company_name,
                "additional_info": additional_info,
                "posted_by_user": posted_by_user,
                "posted_by_role": posted_by_role,
                "jd_id": jd_id,  # Link to the original JD
                "is_active": True,
                "created_date": datetime.utcnow().isoformat(),
                "document_type": "job_posting_metadata",
                # Email integration fields
                "email_subject_id": email_subject_id,
                "email_subject_template": email_subject_template
            }
            
            point = PointStruct(id=job_id, vector=dummy_vector, payload=payload)
            self.client.upsert(collection_name=collection_name, points=[point])
            logger.info(f"✅ Stored job posting metadata: {job_id} with token: {public_token[:8]}...")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to store job posting metadata {job_id}: {e}")
            return False

    def store_job_posting_ui_data(
        self, 
        job_id: str, 
        jd_id: str, 
        public_token: str, 
        ui_data: Dict[str, Any],
        posted_by_user: Optional[str] = None,
        posted_by_role: Optional[str] = None,
        email_subject_id: Optional[str] = None,
        email_subject_template: Optional[str] = None
    ) -> bool:
        """
        Store UI-specific job posting data (separate from matching embeddings).
        This data is used for candidate-facing job display only.
        """
        try:
            collection_name = "job_postings_structured"
            dummy_vector = [0.0] * 768  # Not used for matching
            
            payload = {
                "id": job_id,
                "jd_id": jd_id,  # Link to original JD for applications
                "public_token": public_token,
                "created_date": datetime.utcnow().isoformat(),
                "is_active": True,
                "data_type": "ui_display",  # Mark as UI data
                "posted_by_user": posted_by_user,
                "posted_by_role": posted_by_role,
                "email_subject_id": email_subject_id,
                "email_subject_template": email_subject_template,
                
                # UI-specific structured info
                "structured_info": {
                    "job_title": ui_data.get("job_title", ""),
                    "job_location": ui_data.get("job_location", ""),
                    "job_summary": ui_data.get("job_summary", ""),
                    "key_responsibilities": ui_data.get("key_responsibilities", ""),
                    "qualifications": ui_data.get("qualifications", "")
                }
            }
            
            point = PointStruct(
                id=job_id,
                vector=dummy_vector,
                payload=payload
            )
            
            operation_result = self.client.upsert(
                collection_name=collection_name,
                points=[point]
            )
            
            logger.info(f"✅ UI data stored for job {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to store UI data: {e}")
            return False

    def get_job_posting_by_token(self, public_token: str, include_inactive: bool = False) -> Optional[Dict]:
        """
        Retrieve job posting metadata using public token for anonymous access
        Returns None if job not found or (if include_inactive is False) inactive
        """
        try:
            collection_name = "job_postings_structured"
            
            # Search by public_token
            filter_conditions = [
                FieldCondition(
                    key="public_token",
                    match=MatchValue(value=public_token)
                )
            ]
            
            # Only add active filter if we're not including inactive jobs
            if not include_inactive:
                filter_conditions.append(
                    FieldCondition(
                        key="is_active", 
                        match=MatchValue(value=True)
                    )
                )
            
            filter_condition = Filter(must=filter_conditions)
            
            results = self.client.scroll(
                collection_name=collection_name,
                scroll_filter=filter_condition,
                limit=1,
                with_payload=True,
                with_vectors=False
            )
            
            logger.info(f"🔍 Token search for {public_token[:8]}... found {len(results[0]) if results[0] else 0} results")
            
            if results[0]:  # results is (points, next_page_offset)
                point = results[0][0]
                job_metadata = point.payload
                job_id = job_metadata["id"]
                
                # Get the actual JD data from jd_structured collection (using careers-specific method)
                # Use jd_id from metadata to look up the original JD data
                jd_id = job_metadata.get("jd_id", job_id)  # Fallback to job_id for backward compatibility
                jd_data = self.get_structured_jd_for_careers(jd_id)
                if jd_data:
                    # Merge JD data with metadata (metadata takes precedence for careers fields)
                    # Remove 'id' from jd_data to avoid conflicts with job_metadata
                    jd_data_clean = {k: v for k, v in jd_data.items() if k != 'id'}
                    job_data = {**jd_data_clean, **job_metadata}
                    
                    # If job_metadata has structured_info (updated data), use it to override jd_data
                    if 'structured_info' in job_metadata and job_metadata['structured_info']:
                        structured_info = job_metadata['structured_info']
                        # Override with updated structured data
                        if 'job_title' in structured_info:
                            job_data['job_title'] = structured_info['job_title']
                        if 'location' in structured_info or 'job_location' in structured_info:
                            job_data['location'] = structured_info.get('location', structured_info.get('job_location', ''))
                            job_data['job_location'] = structured_info.get('job_location', structured_info.get('location', ''))
                        if 'job_summary' in structured_info or 'summary' in structured_info:
                            job_data['job_summary'] = structured_info.get('job_summary', structured_info.get('summary', ''))
                            job_data['summary'] = structured_info.get('summary', structured_info.get('job_summary', ''))
                        # Handle responsibilities - support both string and array formats
                        if 'key_responsibilities' in structured_info:
                            # String format from UI extraction
                            job_data['responsibilities'] = structured_info['key_responsibilities'].split('\n')
                            job_data['responsibility_sentences'] = structured_info['key_responsibilities'].split('\n')
                        elif 'responsibilities' in structured_info:
                            # Array format from matching pipeline
                            job_data['responsibility_sentences'] = structured_info['responsibilities']
                            job_data['responsibilities'] = structured_info['responsibilities']
                        
                        # Handle qualifications/skills - support both string and array formats
                        if 'qualifications' in structured_info:
                            # String format from UI extraction
                            job_data['requirements'] = structured_info['qualifications'].split('\n')
                            job_data['skills_sentences'] = structured_info['qualifications'].split('\n')
                        elif 'skills' in structured_info:
                            # Array format from matching pipeline
                            job_data['skills_sentences'] = structured_info['skills']
                            job_data['skills'] = structured_info['skills']
                    
                    logger.info(f"✅ Found job posting for token: {public_token[:8]}...")
                    return job_data
                else:
                    logger.warning(f"❌ JD data not found for job_id: {job_id}")
                    return None
            else:
                logger.warning(f"❌ No job posting found for token: {public_token[:8]}... trying fallback search")
                
                # Fallback: Search all job postings and check public_token in metadata
                try:
                    all_results = self.client.scroll(
                        collection_name=collection_name,
                        limit=100,  # Get up to 100 job postings
                        with_payload=True,
                        with_vectors=False
                    )
                    
                    if all_results[0]:
                        for point in all_results[0]:
                            job_metadata = point.payload
                            if job_metadata.get("public_token") == public_token:
                                logger.info(f"✅ Found job via fallback search for token: {public_token[:8]}...")
                                job_id = job_metadata["id"]
                                
                                # Get the actual JD data
                                jd_data = self.get_structured_jd_for_careers(job_id)
                                if jd_data:
                                    jd_data_clean = {k: v for k, v in jd_data.items() if k != 'id'}
                                    job_data = {**jd_data_clean, **job_metadata}
                                    
                                    if 'structured_info' in job_metadata and job_metadata['structured_info']:
                                        if isinstance(job_metadata['structured_info'], dict):
                                            structured_info = job_metadata['structured_info']
                                            # Handle string format from UI extraction
                                            if 'key_responsibilities' in structured_info:
                                                job_data['responsibilities'] = structured_info['key_responsibilities'].split('\n')
                                                job_data['responsibility_sentences'] = structured_info['key_responsibilities'].split('\n')
                                            if 'qualifications' in structured_info:
                                                job_data['requirements'] = structured_info['qualifications'].split('\n')
                                                job_data['skills_sentences'] = structured_info['qualifications'].split('\n')
                                            # Update other fields
                                            job_data.update(structured_info)
                                    
                                    return job_data
                                else:
                                    return job_metadata
                    
                    logger.warning(f"❌ Fallback search also failed for token: {public_token[:8]}...")
                except Exception as fallback_error:
                    logger.error(f"❌ Fallback search error: {fallback_error}")
                
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to get job posting by token: {e}")
            return None

    def get_job_posting_by_id(self, job_id: str) -> Optional[Dict]:
        """
        Retrieve job posting by job_id (for admin/HR functions)
        """
        try:
            collection_name = "job_postings_structured"
            
            results = self.client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[FieldCondition(key="id", match=MatchValue(value=job_id))]
                ),
                limit=1,
                with_payload=True,
                with_vectors=False
            )
            
            if results[0]:
                job_metadata = results[0][0].payload
                # Get the actual JD data from jd_structured collection (using careers-specific method)
                jd_data = self.get_structured_jd_for_careers(job_id)
                if jd_data:
                    # Merge JD data with metadata (metadata takes precedence for careers fields)
                    # Remove 'id' from jd_data to avoid conflicts with job_metadata
                    jd_data_clean = {k: v for k, v in jd_data.items() if k != 'id'}
                    job_data = {**jd_data_clean, **job_metadata}
                    return job_data
                else:
                    return job_metadata
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to get job posting {job_id}: {e}")
            return None

    def update_job_posting_public_token(self, job_id: str, public_token: str) -> bool:
        """
        Update the public_token for an existing job posting
        """
        try:
            collection_name = "job_postings_structured"
            logger.info(f"🔧 Updating public_token for job {job_id} to {public_token[:8]}...")
            
            # Get current job metadata
            results = self.client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[FieldCondition(key="id", match=MatchValue(value=job_id))]
                ),
                limit=1,
                with_payload=True,
                with_vectors=True  # We need the vector to update the point
            )
            
            logger.info(f"🔍 Search results for job {job_id}: {len(results[0]) if results[0] else 0} found")
            
            if not results[0]:
                logger.error(f"❌ Job {job_id} not found for public_token update")
                return False
            
            # Update the payload with new public_token
            current_payload = results[0][0].payload
            logger.info(f"🔍 Current payload keys: {list(current_payload.keys())}")
            current_payload["public_token"] = public_token
            
            # Get the vector, use dummy vector if None
            vector = results[0][0].vector
            if vector is None:
                logger.warning(f"⚠️ Vector is None for job {job_id}, using dummy vector")
                vector = [0.0] * 768  # Use dummy vector
            
            # Update the point
            point = PointStruct(id=job_id, vector=vector, payload=current_payload)
            self.client.upsert(collection_name=collection_name, points=[point])
            
            logger.info(f"✅ Updated public_token for job {job_id}: {public_token[:8]}...")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to update public_token for job {job_id}: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return False

    def update_job_posting_status(self, job_id: str, is_active: bool) -> bool:
        """
        Activate or deactivate a job posting
        """
        try:
            collection_name = "job_postings_structured"
            
            # First get the current point
            current_point = self.client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[FieldCondition(key="id", match=MatchValue(value=job_id))]
                ),
                limit=1,
                with_payload=True,
                with_vectors=True
            )[0]
            
            if not current_point:
                logger.error(f"❌ Job posting {job_id} not found for status update")
                return False
                
            point = current_point[0]
            payload = point.payload.copy()
            payload["is_active"] = is_active
            payload["status_updated"] = datetime.utcnow().isoformat()
            
            # Update the point
            updated_point = PointStruct(id=job_id, vector=point.vector, payload=payload)
            self.client.upsert(collection_name=collection_name, points=[updated_point])
            
            logger.info(f"✅ Updated job posting {job_id} status to: {is_active}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to update job posting status {job_id}: {e}")
            return False

    def update_job_posting(self, job_id: str, company_name: Optional[str] = None, 
                          additional_info: Optional[str] = None, is_active: Optional[bool] = None) -> bool:
        """
        Update job posting metadata (company_name, additional_info, status)
        """
        try:
            collection_name = "job_postings_structured"
            
            # First get the current point
            current_point = self.client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[FieldCondition(key="id", match=MatchValue(value=job_id))]
                ),
                limit=1,
                with_payload=True,
                with_vectors=True
            )[0]
            
            if not current_point:
                logger.error(f"❌ Job posting {job_id} not found for update")
                return False
                
            point = current_point[0]
            payload = point.payload.copy()
            
            # Update fields if provided
            if company_name is not None:
                payload["company_name"] = company_name
            if additional_info is not None:
                payload["additional_info"] = additional_info
            if is_active is not None:
                payload["is_active"] = is_active
                
            payload["updated_date"] = datetime.utcnow().isoformat()
            
            # Update the point
            updated_point = PointStruct(id=job_id, vector=point.vector, payload=payload)
            self.client.upsert(collection_name=collection_name, points=[updated_point])
            
            logger.info(f"✅ Updated job posting {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to update job posting {job_id}: {e}")
            return False

    def update_job_posting_structured_data(self, job_id: str, structured_data: Dict[str, Any]) -> bool:
        """
        Update job posting structured data while preserving metadata fields like public_token
        """
        try:
            collection_name = "job_postings_structured"
            
            # First get the current point
            current_point = self.client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[FieldCondition(key="id", match=MatchValue(value=job_id))]
                ),
                limit=1,
                with_payload=True,
                with_vectors=True
            )[0]
            
            if not current_point:
                logger.error(f"❌ Job posting {job_id} not found for structured data update")
                return False
                
            point = current_point[0]
            payload = point.payload.copy()
            
            # Update structured data fields while preserving metadata
            for key, value in structured_data.items():
                payload[key] = value
                
            payload["updated_date"] = datetime.utcnow().isoformat()
            
            # Update the point
            updated_point = PointStruct(id=job_id, vector=point.vector, payload=payload)
            self.client.upsert(collection_name=collection_name, points=[updated_point])
            
            logger.info(f"✅ Updated job posting structured data {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to update job posting structured data {job_id}: {e}")
            return False

    def link_application_to_job(
        self, 
        application_id: str, 
        job_id: str, 
        applicant_data: Dict,
        cv_filename: str,
        application_date: Optional[str] = None
    ) -> bool:
        """
        Store application data linking it to a specific job posting
        Uses cv_structured collection with job_id field
        """
        try:
            collection_name = "cv_structured"
            
            if not application_date:
                application_date = datetime.utcnow().isoformat()
            
            # Get existing CV structured data
            current_point = self.client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[FieldCondition(key="id", match=MatchValue(value=application_id))]
                ),
                limit=1,
                with_payload=True,
                with_vectors=True
            )[0]
            
            if not current_point:
                logger.error(f"❌ CV structured data not found for application {application_id}")
                return False
                
            point = current_point[0]
            payload = point.payload.copy()
            
            # Add application linking data
            payload.update({
                "job_id": job_id,  # Link to job posting
                "applicant_name": applicant_data.get("applicant_name"),
                "applicant_email": applicant_data.get("applicant_email"),
                "applicant_phone": applicant_data.get("applicant_phone"),
                "cv_filename": cv_filename,
                "application_date": application_date,
                "application_status": "pending",
                "cover_letter": applicant_data.get("cover_letter"),
                "expected_salary": applicant_data.get("expected_salary"),
                "years_of_experience": applicant_data.get("years_of_experience"),
                "experience_warning": applicant_data.get("experience_warning"),
                "is_job_application": True
            })
            
            # Update the point
            updated_point = PointStruct(id=application_id, vector=point.vector, payload=payload)
            self.client.upsert(collection_name=collection_name, points=[updated_point])
            
            logger.info(f"✅ Linked application {application_id} to job {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to link application {application_id} to job {job_id}: {e}")
            return False

    def get_applications_for_job(self, job_id: str) -> List[Dict]:
        """
        Get all applications for a specific job posting with note information
        """
        try:
            collection_name = "cv_structured"
            
            results = self.client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(key="job_id", match=MatchValue(value=job_id)),
                        FieldCondition(key="is_job_application", match=MatchValue(value=True))
                    ]
                ),
                limit=1000,  # Reasonable limit for applications
                with_payload=True,
                with_vectors=False
            )
            
            applications = []
            if results[0]:
                for point in results[0]:
                    application_data = point.payload.copy()
                    
                    # Extract note information from structured_info
                    structured_info = application_data.get("structured_info", {})
                    hr_notes = structured_info.get("hr_notes", [])
                    
                    # Extract source and email_id from structured_info to top level (for API access)
                    if "source" not in application_data and "source" in structured_info:
                        application_data["source"] = structured_info.get("source")
                    if "email_id" not in application_data and "email_id" in structured_info:
                        application_data["email_id"] = structured_info.get("email_id")
                    
                    # Add note metadata to application data
                    application_data["notes"] = hr_notes
                    application_data["notes_count"] = len(hr_notes)
                    application_data["has_notes"] = len(hr_notes) > 0
                    
                    # Add latest note info for sorting/display
                    if hr_notes:
                        latest_note = max(hr_notes, key=lambda x: x.get("updated_at", x.get("created_at", "")))
                        application_data["latest_note"] = latest_note
                        application_data["latest_note_text"] = latest_note.get("note", "")
                        application_data["latest_note_author"] = latest_note.get("hr_user", "")
                        application_data["latest_note_date"] = latest_note.get("updated_at", latest_note.get("created_at", ""))
                    else:
                        application_data["latest_note"] = None
                        application_data["latest_note_text"] = ""
                        application_data["latest_note_author"] = ""
                        application_data["latest_note_date"] = ""
                    
                    applications.append(application_data)
            
            # Sort applications: those with notes first, then by latest note date, then by application date
            applications.sort(key=lambda x: (
                not x["has_notes"],  # False (has notes) comes before True (no notes)
                x["latest_note_date"] if x["has_notes"] else x.get("application_date", ""),
            ), reverse=True)
            
            logger.info(f"✅ Found {len(applications)} applications for job {job_id} ({sum(1 for app in applications if app['has_notes'])} with notes)")
            return applications
            
        except Exception as e:
            logger.error(f"❌ Failed to get applications for job {job_id}: {e}")
            return []

    def get_all_job_postings(self, include_inactive: bool = False, posted_by_user: Optional[str] = None, user_role: Optional[str] = None) -> List[Dict]:
        """
        Get job postings (for HR dashboard)
        - All users can see all job postings (no filtering by posted_by_user)
        - Permission fields (can_edit, can_delete) are calculated based on ownership and role
        """
        try:
            collection_name = "job_postings_structured"
            
            filter_conditions = []
            filter_conditions_not = []
            
            if not include_inactive:
                filter_conditions.append(
                    FieldCondition(key="is_active", match=MatchValue(value=True))
                )
            
            # Always exclude deleted jobs
            filter_conditions_not.append(
                FieldCondition(key="is_deleted", match=MatchValue(value=True))
            )
            
            # All users can see all job postings (no filtering by user)
            # Permission calculation will be done in the API layer
            
            filter_obj = Filter(
                must=filter_conditions if filter_conditions else None,
                must_not=filter_conditions_not
            )
            
            results = self.client.scroll(
                collection_name=collection_name,
                scroll_filter=filter_obj,
                limit=1000,  # Reasonable limit
                with_payload=True,
                with_vectors=False
            )
            
            jobs = []
            if results[0]:
                for point in results[0]:
                    job_metadata = point.payload
                    job_id = job_metadata["id"]
                    
                    # Get the actual JD data from jd_structured collection (using careers-specific method)
                    jd_data = self.get_structured_jd_for_careers(job_id)
                    if jd_data:
                        # Debug logging before merge
                        logger.info(f"🔍 Job {job_id} - Before merge:")
                        logger.info(f"  JD Data keys: {list(jd_data.keys())}")
                        logger.info(f"  Metadata keys: {list(job_metadata.keys())}")
                        logger.info(f"  Metadata public_token: {job_metadata.get('public_token', 'MISSING')}")
                        
                        # Merge JD data with metadata (metadata takes precedence for careers fields)
                        # Remove 'id' from jd_data to avoid conflicts with job_metadata
                        jd_data_clean = {k: v for k, v in jd_data.items() if k != 'id'}
                        
                        # Merge carefully - metadata should take precedence for user attribution fields
                        job_data = {**jd_data_clean, **job_metadata}
                        
                        # Ensure user attribution fields are preserved from metadata
                        if job_metadata.get('posted_by_user'):
                            job_data['posted_by_user'] = job_metadata['posted_by_user']
                        if job_metadata.get('posted_by_role'):
                            job_data['posted_by_role'] = job_metadata['posted_by_role']
                        
                        # Debug logging for public_token and user attribution
                        logger.info(f"  Final job_data public_token: {job_data.get('public_token', 'MISSING')}")
                        logger.info(f"  Final job_data posted_by_user: {job_data.get('posted_by_user', 'MISSING')}")
                        logger.info(f"  Final job_data posted_by_role: {job_data.get('posted_by_role', 'MISSING')}")
                        if 'public_token' not in job_data or job_data.get('public_token') == 'unknown':
                            logger.warning(f"⚠️ Job {job_id} missing public_token. Metadata: {job_metadata.get('public_token')}, Final: {job_data.get('public_token')}")
                        
                        jobs.append(job_data)
                    else:
                        jobs.append(job_metadata)
            
            logger.info(f"✅ Found {len(jobs)} job postings")
            return jobs
            
        except Exception as e:
            logger.error(f"❌ Failed to get job postings: {e}")
            return []

    def get_careers_stats(self) -> Dict[str, Any]:
        """
        Get statistics for careers functionality
        """
        try:
            stats = {
                "job_postings_count": 0,
                "active_jobs_count": 0,
                "applications_count": 0,
                "collections_status": {}
            }
            
            # Count job postings
            job_results = self.client.scroll(
                collection_name="job_postings_structured",
                limit=1000,
                with_payload=True,
                with_vectors=False
            )
            if job_results[0]:
                stats["job_postings_count"] = len(job_results[0])
                stats["active_jobs_count"] = sum(
                    1 for point in job_results[0] 
                    if point.payload.get("is_active", False)
                )
            
            # Count applications (job applications from cv_structured)
            app_results = self.client.scroll(
                collection_name="cv_structured",
                scroll_filter=Filter(
                    must=[FieldCondition(key="is_job_application", match=MatchValue(value=True))]
                ),
                limit=1000,
                with_payload=False,
                with_vectors=False
            )
            if app_results[0]:
                stats["applications_count"] = len(app_results[0])
            
            # Check collection health
            careers_collections = [
                "job_postings_structured"
            ]
            
            for collection_name in careers_collections:
                try:
                    collection_info = self.client.get_collection(collection_name)
                    stats["collections_status"][collection_name] = {
                        "exists": True,
                        "points_count": collection_info.points_count,
                        "status": "healthy"
                    }
                except Exception as e:
                    stats["collections_status"][collection_name] = {
                        "exists": False,
                        "error": str(e),
                        "status": "unhealthy"
                    }
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Failed to get careers stats: {e}")
            return {
                "job_postings_count": 0,
                "active_jobs_count": 0,
                "applications_count": 0,
                "collections_status": {},
                "error": str(e)
            }

    def delete_all_job_postings(self) -> Dict[str, Any]:
        """
        Delete all job postings and related JD data while preserving CVs.
        This will:
        1. Delete all job posting metadata from job_postings_structured
        2. Delete all JD data from jd_* collections
        3. Preserve all CV data (including job application CVs)
        """
        try:
            results = {
                "job_postings_deleted": 0,
                "jd_documents_deleted": 0,
                "jd_structured_deleted": 0,
                "jd_embeddings_deleted": 0,
                "cvs_preserved": 0,
                "success": True,
                "error": None
            }
            
            # 1. Delete all job posting metadata
            try:
                job_postings = self.client.scroll(
                    collection_name="job_postings_structured",
                    limit=1000,
                    with_payload=True,
                    with_vectors=False
                )
                if job_postings[0]:
                    job_ids = [point.id for point in job_postings[0]]
                    # Delete by point IDs
                    self.client.delete(
                        collection_name="job_postings_structured",
                        points_selector=job_ids
                    )
                    results["job_postings_deleted"] = len(job_ids)
                    logger.info(f"✅ Deleted {len(job_ids)} job postings from job_postings_structured")
            except Exception as e:
                logger.warning(f"⚠️ Failed to delete job postings: {e}")
            
            # 2. Delete all JD documents
            try:
                jd_docs = self.client.scroll(
                    collection_name="jd_documents",
                    limit=1000,
                    with_payload=False,
                    with_vectors=False
                )
                if jd_docs[0]:
                    jd_ids = [point.id for point in jd_docs[0]]
                    # Delete by point IDs
                    self.client.delete(
                        collection_name="jd_documents",
                        points_selector=jd_ids
                    )
                    results["jd_documents_deleted"] = len(jd_ids)
                    logger.info(f"✅ Deleted {len(jd_ids)} JD documents")
            except Exception as e:
                logger.warning(f"⚠️ Failed to delete JD documents: {e}")
            
            # 3. Delete all JD structured data
            try:
                jd_structured = self.client.scroll(
                    collection_name="jd_structured",
                    limit=1000,
                    with_payload=False,
                    with_vectors=False
                )
                if jd_structured[0]:
                    jd_ids = [point.id for point in jd_structured[0]]
                    # Delete by point IDs
                    self.client.delete(
                        collection_name="jd_structured",
                        points_selector=jd_ids
                    )
                    results["jd_structured_deleted"] = len(jd_ids)
                    logger.info(f"✅ Deleted {len(jd_ids)} JD structured data")
            except Exception as e:
                logger.warning(f"⚠️ Failed to delete JD structured data: {e}")
            
            # 4. Delete all JD embeddings
            try:
                jd_embeddings = self.client.scroll(
                    collection_name="jd_embeddings",
                    limit=1000,
                    with_payload=False,
                    with_vectors=False
                )
                if jd_embeddings[0]:
                    jd_ids = [point.id for point in jd_embeddings[0]]
                    # Delete by point IDs
                    self.client.delete(
                        collection_name="jd_embeddings",
                        points_selector=jd_ids
                    )
                    results["jd_embeddings_deleted"] = len(jd_ids)
                    logger.info(f"✅ Deleted {len(jd_ids)} JD embeddings")
            except Exception as e:
                logger.warning(f"⚠️ Failed to delete JD embeddings: {e}")
            
            # 5. Count preserved CVs
            try:
                cv_count = self.client.scroll(
                    collection_name="cv_structured",
                    limit=1000,
                    with_payload=False,
                    with_vectors=False
                )
                if cv_count[0]:
                    results["cvs_preserved"] = len(cv_count[0])
                    logger.info(f"✅ Preserved {len(cv_count[0])} CVs (including job applications)")
            except Exception as e:
                logger.warning(f"⚠️ Failed to count CVs: {e}")
            
            logger.info(f"✅ Job postings deletion completed: {results}")
            return results
            
        except Exception as e:
            logger.error(f"❌ Failed to delete job postings: {e}")
            return {
                "job_postings_deleted": 0,
                "jd_documents_deleted": 0,
                "jd_structured_deleted": 0,
                "jd_embeddings_deleted": 0,
                "cvs_preserved": 0,
                "success": False,
                "error": str(e)
            }

    def get_job_posting_by_id(self, job_id: str) -> Optional[dict]:
        """
        Get a job posting by its ID to check if it exists
        """
        try:
            # Search in job_postings_structured collection
            search_result = self.client.scroll(
                collection_name="job_postings_structured",
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="id",
                            match=MatchValue(value=job_id)
                        )
                    ],
                    must_not=[
                        FieldCondition(
                            key="is_deleted",
                            match=MatchValue(value=True)
                        )
                    ]
                ),
                limit=1,
                with_payload=True,
                with_vectors=False
            )
            
            if search_result[0]:
                return search_result[0][0].payload
            return None
            
        except Exception as e:
            logger.error(f"❌ Error getting job posting {job_id}: {e}")
            return None

    def soft_delete_job_posting(self, job_id: str, deleted_by: str, deleted_at: str) -> dict:
        """
        Soft delete a job posting and related data
        
        Returns:
            dict: Success status and details of what was deleted/archived
        """
        try:
            results = {
                "job_posting_deleted": False,
                "jd_documents_deleted": 0,
                "jd_structured_deleted": 0,
                "jd_embeddings_deleted": 0,
                "applications_archived": 0,
                "success": False
            }
            
            # 1. Get the job posting to find related JD data
            job_posting = self.get_job_posting_by_id(job_id)
            if not job_posting:
                return {
                    "success": False,
                    "error": f"Job posting {job_id} not found or already deleted"
                }
            
            jd_id = job_posting.get("jd_id")
            logger.info(f"🗑️ Soft deleting job posting {job_id} with JD {jd_id}")
            
            # 2. Soft delete job posting (mark as deleted)
            try:
                # Find the job posting point
                search_result = self.client.scroll(
                    collection_name="job_postings_structured",
                    scroll_filter=Filter(
                        must=[
                            FieldCondition(
                                key="id",
                                match=MatchValue(value=job_id)
                            )
                        ]
                    ),
                    limit=1,
                    with_payload=True,
                    with_vectors=False
                )
                
                if search_result[0]:
                    point = search_result[0][0]
                    updated_payload = point.payload.copy()
                    updated_payload.update({
                        "is_deleted": True,
                        "deleted_by": deleted_by,
                        "deleted_at": deleted_at
                    })
                    
                    # Update the point with soft deletion metadata
                    self.client.upsert(
                        collection_name="job_postings_structured",
                        points=[PointStruct(
                            id=point.id,
                            vector=point.vector or {},
                            payload=updated_payload
                        )]
                    )
                    results["job_posting_deleted"] = True
                    logger.info(f"✅ Soft deleted job posting {job_id}")
                
            except Exception as e:
                logger.error(f"❌ Failed to soft delete job posting {job_id}: {e}")
                return {"success": False, "error": f"Failed to delete job posting: {str(e)}"}
            
            # 3. Soft delete related JD documents if they exist
            if jd_id:
                try:
                    # JD Documents
                    jd_docs = self.client.scroll(
                        collection_name="jd_documents",
                        scroll_filter=Filter(
                            must=[
                                FieldCondition(
                                    key="id",
                                    match=MatchValue(value=jd_id)
                                )
                            ]
                        ),
                        limit=100,
                        with_payload=True,
                        with_vectors=False
                    )
                    
                    if jd_docs[0]:
                        for point in jd_docs[0]:
                            updated_payload = point.payload.copy()
                            updated_payload.update({
                                "is_deleted": True,
                                "deleted_by": deleted_by,
                                "deleted_at": deleted_at,
                                "deleted_reason": f"Related to deleted job posting {job_id}"
                            })
                            
                            self.client.upsert(
                                collection_name="jd_documents",
                                points=[PointStruct(
                                    id=point.id,
                                    vector=point.vector or {},
                                    payload=updated_payload
                                )]
                            )
                        results["jd_documents_deleted"] = len(jd_docs[0])
                        logger.info(f"✅ Soft deleted {len(jd_docs[0])} JD documents")
                        
                except Exception as e:
                    logger.warning(f"⚠️ Failed to soft delete JD documents: {e}")
                
                # 4. Soft delete JD structured data
                try:
                    jd_structured = self.client.scroll(
                        collection_name="jd_structured",
                        scroll_filter=Filter(
                            must=[
                                FieldCondition(
                                    key="id",
                                    match=MatchValue(value=jd_id)
                                )
                            ]
                        ),
                        limit=100,
                        with_payload=True,
                        with_vectors=False
                    )
                    
                    if jd_structured[0]:
                        for point in jd_structured[0]:
                            updated_payload = point.payload.copy()
                            updated_payload.update({
                                "is_deleted": True,
                                "deleted_by": deleted_by,
                                "deleted_at": deleted_at,
                                "deleted_reason": f"Related to deleted job posting {job_id}"
                            })
                            
                            self.client.upsert(
                                collection_name="jd_structured",
                                points=[PointStruct(
                                    id=point.id,
                                    vector=point.vector or {},
                                    payload=updated_payload
                                )]
                            )
                        results["jd_structured_deleted"] = len(jd_structured[0])
                        logger.info(f"✅ Soft deleted {len(jd_structured[0])} JD structured data")
                        
                except Exception as e:
                    logger.warning(f"⚠️ Failed to soft delete JD structured data: {e}")
                
                # 5. Soft delete JD embeddings
                try:
                    jd_embeddings = self.client.scroll(
                        collection_name="jd_embeddings",
                        scroll_filter=Filter(
                            must=[
                                FieldCondition(
                                    key="jd_id",
                                    match=MatchValue(value=jd_id)
                                )
                            ]
                        ),
                        limit=1000,
                        with_payload=True,
                        with_vectors=False
                    )
                    
                    if jd_embeddings[0]:
                        for point in jd_embeddings[0]:
                            updated_payload = point.payload.copy()
                            updated_payload.update({
                                "is_deleted": True,
                                "deleted_by": deleted_by,
                                "deleted_at": deleted_at,
                                "deleted_reason": f"Related to deleted job posting {job_id}"
                            })
                            
                            self.client.upsert(
                                collection_name="jd_embeddings",
                                points=[PointStruct(
                                    id=point.id,
                                    vector=point.vector,  # Keep the vector for embeddings
                                    payload=updated_payload
                                )]
                            )
                        results["jd_embeddings_deleted"] = len(jd_embeddings[0])
                        logger.info(f"✅ Soft deleted {len(jd_embeddings[0])} JD embeddings")
                        
                except Exception as e:
                    logger.warning(f"⚠️ Failed to soft delete JD embeddings: {e}")
            
            # 6. Archive applications instead of deleting them
            try:
                # Find applications for this job
                applications = self.client.scroll(
                    collection_name="applications_structured",
                    scroll_filter=Filter(
                        must=[
                            FieldCondition(
                                key="job_id",
                                match=MatchValue(value=job_id)
                            )
                        ]
                    ),
                    limit=1000,
                    with_payload=True,
                    with_vectors=False
                )
                
                if applications[0]:
                    for point in applications[0]:
                        updated_payload = point.payload.copy()
                        updated_payload.update({
                            "job_deleted": True,
                            "job_deleted_by": deleted_by,
                            "job_deleted_at": deleted_at,
                            "application_status": "archived_job_deleted"
                        })
                        
                        self.client.upsert(
                            collection_name="applications_structured",
                            points=[PointStruct(
                                id=point.id,
                                vector=point.vector or {},
                                payload=updated_payload
                            )]
                        )
                    results["applications_archived"] = len(applications[0])
                    logger.info(f"✅ Archived {len(applications[0])} applications")
                    
            except Exception as e:
                logger.warning(f"⚠️ Failed to archive applications: {e}")
            
            results["success"] = True
            logger.info(f"✅ Successfully soft-deleted job posting {job_id}: {results}")
            return results
            
        except Exception as e:
            logger.error(f"❌ Unexpected error during soft deletion of job posting {job_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_next_email_subject_counter(self, abbreviation: str, year: int) -> int:
        """
        Get the next counter for email subject ID generation
        Searches existing job postings to find the highest counter for the given abbreviation and year
        Returns the next available counter (starting from 1)
        """
        try:
            # Search for existing job postings with this abbreviation and year pattern
            search_results = self.client.scroll(
                collection_name="job_postings_structured",
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="doc_type",
                            match=MatchValue(value="job_description")
                        ),
                        FieldCondition(
                            key="is_active",
                            match=MatchValue(value=True)
                        )
                    ]
                ),
                limit=1000,
                with_payload=True,
                with_vectors=False
            )
            
            highest_counter = 0
            pattern = f"{abbreviation}-{year}-"
            
            if search_results[0]:
                for point in search_results[0]:
                    email_subject_id = point.payload.get("email_subject_id")
                    if email_subject_id and email_subject_id.startswith(pattern):
                        # Extract counter from ID like "SE-2025-001"
                        try:
                            counter_str = email_subject_id.split('-')[-1]
                            counter = int(counter_str)
                            highest_counter = max(highest_counter, counter)
                        except (ValueError, IndexError):
                            continue
            
            return highest_counter + 1
            
        except Exception as e:
            logger.error(f"❌ Error getting next email subject counter: {e}")
            # Fallback to timestamp-based counter
            import time
            return int(time.time()) % 1000


# Global singleton
_qdrant_utils: Optional[QdrantUtils] = None

def get_qdrant_utils() -> QdrantUtils:
    global _qdrant_utils
    if _qdrant_utils is None:
        import os
        host = os.getenv("QDRANT_HOST", "qdrant")
        port = int(os.getenv("QDRANT_PORT", "6333"))
        _qdrant_utils = QdrantUtils(host=host, port=port)
    return _qdrant_utils