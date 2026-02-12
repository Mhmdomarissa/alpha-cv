# Backend Architecture

## Overview
Production-ready FastAPI application for CV analysis and job matching with AI-powered features.

## Directory Structure

```
alpha-backend/
├── app/                          # Main application package
│   ├── __init__.py
│   ├── main.py                   # FastAPI app entry point
│   │
│   ├── core/                     # Core configuration
│   │   ├── __init__.py
│   │   └── config.py             # Application settings (Pydantic)
│   │
│   ├── config/                   # Feature-specific configuration
│   │   ├── __init__.py
│   │   └── rate_limiter.py       # Rate limiting configuration
│   │
│   ├── db/                       # Database layer
│   │   ├── __init__.py
│   │   └── auth_db.py            # Authentication database (SQLModel)
│   │
│   ├── models/                   # SQLModel database models
│   │   ├── __init__.py
│   │   └── user.py               # User model
│   │
│   ├── schemas/                   # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── auth.py               # Authentication schemas
│   │   ├── careers.py            # Job posting schemas
│   │   └── matching.py           # Matching schemas
│   │
│   ├── routes/                    # API route handlers
│   │   ├── admin_routes.py       # Admin user management
│   │   ├── auth_routes.py        # Authentication endpoints
│   │   ├── careers_routes.py     # Job postings & applications
│   │   ├── cv_routes.py          # CV upload & management
│   │   ├── email_routes.py       # Email processing
│   │   ├── jd_routes.py          # Job description management
│   │   ├── monitoring_routes.py  # System monitoring
│   │   ├── performance_routes.py # Performance metrics
│   │   ├── special_routes.py     # Matching endpoints
│   │   └── storage_routes.py     # File storage endpoints
│   │
│   ├── services/                  # Business logic services
│   │   ├── azure_email_service.py      # Azure email integration
│   │   ├── careers_service.py           # Job posting business logic
│   │   ├── email_cv_processor.py        # CV extraction from emails
│   │   ├── email_database_service.py    # Email database operations
│   │   ├── email_otp_service.py         # OTP email sending
│   │   ├── email_scheduler.py           # Email processing scheduler
│   │   ├── embedding_service.py         # Vector embeddings (OpenAI)
│   │   ├── enhanced_job_queue.py        # Advanced job queue
│   │   ├── job_queue.py                  # Basic job queue
│   │   ├── llm_matching_service.py      # LLM-based matching
│   │   ├── llm_service.py                # LLM operations (OpenAI)
│   │   ├── matching_service.py           # Core matching algorithm
│   │   ├── otp_service.py                # OTP generation/validation
│   │   ├── parsing_service.py            # Document parsing (PDF/DOCX)
│   │   ├── performance_optimizer.py     # Performance tuning
│   │   ├── s3_storage.py                 # File storage (local/S3)
│   │   └── smart_load_balancer.py        # Load balancing
│   │
│   ├── helpers/                   # Route helper utilities
│   │   ├── __init__.py
│   │   └── careers_helpers.py    # Careers route helpers
│   │
│   ├── utils/                     # Utility functions
│   │   ├── __init__.py
│   │   ├── cache.py               # Caching utilities
│   │   ├── llm_enhancement.py     # LLM text enhancement
│   │   ├── qdrant_pool.py         # Qdrant connection pooling
│   │   ├── qdrant_utils.py        # Qdrant operations
│   │   ├── redis_cache.py         # Redis caching
│   │   └── security.py            # Security utilities (JWT, hashing)
│   │
│   ├── middleware/                # FastAPI middleware
│   │   ├── __init__.py
│   │   ├── api_analytics.py       # API analytics tracking
│   │   └── rate_limiter.py        # Rate limiting middleware
│   │
│   ├── deps/                      # FastAPI dependencies
│   │   ├── __init__.py
│   │   └── auth.py                # Authentication dependencies
│   │
│   └── tasks/                     # Background tasks (future)
│       └── README.md
│
├── tests/                         # Test suite
│   ├── conftest.py                # Pytest fixtures
│   ├── test_auth_db.py            # Database tests
│   ├── test_auth_routes.py        # Auth route tests
│   ├── test_matching_service.py   # Matching service tests
│   ├── test_security.py           # Security utility tests
│   └── ...
│
├── uploads/                       # File uploads (gitignored)
│   ├── cvs/
│   └── jds/
│
├── Dockerfile                     # Docker build configuration
├── requirements.txt               # Python dependencies
├── pytest.ini                    # Pytest configuration
└── sonar-project.properties      # SonarQube configuration
```

## Architecture Layers

### 1. Presentation Layer (`routes/`)
- **Purpose**: Handle HTTP requests/responses
- **Responsibilities**:
  - Request validation (via Pydantic schemas)
  - Authentication/authorization (via `deps/`)
  - Response formatting
  - Error handling
- **Pattern**: Thin controllers, delegate to services

### 2. Application Layer (`services/`)
- **Purpose**: Business logic and orchestration
- **Responsibilities**:
  - Business rules implementation
  - Service coordination
  - Data transformation
  - External API integration
- **Pattern**: Stateless services with dependency injection

### 3. Domain Layer (`models/`, `schemas/`)
- **Purpose**: Domain models and data contracts
- **Responsibilities**:
  - Data models (SQLModel for DB, Pydantic for API)
  - Validation rules
  - Type definitions

### 4. Infrastructure Layer (`db/`, `utils/`)
- **Purpose**: Technical implementations
- **Responsibilities**:
  - Database access
  - External service clients (Qdrant, Redis, OpenAI)
  - Caching
  - Security utilities

## Key Design Patterns

### Dependency Injection
Services use factory functions (`get_*_service()`) for lazy initialization:
```python
from app.services.embedding_service import get_embedding_service

embedding_service = get_embedding_service()
```

### Service Locator Pattern
Services are accessed via getter functions rather than direct instantiation, enabling:
- Lazy initialization
- Singleton behavior
- Easy testing (mockable)

### Repository Pattern
Database access is abstracted through SQLModel models and session management in `db/auth_db.py`.

## Data Flow

### CV Upload Flow
1. `cv_routes.py` receives upload request
2. `parsing_service.py` extracts text from PDF/DOCX
3. `llm_service.py` standardizes CV format
4. `embedding_service.py` generates vector embeddings
5. `qdrant_utils.py` stores in Qdrant collections
6. Response returned to client

### Matching Flow
1. `special_routes.py` receives match request
2. `matching_service.py` retrieves embeddings from Qdrant
3. Cosine similarity calculation (Hungarian algorithm)
4. Business rules applied
5. Results formatted and returned

### Authentication Flow
1. `auth_routes.py` receives login request
2. `auth_db.py` validates credentials
3. `otp_service.py` generates OTP (for non-admin users)
4. `email_otp_service.py` sends OTP email
5. JWT token generated via `security.py`
6. Token returned to client

## External Dependencies

- **Qdrant**: Vector database for embeddings storage
- **OpenAI API**: LLM operations and embeddings
- **Redis**: Caching layer
- **Azure**: Email sending (Microsoft Graph API)
- **SQLite/PostgreSQL**: Authentication database

## Configuration

All configuration via environment variables (see `.env.example`):
- `app/core/config.py`: Main application settings
- `app/config/rate_limiter.py`: Rate limiting configuration

## Testing

- **Location**: `tests/`
- **Framework**: pytest
- **Coverage**: Target 70%+
- **Run**: `pytest` or `scripts/testing/run_tests.sh`

## Security

- JWT authentication (`utils/security.py`)
- Password hashing (bcrypt via passlib)
- Rate limiting (`middleware/rate_limiter.py`)
- Input validation (Pydantic schemas)
- SQL injection protection (SQLModel ORM)

## Performance

- Connection pooling (Qdrant, Redis)
- Caching layer (`utils/cache.py`)
- Async/await for I/O operations
- Background job processing (`services/job_queue.py`)
- Load balancing (`services/smart_load_balancer.py`)
