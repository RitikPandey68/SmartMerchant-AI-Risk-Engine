import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "SmartMerchant AI Onboarding & Risk Engine"
    ENVIRONMENT: str = "development"
    
    # Security
    SECRET_KEY: str = "supersecretkeychangeinproduction12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # DB & Queue Settings
    DATABASE_URL: str = "sqlite:///./smartmerchant.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # LLM API Keys
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    
    # Webhooks & Core configuration
    WEBHOOK_MAX_RETRIES: int = 3
    WEBHOOK_TIMEOUT: int = 5  # seconds

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgresql")

    @property
    def celery_broker_url(self) -> str:
        # Docker Compose will override REDIS_URL
        return self.REDIS_URL

    @property
    def celery_result_backend(self) -> str:
        return self.REDIS_URL

settings = Settings()
