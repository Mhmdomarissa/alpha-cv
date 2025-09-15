# app/utils/qdrant_utils.py
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import hashlib
import uuid

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    FilterSelector,
)

logger = logging.getLogger(__name__)

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
        self.client = QdrantClient(host=host, port=port)
        logger.info(f"🗄 Connected to Qdrant at {host}:{port}")
        self._ensure_collections_exist()

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
                "raw_content": raw_content,
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
        structured_data expected to include "document_id" and "structured_info".
        """
        try:
            collection_name = f"{doc_type}_structured"
            dummy_vector = [0.0] * 768
            payload = {
                "id": doc_id,
                "document_id": doc_id,
                "structured_info": structured_data.get("structured_info", structured_data),
                "stored_at": datetime.utcnow().isoformat(),
            }
            self.client.upsert(
                collection_name=collection_name,
                points=[PointStruct(id=doc_id, vector=dummy_vector, payload=payload)],
            )
            logger.info(f"✅ Structured stored: {doc_id} → {collection_name}")
            return True
        except Exception as e:
            logger.error(f"❌ store_structured_data({doc_id}) failed: {e}")
            return False

    # ---------- EXACT 32 vectors storage (per doc) ----------

    def store_embeddings_exact(self, doc_id: str, doc_type: str, embeddings_data: Dict[str, Any]) -> bool:
        """
        Store EXACTLY 32 vectors as INDIVIDUAL POINTS in {doc_type}_embeddings.
        Expected keys in embeddings_data:
          - skill_vectors (20), responsibility_vectors (10), experience_vector (1), job_title_vector (1)
          - plus 'skills', 'responsibilities', 'experience_years', 'job_title' for payload context
        """
        try:
            collection_name = f"{doc_type}_embeddings"
            points: List[PointStruct] = []

            # 20 skills
            for i, vec in enumerate(embeddings_data.get("skill_vectors", [])[:20]):
                points.append(
                    PointStruct(
                        id=str(uuid.uuid4()),
                        vector=vec,
                        payload={
                            "document_id": doc_id,
                            "vector_type": "skill",
                            "vector_index": i,
                            "content": (embeddings_data.get("skills", []) or [""])[i] if i < len(embeddings_data.get("skills", [])) else "",
                        },
                    )
                )

            # 10 responsibilities
            for i, vec in enumerate(embeddings_data.get("responsibility_vectors", [])[:10]):
                points.append(
                    PointStruct(
                        id=str(uuid.uuid4()),
                        vector=vec,
                        payload={
                            "document_id": doc_id,
                            "vector_type": "responsibility",
                            "vector_index": i,
                            "content": (embeddings_data.get("responsibilities", []) or [""])[i] if i < len(embeddings_data.get("responsibilities", [])) else "",
                        },
                    )
                )

            # 1 experience
            if embeddings_data.get("experience_vector"):
                points.append(
                    PointStruct(
                        id=str(uuid.uuid4()),
                        vector=embeddings_data["experience_vector"][0],
                        payload={
                            "document_id": doc_id,
                            "vector_type": "experience",
                            "vector_index": 0,
                            "content": embeddings_data.get("experience_years", ""),
                        },
                    )
                )

            # 1 job title
            if embeddings_data.get("job_title_vector"):
                points.append(
                    PointStruct(
                        id=str(uuid.uuid4()),
                        vector=embeddings_data["job_title_vector"][0],
                        payload={
                            "document_id": doc_id,
                            "vector_type": "job_title",
                            "vector_index": 0,
                            "content": embeddings_data.get("job_title", ""),
                        },
                    )
                )

            if not points:
                logger.warning(f"⚠ No vectors to store for {doc_id}")
                return False

            self.client.upsert(collection_name=collection_name, points=points)
            logger.info(f"✅ Stored {len(points)} vectors for {doc_id} → {collection_name}")
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
        Read the EXACT-32 vectors back from {doc_type}_embeddings and return a dict:
          { "skill_vectors": [...], "responsibility_vectors": [...], "experience_vector": [...], "job_title_vector": [...] }
        """
        try:
            points, _ = self.client.scroll(
                collection_name=f"{doc_type}_embeddings",
                scroll_filter=Filter(
                    must=[FieldCondition(key="document_id", match=MatchValue(value=doc_id))]
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
        """
        try:
            self.client.delete(collection_name=f"{doc_type}_documents", points_selector=[doc_id])
            self.client.delete(collection_name=f"{doc_type}_structured", points_selector=[doc_id])

            self.client.delete(
                collection_name=f"{doc_type}_embeddings",
                points_selector=FilterSelector(
                    filter=Filter(must=[FieldCondition(key="document_id", match=MatchValue(value=doc_id))])
                ),
            )
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
                    "id": p.payload.get("document_id", str(p.id)),
                    "name": si.get("full_name", si.get("name", str(p.id))),
                })
            if out:
                return out

            # Fallback to documents if structured is empty
            docs = self.list_documents("cv")
            return [{"id": d.get("id", ""), "name": d.get("filename", d.get("id", ""))} for d in docs]
        except Exception as e:
            logger.error(f"❌ list_all_cvs failed: {e}")
            return []

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
                "years_of_experience": s.get("experience_years", s.get("years_of_experience", 0)),
                "skills_sentences": (s.get("skills", []) or [])[:20],
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
                    "years_of_experience": s.get("experience_years", s.get("years_of_experience", 0)),
                    "skills_sentences": (s.get("skills", []) or [])[:20],  # Matching system expects this field name
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
                "years_of_experience": s.get("experience_years", s.get("years_of_experience", 0)),
                "skills_sentences": (s.get("skills", []) or [])[:20],  # Matching system expects this field name
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
                    "years_of_experience": s.get("experience_years", s.get("years_of_experience", 0)),
                    "skills_sentences": (s.get("skills", []) or [])[:20],
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
                "years_of_experience": s.get("experience_years", s.get("years_of_experience", 0)),
                "skills_sentences": (s.get("skills", []) or [])[:20],
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
        additional_info: Optional[str] = None
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
                "is_active": True,
                "created_date": datetime.utcnow().isoformat(),
                "document_type": "job_posting_metadata"
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
        ui_data: Dict[str, Any]
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
                        if 'responsibilities' in structured_info:
                            job_data['responsibility_sentences'] = structured_info['responsibilities']
                            job_data['responsibilities'] = structured_info['responsibilities']
                        if 'skills' in structured_info:
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
                                            job_data.update(job_metadata['structured_info'])
                                    
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
                    must=[FieldCondition(key="document_id", match=MatchValue(value=application_id))]
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
        Get all applications for a specific job posting
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
                    applications.append(point.payload)
            
            logger.info(f"✅ Found {len(applications)} applications for job {job_id}")
            return applications
            
        except Exception as e:
            logger.error(f"❌ Failed to get applications for job {job_id}: {e}")
            return []

    def get_all_job_postings(self, include_inactive: bool = False) -> List[Dict]:
        """
        Get all job postings (for HR dashboard)
        """
        try:
            collection_name = "job_postings_structured"
            
            filter_conditions = []
            if not include_inactive:
                filter_conditions.append(
                    FieldCondition(key="is_active", match=MatchValue(value=True))
                )
            
            filter_obj = Filter(must=filter_conditions) if filter_conditions else None
            
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
                        job_data = {**jd_data_clean, **job_metadata}
                        
                        # Debug logging for public_token
                        logger.info(f"  Final job_data public_token: {job_data.get('public_token', 'MISSING')}")
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


# Global singleton
_qdrant_utils: Optional[QdrantUtils] = None

def get_qdrant_utils() -> QdrantUtils:
    global _qdrant_utils
    if _qdrant_utils is None:
        _qdrant_utils = QdrantUtils()
    return _qdrant_utils