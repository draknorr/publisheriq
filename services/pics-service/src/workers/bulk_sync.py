"""Worker for initial bulk sync of all PICS data."""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..steam.client import PICSSteamClient
from ..steam.pics import PICSFetcher
from ..extractors.common import PICSExtractor
from ..database.operations import PICSDatabase
from ..health.server import HealthServer
from ..config.settings import settings

logger = logging.getLogger(__name__)


class BulkSyncWorker:
    """
    Worker for initial bulk sync of all PICS data.

    Designed to run once to populate database, then hand off to change monitor.
    """

    def __init__(self, health_server: Optional[HealthServer] = None):
        self._steam = PICSSteamClient()
        self._fetcher: Optional[PICSFetcher] = None
        self._extractor = PICSExtractor()
        self._db = PICSDatabase()
        self._health = health_server

    def run(self, app_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Run bulk sync for all apps or specified list.

        Args:
            app_ids: Optional list of specific app IDs to sync.
                     If None, fetches all known app IDs from database.

        Returns:
            Dict with stats: processed, failed, elapsed
        """
        start_time = datetime.utcnow()
        logger.info("Starting PICS bulk sync")

        # Connect to Steam
        if not self._steam.connect():
            raise RuntimeError("Failed to connect to Steam")

        self._fetcher = PICSFetcher(
            self._steam,
            batch_size=settings.bulk_batch_size,
            request_delay=settings.bulk_request_delay,
            timeout=settings.bulk_timeout,
            max_retries=settings.bulk_max_retries,
        )

        # Get app IDs if not provided (only unsynced apps for resume capability)
        if app_ids is None:
            app_ids = self._db.get_all_app_ids(unsynced_only=True)
            logger.info(f"Fetched {len(app_ids)} unsynced app IDs from database")

        if not app_ids:
            logger.warning("No app IDs to sync")
            return {"processed": 0, "failed": 0, "elapsed": 0}

        logger.info(f"Syncing {len(app_ids)} apps")

        # Process stats
        total_processed = 0
        total_failed = 0
        batch_count = 0

        try:
            # Fetch and process in batches
            for batch_data in self._fetcher.fetch_all_apps(app_ids):
                batch_count += 1

                # Extract structured data
                extracted = []
                for appid_str, raw_data in batch_data.items():
                    try:
                        appid = int(appid_str)
                        extracted.append(self._extractor.extract(appid, raw_data))
                    except Exception as e:
                        logger.error(f"Failed to extract app {appid_str}: {e}")
                        total_failed += 1

                # Persist to database
                if extracted:
                    stats = self._db.upsert_apps_batch(extracted)
                    total_processed += stats["updated"]
                    total_failed += stats["failed"]

                # Log progress
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                rate = total_processed / elapsed if elapsed > 0 else 0
                logger.info(
                    f"Batch {batch_count}: {total_processed} processed, "
                    f"{total_failed} failed, {rate:.1f} apps/sec"
                )

                # Update health status
                if self._health:
                    self._health.update_status(
                        {
                            "mode": "bulk_sync",
                            "processed": total_processed,
                            "failed": total_failed,
                            "rate": round(rate, 1),
                            "progress_pct": round(total_processed / len(app_ids) * 100, 1)
                            if app_ids
                            else 0,
                        }
                    )

        finally:
            # Disconnect from Steam
            self._steam.disconnect()

        # Final stats
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        logger.info(
            f"Bulk sync complete in {elapsed:.1f}s: "
            f"{total_processed} processed, {total_failed} failed"
        )

        return {"processed": total_processed, "failed": total_failed, "elapsed": elapsed}
