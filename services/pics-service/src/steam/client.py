"""Steam client wrapper with automatic reconnection and heartbeat."""

import logging
from datetime import datetime
from typing import Callable, Optional

import gevent
from steam.client import SteamClient
from steam.enums import EResult

logger = logging.getLogger(__name__)


class PICSSteamClient:
    """Wrapper around SteamClient with automatic reconnection, heartbeat, and health tracking."""

    def __init__(self):
        self._client: Optional[SteamClient] = None
        self._connected = False
        self._last_change_number: int = 0
        self._reconnect_attempts = 0
        self._reconnect_delay = 5  # seconds (base delay)
        self._max_reconnect_delay = 300  # 5 minutes max

        # Connection tracking
        self._connection_time: Optional[datetime] = None
        self._last_activity: Optional[datetime] = None

        # Heartbeat settings
        self._heartbeat_greenlet: Optional[gevent.Greenlet] = None
        self._heartbeat_interval: int = 300  # 5 minutes default

        # Auto-reconnect settings
        self._auto_reconnect: bool = True
        self._reconnecting: bool = False  # Prevent concurrent reconnection attempts

    def connect(self) -> bool:
        """Establish anonymous connection to Steam with heartbeat."""
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
            self._connection_time = datetime.utcnow()
            self._last_activity = datetime.utcnow()
            self._reconnect_attempts = 0
            self._reconnecting = False

            # Start heartbeat to prevent idle disconnect
            self._start_heartbeat()

            logger.info(
                f"Successfully connected to Steam anonymously "
                f"at {self._connection_time.isoformat()}"
            )
            return True
        else:
            logger.error(f"Failed to connect to Steam: {result}")
            return False

    def reconnect(self, max_attempts: int = 0) -> bool:
        """
        Attempt to reconnect with exponential backoff.

        Args:
            max_attempts: Maximum reconnection attempts (0 = unlimited, default)

        Returns:
            True if reconnected successfully
        """
        if self._reconnecting:
            logger.debug("Reconnection already in progress, skipping")
            return False

        self._reconnecting = True
        attempt = 0

        try:
            while max_attempts == 0 or attempt < max_attempts:
                attempt += 1
                delay = min(self._reconnect_delay * (2 ** (attempt - 1)), self._max_reconnect_delay)

                logger.info(
                    f"Reconnection attempt {attempt}"
                    f"{f'/{max_attempts}' if max_attempts else ''}, "
                    f"waiting {delay}s"
                )

                gevent.sleep(delay)

                # Clean up existing client
                self._cleanup_client()

                if self.connect():
                    logger.info(f"Reconnected successfully after {attempt} attempts")
                    return True

                # Reset backoff after 10 failed attempts to avoid getting stuck
                if attempt % 10 == 0:
                    logger.info("Resetting backoff after 10 failed attempts")
                    attempt = 0

            logger.error(f"Failed to reconnect after {max_attempts} attempts")
            return False
        finally:
            self._reconnecting = False

    def disconnect(self):
        """Disconnect from Steam."""
        self._auto_reconnect = False  # Prevent auto-reconnect on intentional disconnect
        self._stop_heartbeat()

        if self._client:
            try:
                self._client.disconnect()
            except Exception as e:
                logger.warning(f"Error during disconnect: {e}")
            finally:
                self._connected = False
                self._client = None

    def _cleanup_client(self):
        """Clean up existing client resources without triggering auto-reconnect."""
        self._stop_heartbeat()
        if self._client:
            try:
                self._client.disconnect()
            except Exception:
                pass
            self._client = None
        self._connected = False

    def _start_heartbeat(self):
        """Start background heartbeat to prevent idle disconnect."""
        if self._heartbeat_greenlet is not None:
            self._stop_heartbeat()

        self._heartbeat_greenlet = gevent.spawn(self._heartbeat_loop)
        logger.info(f"Started heartbeat loop (interval: {self._heartbeat_interval}s)")

    def _stop_heartbeat(self):
        """Stop the heartbeat greenlet."""
        if self._heartbeat_greenlet is not None:
            self._heartbeat_greenlet.kill(block=False)
            self._heartbeat_greenlet = None
            logger.debug("Stopped heartbeat loop")

    def _heartbeat_loop(self):
        """Background loop sending periodic heartbeat requests."""
        while self._connected:
            gevent.sleep(self._heartbeat_interval)

            if self._connected and self._client:
                try:
                    # Use get_changes_since(0) as a lightweight heartbeat
                    self._client.get_changes_since(0, app_changes=False, package_changes=False)
                    self._last_activity = datetime.utcnow()
                    logger.debug(f"Heartbeat successful at {self._last_activity.isoformat()}")
                except Exception as e:
                    logger.warning(f"Heartbeat failed: {e}")
                    # Don't trigger reconnect here - let disconnect handler do it

    def _on_disconnected(self):
        """Handle disconnection events with automatic reconnection."""
        was_connected = self._connected
        self._connected = False
        self._stop_heartbeat()

        # Calculate connection duration
        duration = None
        if self._connection_time:
            duration = (datetime.utcnow() - self._connection_time).total_seconds()

        logger.warning(
            f"Disconnected from Steam "
            f"(was connected: {was_connected}, "
            f"duration: {duration:.1f}s)" if duration else
            f"Disconnected from Steam (was connected: {was_connected})"
        )

        # Trigger auto-reconnection in a new greenlet (non-blocking)
        if self._auto_reconnect and was_connected and not self._reconnecting:
            logger.info("Scheduling automatic reconnection...")
            gevent.spawn(self._auto_reconnect_handler)

    def _auto_reconnect_handler(self):
        """Handle automatic reconnection in background."""
        # Small delay before reconnecting to avoid rapid reconnect loops
        gevent.sleep(2)

        if not self._connected and not self._reconnecting:
            self.reconnect(max_attempts=0)  # Unlimited attempts

    def _on_error(self, error):
        """Handle error events."""
        logger.error(f"Steam client error: {error}")

    # Configuration methods
    def set_heartbeat_interval(self, seconds: int):
        """Set the heartbeat interval in seconds (clamped to 60-600)."""
        self._heartbeat_interval = max(60, min(seconds, 600))
        logger.debug(f"Heartbeat interval set to {self._heartbeat_interval}s")

    def set_auto_reconnect(self, enabled: bool):
        """Enable or disable automatic reconnection on disconnect."""
        self._auto_reconnect = enabled

    # Properties
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
    def connection_age_seconds(self) -> Optional[float]:
        """Get the age of the current connection in seconds."""
        if self._connection_time and self._connected:
            return (datetime.utcnow() - self._connection_time).total_seconds()
        return None

    @property
    def last_change_number(self) -> int:
        """Get the last known PICS change number."""
        return self._last_change_number

    @last_change_number.setter
    def last_change_number(self, value: int):
        """Set the last known PICS change number."""
        self._last_change_number = value
