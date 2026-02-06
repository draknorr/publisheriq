"""Database operations for PICS data."""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

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
# Gathered from Steam Storefront API calls on 30+ games
CATEGORY_NAMES: Dict[int, str] = {
    # Core gameplay modes
    1: "Multi-player",
    2: "Single-player",
    6: "Mods (require HL2)",
    8: "Valve Anti-Cheat enabled",
    9: "Co-op",
    # Steam features
    13: "Captions available",
    14: "Commentary available",
    15: "Stats",
    16: "Includes Source SDK",
    17: "Includes level editor",
    18: "Partial Controller Support",
    19: "Mods",
    20: "MMO",
    21: "Downloadable Content",
    22: "Steam Achievements",
    23: "Steam Cloud",
    24: "Shared/Split Screen",
    25: "Steam Leaderboards",
    # Multiplayer features
    27: "Cross-Platform Multiplayer",
    28: "Full controller support",
    29: "Steam Trading Cards",
    30: "Steam Workshop",
    31: "VR Support",
    32: "Steam Turn Notifications",
    35: "In-App Purchases",
    36: "Online PvP",
    37: "Shared/Split Screen PvP",
    38: "Online Co-op",
    39: "Shared/Split Screen Co-op",
    40: "SteamVR Collectibles",
    41: "Remote Play on Phone",
    42: "Remote Play on Tablet",
    43: "Remote Play on TV",
    44: "Remote Play Together",
    45: "Captions available",
    46: "LAN PvP",
    47: "LAN Co-op",
    48: "LAN Co-op",
    49: "PvP",
    50: "VR Only",
    51: "Steam Workshop",
    52: "Tracked Controller Support",
    53: "VR Supported",
    54: "VR Only",
    # HDR and new features
    55: "Timeline Support",
    56: "GPU Recording",
    57: "Cloud Gaming",
    58: "Steam Input API",
    59: "Co-op Campaigns",
    60: "Steam Overlay Support",
    61: "HDR available",
    62: "Family Sharing",
    63: "Steam Timeline",
    # Accessibility features
    64: "Adjustable Text Size",
    65: "Subtitle Options",
    66: "Color Alternatives",
    67: "Camera Comfort",
    68: "Custom Volume Controls",
    69: "Stereo Sound",
    70: "Surround Sound",
    71: "Narrated Game Menus",
    72: "Chat Speech-to-text",
    74: "Playable without Timed Input",
    75: "Keyboard Only Option",
    76: "Mouse Only Option",
    77: "Touch Only Option",
    78: "Adjustable Difficulty",
    79: "Save Anytime",
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

        Only processes apps that already exist in the database (from applist-worker).
        This prevents FK violations when change_monitor receives notifications for
        apps that haven't been synced yet.

        Returns stats dict with created/updated/failed/skipped counts.
        """
        stats = {"created": 0, "updated": 0, "failed": 0, "skipped": 0}

        if not apps:
            return stats

        # Get existing appids from database - only process apps that exist
        all_appids = [app.appid for app in apps]
        existing_appids = set(self._get_existing_appids(all_appids))

        # Filter to only apps that exist in database
        apps_to_process = [app for app in apps if app.appid in existing_appids]
        skipped_apps = [app for app in apps if app.appid not in existing_appids]
        stats["skipped"] = len(skipped_apps)

        if skipped_apps:
            skipped_sample = [a.appid for a in skipped_apps[:10]]
            logger.warning(
                f"Skipping {len(skipped_apps)} apps not in database: {skipped_sample}"
                + ("..." if len(skipped_apps) > 10 else "")
            )

        if not apps_to_process:
            logger.info("No apps to process after filtering - all apps not in database")
            return stats

        # Get apps that already have storefront release dates (authoritative)
        # PICS should only set release_date as a fallback when storefront data is missing
        appids_to_process = [app.appid for app in apps_to_process]
        apps_with_storefront_dates = self._get_apps_with_storefront_dates(appids_to_process)
        logger.info(f"{len(apps_with_storefront_dates)} apps have storefront release dates (will not overwrite)")

        # Get apps that have been synced via storefront API (authoritative for is_free)
        # PICS should only set is_free as a fallback when storefront hasn't synced yet
        apps_with_storefront_sync = self._get_apps_with_storefront_sync(appids_to_process)
        logger.info(f"{len(apps_with_storefront_sync)} apps have storefront sync (will not overwrite is_free)")

        # Prepare app records
        app_records = []
        appid_to_app = {}  # Track which apps we're processing
        build_failures = 0
        for app in apps_to_process:
            has_storefront_date = app.appid in apps_with_storefront_dates
            has_storefront_sync = app.appid in apps_with_storefront_sync
            record = self._build_app_record(app, has_storefront_date=has_storefront_date, has_storefront_sync=has_storefront_sync)
            if record:
                app_records.append(record)
                appid_to_app[app.appid] = app
            else:
                build_failures += 1

        logger.info(
            f"Built {len(app_records)} records from {len(apps_to_process)} apps "
            f"({build_failures} build failures, {stats['skipped']} skipped)"
        )

        # Track successfully upserted appids
        successful_appids = set()

        # Upsert apps in batches
        for i in range(0, len(app_records), self.UPSERT_BATCH_SIZE):
            batch = app_records[i : i + self.UPSERT_BATCH_SIZE]
            batch_appids = {r["appid"] for r in batch}
            try:
                self._db.client.table("apps").upsert(batch, on_conflict="appid").execute()
                stats["updated"] += len(batch)
                successful_appids.update(batch_appids)
            except Exception as e:
                logger.error(f"Failed to upsert app batch: {e}")
                stats["failed"] += len(batch)

        # Process relationships only for successfully upserted apps
        successful_apps = [appid_to_app[appid] for appid in successful_appids if appid in appid_to_app]
        self._sync_relationships(successful_apps, successful_appids)

        return stats

    def _get_existing_appids(self, appids: List[int]) -> List[int]:
        """Check which appids already exist in the apps table."""
        if not appids:
            return []

        existing = []
        batch_size = 1000  # Supabase limit

        for i in range(0, len(appids), batch_size):
            batch = appids[i : i + batch_size]
            try:
                result = (
                    self._db.client.table("apps")
                    .select("appid")
                    .in_("appid", batch)
                    .execute()
                )
                existing.extend([r["appid"] for r in result.data])
            except Exception as e:
                logger.error(f"Failed to check existing appids: {e}")

        return existing

    def _get_apps_with_storefront_dates(self, appids: List[int]) -> Set[int]:
        """Get appids that have release_date_raw from storefront (authoritative).

        The storefront API provides authoritative release dates. PICS should only
        set release_date as a fallback when storefront data is not available.
        """
        if not appids:
            return set()

        has_raw_date: Set[int] = set()
        batch_size = 1000

        for i in range(0, len(appids), batch_size):
            batch = appids[i : i + batch_size]
            try:
                result = (
                    self._db.client.table("apps")
                    .select("appid")
                    .in_("appid", batch)
                    .not_.is_("release_date_raw", "null")
                    .execute()
                )
                has_raw_date.update(r["appid"] for r in result.data)
            except Exception as e:
                logger.error(f"Failed to check storefront dates: {e}")

        return has_raw_date

    def _get_apps_with_storefront_sync(self, appids: List[int]) -> Set[int]:
        """Get appids that have been synced via storefront API.

        The storefront API is authoritative for is_free. PICS should only
        set is_free as a fallback when storefront hasn't synced the app yet.
        """
        if not appids:
            return set()

        has_storefront_sync: Set[int] = set()
        batch_size = 1000

        for i in range(0, len(appids), batch_size):
            batch = appids[i : i + batch_size]
            try:
                result = (
                    self._db.client.table("sync_status")
                    .select("appid")
                    .in_("appid", batch)
                    .not_.is_("last_storefront_sync", "null")
                    .execute()
                )
                has_storefront_sync.update(r["appid"] for r in result.data)
            except Exception as e:
                logger.error(f"Failed to check storefront sync status: {e}")

        return has_storefront_sync

    def _build_app_record(self, app: ExtractedPICSData, has_storefront_date: bool = False, has_storefront_sync: bool = False) -> Optional[Dict[str, Any]]:
        """Build a database record from extracted PICS data."""
        try:
            # Use PICS type if available, otherwise infer from other data
            app_type = app.type if app.type else self._infer_type(app)

            return {
                "appid": app.appid,
                # Only update name if it exists (don't overwrite with None)
                **({"name": app.name} if app.name else {}),
                # Always set type - either from PICS or inferred
                "type": self._map_app_type(app_type),
                # PICS-specific fields
                "pics_review_score": app.review_score,
                "pics_review_percentage": app.review_percentage,
                "controller_support": app.controller_support,
                "metacritic_score": app.metacritic_score,
                "metacritic_url": app.metacritic_url,
                "platforms": ",".join(app.platforms) if app.platforms else None,
                "release_state": app.release_state,
                # NOTE: parent_appid removed - PICS common.parent is unreliable (contains garbage)
                # Parent relationships are now only set via Storefront API's fullgame field
                "homepage_url": app.homepage_url,
                "app_state": app.app_state,
                "last_content_update": (
                    app.last_update_timestamp.isoformat() if app.last_update_timestamp else None
                ),
                "store_asset_mtime": (
                    app.store_asset_mtime.date().isoformat() if app.store_asset_mtime else None
                ),
                "current_build_id": app.current_build_id,
                "content_descriptors": app.content_descriptors if app.content_descriptors else None,
                "languages": app.languages if app.languages else None,
                "has_workshop": app.has_workshop,
                # is_free from PICS - only as fallback when storefront hasn't synced yet
                # Storefront API is authoritative for is_free
                **({"is_free": app.is_free} if not has_storefront_sync else {}),
                # Release date from PICS - only as fallback when storefront data is missing
                # Storefront API is authoritative for release dates
                **(
                    {"release_date": app.steam_release_date.date().isoformat()}
                    if app.steam_release_date and not has_storefront_date
                    else {}
                ),
                # is_released from PICS - only as fallback when storefront hasn't synced yet
                # Storefront API is authoritative for is_released (uses reliable coming_soon field)
                **({"is_released": app.release_state == "released"} if not has_storefront_sync else {}),
                "updated_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Failed to build record for app {app.appid}: {e}")
            return None

    def _sync_relationships(self, apps: List[ExtractedPICSData], successful_appids: Set[int]):
        """Sync developer/publisher/tag/genre/category/franchise relationships.

        Only processes apps in the successful_appids set to avoid FK violations
        when updating sync_status for apps that failed to upsert.
        """
        processed_appids = []

        for app in apps:
            # Only process apps that were successfully upserted
            if app.appid not in successful_appids:
                continue

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

                # DLC relationships (from listofdlc field)
                if app.dlc_appids:
                    self._sync_dlc_relationships(app.appid, app.dlc_appids)

                # Mark as successfully processed
                processed_appids.append(app.appid)

            except Exception as e:
                logger.error(f"Failed to sync relationships for app {app.appid}: {e}")

        # Batch update sync status only for successfully processed apps
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

    def _sync_dlc_relationships(self, parent_appid: int, dlc_appids: List[int]):
        """Sync DLC relationships from PICS listofdlc field to junction table.

        Note: FK constraints have been removed from app_dlc table to allow
        relationships to be stored even when DLC apps don't exist yet.
        This handles the case where processing order is unpredictable.
        """
        if not dlc_appids:
            return

        try:
            records = [
                {"parent_appid": parent_appid, "dlc_appid": dlc_id, "source": "pics"}
                for dlc_id in dlc_appids
            ]
            self._db.client.table("app_dlc").upsert(
                records,
                on_conflict="parent_appid,dlc_appid",
            ).execute()
            logger.info(f"Synced {len(dlc_appids)} DLC relationships for app {parent_appid}")
        except Exception as e:
            logger.error(f"Failed to sync DLC relationships for {parent_appid}: {e}")

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

    def _infer_type(self, app: ExtractedPICSData) -> str:
        """Infer app type when PICS doesn't provide it.

        Uses heuristics based on available data:
        - Name contains "Demo" → demo
        - Name contains "Soundtrack" → music
        - Name contains "SDK" → tool

        NOTE: DLC detection removed - PICS parent_appid is unreliable (contains garbage).
        DLC type is now ONLY set via Storefront API's fullgame field.
        """
        # Infer from name patterns
        if app.name:
            name_lower = app.name.lower()

            # Demo patterns (but not "Demon", "Democracy", etc.)
            if (
                " demo" in name_lower
                or name_lower.endswith(" demo")
                or "(demo)" in name_lower
                or "[demo]" in name_lower
            ):
                if not any(x in name_lower for x in ["demon", "democracy", "demolition"]):
                    return "demo"

            # Music/Soundtrack patterns
            if any(x in name_lower for x in ["soundtrack", " ost", "original score", "music pack"]):
                return "music"

            # Tool patterns
            if any(x in name_lower for x in [" sdk", "dedicated server", "level editor", "modding tool"]):
                return "tool"

            # Video patterns
            if any(x in name_lower for x in ["trailer", "- video", "making of", "behind the scenes"]):
                return "video"

        return "game"  # Default fallback

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
            "tool": "tool",
            "application": "application",
            "hardware": "hardware",
            "music": "music",
            "episode": "episode",
            "series": "series",
            "advertising": "advertising",
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
