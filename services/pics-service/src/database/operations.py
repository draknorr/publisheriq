"""Database operations for PICS data."""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

from .client import SupabaseClient
from ..extractors.common import ExtractedPICSData, Association

logger = logging.getLogger(__name__)

STEAM_TAGS_URL = "https://store.steampowered.com/tagdata/populartags/english"

# Genre ID → Name mapping (from Steam PICS data)
GENRE_NAMES: Dict[int, str] = {
    1: "Action",
    2: "Strategy",
    3: "RPG",
    4: "Casual",
    5: "Racing",
    9: "Racing",
    12: "Sports",
    18: "Sports",
    23: "Indie",
    25: "Adventure",
    28: "Simulation",
    29: "Massively Multiplayer",
    37: "Free to Play",
    51: "Animation & Modeling",
    53: "Design & Illustration",
    54: "Education",
    55: "Software Training",
    56: "Utilities",
    57: "Video Production",
    58: "Web Publishing",
    59: "Game Development",
    60: "Photo Editing",
    70: "Early Access",
    71: "Audio Production",
    72: "Accounting",
    81: "Documentary",
    82: "Episodic",
    83: "Feature Film",
    84: "Short",
    85: "Benchmark",
    86: "VR",
    87: "360 Video",
}

# Category ID → Name mapping (Steam feature categories)
CATEGORY_NAMES: Dict[int, str] = {
    1: "Multi-player",
    2: "Single-player",
    9: "Co-op",
    20: "MMO",
    22: "Steam Achievements",
    23: "Steam Cloud",
    27: "Cross-Platform Multiplayer",
    28: "Full Controller Support",
    29: "Steam Trading Cards",
    30: "Steam Workshop",
    35: "In-App Purchases",
    36: "Online PvP",
    37: "Online Co-op",
    38: "Local Co-op",
    41: "Shared/Split Screen",
    42: "Partial Controller Support",
    43: "Remote Play on TV",
    44: "Remote Play Together",
    45: "Captions Available",
    46: "LAN PvP",
    47: "LAN Co-op",
    48: "HDR",
    49: "VR Supported",
    50: "VR Only",
    51: "Steam China Workshop",
    52: "Tracked Controller Support",
    53: "Family Sharing",
    55: "Timeline Support",
    56: "GPU Recording",
    57: "Cloud Gaming",
    59: "Co-op Campaigns",
    60: "Steam Overlay Support",
    61: "Remote Play on Phone",
    62: "Remote Play on Tablet",
}


class PICSDatabase:
    """Database operations for PICS data."""

    UPSERT_BATCH_SIZE = 500
    _tag_name_cache: Dict[int, str] = {}  # Class-level cache

    def __init__(self):
        self._db = SupabaseClient.get_instance()
        self._load_tag_names()

    def _load_tag_names(self):
        """Load Steam tag names from API (cached at class level)."""
        if PICSDatabase._tag_name_cache:
            return  # Already loaded

        try:
            logger.info("Loading Steam tag names from API...")
            response = httpx.get(STEAM_TAGS_URL, timeout=30.0)
            response.raise_for_status()
            tags = response.json()
            PICSDatabase._tag_name_cache = {t["tagid"]: t["name"] for t in tags}
            logger.info(f"Loaded {len(PICSDatabase._tag_name_cache)} Steam tag names")
        except Exception as e:
            logger.warning(f"Failed to load Steam tag names: {e}")

    def _get_tag_name(self, tag_id: int) -> str:
        """Get tag name from cache, or fallback to placeholder."""
        return PICSDatabase._tag_name_cache.get(tag_id, f"Tag {tag_id}")

    def upsert_apps_batch(self, apps: List[ExtractedPICSData]) -> Dict[str, int]:
        """
        Upsert a batch of apps with their relationships.

        Returns stats dict with created/updated/failed counts.
        """
        stats = {"created": 0, "updated": 0, "failed": 0}

        # Prepare app records
        app_records = []
        build_failures = 0
        for app in apps:
            record = self._build_app_record(app)
            if record:
                app_records.append(record)
            else:
                build_failures += 1

        logger.info(f"Built {len(app_records)} records from {len(apps)} apps ({build_failures} build failures)")

        # Upsert apps in batches
        for i in range(0, len(app_records), self.UPSERT_BATCH_SIZE):
            batch = app_records[i : i + self.UPSERT_BATCH_SIZE]
            try:
                self._db.client.table("apps").upsert(batch, on_conflict="appid").execute()
                stats["updated"] += len(batch)
            except Exception as e:
                logger.error(f"Failed to upsert app batch: {e}")
                stats["failed"] += len(batch)

        # Process relationships
        self._sync_relationships(apps)

        return stats

    def _build_app_record(self, app: ExtractedPICSData) -> Optional[Dict[str, Any]]:
        """Build a database record from extracted PICS data."""
        try:
            return {
                "appid": app.appid,
                # Only update name/type if they exist (don't overwrite with None)
                **({"name": app.name} if app.name else {}),
                **({"type": self._map_app_type(app.type)} if app.type else {}),
                # PICS-specific fields
                "pics_review_score": app.review_score,
                "pics_review_percentage": app.review_percentage,
                "controller_support": app.controller_support,
                "metacritic_score": app.metacritic_score,
                "metacritic_url": app.metacritic_url,
                "platforms": ",".join(app.platforms) if app.platforms else None,
                "release_state": app.release_state,
                "parent_appid": app.parent_appid,
                "homepage_url": app.homepage_url,
                "app_state": app.app_state,
                "last_content_update": (
                    app.last_update_timestamp.isoformat() if app.last_update_timestamp else None
                ),
                "current_build_id": app.current_build_id,
                "content_descriptors": app.content_descriptors if app.content_descriptors else None,
                "languages": app.languages if app.languages else None,
                "has_workshop": app.has_workshop,
                "is_free": app.is_free,
                # Release date from PICS
                **(
                    {"release_date": app.steam_release_date.date().isoformat()}
                    if app.steam_release_date
                    else {}
                ),
                "is_released": app.release_state == "released",
                "updated_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Failed to build record for app {app.appid}: {e}")
            return None

    def _sync_relationships(self, apps: List[ExtractedPICSData]):
        """Sync developer/publisher/tag/genre/category/franchise relationships."""
        processed_appids = []

        for app in apps:
            try:
                # Steam Deck compatibility
                if app.steam_deck:
                    self._upsert_steam_deck(app.appid, app.steam_deck)

                # Categories
                if app.categories:
                    self._sync_categories(app.appid, app.categories)

                # Genres
                if app.genres:
                    self._sync_genres(app.appid, app.genres, app.primary_genre)

                # Store tags
                if app.store_tags:
                    self._sync_store_tags(app.appid, app.store_tags)

                # Franchises from associations
                franchises = [a for a in app.associations if a.type == "franchise"]
                for franchise in franchises:
                    self._upsert_franchise_link(app.appid, franchise.name)

                # Mark as successfully processed
                processed_appids.append(app.appid)

            except Exception as e:
                logger.error(f"Failed to sync relationships for app {app.appid}: {e}")

        # Batch update sync status for all processed apps
        if processed_appids:
            self._batch_update_sync_status(processed_appids)

    def _upsert_steam_deck(self, appid: int, deck: "SteamDeckCompatibility"):
        """Upsert Steam Deck compatibility data."""
        from ..extractors.common import SteamDeckCompatibility

        category_map = {0: "unknown", 1: "unsupported", 2: "playable", 3: "verified"}

        try:
            self._db.client.table("app_steam_deck").upsert(
                {
                    "appid": appid,
                    "category": category_map.get(deck.category, "unknown"),
                    "test_timestamp": (
                        datetime.fromtimestamp(deck.test_timestamp).isoformat()
                        if deck.test_timestamp
                        else None
                    ),
                    "tested_build_id": deck.tested_build_id,
                    "tests": deck.tests,
                    "updated_at": datetime.utcnow().isoformat(),
                },
                on_conflict="appid",
            ).execute()
        except Exception as e:
            logger.error(f"Failed to upsert Steam Deck data for {appid}: {e}")

    def _sync_categories(self, appid: int, categories: Dict[int, bool]):
        """Sync app categories."""
        try:
            # Delete existing
            self._db.client.table("app_categories").delete().eq("appid", appid).execute()

            # Get enabled category IDs
            enabled_cat_ids = [cat_id for cat_id, enabled in categories.items() if enabled]
            if not enabled_cat_ids:
                return

            # Batch upsert categories into lookup table
            cat_records = [
                {"category_id": cat_id, "name": CATEGORY_NAMES.get(cat_id, f"Category {cat_id}")}
                for cat_id in enabled_cat_ids
            ]
            self._db.client.table("steam_categories").upsert(cat_records, on_conflict="category_id").execute()

            # Insert new
            records = [{"appid": appid, "category_id": cat_id} for cat_id in enabled_cat_ids]
            self._db.client.table("app_categories").insert(records).execute()
        except Exception as e:
            logger.error(f"Failed to sync categories for {appid}: {e}")

    def _sync_genres(self, appid: int, genres: List[int], primary_genre: Optional[int]):
        """Sync app genres."""
        try:
            # Delete existing
            self._db.client.table("app_genres").delete().eq("appid", appid).execute()

            if not genres:
                return

            # Batch upsert genres into lookup table
            genre_records = [
                {"genre_id": genre_id, "name": GENRE_NAMES.get(genre_id, f"Genre {genre_id}")}
                for genre_id in genres
            ]
            self._db.client.table("steam_genres").upsert(genre_records, on_conflict="genre_id").execute()

            # Insert new
            records = [
                {"appid": appid, "genre_id": genre_id, "is_primary": genre_id == primary_genre}
                for genre_id in genres
            ]
            self._db.client.table("app_genres").insert(records).execute()
        except Exception as e:
            logger.error(f"Failed to sync genres for {appid}: {e}")

    def _sync_store_tags(self, appid: int, tag_ids: List[int]):
        """Sync store tags for an app."""
        try:
            # Delete existing
            self._db.client.table("app_steam_tags").delete().eq("appid", appid).execute()

            if not tag_ids:
                return

            # Batch upsert tags into lookup table
            now = datetime.utcnow().isoformat()
            tag_records = [
                {"tag_id": tag_id, "name": self._get_tag_name(tag_id), "updated_at": now}
                for tag_id in tag_ids
            ]
            self._db.client.table("steam_tags").upsert(tag_records, on_conflict="tag_id").execute()

            # Insert new with rank
            records = [
                {"appid": appid, "tag_id": tag_id, "rank": idx}
                for idx, tag_id in enumerate(tag_ids)
            ]
            self._db.client.table("app_steam_tags").insert(records).execute()
        except Exception as e:
            logger.error(f"Failed to sync store tags for {appid}: {e}")

    def _upsert_franchise_link(self, appid: int, franchise_name: str):
        """Create/update franchise and link to app."""
        try:
            # Upsert franchise
            result = self._db.client.rpc("upsert_franchise", {"p_name": franchise_name}).execute()
            franchise_id = result.data

            if franchise_id:
                # Link to app
                self._db.client.table("app_franchises").upsert(
                    {"appid": appid, "franchise_id": franchise_id},
                    on_conflict="appid,franchise_id",
                ).execute()
        except Exception as e:
            logger.error(f"Failed to link franchise {franchise_name} to {appid}: {e}")

    def _update_sync_status(self, appid: int):
        """Update sync status for an app."""
        try:
            self._db.client.table("sync_status").upsert(
                {"appid": appid, "last_pics_sync": datetime.utcnow().isoformat()},
                on_conflict="appid",
            ).execute()
        except Exception as e:
            logger.error(f"Failed to update sync status for {appid}: {e}")

    def _batch_update_sync_status(self, appids: List[int]):
        """Batch update sync status for multiple apps."""
        if not appids:
            return

        now = datetime.utcnow().isoformat()
        batch_size = 500  # Supabase batch limit

        for i in range(0, len(appids), batch_size):
            batch = appids[i : i + batch_size]
            records = [{"appid": appid, "last_pics_sync": now} for appid in batch]

            try:
                self._db.client.table("sync_status").upsert(
                    records,
                    on_conflict="appid",
                ).execute()
                logger.debug(f"Updated sync status for {len(batch)} apps")
            except Exception as e:
                logger.error(f"Failed to batch update sync status ({len(batch)} apps): {e}")
                # Fallback to individual updates for this batch
                for appid in batch:
                    self._update_sync_status(appid)

    def _map_app_type(self, pics_type: Optional[str]) -> str:
        """Map PICS type to database enum."""
        if not pics_type:
            return "game"
        type_map = {
            "game": "game",
            "dlc": "dlc",
            "demo": "demo",
            "mod": "mod",
            "video": "video",
            "tool": "game",
            "application": "game",
            "hardware": "hardware",
            "music": "music",
        }
        return type_map.get(pics_type.lower(), "game")

    def get_all_app_ids(self, unsynced_only: bool = False) -> List[int]:
        """Get list of app IDs from database.

        Args:
            unsynced_only: If True, only return apps that haven't been PICS synced yet.
        """
        if unsynced_only:
            # Paginate through unsynced apps (Supabase limits to 1000 per request)
            return self._get_unsynced_app_ids_paginated()
        else:
            return self._get_all_app_ids_paginated()

    def _get_unsynced_app_ids_paginated(self) -> List[int]:
        """Get all unsynced app IDs with cursor-based pagination."""
        all_appids = []
        page_size = 1000  # Supabase hard limit
        last_appid = 0

        while True:
            try:
                # Use cursor-based pagination (gt) instead of offset/range
                # Supabase caps range() at 1000 rows regardless of what you specify
                result = (
                    self._db.client.table("sync_status")
                    .select("appid")
                    .is_("last_pics_sync", "null")
                    .gt("appid", last_appid)
                    .order("appid")
                    .limit(page_size)
                    .execute()
                )

                if not result.data:
                    break

                appids = [r["appid"] for r in result.data]
                all_appids.extend(appids)
                last_appid = appids[-1]  # Cursor for next page
                logger.info(f"Fetched {len(appids)} unsynced app IDs (total: {len(all_appids)})")

                if len(appids) < page_size:
                    break

            except Exception as e:
                logger.error(f"Failed to fetch unsynced app IDs after appid {last_appid}: {e}")
                break

        logger.info(f"Total unsynced apps to process: {len(all_appids)}")
        return all_appids

    def _get_all_app_ids_paginated(self) -> List[int]:
        """Get all app IDs with cursor-based pagination."""
        all_appids = []
        page_size = 1000  # Supabase hard limit
        last_appid = 0

        while True:
            try:
                result = (
                    self._db.client.table("apps")
                    .select("appid")
                    .gt("appid", last_appid)
                    .order("appid")
                    .limit(page_size)
                    .execute()
                )

                if not result.data:
                    break

                appids = [r["appid"] for r in result.data]
                all_appids.extend(appids)
                last_appid = appids[-1]

                if len(appids) < page_size:
                    break

            except Exception as e:
                logger.error(f"Failed to fetch app IDs after appid {last_appid}: {e}")
                break

        return all_appids

    def get_last_change_number(self) -> int:
        """Get the last processed PICS change number."""
        try:
            result = (
                self._db.client.table("pics_sync_state")
                .select("last_change_number")
                .eq("id", 1)
                .single()
                .execute()
            )
            return result.data.get("last_change_number", 0) if result.data else 0
        except Exception as e:
            logger.warning(f"Could not get last change number: {e}")
            return 0

    def set_last_change_number(self, change_number: int):
        """Update the last processed PICS change number."""
        try:
            self._db.client.table("pics_sync_state").upsert(
                {
                    "id": 1,
                    "last_change_number": change_number,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).execute()
        except Exception as e:
            logger.error(f"Failed to update change number: {e}")
