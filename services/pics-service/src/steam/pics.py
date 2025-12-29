"""PICS-specific operations for fetching Steam app data."""

import logging
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Generator, List, Optional

from .client import PICSSteamClient

logger = logging.getLogger(__name__)


@dataclass
class PICSChange:
    """Represents a PICS change notification."""

    change_number: int
    app_changes: List[int]
    package_changes: List[int]


class PICSFetcher:
    """Handles PICS data fetching operations."""

    BATCH_SIZE = 200  # Apps per request (PICS supports up to ~300)
    REQUEST_DELAY = 0.5  # Seconds between batches (conservative)

    def __init__(self, client: PICSSteamClient, batch_size: int = None, request_delay: float = None):
        self._client = client
        self.batch_size = batch_size or self.BATCH_SIZE
        self.request_delay = request_delay or self.REQUEST_DELAY

    def fetch_apps_batch(self, appids: List[int]) -> Dict[int, Dict[str, Any]]:
        """
        Fetch PICS data for a batch of apps.

        Args:
            appids: List of app IDs to fetch (max ~200 recommended)

        Returns:
            Dict mapping appid to PICS data
        """
        if not self._client.is_connected:
            raise RuntimeError("Not connected to Steam")

        try:
            response = self._client.client.get_product_info(apps=appids)

            if response is None:
                logger.warning(f"No response for batch starting at {appids[0] if appids else 'empty'}")
                return {}

            return response.get("apps", {})
        except Exception as e:
            logger.error(f"Error fetching PICS data: {e}")
            raise

    def fetch_all_apps(
        self,
        appids: List[int],
        batch_callback: Optional[Callable[[Dict, int, int], None]] = None,
    ) -> Generator[Dict[int, Dict], None, None]:
        """
        Fetch PICS data for all apps in batches.

        Yields batches of app data as they're fetched.
        At ~200 apps/request and 2 req/sec, 70k apps takes ~3 minutes.

        Args:
            appids: List of all app IDs to fetch
            batch_callback: Optional callback(result, processed, total) after each batch

        Yields:
            Dict mapping appid to PICS data for each batch
        """
        total_apps = len(appids)
        processed = 0

        for i in range(0, total_apps, self.batch_size):
            batch = appids[i : i + self.batch_size]

            try:
                result = self.fetch_apps_batch(batch)
                processed += len(batch)

                logger.info(
                    f"Fetched {processed}/{total_apps} apps ({processed / total_apps * 100:.1f}%)"
                )

                if batch_callback:
                    batch_callback(result, processed, total_apps)

                yield result

                # Rate limiting
                time.sleep(self.request_delay)

            except Exception as e:
                logger.error(f"Batch failed at offset {i}: {e}")
                # Continue with next batch after delay
                time.sleep(2)

    def get_changes_since(self, change_number: int) -> Optional[PICSChange]:
        """
        Get changes since the specified change number.

        Args:
            change_number: Last known change number (0 for initial)

        Returns:
            PICSChange with new change_number and list of changed app IDs
        """
        if not self._client.is_connected:
            raise RuntimeError("Not connected to Steam")

        try:
            response = self._client.client.get_changes_since(
                change_number,
                app_changes=True,
                package_changes=False,  # We only care about apps
            )

            if response is None:
                return None

            return PICSChange(
                change_number=response.current_change_number,
                app_changes=[c.appid for c in response.app_changes],
                package_changes=[],
            )
        except Exception as e:
            logger.error(f"Error getting PICS changes: {e}")
            return None
