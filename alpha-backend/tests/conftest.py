"""
Pytest configuration and shared fixtures for all tests.
"""
import pytest
import os
import sys
from typing import Generator
from unittest.mock import Mock, patch
from sqlmodel import Session, create_engine, SQLModel
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope="session")
def test_db_url(tmp_path_factory):
    """Use file-based SQLite database for testing (in-memory doesn't work with dependency injection)."""
    db_file = tmp_path_factory.mktemp("test_db") / "test.db"
    return f"sqlite:///{db_file}"


@pytest.fixture(scope="function")
def db_engine(test_db_url):
    """Create a test database engine."""
    from app.models.user import User  # Import to register the model
    
    engine = create_engine(
        test_db_url,
        connect_args={"check_same_thread": False},
        echo=False
    )
    # Create all tables including User
    SQLModel.metadata.create_all(engine)
    yield engine
    # Clean up
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(scope="function")
def db_session(db_engine) -> Generator[Session, None, None]:
    """Create a test database session."""
    with Session(db_engine) as session:
        yield session


@pytest.fixture
def test_client(db_session, db_engine) -> TestClient:
    """Create a test client for FastAPI with dependency overrides."""
    from app.db.auth_db import get_session
    from app.models.user import User  # Ensure User model is imported
    
    # Ensure tables are created (in case they weren't)
    SQLModel.metadata.create_all(db_engine)
    
    # Override the get_session dependency to use our test database session
    def override_get_session():
        yield db_session
    
    app.dependency_overrides[get_session] = override_get_session
    
    client = TestClient(app)
    yield client
    
    # Clean up: remove the override after test
    app.dependency_overrides.clear()


@pytest.fixture
def mock_user():
    """Create a mock user object."""
    from app.models.user import User
    from datetime import datetime
    return User(
        id="test-user-id",
        username="testuser",
        password_hash="$2b$12$testhash",  # Mock hash
        email="test@example.com",
        role="user",
        is_active=True,
        created_at=datetime.utcnow()
    )


@pytest.fixture
def mock_admin_user():
    """Create a mock admin user object."""
    from app.models.user import User
    from datetime import datetime
    return User(
        id="test-admin-id",
        username="admin",
        password_hash="$2b$12$testhash",  # Mock hash
        email="admin@example.com",
        role="admin",
        is_active=True,
        created_at=datetime.utcnow()
    )


@pytest.fixture
def mock_secret_key():
    """Mock secret key for JWT testing."""
    return "test-secret-key-for-jwt-tokens-12345"


@pytest.fixture
def mock_settings(monkeypatch, mock_secret_key):
    """Mock settings for testing."""
    monkeypatch.setenv("SECRET_KEY", mock_secret_key)
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRES_MIN", "30")
    return settings


@pytest.fixture
def mock_qdrant_client():
    """Mock Qdrant client for testing."""
    mock_client = Mock()
    mock_client.scroll.return_value = ([], None)
    mock_client.retrieve.return_value = []
    mock_client.get_collection.return_value = Mock(points_count=0)
    return mock_client


@pytest.fixture
def mock_redis_client():
    """Mock Redis client for testing."""
    mock_client = Mock()
    mock_client.get.return_value = None
    mock_client.set.return_value = True
    mock_client.delete.return_value = True
    return mock_client


@pytest.fixture
def mock_otp_service():
    """Mock OTP service for testing."""
    mock_service = Mock()
    mock_service.generate_otp.return_value = "123456"
    mock_service.verify_otp.return_value = True
    mock_service.get_otp.return_value = "123456"
    return mock_service


@pytest.fixture
def mock_email_service():
    """Mock email service for testing."""
    mock_service = Mock()
    mock_service.send_otp_email.return_value = True
    return mock_service


@pytest.fixture(autouse=True)
def reset_environment(monkeypatch):
    """Reset environment variables before each test."""
    # Ensure we're not in production mode
    monkeypatch.delenv("NODE_ENV", raising=False)
    monkeypatch.delenv("LOCAL_AUTH", raising=False)
    yield
    # Cleanup after test
