from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ENABLE_AUTH: bool = True
    AUTH_DB_URL: str = "sqlite:///./auth.db"
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRES_MIN: int = 720

    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
