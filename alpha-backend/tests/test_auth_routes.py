"""
Comprehensive tests for authentication routes (app/routes/auth_routes.py)

Tests cover:
- Login endpoint (admin and regular users)
- Password verification
- OTP sending and verification
- Token generation
- Error handling
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from app.models.user import User
from app.utils.security import hash_password, create_access_token
from app.schemas.auth import LoginRequest, VerifyPasswordRequest, SendOTPRequest, VerifyOTPRequest


@pytest.mark.integration
@pytest.mark.auth
class TestLoginEndpoint:
    """Test the /api/auth/login endpoint."""
    
    def test_login_admin_user_success(self, test_client, db_session):
        """Test successful login for admin user."""
        # Add admin user to database
        admin_user = User(
            username="admin",
            password_hash=hash_password("admin123"),
            email="admin@example.com",
            role="admin",
            is_active=True
        )
        db_session.add(admin_user)
        db_session.commit()
        
        response = test_client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["username"] == "admin"
        assert data["role"] == "admin"
    
    def test_login_regular_user_forbidden(self, test_client, db_session):
        """Test that regular users cannot use direct login."""
        # Add regular user to database
        regular_user = User(
            username="user1",
            password_hash=hash_password("user123"),
            email="user1@example.com",
            role="user",
            is_active=True
        )
        db_session.add(regular_user)
        db_session.commit()
        
        response = test_client.post(
            "/api/auth/login",
            json={"username": "user1", "password": "user123"}
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "OTP" in response.json()["detail"]
    
    def test_login_invalid_credentials(self, test_client, db_session):
        """Test login with invalid credentials."""
        response = test_client.post(
            "/api/auth/login",
            json={"username": "nonexistent", "password": "wrong"}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_login_inactive_user(self, test_client, db_session):
        """Test login with inactive user."""
        inactive_user = User(
            username="inactive",
            password_hash=hash_password("pass123"),
            email="inactive@example.com",
            role="admin",
            is_active=False
        )
        db_session.add(inactive_user)
        db_session.commit()
        
        response = test_client.post(
            "/api/auth/login",
            json={"username": "inactive", "password": "pass123"}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.integration
@pytest.mark.auth
class TestVerifyPasswordEndpoint:
    """Test the /api/auth/verify-password endpoint."""
    
    def test_verify_password_admin_user(self, test_client, db_session):
        """Test password verification for admin user (no OTP required)."""
        admin_user = User(
            username="admin",
            password_hash=hash_password("admin123"),
            email="admin@example.com",
            role="admin",
            is_active=True
        )
        db_session.add(admin_user)
        db_session.commit()
        
        response = test_client.post(
            "/api/auth/verify-password",
            json={"username": "admin", "password": "admin123"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["requires_otp"] is False
        assert "message" in data
        # verify-password doesn't return access_token, admin should use /login endpoint
    
    def test_verify_password_regular_user(self, test_client, db_session):
        """Test password verification for regular user (OTP required)."""
        regular_user = User(
            username="user1",
            password_hash=hash_password("user123"),
            email="user1@example.com",
            role="user",
            is_active=True
        )
        db_session.add(regular_user)
        db_session.commit()
        
        response = test_client.post(
            "/api/auth/verify-password",
            json={"username": "user1", "password": "user123"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["requires_otp"] is True
        assert "access_token" not in data
    
    def test_verify_password_invalid_credentials(self, test_client, db_session):
        """Test password verification with invalid credentials."""
        response = test_client.post(
            "/api/auth/verify-password",
            json={"username": "nonexistent", "password": "wrong"}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_verify_password_user_without_email(self, test_client, db_session):
        """Test password verification for user without email (should fail for regular users)."""
        user_no_email = User(
            username="noemail",
            password_hash=hash_password("pass123"),
            email=None,  # No email
            role="user",
            is_active=True
        )
        db_session.add(user_no_email)
        db_session.commit()
        
        response = test_client.post(
            "/api/auth/verify-password",
            json={"username": "noemail", "password": "pass123"}
        )
        
        # Should fail because user has no email for OTP
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.json()["detail"].lower()


@pytest.mark.integration
@pytest.mark.auth
class TestSendOTPEndpoint:
    """Test the /api/auth/send-otp endpoint."""
    
    @pytest.mark.asyncio
    async def test_send_otp_success(self, test_client, db_session, mock_otp_service, mock_email_service):
        """Test successful OTP sending."""
        regular_user = User(
            username="user1",
            password_hash=hash_password("user123"),
            email="user1@example.com",
            role="user",
            is_active=True
        )
        db_session.add(regular_user)
        db_session.commit()
        
        with patch('app.routes.auth_routes.get_otp_service', return_value=mock_otp_service), \
             patch('app.routes.auth_routes.get_email_otp_service', return_value=mock_email_service):
            
            mock_otp_service.generate_otp.return_value = "123456"
            mock_otp_service.store_otp.return_value = None
            # Mock async email service
            async def async_send_email(*args, **kwargs):
                return True
            mock_email_service.send_otp_email = async_send_email
            
            response = test_client.post(
                "/api/auth/send-otp",
                json={"username": "user1", "password": "user123"}
            )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "masked_email" in data
        assert "@" in data["masked_email"]
    
    def test_send_otp_user_not_found(self, test_client, db_session):
        """Test OTP sending for non-existent user."""
        # send-otp requires password field
        response = test_client.post(
            "/api/auth/send-otp",
            json={"username": "nonexistent", "password": "wrong"}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_send_otp_user_without_email(self, test_client, db_session):
        """Test OTP sending for user without email."""
        user_no_email = User(
            username="noemail",
            password_hash=hash_password("pass123"),
            email=None,
            role="user",
            is_active=True
        )
        db_session.add(user_no_email)
        db_session.commit()
        
        response = test_client.post(
            "/api/auth/send-otp",
            json={"username": "noemail", "password": "pass123"}
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.json()["detail"].lower()


@pytest.mark.integration
@pytest.mark.auth
class TestVerifyOTPEndpoint:
    """Test the /api/auth/verify-otp endpoint."""
    
    @pytest.mark.asyncio
    async def test_verify_otp_success(self, test_client, db_session, mock_otp_service):
        """Test successful OTP verification."""
        regular_user = User(
            username="user1",
            password_hash=hash_password("user123"),
            email="user1@example.com",
            role="user",
            is_active=True
        )
        db_session.add(regular_user)
        db_session.commit()
        
        with patch('app.routes.auth_routes.get_otp_service', return_value=mock_otp_service):
            mock_otp_service.verify_otp.return_value = True
            
            response = test_client.post(
                "/api/auth/verify-otp",
                json={"username": "user1", "otp": "123456"}
            )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["username"] == "user1"
    
    @pytest.mark.asyncio
    async def test_verify_otp_invalid(self, test_client, db_session, mock_otp_service):
        """Test OTP verification with invalid OTP."""
        regular_user = User(
            username="user1",
            password_hash=hash_password("user123"),
            email="user1@example.com",
            role="user",
            is_active=True
        )
        db_session.add(regular_user)
        db_session.commit()
        
        with patch('app.routes.auth_routes.get_otp_service', return_value=mock_otp_service):
            mock_otp_service.verify_otp.return_value = False  # Invalid OTP
            
            response = test_client.post(
                "/api/auth/verify-otp",
                json={"username": "user1", "otp": "wrong123"}
            )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "invalid" in response.json()["detail"].lower()
    
    def test_verify_otp_user_not_found(self, test_client, db_session):
        """Test OTP verification for non-existent user."""
        response = test_client.post(
            "/api/auth/verify-otp",
            json={"username": "nonexistent", "otp": "123456"}
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.integration
@pytest.mark.auth
class TestGetCurrentUserEndpoint:
    """Test the /api/auth/me endpoint."""
    
    def test_get_current_user_success(self, test_client, db_session):
        """Test getting current user information."""
        user = User(
            username="user1",
            password_hash=hash_password("user123"),
            email="user1@example.com",
            role="user",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        
        # Create a valid token
        token = create_access_token("user1", "user")
        
        response = test_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "user1"
        assert data["role"] == "user"
        assert data["email"] == "user1@example.com"
    
    def test_get_current_user_unauthorized(self, test_client):
        """Test getting current user without token."""
        response = test_client.get("/api/auth/me")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
