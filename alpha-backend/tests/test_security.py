"""
Comprehensive unit tests for app/utils/security.py

Tests cover:
- Password hashing and verification
- JWT token creation and validation
- Security vulnerabilities (algorithm 'none' rejection)
- Token expiration handling
"""
import pytest
import jwt
from datetime import datetime, timedelta
from unittest.mock import patch, Mock
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    ALGO
)
from app.utils.security import InvalidTokenError
from app.core.config import settings


@pytest.mark.unit
@pytest.mark.security
class TestPasswordHashing:
    """Test password hashing functionality."""
    
    def test_hash_password_creates_hash(self):
        """Test that hash_password creates a non-empty hash."""
        password = "test_password_123"
        hash_result = hash_password(password)
        
        assert hash_result is not None
        assert len(hash_result) > 0
        assert hash_result != password  # Should not be plain text
    
    def test_hash_password_different_for_same_password(self):
        """Test that same password produces different hashes (salt)."""
        password = "test_password_123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        # Hashes should be different due to salt
        assert hash1 != hash2
    
    def test_verify_password_correct(self):
        """Test password verification with correct password."""
        password = "test_password_123"
        password_hash = hash_password(password)
        
        result = verify_password(password, password_hash)
        assert result is True
    
    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password."""
        password = "test_password_123"
        wrong_password = "wrong_password"
        password_hash = hash_password(password)
        
        result = verify_password(wrong_password, password_hash)
        assert result is False
    
    def test_verify_password_empty_password(self):
        """Test password verification with empty password."""
        password_hash = hash_password("some_password")
        
        result = verify_password("", password_hash)
        assert result is False
    
    def test_verify_password_invalid_hash(self):
        """Test password verification with invalid hash."""
        result = verify_password("password", "invalid_hash_format")
        assert result is False
    
    def test_verify_password_none_hash(self):
        """Test password verification with None hash."""
        result = verify_password("password", None)
        assert result is False


@pytest.mark.unit
@pytest.mark.security
class TestJWTTokenCreation:
    """Test JWT token creation."""
    
    def test_create_access_token_creates_valid_token(self):
        """Test that create_access_token creates a valid JWT."""
        username = "testuser"
        role = "user"
        
        token = create_access_token(username, role)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_create_access_token_contains_claims(self):
        """Test that token contains required claims."""
        username = "testuser"
        role = "admin"
        
        token = create_access_token(username, role)
        
        # Decode without verification to check claims
        decoded = jwt.decode(token, options={"verify_signature": False})
        
        assert decoded["sub"] == username
        assert decoded["role"] == role
        assert "exp" in decoded
        assert "alg" in decoded
    
    def test_create_access_token_expiration(self):
        """Test that token has expiration claim."""
        username = "testuser"
        role = "user"
        
        token = create_access_token(username, role)
        decoded = jwt.decode(token, options={"verify_signature": False})
        
        exp_timestamp = decoded["exp"]
        exp_datetime = datetime.fromtimestamp(exp_timestamp)
        now = datetime.utcnow()
        
        # Expiration should be in the future
        assert exp_datetime > now
        # Should be approximately ACCESS_TOKEN_EXPIRES_MIN minutes from now
        expected_exp = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRES_MIN)
        time_diff = abs((exp_datetime - expected_exp).total_seconds())
        assert time_diff < 60  # Within 1 minute tolerance


@pytest.mark.unit
@pytest.mark.security
class TestJWTTokenDecoding:
    """Test JWT token decoding and validation."""
    
    def test_decode_token_valid_token(self):
        """Test decoding a valid token."""
        username = "testuser"
        role = "user"
        
        token = create_access_token(username, role)
        decoded = decode_token(token)
        
        assert decoded["sub"] == username
        assert decoded["role"] == role
        assert "exp" in decoded
    
    def test_decode_token_invalid_signature(self):
        """Test that token with invalid signature is rejected."""
        # Create a token with wrong secret
        wrong_secret = "wrong_secret_key"
        payload = {
            "sub": "testuser",
            "role": "user",
            "exp": datetime.utcnow() + timedelta(minutes=30)
        }
        invalid_token = jwt.encode(payload, wrong_secret, algorithm=ALGO)
        
        with pytest.raises(InvalidTokenError):
            decode_token(invalid_token)
    
    def test_decode_token_expired(self):
        """Test that expired token is rejected."""
        # Create an expired token
        payload = {
            "sub": "testuser",
            "role": "user",
            "exp": datetime.utcnow() - timedelta(minutes=1)  # Expired 1 minute ago
        }
        expired_token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGO)
        
        with pytest.raises(InvalidTokenError) as exc_info:
            decode_token(expired_token)
        
        assert "expired" in str(exc_info.value).lower()
    
    def test_decode_token_missing_claims(self):
        """Test that token missing required claims is rejected."""
        # Create token without 'sub' claim
        payload = {
            "role": "user",
            "exp": datetime.utcnow() + timedelta(minutes=30)
        }
        invalid_token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGO)
        
        with pytest.raises(InvalidTokenError):
            decode_token(invalid_token)
    
    def test_decode_token_wrong_algorithm(self):
        """Test that token with wrong algorithm is rejected."""
        # Create token with RS256 instead of HS256
        payload = {
            "sub": "testuser",
            "role": "user",
            "exp": datetime.utcnow() + timedelta(minutes=30)
        }
        # This will fail because we don't have RS256 key, but test the rejection
        try:
            wrong_algo_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="RS256")
        except Exception:
            # If RS256 encoding fails, create a token manually with 'none' algorithm
            # This tests the security fix we made
            pass
        
        # Test with 'none' algorithm token (security vulnerability)
        # Create a token with algorithm 'none' in header
        none_token = jwt.encode(
            payload,
            "",
            algorithm="none",
            headers={"alg": "none"}
        )
        
        # Should be rejected because 'none' is not in allowed algorithms
        with pytest.raises(InvalidTokenError):
            decode_token(none_token)
    
    def test_decode_token_tampered_payload(self):
        """Test that tampered token payload is rejected."""
        # Create valid token
        token = create_access_token("testuser", "user")
        
        # Tamper with the token (modify payload)
        parts = token.split('.')
        if len(parts) == 3:
            # Decode and modify payload
            import base64
            import json
            
            payload = json.loads(base64.urlsafe_b64decode(parts[1] + '=='))
            payload["role"] = "admin"  # Change role
            
            # Re-encode (but signature will be wrong)
            tampered_payload = base64.urlsafe_b64encode(
                json.dumps(payload).encode()
            ).decode().rstrip('=')
            
            tampered_token = f"{parts[0]}.{tampered_payload}.{parts[2]}"
            
            # Should be rejected due to invalid signature
            with pytest.raises(InvalidTokenError):
                decode_token(tampered_token)
    
    def test_decode_token_empty_string(self):
        """Test that empty token string is rejected."""
        with pytest.raises(InvalidTokenError):
            decode_token("")
    
    def test_decode_token_invalid_format(self):
        """Test that invalid token format is rejected."""
        with pytest.raises(InvalidTokenError):
            decode_token("not.a.valid.jwt.token.format")
    
    def test_decode_token_requires_signature_verification(self):
        """Test that decode_token always verifies signature (security fix)."""
        # This test ensures we're not using get_unverified_header
        # The decode_token function should always verify signature
        
        username = "testuser"
        role = "user"
        token = create_access_token(username, role)
        
        # Decode should work with correct secret
        decoded = decode_token(token)
        assert decoded["sub"] == username
        
        # Should fail with wrong secret (proves signature is verified)
        with patch('app.utils.security.settings') as mock_settings:
            mock_settings.SECRET_KEY = "wrong_secret"
            with pytest.raises(InvalidTokenError):
                decode_token(token)


@pytest.mark.unit
@pytest.mark.security
class TestSecurityEdgeCases:
    """Test edge cases and security scenarios."""
    
    def test_hash_password_special_characters(self):
        """Test password hashing with special characters."""
        password = "P@ssw0rd!#$%^&*()"
        hash_result = hash_password(password)
        
        assert hash_result is not None
        assert verify_password(password, hash_result) is True
    
    def test_hash_password_unicode(self):
        """Test password hashing with unicode characters."""
        password = "密码123🔐"
        hash_result = hash_password(password)
        
        assert hash_result is not None
        assert verify_password(password, hash_result) is True
    
    def test_hash_password_very_long(self):
        """Test password hashing with very long password."""
        password = "a" * 1000
        hash_result = hash_password(password)
        
        assert hash_result is not None
        assert verify_password(password, hash_result) is True
    
    def test_token_with_different_roles(self):
        """Test token creation and decoding with different roles."""
        roles = ["user", "admin", "viewer"]
        
        for role in roles:
            token = create_access_token("testuser", role)
            decoded = decode_token(token)
            assert decoded["role"] == role
    
    def test_multiple_tokens_different_users(self):
        """Test creating and decoding multiple tokens for different users."""
        users = [
            ("user1", "user"),
            ("user2", "admin"),
            ("user3", "viewer")
        ]
        
        tokens = []
        for username, role in users:
            token = create_access_token(username, role)
            tokens.append((token, username, role))
        
        # Verify all tokens can be decoded correctly
        for token, username, role in tokens:
            decoded = decode_token(token)
            assert decoded["sub"] == username
            assert decoded["role"] == role
