from passlib.context import CryptContext
import jwt
from jwt import InvalidTokenError
from datetime import datetime, timedelta
from app.core.config import settings

# Support both argon2 and bcrypt for password verification
# bcrypt is needed for existing passwords, argon2 for new ones
# Disable bcrypt bug detection to avoid false positives
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"], 
    deprecated="auto",
    bcrypt__ident="2b"  # Use bcrypt 2b identifier
)
ALGO = "HS256"

def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)

def verify_password(pw: str, pw_hash: str) -> bool:
    try:
        # For bcrypt hashes, handle the bug detection issue
        if pw_hash and pw_hash.startswith("$2"):
            # Import bcrypt directly to avoid passlib's bug detection
            try:
                import bcrypt
                # Extract the salt and hash from the stored hash
                # Format: $2b$12$salt22charshash31chars
                if len(pw_hash) >= 60:
                    # Verify using bcrypt directly
                    pw_bytes = pw.encode('utf-8')
                    hash_bytes = pw_hash.encode('utf-8')
                    return bcrypt.checkpw(pw_bytes, hash_bytes)
            except ImportError:
                # Fallback to passlib if bcrypt not available
                pass
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.debug(f"Direct bcrypt verification failed: {e}, falling back to passlib")
        
        # Use passlib for argon2 or as fallback
        return pwd_context.verify(pw, pw_hash)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Password verification error: {e}")
        return False

def create_access_token(sub: str, role: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRES_MIN)
    payload = {"sub": sub, "role": role, "exp": exp, "alg": ALGO}  # Explicitly set algorithm
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGO)

def decode_token(token: str) -> dict:
    try:
        # Explicitly reject 'none' algorithm
        decoded = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[ALGO],
            options={
                "verify_signature": True,
                "verify_exp": True,
                "require": ["exp", "sub", "role"]  # Require these claims
            }
        )
        
        # Additional validation: reject if algorithm in payload is 'none'
        header = jwt.get_unverified_header(token)
        if header.get("alg", "").lower() == "none":
            raise InvalidTokenError("Algorithm 'none' not allowed")
        
        return decoded
    except jwt.ExpiredSignatureError:
        raise InvalidTokenError("Token expired")
    except jwt.InvalidTokenError as e:
        raise InvalidTokenError(f"Invalid token: {str(e)}")