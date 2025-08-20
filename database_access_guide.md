# 🗄️ Database Access Guide - CV Analyzer Project

## **Overview**
Your CV Analyzer project uses two databases:
- **Qdrant Vector Database** (Port 6333) - Stores embeddings and performs similarity search
- **PostgreSQL** (Port 5433) - Stores relational data (currently unused but configured)

---

## **🎯 Qdrant Vector Database Access**

### **Method 1: Web Dashboard (Recommended for Exploration)**
```bash
# Open in browser:
http://localhost:6333/dashboard

# Features:
- Visual collection browser
- Query builder interface  
- Real-time metrics
- Vector visualization
```

### **Method 2: REST API (Programmatic Access)**
```bash
# List all collections
curl http://localhost:6333/collections | jq .

# Get collection details
curl http://localhost:6333/collections/cvs | jq .
curl http://localhost:6333/collections/jds | jq .
curl http://localhost:6333/collections/skills | jq .
curl http://localhost:6333/collections/responsibilities | jq .

# Get collection points (with limit)
curl "http://localhost:6333/collections/cvs/points?limit=5" | jq .

# Search for similar vectors (example)
curl -X POST http://localhost:6333/collections/cvs/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.1, 0.2, ...], 
    "limit": 5,
    "with_payload": true
  }' | jq .
```

### **Method 3: Python Client (Development)**
```python
from qdrant_client import QdrantClient

# Connect to Qdrant
client = QdrantClient(host="localhost", port=6333)

# List collections
collections = client.get_collections()
print(f"Collections: {[c.name for c in collections.collections]}")

# Get points from a collection
points = client.scroll(collection_name="cvs", limit=10, with_payload=True)
for point in points[0]:
    print(f"ID: {point.id}")
    print(f"Filename: {point.payload.get('filename', 'Unknown')}")
    print("---")
```

### **Method 4: Docker Exec (Direct Container Access)**
```bash
# Access Qdrant container
docker exec -it ubuntu_qdrant_1 /bin/sh

# View config and logs
docker logs ubuntu_qdrant_1
```

---

## **🐘 PostgreSQL Database Access**

### **Method 1: Command Line (psql)**
```bash
# Connect to PostgreSQL
docker exec -it ubuntu_postgres_1 psql -U cv_user -d cv_database

# Once connected, useful commands:
\dt              # List tables
\d table_name    # Describe table structure
\l               # List databases
\q               # Quit
```

### **Method 2: Environment Variables**
```bash
# Database connection details from docker-compose.yml:
POSTGRES_DB: cv_database
POSTGRES_USER: cv_user
POSTGRES_PASSWORD: cv_password
HOST: localhost
PORT: 5433 (external), 5432 (internal)
```

### **Method 3: External Client (DBeaver, pgAdmin, etc.)**
```bash
Connection Settings:
Host: localhost
Port: 5433
Database: cv_database
Username: cv_user
Password: cv_password
```

### **Method 4: Python Client**
```python
import psycopg2

# Connect to PostgreSQL
conn = psycopg2.connect(
    host="localhost",
    port=5433,
    database="cv_database",
    user="cv_user", 
    password="cv_password"
)

cursor = conn.cursor()
cursor.execute("SELECT version();")
print(cursor.fetchone())
conn.close()
```

---

## **📊 Current Database Status**

### **Qdrant Collections:**
- **`cvs`**: 35 points (CV documents with embeddings)
- **`jds`**: Job descriptions
- **`skills`**: Individual skill embeddings
- **`responsibilities`**: Individual responsibility embeddings

### **Vector Configuration:**
- **Embedding Size**: 768 dimensions (all-mpnet-base-v2)
- **Distance Metric**: Cosine similarity
- **Storage**: On-disk payload for efficiency

### **PostgreSQL:**
- **Status**: Running but no tables created yet
- **Purpose**: Reserved for user management, audit logs, application metadata

---

## **🔍 Useful Database Queries**

### **Qdrant Data Exploration**
```bash
# Count documents in each collection
curl "http://localhost:6333/collections/cvs" | jq '.result.points_count'
curl "http://localhost:6333/collections/jds" | jq '.result.points_count'

# Get sample CV data
curl "http://localhost:6333/collections/cvs/points?limit=1&with_payload=true" | jq '.result.points[0].payload'

# Search for skills containing "Python"
curl -X POST "http://localhost:6333/collections/skills/points/search" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "must": [
        {"key": "content", "match": {"text": "Python"}}
      ]
    },
    "limit": 5,
    "with_payload": true
  }' | jq .
```

### **Backend API for Database Access**
```bash
# Use your backend API endpoints:
curl "http://localhost:8000/api/jobs/list-cvs" | jq .
curl "http://localhost:8000/api/jobs/list-jds" | jq .
curl "http://localhost:8000/health" | jq .
```

---

## **🛠️ Database Management Commands**

### **Backup Qdrant Data**
```bash
# Qdrant data is stored in Docker volume
docker volume ls | grep qdrant
docker run --rm -v ubuntu_qdrant_data:/data -v $(pwd):/backup alpine tar czf /backup/qdrant_backup.tar.gz /data
```

### **Backup PostgreSQL Data**
```bash
docker exec ubuntu_postgres_1 pg_dump -U cv_user cv_database > cv_database_backup.sql
```

### **Reset Databases (CAUTION)**
```bash
# Stop containers
docker-compose down

# Remove volumes (DELETES ALL DATA)
docker volume rm ubuntu_qdrant_data ubuntu_postgres_data

# Restart
docker-compose up -d
```

---

## **🚀 Quick Start Commands**

```bash
# 1. Check database status
docker-compose ps

# 2. Open Qdrant dashboard
open http://localhost:6333/dashboard

# 3. Quick data check
curl "http://localhost:6333/collections" | jq '.result.collections[].name'

# 4. Connect to PostgreSQL
docker exec -it ubuntu_postgres_1 psql -U cv_user -d cv_database

# 5. View system health
curl "http://localhost:8000/health" | jq .
```

This guide covers all the methods to access and explore your project's databases. The Qdrant web dashboard is the most user-friendly for exploring your vector data!
