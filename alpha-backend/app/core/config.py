"""Application core configuration.

Defines typed settings loaded from environment variables using pydantic.
Only readability/docstrings and import ordering adjusted; behavior unchanged.
"""

import os
import sys

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from `.env` and environment variables."""
    ENABLE_AUTH: bool = True
    AUTH_DB_URL: str = "sqlite:///./auth.db"

    # --- Candidate Tracker (isolated relational store) ---
    # IMPORTANT: This is intentionally separate from AUTH_DB_URL and any Qdrant data.
    ENABLE_CANDIDATE_TRACKER: bool = False
    TRACKER_DB_URL: str = ""
    # Extra safety: in non-production, refuse to connect to a URL that "looks like" prod
    # unless explicitly overridden.
    ALLOW_PROD_DATA_ACCESS: bool = False
    TRACKER_PROD_URL_HINTS: str = ""  # comma-separated substrings to treat as production (e.g. "rds.amazonaws.com,alphacv")
    
    # --- Auth / JWT ---
    # Accept both current and legacy env var names to reduce config drift.
    SECRET_KEY: str = Field(
        default="change-me",
        validation_alias=AliasChoices("SECRET_KEY", "JWT_SECRET_KEY"),
    )
    ACCESS_TOKEN_EXPIRES_MIN: int = Field(
        default=720,
        validation_alias=AliasChoices(
            "ACCESS_TOKEN_EXPIRES_MIN",
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
        ),
    )

    # --- Admin bootstrap user ---
    # Used by `init_auth_db()` to seed the initial admin user if missing.
    ADMIN_USERNAME: str = Field(
        default="admin",
        validation_alias=AliasChoices("ADMIN_USERNAME", "DEFAULT_ADMIN_USERNAME"),
    )
    ADMIN_PASSWORD: str = Field(
        default="admin",
        validation_alias=AliasChoices("ADMIN_PASSWORD", "DEFAULT_ADMIN_PASSWORD"),
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        env = (os.getenv("ENVIRONMENT") or os.getenv("NODE_ENV") or "development").lower()

        # Security check: reject default secrets in production
        if env == "production":
            if self.SECRET_KEY == "change-me":
                print("❌ CRITICAL: SECRET_KEY not set in production!")
                print("Set SECRET_KEY (or JWT_SECRET_KEY) environment variable immediately.")
                sys.exit(1)  # Fail fast in production

            if self.ADMIN_USERNAME == "admin" and self.ADMIN_PASSWORD == "admin":
                print("❌ CRITICAL: ADMIN_USERNAME/ADMIN_PASSWORD are still default in production!")
                print("Set ADMIN_USERNAME and ADMIN_PASSWORD environment variables immediately.")
                sys.exit(1)
        else:
            # Development: keep defaults but warn loudly so it doesn't accidentally ship.
            if self.SECRET_KEY == "change-me":
                print(f"⚠️  WARNING: Using default SECRET_KEY in {env} environment")
                print("Generate secure key: python -c 'import secrets; print(secrets.token_urlsafe(32))'")


settings = Settings()


def _env_truthy(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def is_otp_email_sending_disabled() -> bool:
    """When True, login OTP is not emailed; a fixed code is used (dev only).

    Read from ``OTP_DISABLE_EMAIL`` on each call so tests and runtime env changes apply
    without relying on a cached ``Settings()`` instance.
    """
    return _env_truthy("OTP_DISABLE_EMAIL")


def get_otp_fixed_code() -> str:
    """Fixed OTP when email sending is disabled (``OTP_FIXED_CODE``, default ``123456``)."""
    return os.getenv("OTP_FIXED_CODE", "123456").strip() or "123456"


def get_otp_from_email() -> str:
    """Mailbox used as Graph ``/users/{id}/sendMail`` sender (application permission)."""
    return os.getenv("OTP_FROM_EMAIL", "cv@alphadatarecruitment.ae").strip() or "cv@alphadatarecruitment.ae"


def get_otp_from_name() -> str:
    return os.getenv("OTP_FROM_NAME", "Alpha CV System").strip() or "Alpha CV System"