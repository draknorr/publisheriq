"""Supabase client wrapper for PICS service."""

import logging
from typing import Optional

from supabase import create_client, Client

from ..config.settings import settings

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Supabase client wrapper for PICS service."""

    _instance: Optional["SupabaseClient"] = None

    def __init__(self):
        self._client: Optional[Client] = None

    @classmethod
    def get_instance(cls) -> "SupabaseClient":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def connect(self) -> Client:
        """Initialize Supabase connection."""
        url = settings.supabase_url
        key = settings.supabase_service_key

        if not url or not key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")

        self._client = create_client(url, key)
        logger.info("Connected to Supabase")
        return self._client

    @property
    def client(self) -> Client:
        """Get the Supabase client, connecting if needed."""
        if self._client is None:
            return self.connect()
        return self._client

    def disconnect(self):
        """Disconnect from Supabase (cleanup)."""
        self._client = None
        logger.info("Disconnected from Supabase")
