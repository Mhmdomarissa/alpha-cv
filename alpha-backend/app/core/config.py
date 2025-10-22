"""Application core configuration.

Defines typed settings loaded from environment variables using pydantic.
Only readability/docstrings and import ordering adjusted; behavior unchanged.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
import secrets
import sys

class Settings(BaseSettings):
    """Runtime settings loaded from `.env` and environment variables."""
    ENABLE_AUTH: bool = True
    AUTH_DB_URL: str = "sqlite:///./auth.db"
    
    # SECRET_KEY validation
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRES_MIN: int = 720

    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Security check: reject default SECRET_KEY in production
        if self.SECRET_KEY == "change-me":
            import os
            env = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "production"))
            
            if env == "production":
                print("❌ CRITICAL: SECRET_KEY not set in production!")
                print("Set SECRET_KEY environment variable immediately.")
                sys.exit(1)  # Fail fast in production
            else:
                print(f"⚠️  WARNING: Using default SECRET_KEY in {env} environment")
                print("Generate secure key: python -c 'import secrets; print(secrets.token_urlsafe(32))'")

settings = Settings()