from pathlib import Path
import sys
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.extractors.common import Association, ExtractedPICSData, SteamDeckCompatibility
from src.database.change_intelligence import diff_pics_snapshots, hash_normalized_snapshot, normalize_pics_snapshot


def build_app(**overrides):
    base = ExtractedPICSData(
        appid=730,
        name="Counter-Strike 2",
        type="game",
        developer="Valve",
        publisher="Valve",
        associations=[
            Association(type="developer", name="Valve"),
            Association(type="publisher", name="Valve"),
        ],
        dlc_appids=[100, 200],
        release_state="released",
        review_score=9,
        review_percentage=88,
        store_tags=[1, 2],
        genres=[1, 3],
        primary_genre=1,
        categories={2: True, 28: True},
        platforms=["windows", "linux"],
        controller_support="full",
        steam_deck=SteamDeckCompatibility(category=3),
        languages={"english": {"supported": "true"}, "german": {"supported": "true"}},
        current_build_id="111",
        last_update_timestamp=datetime(2026, 3, 1, 12, 0, 0),
    )

    for key, value in overrides.items():
        setattr(base, key, value)

    return base


def test_normalized_snapshot_hash_is_stable_across_input_order():
    left = build_app(
        store_tags=[2, 1],
        platforms=["linux", "windows"],
        languages={"german": {"supported": "true"}, "english": {"supported": "true"}},
    )
    right = build_app(
        store_tags=[1, 2],
        platforms=["windows", "linux"],
        languages={"english": {"supported": "true"}, "german": {"supported": "true"}},
    )

    left_snapshot = normalize_pics_snapshot(left)
    right_snapshot = normalize_pics_snapshot(right)

    assert left_snapshot == right_snapshot
    assert hash_normalized_snapshot(left_snapshot) == hash_normalized_snapshot(right_snapshot)


def test_diff_emits_tag_add_remove_and_platform_build_events():
    before = normalize_pics_snapshot(build_app(store_tags=[1, 2], platforms=["windows"], current_build_id="111"))
    after = normalize_pics_snapshot(
        build_app(
            store_tags=[2, 3],
            platforms=["windows", "linux"],
            current_build_id="222",
        )
    )

    events = diff_pics_snapshots(before, after)
    event_types = [event.change_type for event in events]

    assert "tags_added" in event_types
    assert "tags_removed" in event_types
    assert "platforms_changed" in event_types
    assert "build_id_changed" in event_types

    added_tags = next(event for event in events if event.change_type == "tags_added")
    removed_tags = next(event for event in events if event.change_type == "tags_removed")

    assert added_tags.context["added"] == [3]
    assert removed_tags.context["removed"] == [1]


def test_diff_emits_language_and_association_events():
    before = normalize_pics_snapshot(build_app())
    after = normalize_pics_snapshot(
        build_app(
            developer="Valve South",
            associations=[
                Association(type="developer", name="Valve South"),
                Association(type="publisher", name="Valve"),
            ],
            languages={"english": {"supported": "true"}},
        )
    )

    events = diff_pics_snapshots(before, after)
    event_types = {event.change_type for event in events}

    assert "languages_changed" in event_types
    assert "developer_association_changed" in event_types
