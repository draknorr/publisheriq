"""Application settings from environment variables."""

from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # Database
    supabase_url: str
    supabase_service_key: str

    # Steam (optional - for authenticated requests)
    steam_username: Optional[str] = None
    steam_password: Optional[str] = None

    # Service configuration
    mode: str = "change_monitor"  # 'bulk_sync' or 'change_monitor'
    port: int = 8080

    # Bulk sync options
    bulk_batch_size: int = 200
    bulk_request_delay: float = 0.5

    # Change monitor options
    poll_interval: int = 30
    process_batch_size: int = 100
    max_queue_size: int = 10000

    # Logging
    log_level: str = "INFO"
    log_json: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
