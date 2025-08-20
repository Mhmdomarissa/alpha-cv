# AI CV Analyzer

An intelligent CV-Job matching system that uses GPT-4 for text analysis and vector similarity search for candidate matching.

## 🚀 Features

- **CV Upload & Processing**: Batch upload up to 500 CVs (PDF/DOCX format)
- **Job Description Processing**: Upload JDs via text or file upload
- **AI-Powered Analysis**: GPT-4 extracts structured data (job title, skills, summary)
- **Smart Matching**: Vector similarity search using OpenAI embeddings
- **Database Storage**: Qdrant vector database for efficient similarity search
- **REST API**: Full FastAPI-based REST API

## 🏗️ Architecture

```
CV/JD Upload → Text Extraction → GPT Analysis → Vector Embedding → Qdrant Storage
                                                      ↓
Frontend ← REST API ← Similarity Search ← Vector Query ← Job Matching
```

## 📋 Workflow

### 1. **CV Processing Pipeline**
- Upload PDF/DOCX files (up to 500 at once)
- Extract text using PyMuPDF/python-docx + OCR fallback
- Send to GPT-4 for structured data extraction:
  - Full Name, Job Title, Email, Phone, Education
  - Skills, Years of Experience, Summary
- Generate embeddings using OpenAI text-embedding-3-small
- Store in Qdrant vector database

### 2. **Job Description Processing**
- Upload JD via text input or PDF/DOCX file
- Extract text and send to GPT-4 for analysis:
  - Job Title, Summary, Skills (key matching fields)
- Generate embeddings for similarity search
- Store in separate Qdrant collection

### 3. **Candidate Matching**
- Query uses **only** Job Title + Summary + Skills for matching
- Generate embedding for the query
- Perform cosine similarity search against CV embeddings
- Return top-K candidates with similarity scores

## 🛠️ Setup & Installation

### Prerequisites
- Docker & Docker Compose
- OpenAI API Key

### Quick Start

1. **Clone and Setup**
```bash
git clone <repository>
cd alpha-backend
```

2. **Environment Configuration**
```bash
# Create .env file
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
```

3. **Run with Docker**
```bash
docker-compose up --build -d
```

4. **Test the Setup**
```bash
python test_workflow.py
```

### Services
- **Backend API**: http://localhost:8000
- **Qdrant Database**: http://localhost:6333
- **PostgreSQL**: localhost:5433

## 📖 API Documentation

### Health Check
```bash
GET /health
```

### CV Upload
```bash
POST /upload/
Content-Type: multipart/form-data

files: [CV files in PDF/DOCX format]
```

### Job Description Upload
```bash
POST /jobs/upload-jd
Content-Type: multipart/form-data

jd_text: "Job description text" (optional)
file: JD file in PDF/DOCX format (optional)
```

### List Job Descriptions
```bash
GET /jobs/jds
```

### Match Candidates
```bash
POST /jobs/match-candidates
Content-Type: application/json

{
  "jd_id": "uuid-of-job-description",
  "top_k": 5
}
```

## 🗂️ Database Schema

### CV Collection (`cvs`)
```json
{
  "filename": "resume.pdf",
  "file_type": "CV",
  "raw_text": "Original extracted text...",
  "upload_time": "2024-01-01T12:00:00Z",
  "job_title": "Senior Software Developer",
  "summary": "Experienced developer with...",
  "skills": ["Python", "FastAPI", "Docker"],
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone_number": "+1-555-0123",
  "education": "B.S. Computer Science",
  "years_of_experience": "5+"
}
```

### JD Collection (`jds`)
```json
{
  "filename": "job_posting.pdf",
  "file_type": "JD", 
  "raw_text": "Original job description...",
  "upload_time": "2024-01-01T12:00:00Z",
  "job_title": "Senior Software Developer",
  "summary": "We are looking for...",
  "skills": ["Python", "FastAPI", "Machine Learning"]
}
```

## 🧪 Testing

The included test script verifies the complete workflow:

```bash
python test_workflow.py
```

Tests cover:
- ✅ API health check
- ✅ JD upload and processing
- ✅ CV upload and processing  
- ✅ JD listing
- ✅ Candidate matching with similarity scores

## 🔧 Configuration

### Environment Variables
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `QDRANT_HOST`: Qdrant host (default: "qdrant")
- `QDRANT_PORT`: Qdrant port (default: 6333)

### Limits
- **Max CV batch size**: 500 files
- **Max file size**: 10MB for CVs, 5MB for JDs
- **Supported formats**: PDF, DOCX

## 🚨 Key Technical Details

### GPT Processing
- **Model**: GPT-4-turbo
- **Temperature**: 0.2 (for consistent extraction)
- **Error Handling**: Automatic JSON cleaning (removes code blocks)
- **Fallback**: Stores raw response if JSON parsing fails

### Vector Search
- **Embedding Model**: text-embedding-3-small (1536 dimensions)
- **Distance Metric**: Cosine similarity
- **Query Strategy**: Combines job title + summary + skills only

### Error Handling
- File type validation
- Size limit enforcement
- GPT response validation
- Database connection retry logic
- Detailed error reporting per file

## 🐛 Troubleshooting

### Common Issues

1. **"JD collection not found"**
   - Fixed: Collections are now auto-created on startup

2. **"Invalid JSON from GPT"**
   - Fixed: Automatic cleaning of GPT responses

3. **"Qdrant connection failed"**
   - Wait for services: `docker-compose logs qdrant`

4. **"OpenAI API key missing"**
   - Set in .env file: `OPENAI_API_KEY=sk-...`

### Logs
```bash
# Backend logs
docker-compose logs backend

# Qdrant logs  
docker-compose logs qdrant

# All logs
docker-compose logs
```

## 📈 Performance

- **CV Processing**: ~2-3 seconds per CV (including GPT analysis)
- **JD Processing**: ~1-2 seconds per JD
- **Matching**: Sub-second for up to 10K CVs
- **Batch Upload**: Parallel processing for efficiency

## 🔒 Security Notes

- Input validation for file types and sizes
- CORS enabled for development (configure for production)
- No authentication implemented (add as needed)
- File uploads are processed in-memory (consider disk storage for large files) 