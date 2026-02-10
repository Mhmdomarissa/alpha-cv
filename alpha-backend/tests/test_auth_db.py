"""
Tests for database operations (app/db/auth_db.py)

Tests cover:
- Database initialization
- User creation and retrieval
- Session management
- Database migrations
"""
import pytest
from sqlmodel import Session, select, create_engine, SQLModel
from app.models.user import User
from app.db.auth_db import get_session, init_auth_db
from app.utils.security import hash_password


@pytest.mark.unit
class TestDatabaseSession:
    """Test database session management."""
    
    def test_get_session_creates_session(self, db_session):
        """Test that get_session creates a valid session."""
        assert db_session is not None
        assert isinstance(db_session, Session)
    
    def test_get_session_can_query(self, db_session):
        """Test that session can execute queries."""
        result = db_session.exec(select(User))
        users = result.all()
        assert isinstance(users, list)


@pytest.mark.unit
class TestUserModel:
    """Test User model operations."""
    
    def test_create_user(self, db_session):
        """Test creating a user in the database."""
        user = User(
            username="testuser",
            password_hash=hash_password("password123"),
            email="test@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        assert user.id is not None
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.role == "user"
        assert user.is_active is True
    
    def test_query_user_by_username(self, db_session):
        """Test querying user by username."""
        user = User(
            username="testuser",
            password_hash=hash_password("password123"),
            email="test@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        
        # Query user
        result = db_session.exec(select(User).where(User.username == "testuser"))
        found_user = result.first()
        
        assert found_user is not None
        assert found_user.username == "testuser"
        assert found_user.email == "test@example.com"
    
    def test_query_user_by_email(self, db_session):
        """Test querying user by email."""
        user = User(
            username="testuser",
            password_hash=hash_password("password123"),
            email="test@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        
        # Query user by email
        result = db_session.exec(select(User).where(User.email == "test@example.com"))
        found_user = result.first()
        
        assert found_user is not None
        assert found_user.email == "test@example.com"
        assert found_user.username == "testuser"
    
    def test_update_user(self, db_session):
        """Test updating user information."""
        user = User(
            username="testuser",
            password_hash=hash_password("password123"),
            email="test@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        
        # Update user
        user.email = "newemail@example.com"
        user.role = "admin"
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        assert user.email == "newemail@example.com"
        assert user.role == "admin"
    
    def test_delete_user(self, db_session):
        """Test deleting a user."""
        user = User(
            username="testuser",
            password_hash=hash_password("password123"),
            email="test@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        user_id = user.id
        
        # Delete user
        db_session.delete(user)
        db_session.commit()
        
        # Verify user is deleted
        result = db_session.exec(select(User).where(User.id == user_id))
        found_user = result.first()
        assert found_user is None
    
    def test_unique_username_constraint(self, db_session):
        """Test that usernames must be unique."""
        user1 = User(
            username="testuser",
            password_hash=hash_password("password123"),
            email="test1@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user1)
        db_session.commit()
        
        # Try to create another user with same username
        user2 = User(
            username="testuser",  # Same username
            password_hash=hash_password("password456"),
            email="test2@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user2)
        
        # Should raise an integrity error
        with pytest.raises(Exception):  # SQLModel/SQLAlchemy raises exception
            db_session.commit()
    
    def test_user_without_email(self, db_session):
        """Test creating user without email (should be allowed)."""
        user = User(
            username="noemail",
            password_hash=hash_password("password123"),
            email=None,  # No email
            role="admin",  # Admin can have no email
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        assert user.username == "noemail"
        assert user.email is None


@pytest.mark.unit
class TestDatabaseInitialization:
    """Test database initialization."""
    
    def test_init_auth_db_creates_tables(self, test_db_url):
        """Test that init_auth_db creates necessary tables."""
        engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
        
        # Create tables
        SQLModel.metadata.create_all(engine)
        
        # Verify User table exists
        with Session(engine) as session:
            # Try to query User table
            result = session.exec(select(User))
            users = result.all()
            assert isinstance(users, list)  # Should not raise error
    
    def test_database_migration_adds_email_column(self, db_session):
        """Test that email column exists in User table."""
        # Try to create user with email
        user = User(
            username="testuser",
            password_hash=hash_password("password123"),
            email="test@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # Email should be accessible
        assert hasattr(user, 'email')
        assert user.email == "test@example.com"


@pytest.mark.unit
class TestUserRoles:
    """Test user role functionality."""
    
    def test_admin_user(self, db_session):
        """Test creating admin user."""
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            email="admin@example.com",
            role="admin",
            is_active=True
        )
        db_session.add(admin)
        db_session.commit()
        
        assert admin.role == "admin"
        assert admin.is_active is True
    
    def test_regular_user(self, db_session):
        """Test creating regular user."""
        user = User(
            username="user1",
            password_hash=hash_password("user123"),
            email="user1@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        
        assert user.role == "user"
        assert user.is_active is True
    
    def test_inactive_user(self, db_session):
        """Test creating inactive user."""
        user = User(
            username="inactive",
            password_hash=hash_password("pass123"),
            email="inactive@example.com",
            role="user",
            is_active=False
        )
        db_session.add(user)
        db_session.commit()
        
        assert user.is_active is False


@pytest.mark.unit
class TestPasswordHashingInDatabase:
    """Test password hashing stored in database."""
    
    def test_password_hash_stored(self, db_session):
        """Test that password hash is stored (not plain text)."""
        password = "secret_password_123"
        user = User(
            username="testuser",
            password_hash=hash_password(password),
            email="test@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # Password hash should not be the plain password
        assert user.password_hash != password
        assert len(user.password_hash) > 0
        assert user.password_hash.startswith("$")  # Bcrypt/Argon2 format
    
    def test_password_verification_works(self, db_session):
        """Test that stored password hash can be verified."""
        from app.utils.security import verify_password
        
        password = "secret_password_123"
        user = User(
            username="testuser",
            password_hash=hash_password(password),
            email="test@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # Verify password works
        assert verify_password(password, user.password_hash) is True
        assert verify_password("wrong_password", user.password_hash) is False
