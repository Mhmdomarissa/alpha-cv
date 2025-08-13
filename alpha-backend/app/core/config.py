"""
Backend Configuration Management Following Best Practices
Centralized configuration with validation, type safety, and environment-based settings
"""

import os
from typing import Optional, List
from functools import lru_cache
from pydantic import validator, Field
from pydantic_settings import BaseSettings
from enum import Enum

class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class Settings(BaseSettings):
    """Application settings with validation and type safety."""
    
    # App Configuration
    app_name: str = Field(default="CV Job Matching API", description="Application name")
    app_version: str = Field(default="1.0.0", description="Application version")
    environment: Environment = Field(default=Environment.DEVELOPMENT, description="Runtime environment")
    debug: bool = Field(default=False, description="Debug mode")
    
    # Server Configuration
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")
    reload: bool = Field(default=False, description="Auto-reload on code changes")
    workers: int = Field(default=1, description="Number of worker processes")
    
    # Logging Configuration
    log_level: LogLevel = Field(default=LogLevel.INFO, description="Logging level")
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        description="Log format string"
    )
    
    # CORS Configuration
    cors_origins: List[str] = Field(
        default=["*"], 
        description="Allowed CORS origins"
    )
    cors_allow_credentials: bool = Field(default=True, description="Allow CORS credentials")
    cors_allow_methods: List[str] = Field(
        default=["*"], 
        description="Allowed CORS methods"
    )
    cors_allow_headers: List[str] = Field(
        default=["*"], 
        description="Allowed CORS headers"
    )
    
    # OpenAI Configuration
    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API key", validation_alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", description="OpenAI model to use")
    openai_max_tokens: int = Field(default=2000, description="Max tokens for OpenAI requests")
    openai_temperature: float = Field(default=0.1, description="OpenAI temperature setting")
    
    # Qdrant Configuration
    qdrant_host: str = Field(default="qdrant", description="Qdrant host", validation_alias="QDRANT_HOST")
    qdrant_port: int = Field(default=6333, description="Qdrant port")
    qdrant_grpc_port: int = Field(default=6334, description="Qdrant gRPC port")
    qdrant_api_key: Optional[str] = Field(default=None, description="Qdrant API key")
    qdrant_timeout: int = Field(default=30, description="Qdrant connection timeout")
    
    # Database Configuration (if using PostgreSQL)
    database_url: Optional[str] = Field(default=None, description="Database connection URL", validation_alias="POSTGRES_URI")
    database_pool_size: int = Field(default=20, description="Database connection pool size")
    
    # File Processing Configuration
    max_file_size: int = Field(default=10 * 1024 * 1024, description="Maximum file size (10MB)")
    supported_extensions: List[str] = Field(
        default=['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg'],
        description="Supported file extensions"
    )
    upload_dir: str = Field(default="uploaded_files", description="Upload directory")
    
    # AI/ML Configuration
    embedding_model: str = Field(default="all-mpnet-base-v2", description="Sentence transformer model")
    embedding_batch_size: int = Field(default=32, description="Batch size for embeddings")
    similarity_threshold: float = Field(default=0.7, description="Similarity threshold for matching")
    
    # Security Configuration
    secret_key: str = Field(default="your-secret-key-change-in-production", description="Secret key for JWT")
    access_token_expire_minutes: int = Field(default=30, description="Access token expiration")
    algorithm: str = Field(default="HS256", description="JWT algorithm")
    
    # Rate Limiting
    rate_limit_requests: int = Field(default=100, description="Rate limit requests per minute")
    rate_limit_window: int = Field(default=60, description="Rate limit window in seconds")
    
    # Monitoring and Health Checks
    health_check_interval: int = Field(default=30, description="Health check interval in seconds")
    metrics_enabled: bool = Field(default=True, description="Enable metrics collection")
    
    # Validators
    @validator('environment', pre=True)
    def validate_environment(cls, v):
        if isinstance(v, str):
            return Environment(v.lower())
        return v
    
    @validator('openai_temperature')
    def validate_temperature(cls, v):
        if not 0.0 <= v <= 2.0:
            raise ValueError('Temperature must be between 0.0 and 2.0')
        return v
    
    @validator('similarity_threshold')
    def validate_similarity_threshold(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError('Similarity threshold must be between 0.0 and 1.0')
        return v
    
    @validator('cors_origins', pre=True)
    def validate_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    # Property methods for computed values
    @property
    def is_development(self) -> bool:
        return self.environment == Environment.DEVELOPMENT
    
    @property
    def is_production(self) -> bool:
        return self.environment == Environment.PRODUCTION
    
    @property
    def qdrant_url(self) -> str:
        return f"http://{self.qdrant_host}:{self.qdrant_port}"
    
    @property
    def openai_configured(self) -> bool:
        return bool(self.openai_api_key)
    
    @property
    def database_configured(self) -> bool:
        return bool(self.database_url)
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore"  # Ignore extra fields to prevent validation errors
    }

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

# Global settings instance
settings = get_settings()

# Helper functions
def is_development() -> bool:
    """Check if running in development mode."""
    return settings.is_development

def is_production() -> bool:
    """Check if running in production mode."""
    return settings.is_production

def get_cors_config() -> dict:
    """Get CORS configuration."""
    return {
        "allow_origins": settings.cors_origins,
        "allow_credentials": settings.cors_allow_credentials,
        "allow_methods": settings.cors_allow_methods,
        "allow_headers": settings.cors_allow_headers,
    }