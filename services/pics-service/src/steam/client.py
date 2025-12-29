"""Steam client wrapper with automatic reconnection."""

import logging
import time
from typing import Optional

from steam.client import SteamClient
from steam.enums import EResult

logger = logging.getLogger(__name__)


class PICSSteamClient:
    """Wrapper around SteamClient with automatic reconnection and health tracking."""

    def __init__(self):
        self._client: Optional[SteamClient] = None
        self._connected = False
        self._last_change_number: int = 0
        self._reconnect_attempts = 0
        self._max_reconnect_attempts = 5
        self._reconnect_delay = 5  # seconds

    def connect(self) -> bool:
        """Establish anonymous connection to Steam."""
        self._client = SteamClient()

        # Register event handlers
        @self._client.on("disconnected")
        def on_disconnected():
            self._on_disconnected()

        @self._client.on("error")
        def on_error(result):
            self._on_error(result)

        result = self._client.anonymous_login()

        if result == EResult.OK:
            self._connected = True
            self._reconnect_attempts = 0
            logger.info("Successfully connected to Steam anonymously")
            return True
        else:
            logger.error(f"Failed to connect to Steam: {result}")
            return False

    def reconnect(self) -> bool:
        """Attempt to reconnect with exponential backoff."""
        while self._reconnect_attempts < self._max_reconnect_attempts:
            self._reconnect_attempts += 1
            delay = self._reconnect_delay * (2 ** (self._reconnect_attempts - 1))
            logger.info(f"Reconnection attempt {self._reconnect_attempts}, waiting {delay}s")
            time.sleep(delay)

            # Disconnect existing client if any
            if self._client:
                try:
                    self._client.disconnect()
                except Exception:
                    pass

            if self.connect():
                return True

        logger.error("Max reconnection attempts reached")
        return False

    def disconnect(self):
        """Disconnect from Steam."""
        if self._client:
            try:
                self._client.disconnect()
            except Exception as e:
                logger.warning(f"Error during disconnect: {e}")
            finally:
                self._connected = False

    def _on_disconnected(self):
        """Handle disconnection events."""
        self._connected = False
        logger.warning("Disconnected from Steam")

    def _on_error(self, error):
        """Handle error events."""
        logger.error(f"Steam client error: {error}")

    @property
    def is_connected(self) -> bool:
        """Check if connected to Steam."""
        return self._connected and self._client is not None

    @property
    def client(self) -> SteamClient:
        """Get the underlying Steam client."""
        if not self._client:
            raise RuntimeError("Steam client not initialized")
        return self._client

    @property
    def last_change_number(self) -> int:
        """Get the last known PICS change number."""
        return self._last_change_number

    @last_change_number.setter
    def last_change_number(self, value: int):
        """Set the last known PICS change number."""
        self._last_change_number = value
