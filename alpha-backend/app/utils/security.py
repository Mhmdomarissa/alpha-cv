from passlib.context import CryptContext
import jwt
from jwt import InvalidTokenError
from datetime import datetime, timedelta
from app.core.config import settings

# Use only argon2 to avoid bcrypt initialization issues
# We'll handle bcrypt password migration through a separate migration process
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
ALGO = "HS256"

def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)

def verify_password(pw: str, pw_hash: str) -> bool:
    return pwd_context.verify(pw, pw_hash)

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