"""Extract structured data from raw PICS response."""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class SteamDeckCompatibility:
    """Steam Deck compatibility info."""

    category: int  # 0=Unknown, 1=Unsupported, 2=Playable, 3=Verified
    test_timestamp: Optional[int] = None
    tested_build_id: Optional[str] = None
    tests: Optional[Dict[str, Any]] = None


@dataclass
class Association:
    """Developer/Publisher/Franchise association."""

    type: str  # 'developer', 'publisher', 'franchise', 'award'
    name: str


@dataclass
class ExtractedPICSData:
    """All extracted PICS data for an app."""

    appid: int
    name: Optional[str] = None
    type: Optional[str] = None

    # Developer/Publisher
    developer: Optional[str] = None
    publisher: Optional[str] = None
    associations: List[Association] = field(default_factory=list)

    # Relationships
    parent_appid: Optional[int] = None
    dlc_appids: List[int] = field(default_factory=list)

    # Dates
    steam_release_date: Optional[datetime] = None
    original_release_date: Optional[datetime] = None
    store_asset_mtime: Optional[datetime] = None  # When store page was created
    release_state: Optional[str] = None
    last_update_timestamp: Optional[datetime] = None

    # Reviews
    review_score: Optional[int] = None
    review_percentage: Optional[int] = None
    metacritic_score: Optional[int] = None
    metacritic_url: Optional[str] = None

    # Tags & Categories
    store_tags: List[int] = field(default_factory=list)
    genres: List[int] = field(default_factory=list)
    primary_genre: Optional[int] = None
    categories: Dict[int, bool] = field(default_factory=dict)

    # Platform & Compatibility
    platforms: List[str] = field(default_factory=list)
    controller_support: Optional[str] = None
    steam_deck: Optional[SteamDeckCompatibility] = None

    # Features
    has_workshop: bool = False
    is_free: bool = False

    # Content
    content_descriptors: Dict[str, Any] = field(default_factory=dict)
    languages: Dict[str, Any] = field(default_factory=dict)

    # URLs
    homepage_url: Optional[str] = None

    # State
    app_state: Optional[str] = None

    # Build info
    current_build_id: Optional[str] = None


class PICSExtractor:
    """Extracts structured data from raw PICS response."""

    def extract(self, appid: int, raw_data: Dict[str, Any]) -> ExtractedPICSData:
        """Extract all relevant fields from PICS app data."""
        # Handle both wrapped and unwrapped formats
        if "appinfo" in raw_data:
            appinfo = raw_data.get("appinfo", raw_data)
        else:
            appinfo = raw_data

        common = appinfo.get("common", {}) if isinstance(appinfo, dict) else {}

        # Debug logging to diagnose type extraction issues
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug(f"[{appid}] Raw keys: {list(raw_data.keys())[:5]}")
            if isinstance(appinfo, dict):
                logger.debug(f"[{appid}] appinfo keys: {list(appinfo.keys())[:5]}")
            logger.debug(f"[{appid}] common keys: {list(common.keys())[:10] if common else 'EMPTY'}")
            logger.debug(f"[{appid}] common.type = {common.get('type')}")
        extended = appinfo.get("extended", {})
        config = appinfo.get("config", {})
        depots = appinfo.get("depots", {})

        return ExtractedPICSData(
            appid=appid,
            name=common.get("name"),
            type=common.get("type"),
            # Developer/Publisher (prefer common, fallback to extended)
            developer=common.get("developer") or extended.get("developer"),
            publisher=common.get("publisher") or extended.get("publisher"),
            associations=self._extract_associations(common.get("associations", {})),
            # Relationships
            parent_appid=self._safe_int(common.get("parent")),
            dlc_appids=self._parse_dlc_list(extended.get("listofdlc", "")),
            # Dates
            steam_release_date=self._parse_timestamp(common.get("steam_release_date")),
            original_release_date=self._parse_timestamp(common.get("original_release_date")),
            store_asset_mtime=self._parse_timestamp(common.get("store_asset_mtime")),
            release_state=common.get("releasestate"),
            last_update_timestamp=self._extract_last_update(depots),
            # Reviews
            review_score=self._safe_int(common.get("review_score")),
            review_percentage=self._safe_int(common.get("review_percentage")),
            metacritic_score=self._safe_int(common.get("metacritic_score")),
            metacritic_url=common.get("metacritic_url"),
            # Tags & Categories
            store_tags=self._extract_tag_ids(common.get("store_tags", {})),
            genres=self._extract_tag_ids(common.get("genres", {})),
            primary_genre=self._safe_int(common.get("primary_genre")),
            categories=self._extract_categories(common.get("category", {})),
            # Platform & Compatibility
            platforms=self._parse_platforms(common.get("oslist", "")),
            controller_support=common.get("controller_support"),
            steam_deck=self._extract_steam_deck(common.get("steam_deck_compatibility", {})),
            # Features
            has_workshop="workshop" in config or common.get("workshop_visible") == "1",
            is_free=common.get("isfreeapp") == "1",
            # Content
            content_descriptors=common.get("content_descriptors", {}),
            languages=common.get("languages", {}),
            # URLs
            homepage_url=extended.get("homepage") or extended.get("developer_url"),
            # State
            app_state=extended.get("state"),
            # Build info
            current_build_id=self._extract_build_id(depots),
        )

    def _extract_associations(self, data: Dict) -> List[Association]:
        """Extract associations from numbered dict format."""
        associations = []
        if not isinstance(data, dict):
            return associations

        for _, assoc in data.items():
            if isinstance(assoc, dict) and "type" in assoc and "name" in assoc:
                associations.append(Association(type=assoc["type"], name=assoc["name"]))
        return associations

    def _extract_tag_ids(self, data: Dict) -> List[int]:
        """Extract tag IDs from numbered dict format."""
        if not isinstance(data, dict):
            return []
        result = []
        for v in data.values():
            try:
                result.append(int(v))
            except (ValueError, TypeError):
                pass
        return result

    def _extract_categories(self, data: Dict) -> Dict[int, bool]:
        """Extract category flags as category_id -> True mapping."""
        if not isinstance(data, dict):
            return {}

        result = {}
        for k, v in data.items():
            if k.startswith("category_"):
                try:
                    cat_id = int(k.replace("category_", ""))
                    result[cat_id] = v == "1"
                except ValueError:
                    pass
        return result

    def _parse_platforms(self, oslist: str) -> List[str]:
        """Parse comma-separated platform list."""
        if not oslist:
            return []
        return [p.strip() for p in oslist.split(",") if p.strip()]

    def _parse_dlc_list(self, dlc_str: str) -> List[int]:
        """Parse comma-separated DLC appid list."""
        if not dlc_str:
            return []
        result = []
        for x in dlc_str.split(","):
            try:
                result.append(int(x.strip()))
            except ValueError:
                pass
        return result

    def _extract_steam_deck(self, data: Dict) -> Optional[SteamDeckCompatibility]:
        """Extract Steam Deck compatibility info."""
        if not data or not isinstance(data, dict):
            return None
        return SteamDeckCompatibility(
            category=self._safe_int(data.get("category")) or 0,
            test_timestamp=self._safe_int(data.get("test_timestamp")),
            tested_build_id=data.get("tested_build_id"),
            tests=data.get("tests"),
        )

    def _extract_last_update(self, depots: Dict) -> Optional[datetime]:
        """Extract last update timestamp from public branch."""
        if not isinstance(depots, dict):
            return None
        try:
            branches = depots.get("branches", {})
            public = branches.get("public", {})
            timestamp = public.get("timeupdated")
            return self._parse_timestamp(timestamp)
        except Exception:
            return None

    def _extract_build_id(self, depots: Dict) -> Optional[str]:
        """Extract current build ID from public branch."""
        if not isinstance(depots, dict):
            return None
        try:
            branches = depots.get("branches", {})
            public = branches.get("public", {})
            return public.get("buildid")
        except Exception:
            return None

    def _parse_timestamp(self, value) -> Optional[datetime]:
        """Safely parse Unix timestamp."""
        if not value:
            return None
        try:
            return datetime.fromtimestamp(int(value))
        except (ValueError, TypeError, OSError):
            return None

    def _safe_int(self, value) -> Optional[int]:
        """Safely convert to int."""
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
