# Backend File Structure Guide

## Quick Navigation

### 🎯 Entry Points
- **`app/main.py`** - FastAPI application entry point, route registration

### 📋 Configuration
- **`app/core/config.py`** - Main application settings (Pydantic)
- **`app/config/rate_limiter.py`** - Rate limiting configuration
- **`requirements.txt`** - Python dependencies
- **`pytest.ini`** - Test configuration
- **`Dockerfile`** - Container build config

### 🗄️ Database & Models
- **`app/db/auth_db.py`** - Database initialization & session management
- **`app/models/user.py`** - User SQLModel
- **`app/schemas/`** - Pydantic request/response models

### 🛣️ API Routes
- **`app/routes/auth_routes.py`** - Login, OTP, JWT authentication
- **`app/routes/admin_routes.py`** - User management (admin only)
- **`app/routes/cv_routes.py`** - CV upload, processing, management
- **`app/routes/jd_routes.py`** - Job description management
- **`app/routes/careers_routes.py`** - Job postings & public applications
- **`app/routes/special_routes.py`** - Matching endpoints
- **`app/routes/email_routes.py`** - Email processing
- **`app/routes/storage_routes.py`** - File storage endpoints
- **`app/routes/monitoring_routes.py`** - Health checks, metrics
- **`app/routes/performance_routes.py`** - Performance monitoring

### 🔧 Services (Business Logic)
**Email Services:**
- `azure_email_service.py` - Azure/Microsoft Graph email integration
- `email_otp_service.py` - OTP email sending
- `email_cv_processor.py` - Extract CVs from emails
- `email_database_service.py` - Email database operations
- `email_scheduler.py` - Email processing scheduler

**Matching Services:**
- `matching_service.py` - Core matching algorithm (Hungarian, cosine similarity)
- `llm_matching_service.py` - LLM-enhanced matching

**Core Services:**
- `parsing_service.py` - Document parsing (PDF, DOCX, OCR)
- `embedding_service.py` - Vector embeddings (OpenAI)
- `llm_service.py` - LLM operations (OpenAI API)
- `otp_service.py` - OTP generation/validation
- `careers_service.py` - Job posting business logic

**Queue & Performance:**
- `job_queue.py` - Basic job queue
- `enhanced_job_queue.py` - Advanced queue with prioritization
- `performance_optimizer.py` - Performance tuning
- `smart_load_balancer.py` - Load balancing

**Storage:**
- `s3_storage.py` - File storage (local filesystem or S3)

### 🛠️ Utilities
- **`app/utils/security.py`** - JWT, password hashing
- **`app/utils/qdrant_utils.py`** - Qdrant vector database operations
- **`app/utils/qdrant_pool.py`** - Qdrant connection pooling
- **`app/utils/cache.py`** - Caching layer
- **`app/utils/redis_cache.py`** - Redis caching
- **`app/utils/llm_enhancement.py`** - LLM text enhancement

### 🎁 Helpers
- **`app/helpers/careers_helpers.py`** - Helper functions for careers routes

### 🛡️ Middleware
- **`app/middleware/rate_limiter.py`** - Rate limiting middleware
- **`app/middleware/api_analytics.py`** - API analytics tracking

### 🔐 Dependencies
- **`app/deps/auth.py`** - FastAPI auth dependencies (`require_user`, `require_admin`)

### 🧪 Tests
- **`tests/conftest.py`** - Pytest fixtures
- **`tests/test_*.py`** - Test files

### 📜 Scripts
- **`scripts/testing/run_tests.sh`** - Run tests (Bash)
- **`scripts/testing/run_tests.ps1`** - Run tests (PowerShell)

## File Size Guidelines

### ✅ Well-Sized Files
- Route files: < 500 lines (extract helpers if larger)
- Service files: < 1000 lines (split if larger)
- Utility files: < 500 lines

### ⚠️ Large Files (Consider Refactoring)
- `app/utils/qdrant_utils.py` - 1,987 lines (consider splitting)
- `app/services/matching_service.py` - 1,646 lines (consider splitting)
- `app/routes/careers_routes.py` - 1,450 lines (helpers extracted, could extract more)
- `app/routes/cv_routes.py` - 1,523 lines (extract helpers)
- `app/routes/special_routes.py` - 1,158 lines (extract helpers)

## Import Patterns

### Service Access
```python
from app.services.embedding_service import get_embedding_service
service = get_embedding_service()
```

### Route Helpers
```python
from app.helpers.careers_helpers import generate_public_token, validate_file_upload
```

### Utilities
```python
from app.utils.security import hash_password, create_token
from app.utils.qdrant_utils import get_qdrant_utils
```

### Dependencies
```python
from app.deps.auth import require_user, require_admin
```

## Best Practices

1. **Keep routes thin** - Delegate to services
2. **Services are stateless** - Use dependency injection
3. **Use schemas** - Validate all inputs/outputs
4. **Extract helpers** - Keep route files < 500 lines
5. **Document imports** - Use clear import paths
6. **Test coverage** - Aim for 70%+
