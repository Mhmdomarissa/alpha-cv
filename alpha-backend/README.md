# CV Analyzer Backend

Production-ready FastAPI backend for AI-powered CV analysis and job matching.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run tests
pytest

# Start development server
uvicorn app.main:app --reload
```

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete architecture overview
- **[STRUCTURE.md](./STRUCTURE.md)** - File structure and navigation guide

## Project Structure

```
alpha-backend/
├── app/              # Main application
│   ├── core/         # Core configuration
│   ├── routes/       # API endpoints
│   ├── services/     # Business logic
│   ├── utils/        # Utilities
│   ├── helpers/      # Route helpers
│   └── ...
├── tests/            # Test suite
└── scripts/          # Utility scripts
```

## Key Features

- 🔐 JWT Authentication with OTP
- 📄 Document parsing (PDF, DOCX, OCR)
- 🤖 LLM-powered CV/JD standardization
- 🔍 Vector-based matching (Qdrant)
- 📧 Email integration (Azure)
- 🚀 High-performance matching algorithms
- 📊 Analytics and monitoring

## Environment Variables

See `.env.example` for required configuration.

## Testing

```bash
# Run all tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific test file
pytest tests/test_auth_routes.py
```

## Development

See [docs/dev/DEV_WORKFLOW_GUIDE.md](../../docs/dev/DEV_WORKFLOW_GUIDE.md) for development guidelines.

## Deployment

See [docs/deployment/DEPLOYMENT_GUIDE.md](../../docs/deployment/DEPLOYMENT_GUIDE.md) for deployment instructions.
