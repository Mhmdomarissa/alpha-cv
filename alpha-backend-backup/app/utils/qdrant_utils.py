import logging
import os
import uuid
import json
import re
import requests
from datetime import datetime
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from functools import lru_cache
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_qdrant_client() -> QdrantClient:
    """Get Qdrant client with error handling."""
    try:
        client = QdrantClient(
            host=os.getenv("QDRANT_HOST", "qdrant"),
            port=int(os.getenv("QDRANT_PORT", 6333))
        )
        return client
    except Exception as e:
        logger.error(f"Failed to create Qdrant client: {str(e)}")
        raise

def create_collections():
    """Create Qdrant collections with error handling for new embedding structure."""
    try:
        client = get_qdrant_client()
        
        # Create CVs collection - now stores individual skill/responsibility embeddings
        try:
            client.create_collection(
                collection_name="cvs",
                vectors_config=VectorParams(size=768, distance=Distance.COSINE)
            )
            logger.info("Created CVs collection")
        except Exception as e:
            if "already exists" not in str(e).lower():
                logger.error(f"Failed to create CVs collection: {str(e)}")
                raise
        
        # Create JDs collection - now stores individual skill/responsibility embeddings
        try:
            client.create_collection(
                collection_name="jds",
                vectors_config=VectorParams(size=768, distance=Distance.COSINE)
            )
            logger.info("Created JDs collection")
        except Exception as e:
            if "already exists" not in str(e).lower():
                logger.error(f"Failed to create JDs collection: {str(e)}")
                raise
        
        # Create Skills collection for individual skill embeddings
        try:
            client.create_collection(
                collection_name="skills",
                vectors_config=VectorParams(size=768, distance=Distance.COSINE)
            )
            logger.info("Created Skills collection")
        except Exception as e:
            if "already exists" not in str(e).lower():
                logger.error(f"Failed to create Skills collection: {str(e)}")
                raise
                
        # Create Responsibilities collection for individual responsibility embeddings
        try:
            client.create_collection(
                collection_name="responsibilities",
                vectors_config=VectorParams(size=768, distance=Distance.COSINE)
            )
            logger.info("Created Responsibilities collection")
        except Exception as e:
            if "already exists" not in str(e).lower():
                logger.error(f"Failed to create Responsibilities collection: {str(e)}")
                raise
                
    except Exception as e:
        logger.error(f"Failed to create collections: {str(e)}")
        raise

def generate_embedding(text: str) -> List[float]:
    """Generate embedding for text using the configured embedding service (all-mpnet-base-v2, 768 dimensions)."""
    from app.services.embedding_service import get_embedding_service
    
    # Clean and validate input text
    cleaned_text = text.strip()
    if not cleaned_text:
        raise Exception("Empty text provided for embedding")
    
    # No truncation - process full text as required
    logger.info(f"Generating embedding for text: {len(cleaned_text)} characters")
    try:
        embedding_service = get_embedding_service()
        embedding = embedding_service.get_embedding(cleaned_text)
        
        if not isinstance(embedding, list) or len(embedding) == 0:
            raise Exception(f"Invalid embedding format: {type(embedding)}")
        
        logger.info(f"✅ Successfully generated embedding: {len(embedding)} dimensions")
        return embedding
        
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        raise Exception(f"Embedding generation failed: {str(e)}")

def save_cv_to_qdrant_new(extracted_text: str, standardized_data: dict, filename: str) -> str:
    """
    NEW APPROACH: Save CV using standardized data with individual embeddings.
    CRITICAL: Embeds standardized data, not raw text.
    """
    try:
        client = get_qdrant_client()
        
        # Generate unique ID for this CV
        cv_id = str(uuid.uuid4())
        
        logger.info(f"🔄 Saving CV with NEW embedding strategy: {filename}")
        logger.info(f"📊 Standardized data: {len(standardized_data.get('skills', []))} skills, {len(standardized_data.get('responsibilities', []))} responsibilities")
        
        # 1. Generate individual skill embeddings
        skills = standardized_data.get("skills", [])
        skill_points = []
        for i, skill in enumerate(skills):
            if skill and skill.strip():
                try:
                    skill_embedding = generate_embedding(skill.strip())
                    skill_id = str(uuid.uuid4())
                    skill_points.append(PointStruct(
                        id=skill_id,
                        vector=skill_embedding,
                        payload={
                            "type": "skill",
                            "content": skill.strip(),
                            "document_id": cv_id,
                            "document_type": "cv",
                            "filename": filename,
                            "index": i
                        }
                    ))
                except Exception as e:
                    logger.error(f"❌ Failed to generate embedding for skill '{skill}': {str(e)}")
        
        # 2. Generate individual responsibility embeddings
        responsibilities = standardized_data.get("responsibilities", [])
        responsibility_points = []
        for i, responsibility in enumerate(responsibilities):
            if responsibility and responsibility.strip():
                try:
                    resp_embedding = generate_embedding(responsibility.strip())
                    resp_id = str(uuid.uuid4())
                    responsibility_points.append(PointStruct(
                        id=resp_id,
                        vector=resp_embedding,
                        payload={
                            "type": "responsibility",
                            "content": responsibility.strip(),
                            "document_id": cv_id,
                            "document_type": "cv",
                            "filename": filename,
                            "index": i
                        }
                    ))
                except Exception as e:
                    logger.error(f"❌ Failed to generate embedding for responsibility: {str(e)}")
        
        # 3. Generate job title embedding
        job_title = standardized_data.get("job_title", "")
        title_embedding = None
        if job_title and job_title.strip() and job_title != "Not specified":
            try:
                title_embedding = generate_embedding(job_title.strip())
            except Exception as e:
                logger.error(f"❌ Failed to generate embedding for job title: {str(e)}")
        
        # 4. Generate experience embedding
        experience = standardized_data.get("experience_years", "")
        # Also check legacy field name for backward compatibility
        if not experience:
            experience = standardized_data.get("years_of_experience", "")
        experience_embedding = None
        if experience and experience.strip() and experience != "Not specified":
            try:
                experience_embedding = generate_embedding(experience.strip())
            except Exception as e:
                logger.error(f"❌ Failed to generate embedding for experience: {str(e)}")
        
        # 5. Create a combined embedding for the overall document (for compatibility)
        # Use job title + summary of skills as the main document embedding
        skills_summary = ", ".join(skills[:10])  # Top 10 skills
        combined_text = f"{job_title}. Skills: {skills_summary}"
        main_embedding = generate_embedding(combined_text)
        
        # 6. Store main CV document with all metadata
        cv_payload = {
            "extracted_text": extracted_text,
            "filename": filename,
            "upload_date": datetime.utcnow().isoformat(),
            "document_type": "cv",
            "full_name": standardized_data.get("full_name", "Not specified"),
            "email": standardized_data.get("email", "Not specified"),
            "phone": standardized_data.get("phone", "Not specified"),
            "job_title": job_title,
            "years_of_experience": experience,
            "skills": skills,
            "responsibilities": responsibilities,
            "structured_info": standardized_data,
            "embedding_strategy": "standardized_individual_components",
            "total_skill_embeddings": len(skill_points),
            "total_responsibility_embeddings": len(responsibility_points),
            "processing_metadata": standardized_data.get("processing_metadata", {})
        }
        
        # Store main CV document
        client.upsert(
            collection_name="cvs",
            wait=True,
            points=[PointStruct(id=cv_id, vector=main_embedding, payload=cv_payload)]
        )
        
        # Store individual skill embeddings
        if skill_points:
            client.upsert(
                collection_name="skills",
                wait=True,
                points=skill_points
            )
            logger.info(f"✅ Stored {len(skill_points)} individual skill embeddings")
        
        # Store individual responsibility embeddings
        if responsibility_points:
            client.upsert(
                collection_name="responsibilities",
                wait=True,
                points=responsibility_points
            )
            logger.info(f"✅ Stored {len(responsibility_points)} individual responsibility embeddings")
        
        logger.info(f"✅ Successfully saved CV {filename} with NEW embedding strategy (ID: {cv_id})")
        return cv_id
        
    except Exception as e:
        logger.error(f"❌ Error saving CV with new embedding strategy: {str(e)}")
        raise Exception(f"Failed to save CV to Qdrant: {str(e)}")

def save_jd_to_qdrant_new(extracted_text: str, standardized_data: dict, filename: str) -> str:
    """
    NEW APPROACH: Save JD using standardized data with individual embeddings.
    CRITICAL: Embeds standardized data, not raw text.
    """
    try:
        client = get_qdrant_client()
        
        # Generate unique ID for this JD
        jd_id = str(uuid.uuid4())
        
        logger.info(f"🔄 Saving JD with NEW embedding strategy: {filename}")
        logger.info(f"📊 Standardized data: {len(standardized_data.get('skills', []))} skills, {len(standardized_data.get('responsibility_sentences', []))} responsibilities")
        
        # 1. Generate individual skill embeddings
        skills = standardized_data.get("skills", [])
        skill_points = []
        for i, skill in enumerate(skills):
            if skill and skill.strip():
                try:
                    skill_embedding = generate_embedding(skill.strip())
                    skill_id = str(uuid.uuid4())
                    skill_points.append(PointStruct(
                        id=skill_id,
                        vector=skill_embedding,
                        payload={
                            "type": "skill",
                            "content": skill.strip(),
                            "document_id": jd_id,
                            "document_type": "jd",
                            "filename": filename,
                            "index": i
                        }
                    ))
                except Exception as e:
                    logger.error(f"❌ Failed to generate embedding for skill '{skill}': {str(e)}")
        
        # 2. Generate individual responsibility embeddings
        responsibilities = standardized_data.get("responsibilities", [])
        # Also check legacy field name for backward compatibility
        if not responsibilities:
            responsibilities = standardized_data.get("responsibility_sentences", [])
        responsibility_points = []
        for i, responsibility in enumerate(responsibilities):
            if responsibility and responsibility.strip():
                try:
                    resp_embedding = generate_embedding(responsibility.strip())
                    resp_id = str(uuid.uuid4())
                    responsibility_points.append(PointStruct(
                        id=resp_id,
                        vector=resp_embedding,
                        payload={
                            "type": "responsibility",
                            "content": responsibility.strip(),
                            "document_id": jd_id,
                            "document_type": "jd",
                            "filename": filename,
                            "index": i
                        }
                    ))
                except Exception as e:
                    logger.error(f"❌ Failed to generate embedding for responsibility: {str(e)}")
        
        # 3. Generate job title embedding
        job_title = standardized_data.get("job_title", "")
        title_embedding = None
        if job_title and job_title.strip() and job_title != "Not specified":
            try:
                title_embedding = generate_embedding(job_title.strip())
            except Exception as e:
                logger.error(f"❌ Failed to generate embedding for job title: {str(e)}")
        
        # 4. Generate experience embedding
        experience = standardized_data.get("experience_years", "")
        # Also check legacy field name for backward compatibility
        if not experience:
            experience = standardized_data.get("years_of_experience", "")
        experience_embedding = None
        if experience and experience.strip() and experience != "Not specified":
            try:
                experience_embedding = generate_embedding(experience.strip())
            except Exception as e:
                logger.error(f"❌ Failed to generate embedding for experience: {str(e)}")
        
        # 5. Create a combined embedding for the overall document (for compatibility)
        # Use job title + summary of skills as the main document embedding
        skills_summary = ", ".join(skills[:10])  # Top 10 skills
        combined_text = f"{job_title}. Required skills: {skills_summary}"
        main_embedding = generate_embedding(combined_text)
        
        # 6. Store main JD document with all metadata
        jd_payload = {
            "extracted_text": extracted_text,
            "filename": filename,
            "upload_date": datetime.utcnow().isoformat(),
            "document_type": "jd",
            "job_title": job_title,
            "years_of_experience": experience,
            "skills": skills,
            "responsibilities": responsibilities,  # Updated to use consistent field name
            "responsibility_sentences": responsibilities,  # Keep for backward compatibility
            "structured_info": standardized_data,
            "embedding_strategy": "standardized_individual_components",
            "total_skill_embeddings": len(skill_points),
            "total_responsibility_embeddings": len(responsibility_points),
            "processing_metadata": standardized_data.get("processing_metadata", {})
        }
        
        # Store main JD document
        client.upsert(
            collection_name="jds",
            wait=True,
            points=[PointStruct(id=jd_id, vector=main_embedding, payload=jd_payload)]
        )
        
        # Store individual skill embeddings
        if skill_points:
            client.upsert(
                collection_name="skills",
                wait=True,
                points=skill_points
            )
            logger.info(f"✅ Stored {len(skill_points)} individual skill embeddings")
        
        # Store individual responsibility embeddings
        if responsibility_points:
            client.upsert(
                collection_name="responsibilities",
                wait=True,
                points=responsibility_points
            )
            logger.info(f"✅ Stored {len(responsibility_points)} individual responsibility embeddings")
        
        logger.info(f"✅ Successfully saved JD {filename} with NEW embedding strategy (ID: {jd_id})")
        return jd_id
        
    except Exception as e:
        logger.error(f"❌ Error saving JD with new embedding strategy: {str(e)}")
        raise Exception(f"Failed to save JD to Qdrant: {str(e)}")

# Wrapper functions to maintain compatibility while using new approach
def save_cv_to_qdrant(extracted_text: str, structured_info: Any, filename: str) -> str:
    """
    UPDATED: Now uses standardized data instead of raw text for embeddings.
    """
    # Handle both dict and string inputs
    if isinstance(structured_info, dict):
        standardized_data = structured_info
    else:
        try:
            standardized_data = json.loads(structured_info) if isinstance(structured_info, str) else structured_info
        except (json.JSONDecodeError, TypeError):
            logger.error(f"Invalid structured_info format for {filename}: {type(structured_info)}")
            raise Exception("Invalid structured_info format")
    
    return save_cv_to_qdrant_new(extracted_text, standardized_data, filename)

def save_jd_to_qdrant(extracted_text: str, structured_info: Any, filename: str) -> str:
    """
    UPDATED: Now uses standardized data instead of raw text for embeddings.
    """
    # Handle both dict and string inputs
    if isinstance(structured_info, dict):
        standardized_data = structured_info
    else:
        try:
            standardized_data = json.loads(structured_info) if isinstance(structured_info, str) else structured_info
        except (json.JSONDecodeError, TypeError):
            logger.error(f"Invalid structured_info format for {filename}: {type(structured_info)}")
            raise Exception("Invalid structured_info format")
    
    return save_jd_to_qdrant_new(extracted_text, standardized_data, filename)

def search_similar_skills(query_skills: List[str], document_type: str = "cv", limit: int = 10) -> List[Dict]:
    """
    NEW: Search for similar skills using individual skill embeddings.
    """
    try:
        client = get_qdrant_client()
        all_results = []
        
        for skill in query_skills:
            if not skill or not skill.strip():
                continue
                
            try:
                # Generate embedding for the query skill
                skill_embedding = generate_embedding(skill.strip())
                
                # Search in skills collection
                search_results = client.search(
                    collection_name="skills",
                    query_vector=skill_embedding,
                    query_filter={
                        "must": [
                            {"key": "document_type", "match": {"value": document_type}}
                        ]
                    },
                    limit=limit,
                    with_payload=True,
                    with_vectors=False
                )
                
                for result in search_results:
                    all_results.append({
                        "query_skill": skill,
                        "matched_skill": result.payload["content"],
                        "similarity_score": float(result.score),
                        "document_id": result.payload["document_id"],
                        "filename": result.payload["filename"]
                    })
                    
            except Exception as e:
                logger.error(f"Error searching for skill '{skill}': {str(e)}")
        
        # Sort by similarity score
        all_results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return all_results
        
    except Exception as e:
        logger.error(f"Error in skill search: {str(e)}")
        return []

def search_similar_responsibilities(query_responsibilities: List[str], document_type: str = "cv", limit: int = 10) -> List[Dict]:
    """
    NEW: Search for similar responsibilities using individual responsibility embeddings.
    """
    try:
        client = get_qdrant_client()
        all_results = []
        
        for responsibility in query_responsibilities:
            if not responsibility or not responsibility.strip():
                continue
                
            try:
                # Generate embedding for the query responsibility
                resp_embedding = generate_embedding(responsibility.strip())
                
                # Search in responsibilities collection
                search_results = client.search(
                    collection_name="responsibilities",
                    query_vector=resp_embedding,
                    query_filter={
                        "must": [
                            {"key": "document_type", "match": {"value": document_type}}
                        ]
                    },
                    limit=limit,
                    with_payload=True,
                    with_vectors=False
                )
                
                for result in search_results:
                    all_results.append({
                        "query_responsibility": responsibility,
                        "matched_responsibility": result.payload["content"],
                        "similarity_score": float(result.score),
                        "document_id": result.payload["document_id"],
                        "filename": result.payload["filename"]
                    })
                    
            except Exception as e:
                logger.error(f"Error searching for responsibility: {str(e)}")
        
        # Sort by similarity score
        all_results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return all_results
        
    except Exception as e:
        logger.error(f"Error in responsibility search: {str(e)}")
        return []

# Keep existing functions for compatibility
def list_cvs() -> List[Dict[str, Any]]:
    """List all CVs with enhanced metadata."""
    try:
        client = get_qdrant_client()
        
        # Get all CVs from collection with enhanced pagination
        all_cvs = []
        offset = None
        
        while True:
            result = client.scroll(
                collection_name="cvs",
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            
            points, next_offset = result
            
            for point in points:
                cv_data = {
                    "id": point.id,
                    "filename": point.payload.get("filename", "Unknown"),
                    "upload_date": point.payload.get("upload_date", "Unknown"),
                    "full_name": point.payload.get("full_name", "Not specified"),
                    "job_title": point.payload.get("job_title", "Not specified"),
                    "years_of_experience": point.payload.get("years_of_experience", "Not specified"),
                    "skills": point.payload.get("skills", []),
                    "email": point.payload.get("email", "Not specified"),
                    "phone": point.payload.get("phone", "Not specified"),
                    "extracted_text": point.payload.get("extracted_text", ""),
                    "structured_info": point.payload.get("structured_info", {}),
                    "embedding_strategy": point.payload.get("embedding_strategy", "legacy")
                }
                all_cvs.append(cv_data)
            
            if next_offset is None:
                break
            offset = next_offset
        
        logger.info(f"Found {len(all_cvs)} CVs in database")
        return all_cvs
        
    except Exception as e:
        logger.error(f"Error listing CVs: {str(e)}")
        return []

def list_jds() -> List[Dict[str, Any]]:
    """List all Job Descriptions with enhanced metadata."""
    try:
        client = get_qdrant_client()
        
        # Get all JDs from collection with enhanced pagination
        all_jds = []
        offset = None
        
        while True:
            result = client.scroll(
                collection_name="jds",
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            
            points, next_offset = result
            
            for point in points:
                jd_data = {
                    "id": point.id,
                    "filename": point.payload.get("filename", "Unknown"),
                    "upload_date": point.payload.get("upload_date", "Unknown"),
                    "job_title": point.payload.get("job_title", "Not specified"),
                    "years_of_experience": point.payload.get("years_of_experience", "Not specified"),
                    "skills": point.payload.get("skills", []),
                    "responsibility_sentences": point.payload.get("responsibility_sentences", []),
                    "extracted_text": point.payload.get("extracted_text", ""),
                    "structured_info": point.payload.get("structured_info", {}),
                    "embedding_strategy": point.payload.get("embedding_strategy", "legacy")
                }
                all_jds.append(jd_data)
            
            if next_offset is None:
                break
            offset = next_offset
        
        logger.info(f"Found {len(all_jds)} JDs in database")
        return all_jds
        
    except Exception as e:
        logger.error(f"Error listing JDs: {str(e)}")
        return []
