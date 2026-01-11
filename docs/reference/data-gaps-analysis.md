# PublisherIQ Data Gaps Analysis

> Comprehensive analysis of data points not currently being captured that could benefit the platform.
> Last updated: January 11, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Current APIs - Unused Fields](#part-1-data-available-in-current-apis-but-not-captured)
3. [Steam APIs Not Used](#part-2-steam-apis-not-currently-used)
4. [Third-Party Sources](#part-3-third-party-data-sources-not-used)
5. [Embedding Enhancements](#part-4-embedding-enhancement-opportunities)
6. [Priority Recommendations](#part-5-summary---priority-recommendations)

---

## Overview

This analysis identifies **data points not currently being captured** that could benefit PublisherIQ, organized by source and potential value. The goal is to provide a roadmap for future data enrichment.

**Current Data Sources (7 total):**
1. Steam App List API - Master app inventory
2. Steam Storefront API - Game metadata, dev/pub names (AUTHORITATIVE)
3. Steam Reviews API - Review counts and sentiment
4. Steam Review Histogram - Monthly review trends
5. Steam CCU API - Exact player counts
6. SteamSpy API - Owner estimates, playtime, user-voted tags
7. PICS Service - Official tags, genres, Steam Deck data

---

## Part 1: Data Available in Current APIs But NOT Captured

### Steam Storefront API (store.steampowered.com/api/appdetails)

| Field | Type | Current Status | Potential Value |
|-------|------|----------------|-----------------|
| `detailed_description` | HTML text | **NOT CAPTURED** | Full game descriptions for semantic search, NLP analysis, embedding enrichment |
| `about_the_game` | HTML text | **NOT CAPTURED** | Marketing copy for sentiment analysis |
| `short_description` | text | **NOT CAPTURED** | Concise summaries for quick display |
| `supported_languages` | text | **NOT CAPTURED** | Localization coverage analysis, market reach |
| `header_image` | URL | **NOT CAPTURED** | Visual identity, image-based similarity |
| `capsule_image` | URL | **NOT CAPTURED** | Thumbnail assets |
| `background` | URL | **NOT CAPTURED** | Visual theming analysis |
| `website` | URL | **NOT CAPTURED** | Developer/publisher web presence |
| `pc_requirements.minimum` | HTML | **NOT CAPTURED** | System spec trends, market accessibility |
| `pc_requirements.recommended` | HTML | **NOT CAPTURED** | Performance tier analysis |
| `mac_requirements` | HTML | **NOT CAPTURED** | Mac market focus |
| `linux_requirements` | HTML | **NOT CAPTURED** | Linux market focus |
| `screenshots[]` | array | **NOT CAPTURED** | Visual content for image embeddings |
| `movies[]` | array | **NOT CAPTURED** | Trailer metadata, video marketing |
| `achievements.total` | integer | **NOT CAPTURED** | Achievement system complexity |
| `achievements.highlighted[]` | array | **NOT CAPTURED** | Featured achievement names/descriptions |
| `support_info.url` | URL | **NOT CAPTURED** | Customer support presence |
| `support_info.email` | email | **NOT CAPTURED** | Contact availability |
| `content_descriptors.ids` | array | **NOT CAPTURED** | Mature content flags (ESRB-like) |
| `content_descriptors.notes` | text | **NOT CAPTURED** | Content warning details |
| `required_age` | integer | **NOT CAPTURED** | Age rating for filtering |
| `package_groups[]` | array | **NOT CAPTURED** | Bundle/subscription data |
| `legal_notice` | text | **NOT CAPTURED** | Copyright/trademark info |

**HIGH VALUE FIELDS:**
1. **Descriptions** (detailed_description, about_the_game, short_description) - Would dramatically improve embeddings and enable full-text search
2. **System Requirements** - Market accessibility analysis
3. **Achievement Count** - Engagement complexity metric
4. **Supported Languages** - Localization coverage

---

### Steam Reviews API (store.steampowered.com/appreviews)

Currently only using `num_per_page=0` (summary only). Individual reviews contain:

| Field | Type | Current Status | Potential Value |
|-------|------|----------------|-----------------|
| `reviews[].review` | text | **NOT CAPTURED** | Full review text for sentiment analysis |
| `reviews[].language` | code | **NOT CAPTURED** | Language distribution of reviewers |
| `reviews[].votes_up` | integer | **NOT CAPTURED** | Helpfulness metric |
| `reviews[].votes_funny` | integer | **NOT CAPTURED** | Community engagement style |
| `reviews[].weighted_vote_score` | float | **NOT CAPTURED** | Review quality indicator |
| `reviews[].comment_count` | integer | **NOT CAPTURED** | Discussion generation |
| `reviews[].steam_purchase` | boolean | **NOT CAPTURED** | Verified purchase filtering |
| `reviews[].received_for_free` | boolean | **NOT CAPTURED** | Review authenticity signal |
| `reviews[].written_during_early_access` | boolean | **NOT CAPTURED** | Early vs post-launch sentiment |
| `reviews[].author.num_games_owned` | integer | **NOT CAPTURED** | Reviewer profile depth |
| `reviews[].author.num_reviews` | integer | **NOT CAPTURED** | Reviewer experience |
| `reviews[].author.playtime_forever` | integer | **NOT CAPTURED** | Engagement before review |
| `reviews[].author.playtime_at_review` | integer | **NOT CAPTURED** | How much played before reviewing |
| `reviews[].author.last_played` | timestamp | **NOT CAPTURED** | Reviewer recency |
| `reviews[].timestamp_created` | timestamp | **NOT CAPTURED** | Review timing patterns |

**HIGH VALUE FIELDS:**
1. **Review Text** - Enables NLP sentiment analysis, topic extraction
2. **Playtime at Review** - Review credibility scoring
3. **Language Distribution** - Market reach analysis
4. **Early Access vs Launch Reviews** - Lifecycle sentiment tracking

---

### Steam App List API (IStoreService/GetAppList)

| Field | Type | Current Status | Potential Value |
|-------|------|----------------|-----------------|
| `last_modified` | timestamp | **NOT CAPTURED** | Incremental sync optimization |
| `price_change_number` | integer | **NOT CAPTURED** | Price change detection |

**MEDIUM VALUE** - Could enable more efficient incremental syncing

---

### SteamSpy API (steamspy.com/api.php)

| Field | Type | Current Status | Potential Value |
|-------|------|----------------|-----------------|
| `score_rank` | string | **NOT CAPTURED** | Score percentile ranking |
| Tag vote counts | integer per tag | **CAPTURED but not weighted** | Tag popularity/relevance ranking |

**LOW VALUE** - Most useful data already captured

---

## Part 2: Steam APIs Not Currently Used

### 1. Steam News API (ISteamNews/GetNewsForApp)

**Priority:** High (code already exists!)

**Status:** Code exists (`fetchAppNews()` in steam-web.ts) but **NOT USED IN ANY WORKER**

**Endpoint:** `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/`

| Field | Type | Potential Value |
|-------|------|-----------------|
| `newsitems[].title` | text | Update/patch naming |
| `newsitems[].contents` | HTML | Patch notes, announcements |
| `newsitems[].date` | timestamp | Update frequency tracking |
| `newsitems[].feedlabel` | string | Content categorization |
| `newsitems[].author` | string | Community manager activity |

**USE CASES:**
- Track patch frequency (active development indicator)
- Identify lifecycle phase (early access -> launch -> maintenance)
- Publisher communication patterns
- Enhance embeddings with "recently updated" signals
- News-based alerts for tracked games

**IMPLEMENTATION:** Low effort - function already exists

---

### 2. Steam Achievements API (ISteamUserStats)

**Priority:** High

**Endpoints:**
- `GetSchemaForGame/v2/` - Achievement definitions
- `GetGlobalAchievementPercentagesForApp/v2/` - Unlock rates

| Field | Type | Potential Value |
|-------|------|-----------------|
| `achievement_name` | string | Achievement naming conventions |
| `achievement_description` | text | Challenge descriptions |
| `percent` | float | Global unlock rate (0-100) |

**USE CASES:**
- **Achievement count** as game complexity metric
- **Unlock rate distribution** as engagement indicator:
  - High unlock rates = accessible/casual
  - Low unlock rates = hardcore/challenging
- **Achievement-based similarity** ("games with similar achievement structure")
- **Completion rate** analysis (% who finish vs abandon)
- Filter games by achievement availability

**DATABASE SCHEMA:**
```sql
CREATE TABLE app_achievements (
  appid INTEGER REFERENCES apps(appid),
  achievement_id TEXT,
  name TEXT,
  description TEXT,
  unlock_percent DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (appid, achievement_id)
);
```

---

### 3. Steam Workshop API (IPublishedFileService)

**Priority:** Medium

**Endpoints:**
- `QueryFiles/v1/` - Workshop item listing
- `GetDetails/v1/` - Item metadata

| Field | Type | Potential Value |
|-------|------|-----------------|
| `total` | integer | Total workshop items for game |
| `file_type` | enum | Type of UGC (mod, map, skin) |
| `subscriptions` | integer | Popularity metric |
| `favorited` | integer | Community endorsement |

**USE CASES:**
- Workshop item count as moddability indicator
- Community mod popularity rankings
- UGC ecosystem health metrics
- Filter: "games with active modding communities"

**NOTE:** PICS already provides `workshop: true/false` flag. This would add quantitative depth.

---

### 4. Steam Store Search/Featured API

**Priority:** Low

**Endpoints:**
- `store.steampowered.com/api/featured/` - Featured games
- `store.steampowered.com/api/featuredcategories/` - Category features

| Field | Type | Potential Value |
|-------|------|-----------------|
| `specials[]` | array | Current sale games |
| `coming_soon[]` | array | Upcoming releases |
| `top_sellers[]` | array | Current bestsellers |
| `new_releases[]` | array | Recent launches |

**USE CASES:**
- Track which games get featured placement
- Identify trending/viral games early
- Publisher relationship with Steam (featuring patterns)
- Seasonal sale tracking

---

### 5. Steam Trading Cards API (IEconService)

**Priority:** Low

**Endpoint:** Market and inventory APIs

| Field | Type | Potential Value |
|-------|------|-----------------|
| `has_trading_cards` | boolean | Feature flag |
| `card_count` | integer | Card set size |
| `market_price` | float | Collectible value |

**USE CASES:**
- Trading card presence as monetization signal
- Market activity correlation with engagement
- Collector audience targeting

**NOTE:** PICS category 29 (`Steam Trading Cards`) already indicates presence. This adds depth.

---

## Part 3: Third-Party Data Sources Not Used

### 1. ProtonDB API

**Priority:** High for Linux users

**URL:** `https://protondb.com/api/v1/reports/summaries/{appid}.json`

| Field | Type | Potential Value |
|-------|------|-----------------|
| `tier` | enum | platinum/gold/silver/bronze/borked |
| `score` | float | Numeric compatibility score |
| `total_reports` | integer | Test sample size |
| `trending_tier` | enum | Recent performance trend |

**USE CASES:**
- Linux/Steam Deck compatibility beyond official ratings
- Community-verified Proton performance
- Identify games working better than official status
- Linux market segment analysis

**COVERAGE:** ~25,000 games with Proton reports

---

### 2. IGDB (Internet Game Database)

**Priority:** High for franchise data

**URL:** `https://api.igdb.com/v4/games`

| Field | Type | Potential Value |
|-------|------|-----------------|
| `franchise` | reference | Franchise/series relationships |
| `involved_companies` | array | Publisher/developer with roles |
| `platforms` | array | Multi-platform availability |
| `similar_games` | array | IGDB's similarity graph |
| `themes` | array | Thematic classification |
| `game_modes` | array | Single/multi/coop/etc |
| `player_perspectives` | array | First-person/third-person/etc |
| `time_to_beat` | object | Main/extra/completionist times |

**USE CASES:**
- **Franchise detection** - "Part of the Dark Souls series"
- **Cross-platform tracking** - Console port availability
- **Series relationships** - Sequels, prequels, spinoffs
- **Player perspective** - First-person vs third-person filter
- **Time to beat** - Content length classification

**RATE LIMIT:** 4 requests/second
**COVERAGE:** 500,000+ games globally
**CHALLENGE:** Requires Steam appid -> IGDB id matching

---

### 3. IsThereAnyDeal API

**Priority:** High for pricing insights

**URL:** `https://api.isthereanydeal.com/`

| Field | Type | Potential Value |
|-------|------|-----------------|
| `price_history` | array | Historical price points |
| `lowest_price` | object | All-time low with date |
| `bundles` | array | Bundle appearances |
| `sales_count` | integer | How often on sale |
| `avg_discount` | float | Typical discount percentage |

**USE CASES:**
- **Price history** - Pricing strategy analysis
- **Sale patterns** - Seasonal discount trends
- **Bundle tracking** - Bundled game identification
- **Price elasticity** - How discounts affect visibility
- **Publisher pricing strategies** - Compare pricing across publishers

**RATE LIMIT:** 100 requests/hour
**COVERAGE:** 500,000+ games with pricing data

---

### 4. HowLongToBeat (Unofficial)

**Priority:** Medium

**URL:** Unofficial scraping required

| Field | Type | Potential Value |
|-------|------|-----------------|
| `main_story` | hours | Campaign length |
| `main_extras` | hours | Completionist-lite |
| `completionist` | hours | 100% time |
| `all_styles` | hours | Average across playstyles |

**USE CASES:**
- **Content length classification** - Short (<10h) vs Long (>50h)
- **Value proposition** - Hours per dollar
- **Genre benchmarking** - RPG expectations vs shooter expectations
- **Alternative to SteamSpy playtime** - More accurate for completion

**COVERAGE:** ~50,000 games
**RISK:** Unofficial, could be blocked

---

### 5. SteamGridDB

**Priority:** Low (requires image pipeline)

**URL:** `https://www.steamgriddb.com/api/v2/`

| Field | Type | Potential Value |
|-------|------|-----------------|
| `grids[]` | array | Custom grid artwork |
| `heroes[]` | array | Banner images |
| `logos[]` | array | Game logos |
| `icons[]` | array | Icon variations |

**USE CASES:**
- **Visual similarity** - Image embedding based matching
- **Art style analysis** - Visual design trends
- **Thumbnail alternatives** - Better quality assets

**COVERAGE:** 50,000+ games
**RATE LIMIT:** 1000 requests/day

---

### 6. OpenCritic API

**Priority:** Low

**URL:** `https://opencritic.com/api/game/`

| Field | Type | Potential Value |
|-------|------|-----------------|
| `topCriticScore` | float | Critic average (0-100) |
| `percentRecommended` | float | % of critics recommending |
| `tier` | enum | Mighty/Strong/Fair/Weak |
| `reviews` | array | Individual critic reviews |

**USE CASES:**
- **Critic vs User sentiment** - Compare to Steam reviews
- **Launch reception** - Professional reviewer scores
- **Review embargo patterns** - When reviews appear

**COVERAGE:** ~10,000 major releases
**CHALLENGE:** Matching to Steam appids

---

## Part 4: Embedding Enhancement Opportunities

Current embedding text includes:
- Name, Type, Developers, Publishers
- Genres, Tags, Categories
- Platforms, Release Date, Price
- Controller Support, Steam Deck
- Review Score/Percentage

**Potential additions from unused data:**

| Data Point | Source | Embedding Text Example |
|------------|--------|------------------------|
| Description | Storefront | Full game description text |
| Achievement count | Steam API | "Achievement system: 150 achievements" |
| Unlock rate | Steam API | "Challenging (avg 15% completion)" |
| Update frequency | News API | "Actively updated (last patch: 3 days ago)" |
| Franchise | IGDB | "Part of the Dark Souls series" |
| Content length | HLTB | "Long RPG: 80+ hours to complete" |
| Proton rating | ProtonDB | "Linux: Platinum compatibility" |
| Workshop | Workshop API | "Active modding: 5,000+ workshop items" |
| Price history | ITAD | "Frequently discounted (avg 40% off)" |
| Language count | Storefront | "Localized in 15 languages" |
| System requirements | Storefront | "High-end: RTX 3070 recommended" |

---

## Part 5: Summary - Priority Recommendations

### Tier 1: Low Effort, High Value (Implement First)

1. **News API Integration** - Code already exists, just needs worker
2. **Storefront Descriptions** - Add 3 text fields to capture
3. **Achievement Count** - Single API call per game
4. **Supported Languages** - Already in response, just not stored

### Tier 2: Medium Effort, High Value

5. **Achievement Unlock Rates** - New table + scheduled worker
6. **Individual Review Sampling** - Capture top 10 reviews per game for NLP
7. **IsThereAnyDeal Integration** - Price history tracking
8. **ProtonDB Integration** - Linux compatibility depth

### Tier 3: High Effort, Medium Value

9. **IGDB Integration** - Franchise/series relationships (requires ID matching)
10. **Workshop Item Counts** - UGC ecosystem metrics
11. **HowLongToBeat** - Content length (unofficial API risk)

### Tier 4: Future Exploration

12. **Image Embeddings** - Visual similarity via screenshots/capsules
13. **Review NLP Pipeline** - Full sentiment analysis
14. **Cross-platform Tracking** - Console port detection

---

## Implementation Considerations

**Rate Limits:**
- New APIs must respect rate limits
- Consider priority-based fetching (high-activity games first)
- Batch operations where possible

**Database Impact:**
- New columns require migrations
- Large text fields (descriptions) need storage planning
- Consider separate tables for high-cardinality data (achievements, reviews)

**Embedding Changes:**
- Adding new data to embeddings requires re-embedding all entities
- Use hash-based change detection to minimize re-embedding
- Consider versioning embedding schemas

**Third-Party Terms:**
- Verify terms of service for each third-party API
- Some unofficial APIs (HLTB) carry legal risk
- Consider attribution requirements

---

*Document generated: January 11, 2026*
