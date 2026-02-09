#!/usr/bin/env python3
"""Initialize Qdrant collections for development environment"""

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

# Connect to dev Qdrant
client = QdrantClient(host="localhost", port=6335)

# Collection definitions (matching production structure)
collections = {
    "cv_documents": 1,       # Dummy vector for document storage
    "jd_documents": 1,       # Dummy vector for document storage  
    "cv_structured": 1,      # Dummy vector for structured data
    "jd_structured": 1,      # Dummy vector for structured data
    "cv_embeddings": 768,    # all-mpnet-base-v2 dimension
    "jd_embeddings": 768,    # all-mpnet-base-v2 dimension
}

print("🚀 Initializing Qdrant collections for development...")
print()

for collection_name, vector_size in collections.items():
    try:
        # Check if collection exists
        existing = client.get_collections().collections
        exists = any(c.name == collection_name for c in existing)
        
        if exists:
            print(f"✅ Collection '{collection_name}' already exists")
        else:
            # Create collection
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )
            print(f"✨ Created collection '{collection_name}' with vector size {vector_size}")
    except Exception as e:
        print(f"❌ Error with collection '{collection_name}': {e}")

print()
print("🎉 Development Qdrant initialized!")
print("You can now upload CVs and JDs in your dev environment.")
