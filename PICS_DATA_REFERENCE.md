# Complete PICS/SteamKit2 Data Fields Reference

Everything you can extract from Steam's PICS (Product Info Cache Server) via SteamKit2.

---

## How PICS Data is Structured

```
appinfo
├── appid
├── common          ← Main metadata (name, type, developer, etc.)
├── extended        ← Additional metadata (publisher homepage, etc.)
├── config          ← Technical config (install dir, launch options)
├── depots          ← Download/update information
├── ufs             ← Cloud save configuration
└── localization    ← Language-specific data
```

---

## COMMON Section (Most Relevant for Your Use Case)

| Field | Type | Description | Relevance |
|-------|------|-------------|-----------|
| **`name`** | string | Game/app name | ⭐ Core |
| **`type`** | string | "game", "dlc", "demo", "mod", "video", "tool", "application" | ⭐ Core |
| **`developer`** | string | Developer name | ⭐ Core |
| **`publisher`** | string | Publisher name | ⭐ Core |
| **`gameid`** | int | Steam game ID (usually same as appid) | ⭐ Core |
| **`steam_release_date`** | timestamp | Official Steam release date (Unix timestamp) | ⭐ Core |
| **`original_release_date`** | timestamp | Original release date (if game was released elsewhere first) | ⭐ Core |
| **`store_asset_mtime`** | timestamp | When store page assets were created (proxy for page creation) | ⭐ Core |
| **`releasestate`** | string | "released", "prerelease", "unavailable", "preloadonly" | ⭐ Core |
| **`review_score`** | int | Review score (1-9 scale: 1=Overwhelmingly Negative to 9=Overwhelmingly Positive) | ⭐ Core |
| **`review_percentage`** | int | Percentage of positive reviews (0-100) | ⭐ Core |
| **`store_tags`** | dict | User-defined tags as IDs `{"0": "493", "1": "599"}` | ⭐ Core |
| **`oslist`** | string | Supported platforms: "windows", "macos", "linux" (comma-separated) | ⭐ Core |
| **`controller_support`** | string | "full", "partial", or absent | ⭐ Important |
| **`isfreeapp`** | string | "1" if free, absent/0 otherwise | ⭐ Important |
| **`metacritic_score`** | int | Metacritic score (0-100) | ⭐ Important |
| **`metacritic_url`** | string | URL to Metacritic page | Medium |
| **`category`** | dict | Feature categories (see below) | ⭐ Important |
| **`genres`** | dict | Genre IDs `{"0": "1", "1": "25"}` | ⭐ Important |
| **`primary_genre`** | int | Primary genre ID | Medium |
| **`associations`** | dict | Franchise/developer/publisher associations | ⭐ Important |
| **`parent`** | int | Parent appid (for DLC, demos, etc.) | Medium |
| **`name_localized`** | dict | Localized names `{"schinese": "反恐精英2"}` | Low |
| **`small_capsule`** | dict | Small capsule image info | Low |
| **`header_image`** | dict | Header image info | Low |
| **`library_assets`** | dict | Library asset info | Low |
| **`icon`** | string | Icon hash | Low |
| **`clienticon`** | string | Client icon hash | Low |
| **`logo`** | string | Logo hash | Low |
| **`clienttga`** | string | Client TGA hash | Low |
| **`exfgls`** | string | Exclude from family library sharing (values 1-9) | Medium |
| **`workshop_visible`** | string | "1" if workshop visible | ⭐ Important |
| **`community_visible_stats`** | string | "1" if stats are public | Medium |
| **`community_hub_visible`** | string | "1" if community hub exists | Medium |
| **`osarch`** | string | OS architecture ("32" or "64") | Low |
| **`osextended`** | string | Extended OS requirements | Low |
| **`eulas`** | dict | EULA configuration | Low |
| **`languages`** | dict | Supported languages | Medium |
| **`steam_deck_compatibility`** | dict | Steam Deck verification status | ⭐ Important |
| **`playtest_mode`** | string | Playtest availability | Low |
| **`content_descriptors`** | dict | Mature content descriptors | Medium |

### Category Field Values (Feature Flags)

The `category` field indicates supported Steam features:

| Category ID | Feature |
|-------------|---------|
| `category_1` | Multi-player |
| `category_2` | Single-player |
| `category_9` | Co-op |
| `category_20` | MMO |
| `category_22` | Steam Achievements |
| `category_23` | Steam Cloud |
| `category_27` | Cross-Platform Multiplayer |
| `category_28` | Full Controller Support |
| `category_29` | Steam Trading Cards |
| `category_30` | Steam Workshop |
| `category_35` | In-App Purchases |
| `category_36` | Online PvP |
| `category_37` | Online Co-op |
| `category_38` | Local Co-op |
| `category_43` | Remote Play on TV |
| `category_44` | Remote Play Together |
| `category_45` | Captions Available |
| `category_46` | LAN PvP |
| `category_47` | LAN Co-op |
| `category_48` | HDR |
| `category_49` | VR Supported |
| `category_50` | VR Only |
| `category_51` | Steam China Workshop |
| `category_52` | Tracked Controller Support |
| `category_53` | Family Sharing |
| `category_55` | Timeline Support |
| `category_56` | GPU Recording |
| `category_57` | Cloud Gaming (NVIDIA/Xbox Cloud) |
| `category_59` | Co-op Campaigns |
| `category_60` | Steam Overlay Support |
| `category_61` | Remote Play on Phone |
| `category_62` | Remote Play on Tablet |

### Genre ID Mapping (Common Ones)

| Genre ID | Genre Name |
|----------|------------|
| 1 | Action |
| 2 | Strategy |
| 3 | RPG |
| 4 | Casual |
| 5 | Racing |
| 9 | Racing |
| 12 | Sports |
| 18 | Sports |
| 23 | Indie |
| 25 | Adventure |
| 28 | Simulation |
| 29 | Massively Multiplayer |
| 37 | Free to Play |
| 51 | Animation & Modeling |
| 53 | Design & Illustration |
| 54 | Education |
| 55 | Software Training |
| 56 | Utilities |
| 57 | Video Production |
| 58 | Web Publishing |
| 59 | Game Development |
| 60 | Photo Editing |
| 70 | Early Access |
| 71 | Audio Production |
| 72 | Accounting |
| 81 | Documentary |
| 82 | Episodic |
| 83 | Feature Film |
| 84 | Short |
| 85 | Benchmark |
| 86 | VR |
| 87 | 360 Video |

### Associations Field Structure

```json
{
  "0": {
    "type": "developer",
    "name": "Valve"
  },
  "1": {
    "type": "publisher",
    "name": "Valve"
  },
  "2": {
    "type": "franchise",
    "name": "Counter-Strike"
  }
}
```

**Association types:**
- `developer` - Developer company
- `publisher` - Publisher company
- `franchise` - Game franchise/series
- `award` - Awards won

### Steam Deck Compatibility

```json
{
  "category": "2",           // 0=Unknown, 1=Unsupported, 2=Playable, 3=Verified
  "steamos_compatibility": "2",
  "test_timestamp": "1748044800",
  "tested_build_id": "18537564",
  "tests": {
    "0": {
      "display": "3",        // 1=Fail, 2=Info, 3=Warn, 4=Pass
      "token": "#SteamDeckVerified_TestResult_ControllerGlyphsDoNotMatchDeckDevice"
    }
  }
}
```

---

## EXTENDED Section

| Field | Type | Description | Relevance |
|-------|------|-------------|-----------|
| **`developer`** | string | Developer (duplicate/override) | Medium |
| **`publisher`** | string | Publisher (duplicate/override) | Medium |
| **`homepage`** | string | Developer/publisher homepage URL | Medium |
| **`developer_url`** | string | Developer website | Medium |
| **`gamemanualurl`** | string | Link to game manual | Low |
| **`state`** | string | App state ("eStateAvailable", "eStateUnpublished", etc.) | ⭐ Important |
| **`visibleonlywhensubscribed`** | string | "1" if only visible when owned | Medium |
| **`visibleonlywheninstalled`** | string | "1" if only visible when installed | Medium |
| **`noservers`** | string | "1" if no server browser | Low |
| **`sourcegame`** | string | "1" if Source engine game | Low |
| **`gamedir`** | string | Game directory name | Low |
| **`serverbrowsername`** | string | Server browser filter name | Low |
| **`order`** | string | Display order in lists | Low |
| **`primarycache`** | int | Primary depot cache | Low |
| **`validoslist`** | string | Valid OS platforms | Low |
| **`listofdlc`** | string | Comma-separated list of DLC appids | ⭐ Important |
| **`requireskbdmouse`** | string | "1" if keyboard/mouse required | Medium |
| **`dlcforappid`** | int | Parent app if this is DLC | Medium |

---

## CONFIG Section

| Field | Type | Description | Relevance |
|-------|------|-------------|-----------|
| **`installdir`** | string | Install directory name | Low |
| **`contenttype`** | string | Content type ("3" = game) | Low |
| **`launch`** | dict | Launch configurations per platform | Low |
| **`steamcontrollertemplateindex`** | string | Controller template | Low |
| **`steamcontrollertouchmenustyle`** | string | Touch menu style | Low |
| **`workshop`** | dict | Workshop configuration (if present = has workshop!) | ⭐ Important |
| **`checkforupdatesaliasappid`** | int | Update checking alias | Low |

### Workshop Detection

If `config.workshop` exists, the game supports Steam Workshop:
```json
{
  "workshop": {
    "publishedfileid_max": "5"
  }
}
```

---

## DEPOTS Section

| Field | Type | Description | Relevance |
|-------|------|-------------|-----------|
| **`branches`** | dict | Available branches (public, beta, etc.) | Medium |
| **`{depot_id}`** | dict | Individual depot info | Low |

### Branch Info (Inside branches)

```json
{
  "branches": {
    "public": {
      "buildid": "12345678",
      "timeupdated": "1703980800",  // Last update timestamp!
      "description": "Live build"
    },
    "beta": {
      "buildid": "12345679",
      "timeupdated": "1703990800",
      "pwdrequired": "1"
    }
  }
}
```

**Useful from depots:**
- `timeupdated` - Last update/patch timestamp
- `buildid` - Current build ID

---

## PICS Change System (Real-time Updates)

| Field | Type | Description |
|-------|------|-------------|
| **`current_change_number`** | int | Current global change number |
| **`since_change_number`** | int | Your last known change number |
| **`force_full_update`** | bool | Whether full refresh needed |
| **`app_changes`** | list | Apps that changed since last check |
| **`package_changes`** | list | Packages that changed |

Each app_change contains:
- `appid` - The app that changed
- `change_number` - Change number for this specific change

---

## Data You CAN Get from PICS (Summary)

### ⭐ HIGH VALUE (Your Core Needs)

| Data Point | PICS Field | Notes |
|------------|------------|-------|
| App name | `common.name` | ✅ |
| App type | `common.type` | game/dlc/demo/etc |
| Developer | `common.developer` or `extended.developer` | ✅ |
| Publisher | `common.publisher` or `extended.publisher` | ✅ |
| Release date | `common.steam_release_date` | Unix timestamp |
| Page creation date | `common.store_asset_mtime` | Approximate |
| Workshop support | `config.workshop` exists OR `common.workshop_visible` | Boolean check |
| Review score | `common.review_score` | 1-9 scale |
| Review percentage | `common.review_percentage` | 0-100% positive |
| Tags | `common.store_tags` | IDs (need mapping) |
| Platforms | `common.oslist` | windows,macos,linux |
| Is free | `common.isfreeapp` | "1" or absent |
| Controller support | `common.controller_support` | full/partial/none |
| Steam Deck status | `common.steam_deck_compatibility` | Verified/Playable/etc |
| Categories | `common.category` | Feature flags |
| Genres | `common.genres` | IDs (need mapping) |
| Franchise | `common.associations` | Developer/Publisher/Franchise |
| DLC list | `extended.listofdlc` | Comma-separated appids |
| Family sharing | `common.exfgls` | Excluded or not |
| Last update | `depots.branches.public.timeupdated` | Unix timestamp |

### ⚠️ MEDIUM VALUE

| Data Point | PICS Field | Notes |
|------------|------------|-------|
| Metacritic score | `common.metacritic_score` | Not always present |
| Homepage | `extended.homepage` | Publisher website |
| Localized names | `common.name_localized` | Translations |
| Languages | `common.languages` | Supported languages |
| Parent app | `common.parent` | For DLC/demos |
| App state | `extended.state` | Available/unpublished |
| Content warnings | `common.content_descriptors` | Mature content |

### ❌ NOT AVAILABLE IN PICS

| Data Point | Alternative Source |
|------------|-------------------|
| Owner estimates | SteamSpy API |
| CCU/Player counts | SteamSpy API |
| Price/pricing history | Store API or SteamSpy |
| Detailed reviews | Reviews API |
| Review histogram | Review Histogram API |
| Screenshots | Store API |
| Videos/trailers | Store API |
| System requirements | Store API |
| Full descriptions | Store API |
| User playtime | Requires account ownership |

---

## Speed Comparison

| Method | Rate | 70,000 Apps |
|--------|------|-------------|
| PICS via SteamKit2 | ~200 apps/request, 2 req/sec | **~3 minutes** |
| Steam Store API | ~40 req/min | ~29 hours |
| SteamSpy /appdetails | 1 req/sec | ~20 hours |
| Web scraping | ~1 req/sec | ~20 hours |

---

## Complete Python Example

```python
from steam.client import SteamClient

def extract_all_pics_data(client: SteamClient, appids: list[int]) -> dict:
    """Extract all available PICS data for apps."""
    
    response = client.get_product_info(apps=appids)
    results = {}
    
    for appid, data in response.get('apps', {}).items():
        appinfo = data.get('appinfo', {})
        common = appinfo.get('common', {})
        extended = appinfo.get('extended', {})
        config = appinfo.get('config', {})
        depots = appinfo.get('depots', {})
        
        results[int(appid)] = {
            # Core identification
            'appid': int(appid),
            'name': common.get('name'),
            'type': common.get('type'),
            'gameid': common.get('gameid'),
            
            # Developer/Publisher
            'developer': common.get('developer') or extended.get('developer'),
            'publisher': common.get('publisher') or extended.get('publisher'),
            'homepage': extended.get('homepage'),
            
            # Associations (franchise, etc.)
            'associations': common.get('associations', {}),
            
            # Dates
            'steam_release_date': common.get('steam_release_date'),
            'original_release_date': common.get('original_release_date'),
            'store_asset_mtime': common.get('store_asset_mtime'),  # Page creation
            'release_state': common.get('releasestate'),
            
            # Reviews
            'review_score': int(common.get('review_score', 0)) or None,
            'review_percentage': int(common.get('review_percentage', 0)) or None,
            'metacritic_score': common.get('metacritic_score'),
            
            # Classification
            'store_tags': list(common.get('store_tags', {}).values()),  # Tag IDs
            'genres': list(common.get('genres', {}).values()),  # Genre IDs
            'primary_genre': common.get('primary_genre'),
            'categories': common.get('category', {}),
            
            # Platform support
            'oslist': common.get('oslist', '').split(','),
            'os_arch': common.get('osarch'),
            'controller_support': common.get('controller_support'),
            'steam_deck': common.get('steam_deck_compatibility', {}),
            
            # Pricing/Access
            'is_free': common.get('isfreeapp') == '1',
            'exclude_family_sharing': common.get('exfgls'),
            
            # Features
            'has_workshop': 'workshop' in config or common.get('workshop_visible') == '1',
            'has_achievements': 'category_22' in common.get('category', {}),
            'has_trading_cards': 'category_29' in common.get('category', {}),
            'has_cloud_saves': 'category_23' in common.get('category', {}),
            'has_multiplayer': 'category_1' in common.get('category', {}),
            'has_coop': 'category_9' in common.get('category', {}),
            
            # Community
            'community_visible_stats': common.get('community_visible_stats') == '1',
            'community_hub_visible': common.get('community_hub_visible') == '1',
            
            # Content
            'content_descriptors': common.get('content_descriptors', {}),
            'languages': common.get('languages', {}),
            'name_localized': common.get('name_localized', {}),
            
            # DLC relationship
            'parent_appid': common.get('parent'),
            'dlc_list': extended.get('listofdlc', '').split(',') if extended.get('listofdlc') else [],
            
            # Technical
            'install_dir': config.get('installdir'),
            'app_state': extended.get('state'),
            
            # Last update info
            'last_update_timestamp': (
                depots.get('branches', {}).get('public', {}).get('timeupdated')
            ),
            'current_build_id': (
                depots.get('branches', {}).get('public', {}).get('buildid')
            ),
        }
    
    return results
```

---

## Recommended Data Collection Strategy

### Initial Bulk Load (Once)
1. Use PICS to fetch all 70k apps (~3 minutes)
2. Extract core fields: name, type, developer, publisher, dates, tags, etc.
3. Build tag ID → name mapping using SteamSpy sample

### Daily Updates
1. Monitor PICS changes (real-time)
2. Queue changed apps
3. Fetch fresh PICS data for changed apps only
4. Use REST APIs for data PICS doesn't have:
   - Review histogram (trends)
   - CCU/owners (SteamSpy)
   - Pricing (Store API)

### What Still Requires Other APIs

| Data | Best Source |
|------|-------------|
| Review trends over time | Review Histogram API |
| CCU / player counts | SteamSpy |
| Owner estimates | SteamSpy |
| Pricing / discounts | SteamSpy or Store API |
| Tag names (not IDs) | SteamSpy (build mapping) |
| Genre names (not IDs) | Hardcoded mapping (stable) |
