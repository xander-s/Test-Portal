import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl

class Settings(BaseSettings):
    PROJECT_NAME: str = "Enterprise Online Test Portal"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "super-secret-development-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite+aiosqlite:///{os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../testportal.db'))}"
    )
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Storage / S3 / MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_NAME: str = "testportal-media"
    
    # SAP SuccessFactors Integration
    SAP_BASE_URL: Optional[str] = None
    SAP_CLIENT_ID: Optional[str] = None
    SAP_CLIENT_SECRET: Optional[str] = None
    SAP_TOKEN_URL: Optional[str] = None
    
    # Stripe / Razorpay Webhooks
    STRIPE_API_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    
    # AI Config
    SELF_HOSTED_AI_URL: str = "http://localhost:11434"
    AI_MODEL_NAME: str = "llama3"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
