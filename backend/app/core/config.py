from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "vynelixai_health"
    auth_jwt_secret: str = ""
    auth_jwt_issuer: str = "vynelixai-health"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    app_env: str = "development"
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, gt=0)
    upload_directory: Path = Path("uploads")

    @field_validator("mongodb_uri", "mongodb_database", "auth_jwt_issuer")
    @classmethod
    def require_nonempty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This setting must not be empty")
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    def validate_security_configuration(self) -> None:
        if len(self.auth_jwt_secret.encode("utf-8")) < 32:
            raise ValueError("AUTH_JWT_SECRET must contain at least 32 bytes")


@lru_cache
def get_settings() -> Settings:
    return Settings()
