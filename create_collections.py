#!/usr/bin/env python3
"""
Script to manually create Qdrant collections.
"""

import requests
import json

def create_collection(name, vector_size=768):
    """Create a Qdrant collection."""
    url = f"http://localhost:6333/collections/{name}"
    config = {
        "vectors": {
            "size": vector_size,
            "distance": "Cosine"
        }
    }
    
    try:
        response = requests.put(url, json=config)
        if response.status_code in [200, 201]:
            print(f"✅ Created collection: {name}")
            return True
        elif response.status_code == 400 and "already exists" in response.text:
            print(f"✅ Collection already exists: {name}")
            return True
        else:
            print(f"❌ Failed to create collection {name}: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating collection {name}: {e}")
        return False

def main():
    """Create all required collections."""
    print("🚀 Creating Qdrant Collections...")
    
    collections = [
        "cv_documents",
        "cv_structured", 
        "cv_embeddings",
        "jd_documents",
        "jd_structured",
        "jd_embeddings",
        "job_postings_structured"
    ]
    
    success_count = 0
    for collection in collections:
        if create_collection(collection):
            success_count += 1
    
    print(f"\n📊 Summary: {success_count}/{len(collections)} collections created successfully")
    
    # Test collections
    print("\n🔍 Testing collections...")
    try:
        response = requests.get("http://localhost:6333/collections")
        if response.status_code == 200:
            collections_data = response.json()
            print(f"✅ Found {len(collections_data.get('result', {}).get('collections', []))} collections in Qdrant")
            for col in collections_data.get('result', {}).get('collections', []):
                print(f"   • {col['name']}")
        else:
            print(f"❌ Failed to list collections: {response.status_code}")
    except Exception as e:
        print(f"❌ Error listing collections: {e}")

if __name__ == "__main__":
    main()
