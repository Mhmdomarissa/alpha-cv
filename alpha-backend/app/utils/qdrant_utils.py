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
        """
        try:
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
            }
        except Exception as e:
            logger.error(f"❌ get_structured_jd({jd_id}) failed: {e}")
            return None


# Global singleton
_qdrant_utils: Optional[QdrantUtils] = None

def get_qdrant_utils() -> QdrantUtils:
    global _qdrant_utils
    if _qdrant_utils is None:
        _qdrant_utils = QdrantUtils()
    return _qdrant_utils