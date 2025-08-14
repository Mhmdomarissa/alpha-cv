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
    """Create Qdrant collections with error handling."""
    try:
        client = get_qdrant_client()
        
        # Create CVs collection
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
        
        # Create JDs collection
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
    
    # Truncate text if too long
    if len(cleaned_text) > 8000:
        cleaned_text = cleaned_text[:8000]
        logger.warning(f"Text truncated to 8000 characters for embedding")
    
    logger.info("Generating embedding using embedding service (all-mpnet-base-v2)")
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

def clean_gpt_json(raw: str) -> str:
    """Clean and validate GPT JSON response with enhanced error handling."""
    try:
        if not raw:
            return '{"error": "Empty GPT response"}'
        
        # Remove markdown code blocks
        cleaned = re.sub(r'```(json)?', '', raw, flags=re.IGNORECASE).strip()
        
        # Find JSON boundaries
        json_start = cleaned.find('{')
        json_end = cleaned.rfind('}')
        
        if json_start != -1 and json_end != -1 and json_end > json_start:
            cleaned = cleaned[json_start:json_end + 1]
        
        # Validate JSON
        try:
            json.loads(cleaned)
            return cleaned
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON from GPT: {str(e)}")
            return json.dumps({
                "Full Name": "JSON parsing error",
                "Email": "Not provided in the CV",
                "Phone Number": "Not provided in the CV",
                "Job Title": "Not specified in the CV",
                "Years of Experience": "Not calculable from CV",
                "Skills": "Not specified in the CV",
                "Education": "Not specified in the CV",
                "Summary": "Not specified in the CV"
            })
            
    except Exception as e:
        logger.error(f"Error cleaning GPT JSON: {str(e)}")
        return '{"error": "JSON processing failed"}'

def save_cv_to_qdrant(extracted_text: str, structured_info: str, filename: str) -> str:
    """Save CV to Qdrant with enhanced error handling and consistent field mapping"""
    try:
        client = get_qdrant_client()
        
        # Generate embedding
        embedding = generate_embedding(extracted_text)
        
        # Parse structured info from GPT
        try:
            # Handle both string and dict responses (mock mode returns dict)
            if isinstance(structured_info, dict):
                info = structured_info
            else:
                info = json.loads(structured_info)
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from GPT for {filename}: {structured_info}")
            info = {}
        
        # Generate unique ID
        cv_id = str(uuid.uuid4())
        
        # Extract skills from the correct structure
        skills = ""
        if "skills_analysis" in info and "technical_skills" in info["skills_analysis"]:
            # Extract from complex structure
            tech_skills = info["skills_analysis"]["technical_skills"]
            if isinstance(tech_skills, list):
                skills = ", ".join([skill.get("skill", str(skill)) if isinstance(skill, dict) else str(skill) for skill in tech_skills])
        elif "skills" in info:
            # Extract from simple structure
            skills = str(info["skills"])
        
        # Extract basic info
        basic_info = info.get("basic_info", {})
        
        # Prepare payload with consistent field names and safe defaults
        payload = {
            "extracted_text": extracted_text,
            "filename": filename,
            "upload_date": datetime.utcnow().isoformat(),
            # Map GPT response fields to consistent names with safe defaults
            "full_name": str(basic_info.get("full_name", info.get("full_name", "Not provided in the CV"))).strip(),
            "email": str(basic_info.get("email", info.get("email", "Not provided in the CV"))).strip(),
            "phone": str(basic_info.get("phone", info.get("phone", "Not provided in the CV"))).strip(),
            "job_title": str(basic_info.get("current_job_title", info.get("job_title", "Not specified in the CV"))).strip(),
            "years_of_experience": str(basic_info.get("years_of_experience", info.get("years_of_experience", "Not calculable from CV"))).strip(),
            "skills": skills.strip(),
            "education": str(info.get("education", "Not specified in the CV")).strip(),
            "summary": str(info.get("summary", "Not specified in the CV")).strip(),
            # Store the full structured info for advanced matching
            "structured_info": info
        }
        
        # Store in Qdrant
        client.upsert(
            collection_name="cvs",
            wait=True,
            points=[
                PointStruct(
                    id=cv_id,
                    vector=embedding,
                    payload=payload
                )
            ]
        )
        
        logger.info(f"Successfully saved CV {filename} with ID {cv_id}")
        return cv_id
        
    except Exception as e:
        logger.error(f"Error saving CV to Qdrant: {str(e)}")
        raise

def save_jd_to_qdrant(jd_text: str, structured_info: str, filename: str) -> str:
    """Save JD to Qdrant with enhanced error handling and consistent field mapping"""
    try:
        client = get_qdrant_client()
        
        # Generate embedding
        embedding = generate_embedding(jd_text)
        
        # Parse structured info from GPT
        try:
            # Handle both string and dict responses (mock mode returns dict)
            if isinstance(structured_info, dict):
                info = structured_info
            else:
                info = json.loads(structured_info)
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from GPT for JD {filename}: {structured_info}")
            info = {}
        
        # Generate unique ID
        jd_id = str(uuid.uuid4())
        
        # Extract skills from the correct structure
        skills = ""
        if "required_skills" in info:
            required_skills = info["required_skills"]
            if isinstance(required_skills, str):
                skills = required_skills
            elif isinstance(required_skills, list):
                skills = ", ".join([str(skill) for skill in required_skills])
        
        # Prepare payload with consistent field names and safe defaults
        payload = {
            "jd_text": jd_text,
            "filename": filename,
            "upload_date": datetime.utcnow().isoformat(),
            # Map GPT response fields to consistent names with safe defaults
            "job_title": str(info.get("job_title", "Not specified in the JD")).strip(),
            "company_name": str(info.get("company_name", "Not specified in the JD")).strip(),
            "required_skills": skills.strip(),
            "experience_required": str(info.get("experience_required", "Not specified in the JD")).strip(),
            "job_summary": str(info.get("job_summary", "Not specified in the JD")).strip(),
            "location": str(info.get("location", "Not specified in the JD")).strip(),
            "employment_type": str(info.get("employment_type", "Not specified in the JD")).strip(),
            # Store the full structured info for advanced matching
            "structured_info": info
        }
        
        # Store in Qdrant
        client.upsert(
            collection_name="jds",
            wait=True,
            points=[
                PointStruct(
                    id=jd_id,
                    vector=embedding,
                    payload=payload
                )
            ]
        )
        
        # Clear the list_jds cache since we added a new JD
        list_jds.cache_clear()
        
        logger.info(f"Successfully saved JD {filename} with ID {jd_id}")
        return jd_id
        
    except Exception as e:
        logger.error(f"Error saving JD to Qdrant: {str(e)}")
        raise

def list_cvs() -> List[Dict[str, Any]]:
    """List all CVs from Qdrant with caching for performance"""
    try:
        client = get_qdrant_client()
        
        # Use scroll to get all CVs efficiently
        response = client.scroll(
            collection_name="cvs",
            limit=1000,  # Get more records per request
            with_payload=True,
            with_vectors=False  # Don't fetch vectors to save bandwidth
        )
        
        cvs = []
        for point in response[0]:
            payload = point.payload
            # Parse structured_info if it's stored as string
            structured_info = payload.get("structured_info", {})
            if isinstance(structured_info, str):
                try:
                    structured_info = json.loads(structured_info)
                except json.JSONDecodeError:
                    structured_info = {}
                    
            cvs.append({
                "id": point.id,
                "full_name": payload.get("full_name", "Unknown"),
                "job_title": payload.get("job_title", "Not specified"),
                "email": payload.get("email", "Not provided"),
                "phone": payload.get("phone", "Not provided"),
                "years_of_experience": payload.get("years_of_experience", "Unknown"),
                "skills": payload.get("skills", "Not specified"),
                "education": payload.get("education", "Not specified"),
                "summary": payload.get("summary", "Not specified"),
                "filename": payload.get("filename", "Unknown"),
                "upload_date": payload.get("upload_date", "Unknown"),
                # Add the requested raw and processed data
                "extracted_text": payload.get("extracted_text", ""),
                "structured_info": structured_info
            })
        
        logger.info(f"Retrieved {len(cvs)} CVs from Qdrant")
        return cvs
        
    except Exception as e:
        logger.error(f"Error listing CVs: {str(e)}")
        return []

@lru_cache(maxsize=1)  # Cache for performance
def list_jds() -> List[Dict[str, Any]]:
    """List all JDs from Qdrant with caching for performance"""
    try:
        client = get_qdrant_client()
        
        # Use scroll to get all JDs efficiently
        response = client.scroll(
            collection_name="jds",
            limit=1000,  # Get more records per request
            with_payload=True,
            with_vectors=False  # Don't fetch vectors to save bandwidth
        )
        
        jds = []
        for point in response[0]:
            payload = point.payload
            
            # Parse structured_info if it exists
            structured_info = payload.get("structured_info")
            if isinstance(structured_info, str):
                try:
                    structured_info = json.loads(structured_info)
                except json.JSONDecodeError:
                    structured_info = {}
            elif structured_info is None:
                structured_info = {}
                
            # Extract skills from structured_info if main field is empty
            skills_text = payload.get("required_skills", payload.get("skills", ""))
            if not skills_text and structured_info.get("skills"):
                skills_list = structured_info.get("skills", [])
                if isinstance(skills_list, list):
                    skills_text = ", ".join(skills_list)
                else:
                    skills_text = str(skills_list)
            
            jds.append({
                "id": point.id,
                "job_title": payload.get("job_title", "Not specified"),
                "years_of_experience": payload.get("experience_required", payload.get("years_of_experience", "Not specified")),
                "skills": skills_text or "Not specified",
                "education": payload.get("education", "Not specified"),
                "summary": payload.get("job_summary", payload.get("summary", "Not specified")),
                "filename": payload.get("filename", "Unknown"),
                "upload_date": payload.get("upload_date", "Unknown"),
                # Add the requested raw and processed data
                "extracted_text": payload.get("jd_text", payload.get("extracted_text", "")),
                "structured_info": structured_info
            })
        
        logger.info(f"Retrieved {len(jds)} JDs from Qdrant")
        return jds
        
    except Exception as e:
        logger.error(f"Error listing JDs: {str(e)}")
        return []

def get_cv_by_id(cv_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific CV by ID with optimized retrieval"""
    try:
        client = get_qdrant_client()
        
        # Retrieve specific point by ID
        response = client.retrieve(
            collection_name="cvs",
            ids=[cv_id],
            with_payload=True,
            with_vectors=False
        )
        
        if not response:
            return None
            
        point = response[0]
        payload = point.payload
        
        return {
            "id": point.id,
            "full_name": payload.get("full_name", "Unknown"),
            "job_title": payload.get("job_title", "Not specified"),
            "email": payload.get("email", "Not provided"),
            "phone": payload.get("phone", "Not provided"),
            "years_of_experience": payload.get("years_of_experience", "Unknown"),
            "skills": payload.get("skills", "Not specified"),
            "education": payload.get("education", "Not specified"),
            "summary": payload.get("summary", "Not specified"),
            "filename": payload.get("filename", "Unknown"),
            "upload_date": payload.get("upload_date", "Unknown"),
            "extracted_text": payload.get("extracted_text", "")
        }
        
    except Exception as e:
        logger.error(f"Error retrieving CV {cv_id}: {str(e)}")
        return None

def get_jd_by_id(jd_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific JD by ID with optimized retrieval"""
    try:
        client = get_qdrant_client()
        
        # Retrieve specific point by ID
        response = client.retrieve(
            collection_name="jds",
            ids=[jd_id],
            with_payload=True,
            with_vectors=False
        )
        
        if not response:
            return None
            
        point = response[0]
        payload = point.payload
        
        return {
            "id": point.id,
            "job_title": payload.get("job_title", "Not specified"),
            "years_of_experience": payload.get("years_of_experience", "Not specified"),
            "skills": payload.get("skills", "Not specified"),
            "education": payload.get("education", "Not specified"),
            "summary": payload.get("summary", "Not specified"),
            "filename": payload.get("filename", "Unknown"),
            "upload_date": payload.get("upload_date", "Unknown"),
            "jd_text": payload.get("jd_text", "")
        }
        
    except Exception as e:
        logger.error(f"Error retrieving JD {jd_id}: {str(e)}")
        return None

def delete_cv(cv_id: str) -> bool:
    """Delete a CV by ID with error handling."""
    try:
        client = get_qdrant_client()
        client.delete(collection_name="cvs", points_selector=[cv_id])
        logger.info(f"Successfully deleted CV {cv_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete CV {cv_id}: {str(e)}")
        return False

def delete_jd(jd_id: str) -> bool:
    """Delete a Job Description by ID with error handling."""
    try:
        client = get_qdrant_client()
        client.delete(collection_name="jds", points_selector=[jd_id])
        logger.info(f"Successfully deleted JD {jd_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete JD {jd_id}: {str(e)}")
        return False

def clear_cache():
    """Clear the LRU cache for list operations"""
    list_cvs.cache_clear()
    list_jds.cache_clear()
