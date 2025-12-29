"""Sync Steam tag names from Steam's API to the database."""

import logging
from datetime import datetime

import httpx

from database.client import SupabaseClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

STEAM_TAGS_URL = "https://store.steampowered.com/tagdata/populartags/english"


def sync_steam_tag_names():
    """Fetch all Steam tag names and update the steam_tags table."""
    logger.info("Fetching Steam tag names from API...")

    response = httpx.get(STEAM_TAGS_URL, timeout=30.0)
    response.raise_for_status()
    tags = response.json()  # [{"tagid": 19, "name": "Action"}, ...]

    logger.info(f"Fetched {len(tags)} tags from Steam API")

    db = SupabaseClient.get_instance()
    client = db.client

    updated = 0
    for tag in tags:
        try:
            client.table("steam_tags").upsert(
                {
                    "tag_id": tag["tagid"],
                    "name": tag["name"],
                    "updated_at": datetime.utcnow().isoformat(),
                },
                on_conflict="tag_id",
            ).execute()
            updated += 1
        except Exception as e:
            logger.error(f"Failed to update tag {tag['tagid']}: {e}")

    logger.info(f"Updated {updated}/{len(tags)} tag names in database")
    return updated


if __name__ == "__main__":
    sync_steam_tag_names()
