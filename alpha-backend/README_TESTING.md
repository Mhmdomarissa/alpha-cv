# 🧪 Testing Guide

This document explains how to run tests and achieve code coverage for the Alpha CV Analyzer backend.

## 📋 Prerequisites

1. Install testing dependencies:
```bash
pip install -r requirements.txt
```

This will install:
- `pytest` - Testing framework
- `pytest-cov` - Coverage reporting
- `pytest-asyncio` - Async test support
- `pytest-mock` - Mocking utilities
- `httpx` - HTTP client for testing

## 🚀 Running Tests

### Run All Tests
```bash
pytest
```

### Run Tests with Coverage Report
```bash
pytest --cov=app --cov-report=html --cov-report=term
```

This will:
- Run all tests
- Generate coverage report in terminal
- Generate HTML coverage report in `htmlcov/` directory

### Run Specific Test Files
```bash
# Run security tests
pytest tests/test_security.py

# Run authentication route tests
pytest tests/test_auth_routes.py

# Run database tests
pytest tests/test_auth_db.py
```

### Run Tests by Marker
```bash
# Run only unit tests
pytest -m unit

# Run only integration tests
pytest -m integration

# Run only security tests
pytest -m security

# Run only authentication tests
pytest -m auth
```

### Run Tests Verbosely
```bash
pytest -v
```

### Run Tests with Output
```bash
pytest -s
```

## 📊 Coverage Reports

### View HTML Coverage Report
After running tests with coverage, open:
```
htmlcov/index.html
```

### Coverage Target
- **Current Target**: 70%+ coverage
- **Critical Modules**: Must have 80%+ coverage
  - `app/utils/security.py`
  - `app/routes/auth_routes.py`
  - `app/db/auth_db.py`

### Check Coverage
```bash
pytest --cov=app --cov-report=term-missing
```

The `--cov-fail-under=70` flag in `pytest.ini` will fail the test run if coverage is below 70%.

## 🧩 Test Structure

```
tests/
├── conftest.py          # Shared fixtures and configuration
├── test_security.py     # Security utilities tests (JWT, password hashing)
├── test_auth_routes.py  # Authentication API endpoint tests
├── test_auth_db.py      # Database operation tests
└── test_matching_service.py  # Matching service tests (existing)
```

## 📝 Writing New Tests

### Test File Template
```python
"""
Tests for [module name]
"""
import pytest
from unittest.mock import Mock, patch

@pytest.mark.unit
class TestYourModule:
    """Test your module functionality."""
    
    def test_something(self):
        """Test description."""
        # Arrange
        # Act
        # Assert
        assert True
```

### Using Fixtures
```python
def test_with_fixture(db_session, mock_user):
    """Test using fixtures from conftest.py."""
    # Use db_session for database operations
    # Use mock_user for user-related tests
    pass
```

### Markers
Use markers to categorize tests:
- `@pytest.mark.unit` - Unit tests
- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.security` - Security-related tests
- `@pytest.mark.auth` - Authentication tests
- `@pytest.mark.slow` - Slow-running tests

## 🔧 Configuration

Test configuration is in `pytest.ini`:
- Test paths: `tests/`
- Coverage: 70% minimum
- Async mode: auto
- Reports: terminal, HTML, XML

## 🐛 Debugging Tests

### Run Single Test
```bash
pytest tests/test_security.py::TestPasswordHashing::test_hash_password_creates_hash
```

### Run with Print Statements
```bash
pytest -s tests/test_security.py
```

### Run with PDB (Python Debugger)
```bash
pytest --pdb tests/test_security.py
```

## ✅ Test Checklist

Before committing, ensure:
- [ ] All tests pass: `pytest`
- [ ] Coverage is above 70%: `pytest --cov=app`
- [ ] No linting errors
- [ ] New code has corresponding tests
- [ ] Tests are well-documented

## 📈 Current Test Coverage

Run tests to see current coverage:
```bash
pytest --cov=app --cov-report=term-missing
```

### Modules with Tests
- ✅ `app/utils/security.py` - Comprehensive tests
- ✅ `app/routes/auth_routes.py` - API endpoint tests
- ✅ `app/db/auth_db.py` - Database operation tests
- ✅ `app/services/matching_service.py` - Existing tests

### Modules Needing Tests
- ⏳ `app/utils/qdrant_utils.py`
- ⏳ `app/routes/cv_routes.py`
- ⏳ `app/routes/jd_routes.py`
- ⏳ Other service modules

## 🚨 Common Issues

### Issue: Import Errors
**Solution**: Ensure you're running tests from the `alpha-backend` directory:
```bash
cd alpha-backend
pytest
```

### Issue: Database Connection Errors
**Solution**: Tests use in-memory SQLite database. No external database needed.

### Issue: Async Test Failures
**Solution**: Ensure you use `@pytest.mark.asyncio` for async tests.

### Issue: Mock Not Working
**Solution**: Ensure you're patching the correct import path (where it's used, not where it's defined).

## 📚 Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Pytest-Cov Documentation](https://pytest-cov.readthedocs.io/)
- [Python Mocking Guide](https://docs.python.org/3/library/unittest.mock.html)
