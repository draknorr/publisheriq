#!/usr/bin/env python3
"""Debug script to verify PICS data for known games."""

import json
import sys

from steam.client import PICSSteamClient
from steam.pics import PICSFetcher
from extractors.common import PICSExtractor

# Well-known games that should have full metadata
TEST_APPS = {
    730: "Counter-Strike 2",
    570: "Dota 2",
    440: "Team Fortress 2",
    1245620: "Elden Ring",
    1086940: "Baldur's Gate 3",
    292030: "The Witcher 3",
}


def main():
    print("Connecting to Steam...")
    steam = PICSSteamClient()
    if not steam.connect():
        print("ERROR: Failed to connect to Steam")
        return 1

    try:
        fetcher = PICSFetcher(steam)
        extractor = PICSExtractor()

        print(f"\nFetching PICS data for {len(TEST_APPS)} apps...")
        raw_data = fetcher.fetch_apps_batch(list(TEST_APPS.keys()))

        print(f"\nReceived data for {len(raw_data)} apps\n")
        print("=" * 80)

        for appid, data in raw_data.items():
            appid_int = int(appid)
            expected_name = TEST_APPS.get(appid_int, "Unknown")

            # Extract structured data
            extracted = extractor.extract(appid_int, data)

            # Get raw common section for comparison
            appinfo = data.get("appinfo", data)
            common = appinfo.get("common", {})

            print(f"\n[{appid}] {expected_name}")
            print("-" * 40)
            print(f"  Name from PICS: {extracted.name}")
            print(f"  Type: {extracted.type}")
            print(f"  Developer: {extracted.developer}")
            print(f"  Publisher: {extracted.publisher}")
            print(f"  Platforms: {extracted.platforms}")
            print(f"  ")
            print(f"  Store Tags (IDs): {extracted.store_tags[:10]}{'...' if len(extracted.store_tags) > 10 else ''}")
            print(f"  Genres (IDs): {extracted.genres}")
            print(f"  Primary Genre: {extracted.primary_genre}")
            print(f"  Categories: {list(extracted.categories.keys())[:10]}{'...' if len(extracted.categories) > 10 else ''}")
            print(f"  ")
            print(f"  Has tags in raw: {'store_tags' in common}")
            print(f"  Has genres in raw: {'genres' in common}")
            print(f"  Has categories in raw: {'category' in common}")

            # Show raw store_tags sample
            raw_tags = common.get("store_tags", {})
            if raw_tags:
                print(f"  Raw store_tags sample: {dict(list(raw_tags.items())[:3])}")
            else:
                print(f"  Raw store_tags: EMPTY/MISSING")

        print("\n" + "=" * 80)
        print("\nSUMMARY:")
        apps_with_tags = sum(1 for appid, data in raw_data.items()
                           if data.get("appinfo", data).get("common", {}).get("store_tags"))
        apps_with_genres = sum(1 for appid, data in raw_data.items()
                             if data.get("appinfo", data).get("common", {}).get("genres"))
        print(f"  Apps with store_tags: {apps_with_tags}/{len(raw_data)}")
        print(f"  Apps with genres: {apps_with_genres}/{len(raw_data)}")

    finally:
        steam.disconnect()
        print("\nDisconnected from Steam")

    return 0


if __name__ == "__main__":
    sys.exit(main())
