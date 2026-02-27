"""Configuration - uses environment variables. No AWS keys required (EC2 IAM role)."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Database
    database_url: str = "postgresql://compliance:compliance@localhost:5432/compliance_scanner"

    # Redis (Celery broker)
    redis_url: str = "redis://localhost:6379/0"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # AWS - uses default credential chain (EC2 IAM role, no keys)
    aws_region: str = "us-east-1"

    # Scheduler
    collection_interval_hours: int = 6
    scan_interval_hours: int = 1

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
