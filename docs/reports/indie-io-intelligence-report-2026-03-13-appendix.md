# indie.io Intelligence Report Appendix

As of March 13, 2026

## Methodology

- Internal data source: read-only queries against the live Supabase Postgres database.
- Latest daily metrics date: **2026-03-13**.
- Latest CCU snapshot observed: **2026-03-13 23:42:54 UTC**.
- `publisher_metrics` timestamp for indie.io: **2026-03-13 22:40:58 UTC**.
- Portfolio definition for live-catalog analysis: `apps.type = 'game' AND is_released = TRUE AND is_delisted = FALSE`.
- Pipeline definition: any game with `release_date > CURRENT_DATE` or `release_state = 'prerelease'` or `is_released IS DISTINCT FROM TRUE`.
- Launch-chronology scope: **187** `apps.type = 'game'` records linked to indie.io; **1** additional linked app is not typed as a game and is excluded from the chronology table.
- `steam_launch_date` in the chronology tables is `apps.release_date`.
- `steam_launch_raw` is `apps.release_date_raw` and is preserved when `release_date` is null so `Coming soon` / `To be announced` records remain visible.
- `went_live_proxy_date` is `apps.store_asset_mtime`, which repo docs describe as a Steam PICS store-page creation / visibility proxy rather than a confirmed player-launch timestamp.
- `db_created_date` is included only for traceability; it reflects internal row creation and backfill timing, not a market event.
- `original_release_date` is not persisted in the warehouse and therefore cannot be used for the all-games chronology.
- `publisher_metrics` was used for cross-publisher ranking and peer selection only because it materially understates indie.io's current title-level sums relative to `latest_daily_metrics`.

## Public Team Intelligence

Official company pages do not expose a complete employee directory, so this is a best-effort public roster rather than an authoritative HR file. The most useful source is the official *One Lonely Outpost* credits page published on **May 31, 2025**, which attributes **36 indie.io contributors** across leadership, business development, marketing, community, events, operations, technology, design, engineering, QA, finance, HR, IT, and wiki operations. Adding recent official bylines, press contacts, and a small set of older pre-rebrand Freedom Games operators surfaces **41 named people** tied to indie.io or the Freedom Games lineage.

`Current` is reserved for people with recent 2025-2026 public evidence tying them directly to indie.io. `Unclear` means the person is publicly attributable to the company, but the reviewed sources do not confirm whether they remained active as of March 13, 2026. No one is labeled `former` unless an explicit public source says so.

### Best-effort public roster

| Name | Most recent public role | Status | Public history summary | Evidence | Sources |
| --- | --- | --- | --- | --- | --- |
| Donovan Duncan | CEO & Co-Founder / Co-Founder | current | Co-founded Freedom Games / indie.io; public org-chart materials tie him to prior senior leadership at Curse and Fandom. | High / 2026-03-13 access | [support](https://support.wiki.gg/wiki/Indie.io), [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits), [The Org](https://theorg.com/org/freedom-games/org-chart/donovan-duncan), [GamesPress](https://www.gamespress.com/Introducing-indieio---The-Next-Evolution-of-Indie-Game-Development-Mar) |
| Ben Robinson | COO & Co-Founder / Co-Founder | current | Official support materials identify him as former Gamepedia Director of Wiki Partnerships; public profiles tie him to Curse, Twitch, Fandom, and wiki.gg. | High / 2026-03-13 access | [support](https://support.wiki.gg/wiki/Indie.io), [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits), [The Org](https://theorg.com/org/freedom-games/org-chart/ben-robinson) |
| Benjamin Tarsa | Director of Business Development / Director of Publishing | current | Public sources place him in Curse / Gamepedia / Fandom-adjacent publishing roles before indie.io. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits), [support](https://support.wiki.gg/wiki/Indie.io), [The Org](https://theorg.com/org/freedom-games/org-chart/benjamin-tarsa) |
| Emmanuel Franco | Creative Director | current | Public org-chart sources tie him to earlier digital media and content-production roles before indie.io. | Medium / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits), [The Org](https://theorg.com/org/freedom-games/org-chart/emmanuel-franco) |
| Jordan Kahn | Director of Operations | current | Public org-chart sources tie him to earlier esports, live-event, and studio operations roles. | Medium / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits), [The Org](https://theorg.com/org/freedom-games/org-chart/jordan-kahn) |
| Evan Bryant | Senior Director of Technology | current | Public org-chart sources tie him to engineering management across EBSCO, Curse, and Fandom. | Medium / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits), [The Org](https://theorg.com/org/freedom-games/org-chart/evan-bryant) |
| Amanda Hoppe | CFO / Financial Controller | current | Runway identifies her as CFO in July 2025; the official May 2025 credits page still lists Financial Controller. | High / 2025-07-06 | [Runway](https://runway.com/customer-stories/indie-io), [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits), [The Org](https://theorg.com/org/freedom-games/org-chart/amanda-h) |
| Jessica "Jess" Mitchell | Director of Marketing / official author byline | current | Official credits and posts consistently place her in marketing leadership; robust pre-indie.io history was not surfaced in reviewed sources. | High / 2025-08-21 | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits), [PAX West](https://www.indie.io/post/indie-io-is-headed-to-pax-west), [DevGAMM](https://devgamm.com/portugal2025/event-highlights/) |
| Ben Smith | Marketing Manager | current | Public bios outside indie.io tie him to local government, hospitality, and podcast / media work before the company. | Medium / 2025-10-21 | [GamesPress](https://www.gamespress.com/Plagun-Launches-on-Steam-November-5th), [TooManyGames](https://toomanygames.com/special-guest/ben-smith/), [Niche Gamer](https://nichegamer.com/indie-io-pax-east-2025-interview-and-previews/) |
| Christopher Fries | Writer / editorial contributor | current | Active official indie.io bylines in January-February 2026; prior public history was not surfaced in prioritized sources. | High / 2026-01-14 | [HumanitZ](https://www.indie.io/post/sandbox-zombie-survival-humanitz-exits-steam-early-access-on-feb-6), [DeTechtive 2112](https://www.indie.io/post/detechtive-2112-now-available-on-steam) |
| John C. Boone II | Project Manager | unclear | Public game-dev biography spans NovaLogic, 3DO, Atari / Black Ops, and Genuine Games before his indie.io credits. | Medium / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits), [MobyGames bio](https://www.mobygames.com/person/30516/john-c-boone-ii/) |
| Patrick "pcj" Johnston | Head of Wikis | unclear | Public credits tie him to the `wiki.gg` / wiki-operations function; broader public career detail was not surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Kerri King | Game Designer | unclear | Public org-chart sources also list Dev Ops Analyst II and earlier Bad Gateway Games work. | Medium / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits), [The Org](https://theorg.com/org/freedom-games/org-chart/kerri-king) |
| Ianna Dria Besa | Senior Motion Graphics Designer | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Veronica Irizarry | Graphic Designer | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Angela Maldonado | Graphic Designer | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Carrol Dufault | Marketing Coordinator | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Minerva Filipiak | Copywriter | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Katie VanClieaf | Marketing Manager | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Destinee Cleveland | Event Marketing Manager | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Annette Bowen | Community Manager | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Jordan Taylor | Business Development Analyst | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Ciera Adair | Operations Manager | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Brian Borg | Lead Programmer | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Vitor Hugo Moura | Associate Game Designer | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Tony Cervantes | Game Designer | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Adam Carmichael | Programmer | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Joshua Scott | Programmer | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Alexandre Carchano | QA Analyst | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Vitoria Ama | QA Manager | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Josh Mitchell | QA Analyst | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Caroline Frattini | QA Analyst | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Gabriel Bergami | QA Analyst | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Matthew Schwartz | Producer | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Jonathan Johnson | IT Manager | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| John Popilek | Lead Software Engineer | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Kristi Harms | Junior Accountant / HR assistant | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |
| Kiana Cassell | HR Manager | unclear | No prior public history surfaced in reviewed sources. | High / 2025-05-31 credits | [credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) |

The 36-name official credits snapshot is directionally aligned with indie.io's public claim of a **35-person remote team**, but it should not be treated as a precise payroll count. Credits pages can include embedded contributors, contractors, or people whose status changed after publication.

### Historical pre-rebrand operators

These names extend the roster into the earlier Freedom Games period. They come from public credits databases rather than current official company pages, so they are useful for lineage mapping but weaker for present-tense staffing.

| Name | Most recent public role | Status | Public history summary | Evidence | Sources |
| --- | --- | --- | --- | --- | --- |
| Francis Gaudette | Director of Tech | unclear | Public *Mars Base* credits place him in early Freedom Games technical leadership; later current-status evidence was not surfaced. | Low / 2022 credits | [Mars Base credits](https://www.mobygames.com/game/192198/mars-base/credits/windows/) |
| Bryan Herren | Director of Marketing | unclear | Public *Mars Base* credits place him in early Freedom Games marketing leadership; later current-status evidence was not surfaced. | Low / 2022 credits | [Mars Base credits](https://www.mobygames.com/game/192198/mars-base/credits/windows/) |
| Elisabeth Reeve | Social Media Manager | unclear | Public *Mars Base* credits place her in early Freedom Games social-media leadership; later current-status evidence was not surfaced. | Low / 2022 credits | [Mars Base credits](https://www.mobygames.com/game/192198/mars-base/credits/windows/) |

## Launch Chronology Summary

The chronology table below is intentionally broader than the live-catalog performance table. It covers every indie.io-linked record with `apps.type = 'game'`, including released, prerelease, delisted, and metadata-edge-case rows.

| Metric | Value | Read |
| --- | ---: | --- |
| Game records in chronology | 187 | All linked `type = 'game'` records |
| Non-game linked records excluded | 1 | Keeps the chronology aligned to the user request for games only |
| With `release_date` | 136 | Structured Steam launch date present |
| With `store_asset_mtime` proxy | 99 | Proxy coverage is partial |
| Same-day launch and proxy | 7 | Very limited direct alignment |
| Proxy before launch | 14 | Plausible page-lead cases |
| Proxy after launch | 47 | Too common to treat proxy as literal go-live |
| Missing either field | 119 | Chronology completeness is weak |
| Missing `release_date` | 51 | Falls back to `release_date_raw` strings only |
| Missing proxy | 88 | No usable store-page proxy present |

| Longest apparent pre-release page lead | Steam launch date | Proxy date | Days |
| --- | --- | --- | ---: |
| Yankee Rabbits | 2026-03-04 | 2025-09-12 | 173 |
| Subway Invasion | 2026-04-03 | 2025-12-04 | 120 |
| SoulQuest | 2026-04-01 | 2025-12-31 | 91 |
| Elemental Brawl | 2026-01-13 | 2026-01-05 | 8 |
| Kriophobia | 2025-11-20 | 2025-11-12 | 8 |

| Largest post-release proxy lag | Steam launch date | Proxy date | Days |
| --- | --- | --- | ---: |
| Jetboard Joust | 2020-10-23 | 2025-05-01 | 1,651 |
| Godstrike | 2021-04-15 | 2025-05-01 | 1,477 |
| Coromon | 2022-03-31 | 2026-03-12 | 1,442 |
| Twilight Memoria | 2021-08-20 | 2025-07-14 | 1,424 |
| Cat Cafe Manager | 2022-04-14 | 2025-08-14 | 1,218 |

## Data Reconciliation

| Metric | `publisher_metrics` | Summed live catalog | Difference |
| --- | ---: | ---: | ---: |
| Game count | 188 | 128 | `publisher_metrics` includes non-live relationships |
| Owners | 960,000 | 5,900,000 | `publisher_metrics` materially lower |
| Reviews | 42,476 | 74,484 | `publisher_metrics` materially lower |
| CCU | 3,246 | 3,243 | Essentially aligned |

Interpretation: use `publisher_metrics` for rank context and precomputed trend fields; use `latest_daily_metrics` for title-level and live-catalog facts.

## Rank Snapshot

| Metric | Value | Rank | Universe |
| --- | ---: | ---: | ---: |
| Game count | 188 | 10 | 54,037 |
| Total owners | 960,000 | 53 | 54,037 |
| Revenue estimate | $17.1M | 54 | 54,037 |
| Total CCU | 3,246 | 214 | 54,037 |
| Total reviews | 42,476 | 271 | 54,037 |
| Avg review score | 85 | 4,792 | 54,037 |
| 30d CCU growth | -35.61% | 8,655 | 54,037 |

## Concentration

| Bucket | Owners share | Review share | CCU share |
| --- | ---: | ---: | ---: |
| Top 5 live titles | 43.2% | 50.9% | 91.0% |
| Top 10 live titles | 59.3% | 69.2% | 94.6% |

## Review Quality Distribution

| Review band | Games | Share of live catalog |
| --- | ---: | ---: |
| 90-100% | 37 | 28.9% |
| 80-89.9% | 34 | 26.6% |
| 70-79.9% | 28 | 21.9% |
| <70% | 20 | 15.6% |
| No reviews | 9 | 7.0% |

## Steam Deck Coverage

| Deck category | Games | Share of live catalog |
| --- | ---: | ---: |
| Playable | 56 | 43.8% |
| Verified | 42 | 32.8% |
| Unclassified | 21 | 16.4% |
| Unsupported | 9 | 7.0% |

## Release Cadence

```text
release_year|released_games
2017|1
2019|2
2020|1
2021|8
2022|12
2023|22
2024|28
2025|43
2026|11
```

## Peer Cohort

Selection logic: publishers with `game_count BETWEEN 50 AND 300`, `total_owners BETWEEN 250000 AND 4000000`, `unique_developers >= 25`, ranked by log-distance to indie.io on game count, owners, reviews, and unique developers.

```text
publisher_id|publisher_name|game_count|total_owners|total_reviews|total_ccu|revenue_estimate_cents|avg_review_score|unique_developers|ccu_growth_30d_percent|review_velocity_30d|distance
2724|Sekai Project|176|920000|44187|352|479580000|96|89|-11.15|12.53|0.795
1536|Strategy First|210|920000|58677|509|713980000|82|120|-20.81|11.63|0.825
1571|Fulqrum Publishing|129|900000|63043|1453|640600000|89|83|-11.39|19.67|1.553
5836|Gamersky Games|168|580000|65632|8716|247220000|89|100|11.14|35.41|1.582
2278|PLAYISM|146|1030000|149818|841|566570000|91|116|-15.51|35.24|1.966
1837|Microids|126|580000|40884|393|902820000|78|54|-6.42|9.57|2.089
5021|Kagura Games|212|430000|16901|1310|713070000|85|121|-16.73|13.27|2.185
1530|Nightdive Studios|111|1000000|25997|530|896800000|91|51|-16.07|11.79|2.263
2115|tinyBuild|119|990000|160439|5146|1758010000|85|89|-8.81|78.93|2.464
3460|PQube|87|490000|34410|263|1250010000|84|74|12.44|14.05|2.485
```

## Partner Concentration

```text
developer_name|game_count|owners_midpoint_sum|total_reviews|total_ccu
Reverie World Studios|8|315000|4843|8
YSY Softworks|6|150000|64|0
indie.io|3|195000|2781|6
@TonyDevGame|3|20000|201|0
TRAGsoft|2|750000|6682|83
Afterburner Studios|2|700000|5082|5
Sword & Axe LLC|2|500000|4206|30
Twilight|2|75000|25|0
Pangea Game Studios|2|75000|297|7
Xurzerth|2|75000|39|0
CosmicNobab Games|2|45000|514|3
Lion Core|2|35000|28|0
Pepperbox Studios|2|35000|82|1
Orbiting Disco|2|35000|154|5
Gamecom Team|2|35000|1072|4
OverPowered Team|2|20000|313|0
Blusagi Team|2|10000|48|0
Shotx|2|10000|118|1
stellarNull|2|10000|159|1
Cognitive Forge|2|10000|103|1
```

## Genre and Tag Mix

```text
type|name|game_count
genre|Indie|105
genre|Adventure|75
genre|Action|71
genre|RPG|47
genre|Strategy|37
genre|Simulation|30
genre|Casual|28
genre|Early Access|9
genre|Massively Multiplayer|1
genre|Sports|1
tag|Exploration|25
tag|RPG|25
tag|Strategy|25
tag|Adventure|24
tag|Action|23
tag|Roguelite|20
tag|Roguelike|18
tag|Combat|15
tag|Story Rich|15
tag|Bullet Hell|13
tag|Co-op|13
tag|Puzzle|12
tag|PvE|12
tag|Action RPG|11
tag|Casual|11
tag|Multiplayer|11
tag|Pixel Graphics|11
tag|Simulation|11
tag|Survival|11
tag|Action Roguelike|10
tag|Base Building|9
tag|Platformer|9
tag|Psychological Horror|9
tag|Survival Horror|9
tag|Turn-Based Strategy|9
tag|Turn-Based Tactics|9
tag|Action-Adventure|8
tag|FPS|8
tag|Horror|8
tag|Sci-fi|8
```

## Highest Current CCU Titles

| Game | Release | CCU peak | Reviews | Positive |
| --- | --- | ---: | ---: | ---: |
| HumanitZ | 2026-02-06 | 2,446 | 11,158 | 74.7% |
| Symphony of War: The Nephilim Saga | 2022-06-10 | 409 | 14,181 | 94.6% |
| Echoes of the Plum Grove | 2024-04-29 | 84 | 3,013 | 87.9% |
| Coromon | 2022-03-31 | 83 | 6,682 | 85.3% |
| World of Football | 2024-11-20 | 26 | 187 | 81.8% |
| Dark Deity 2 | 2025-03-24 | 22 | 1,453 | 91.2% |
| Everholm | 2024-11-11 | 20 | 273 | 78.8% |
| The Witch of Fern Island | 2024-02-27 | 19 | 809 | 71.0% |
| Airborne Kingdom | 2022-03-07 | 12 | 2,323 | 86.9% |
| 9 Years of Shadows | 2023-03-27 | 10 | 3,075 | 76.7% |

## Most Reviewed Live Titles

| Game | Reviews | Positive | Quality band |
| --- | ---: | ---: | --- |
| Symphony of War: The Nephilim Saga | 14,181 | 94.6% | Strong |
| HumanitZ | 11,158 | 74.7% | Mixed-positive |
| Coromon | 6,682 | 85.3% | Good |
| Dreamscaper | 3,139 | 88.0% | Good |
| Cat Cafe Manager | 3,097 | 88.0% | Good |
| 9 Years of Shadows | 3,075 | 76.7% | Mixed-positive |
| Echoes of the Plum Grove | 3,013 | 87.9% | Good |
| Dark Deity | 2,753 | 72.5% | Mixed-positive |
| Medieval Kingdom Wars | 2,601 | 76.2% | Mixed-positive |
| Airborne Kingdom | 2,323 | 86.9% | Good |
| To The Rescue! | 2,114 | 66.2% | Weak |
| Mail Time | 1,601 | 84.9% | Good |
| Dark Deity 2 | 1,453 | 91.2% | Strong |
| Stars End | 1,392 | 62.6% | Weak |
| Troublemaker | 977 | 88.3% | Good |

## Pipeline Flags

This is not a clean “upcoming releases” table. It includes future-dated records, titles flagged `prerelease`, and games whose `is_released` flag is not true. Several are also marked delisted, which suggests metadata drift or a workflow artifact rather than a pure launch pipeline.

```text
appid|name|release_date|release_state|is_released|is_delisted
1119840|Sands of Aura|2023-10-27|released||false
3922140|Yankee Rabbits|2026-03-04|prerelease|true|false
2512450|SoulQuest|2026-04-01|prerelease||true
4130340|Subway Invasion|2026-04-03|prerelease|false|true
2892380|AI.VI||prerelease||true
3843760|Ashes of the Damned: The Forgotten Ward||prerelease|false|true
2398140|Bail Force: Cyberpunk Bounty Hunters||released||false
1908380|Binary Golf||prerelease|false|true
4066390|City States: Medieval||prerelease|false|true
2810210|Codename CURE II||prerelease|false|true
2878390|Conjurers||prerelease|false|true
3415380|CoreRunner||prerelease|false|true
3195360|Coromon: Rogue Planet||prerelease|false|true
4059000|Cozy Builder||prerelease|false|true
2440030|Crownless Abyss||prerelease|false|true
4063600|Cryorise||prerelease|false|true
3575650|Dark Adelita||prerelease|false|true
3437580|Descension||prerelease|false|true
2906040|Destiny of Heroes||prerelease|false|true
3967790|Disgrace - When Our Beautiful World Disappears||prerelease|false|true
3849020|Don't Burst My Balloon||prerelease|false|true
3034660|Dunebound Tactics||prerelease|false|true
2237320|Dwarf Delve||prerelease|false|true
2927490|Dwellink: War of the Nine||prerelease|false|true
3766600|Eclipse of Fate||prerelease|false|true
2749950|Esports Manager 2026||prerelease|false|true
3373440|Everybody Herds||prerelease|false|true
1475310|Factory Magnate||prerelease|false|true
3393740|Firefly Village||released||false
2174750|Get Your Tentacles Off My Waifu!||prerelease|false|true
3080560|Graphite||prerelease|false|true
2127570|Greenhearth Necromancer||prerelease|false|true
3068230|Mad Metal||prerelease|false|true
1686230|Mayday: The Survival Island||prerelease|false|true
3146560|Mentari||prerelease|false|true
3536950|Mini Worlds Dioramas||prerelease|false|true
3517930|Nemorsys ||prerelease|false|true
3094210|Nullstar: Solus||prerelease|false|true
3316970|Once Upon A Kingdom||prerelease|false|true
3638080|Outcity||prerelease|false|true
2926700|Presidential Rise||prerelease|false|true
2664400|Renaissance Kingdom Wars - Prologue||prerelease|false|true
2958410|Rise of The Newborns||prerelease|false|true
3445360|Rust & Roots||prerelease|false|true
2912820|Sages of Vandaleria: Rebirth of an Empire||prerelease|false|true
1513430|Saghala: Heroes of the Last World||prerelease|false|true
3494450|Skyvern||prerelease|false|true
2748520|Sunflowers and the Goddess of Death||prerelease|false|true
3411970|The Abbess Garden||released||false
3553150|The Cascadier||prerelease|false|true
2173770|The Wings of Dawn||prerelease|false|true
1814570|Transcendence Legacy - Voidswept||released||false
2440010|Twilight Memoria : Freedom||prerelease|false|true
3957950|Undockable||prerelease|false|true
1754250|We Took That Trip||prerelease|false|true
```

## Full Game Launch Chronology

Sorted by `release_date DESC NULLS LAST, name`. `went_live_proxy_date` is `apps.store_asset_mtime` and remains a proxy only.

```text
appid|name|steam_launch_date|steam_launch_raw|went_live_proxy_date|db_created_date|release_state|is_released|is_delisted|timing_note
4130340|Subway Invasion|2026-04-03|Apr 3, 2026|2025-12-04|2025-12-28|prerelease|false|true|page_before_release
2512450|SoulQuest|2026-04-01|April 2026|2025-12-31|2025-12-28|prerelease||true|page_before_release
3057670|Pluto|2026-03-09|Mar 9, 2026|2026-03-13|2025-12-28|released|true|false|page_after_release
3922140|Yankee Rabbits|2026-03-04|Mar 4, 2026|2025-09-12|2025-12-28|prerelease|true|false|page_before_release
2944590|Chowdown Kitty|2026-02-12|Feb 12, 2026|2026-02-11|2025-12-28|released|true|false|page_before_release
3330930|Locked in my Darkness 2: The Room|2026-02-11|Feb 11, 2026|2026-02-09|2025-12-28|released|true|false|page_before_release
3644160|Monsters and Me 🧟♂🤷♂|2026-02-10|Feb 10, 2026|2026-02-09|2025-12-28|released|true|false|page_before_release
1766060|HumanitZ|2026-02-06|Feb 6, 2026|2026-02-04|2025-12-28|released|true|false|page_before_release
3531630|Tomb of the Bloodletter|2026-02-05|Feb 5, 2026|2026-02-23|2025-12-28|released|true|false|page_after_release
2941360|Pie in the Sky|2026-02-02|Feb 2, 2026|2026-01-28|2025-12-28|released|true|false|page_before_release
2201620|Adaptory|2026-01-26|Jan 26, 2026|2026-01-26|2025-12-28|released|true|false|same_day
3544390|Air Hares|2026-01-14|Jan 14, 2026|2026-01-14|2025-12-28|released|true|false|same_day
1075880|Elemental Brawl|2026-01-13|Jan 13, 2026|2026-01-05|2025-12-28|released|true|false|page_before_release
1604630|Kriophobia|2025-11-20|Nov 20, 2025|2025-11-12|2025-12-28|released|true|false|page_before_release
3128940|Rune Ark|2025-11-18|Nov 18, 2025||2025-12-28|released|true|false|missing_proxy
3168930|Infect Cam|2025-11-17|Nov 17, 2025|2025-11-12|2025-12-28|released|true|false|page_before_release
2653120|Donna: The Canine Quest|2025-11-10|Nov 10, 2025||2025-12-28|released|true|false|missing_proxy
3805100|PLAGUN – The Plague Goes On|2025-11-05|Nov 5, 2025||2025-12-28|released|true|false|missing_proxy
2761000|Tales of Old: Dominus|2025-11-03|Nov 3, 2025|2025-10-30|2025-12-28|released|true|false|page_before_release
2932990|The Zombie Slayers|2025-10-31|Oct 31, 2025|2025-10-30|2025-12-28|released|true|false|page_before_release
3006080|Aris Arcanum|2025-10-27|Oct 27, 2025|2026-03-12|2025-12-28|released|true|false|page_after_release
2567770|BoneField: Bodycam Horror|2025-10-27|Oct 27, 2025||2025-12-28|released|true|false|missing_proxy
1689390|Mythrealm|2025-10-27|Oct 27, 2025|2025-10-27|2025-12-28|released|true|false|same_day
3819310|The Scarlet Harvest|2025-10-23|Oct 23, 2025||2025-12-28|released|true|false|missing_proxy
2578140|I Mother|2025-10-22|Oct 22, 2025||2025-12-28|released|true|false|missing_proxy
2168260|Forgotten Seas|2025-10-11|Oct 11, 2025|2025-12-11|2025-12-28|released|true|false|page_after_release
2876640|Color Breakers 2|2025-10-09|Oct 9, 2025||2025-12-28|released|true|false|missing_proxy
1435410|Shrine's Legacy|2025-10-07|Oct 7, 2025|2025-12-17|2025-12-28|released|true|false|page_after_release
2052160|Don't Die, Collect Loot|2025-09-19|Sep 19, 2025|2026-02-17|2025-12-28|released|true|false|page_after_release
3256850|Tic Tactic|2025-09-18|Sep 18, 2025|2025-09-18|2025-12-28|released|true|false|same_day
2479770|Troublemaker 2: Beyond Dream|2025-09-15|Sep 15, 2025||2025-12-28|released|true|false|missing_proxy
3440120| Knights of the Crusades|2025-09-06|Sep 6, 2025|2026-01-05|2025-12-28|released|true|false|page_after_release
2412110|Rogue Labyrinth|2025-09-01|Sep 1, 2025|2026-02-16|2025-12-28|released|true|false|page_after_release
3629840|Blast Rush LS|2025-08-21|Aug 21, 2025|2025-08-21|2025-12-28|released|true|false|same_day
1318240|Shields of Loyalty|2025-08-12|Aug 12, 2025|2025-12-19|2025-12-28|released|true|false|page_after_release
3639120|Vartio|2025-08-12|Aug 12, 2025||2025-12-28|released|true|false|missing_proxy
2412280|Valiant Tactics|2025-08-04|Aug 4, 2025||2025-12-28|released|true|false|missing_proxy
3472300|Medievaly: Battle Simulator|2025-07-16|Jul 16, 2025||2025-12-28|released|true|false|missing_proxy
3213790|Red Pistol|2025-07-15|Jul 15, 2025||2025-12-28|released|true|false|missing_proxy
2733070|Heroes of Mount Dragon|2025-06-25|Jun 25, 2025||2025-12-28|released|true|false|missing_proxy
3407990|Second Chances|2025-06-25|Jun 25, 2025||2025-12-28|released|true|false|missing_proxy
3357380|NEDRA|2025-06-23|Jun 23, 2025|2025-08-01|2025-12-28|released|true|false|page_after_release
1631230|Grimstar: Crystals are the New Oil!|2025-06-16|Jun 16, 2025||2025-12-28|released|true|false|missing_proxy
3226540|Void Scout|2025-06-02|Jun 2, 2025|2025-08-14|2025-12-28|released|true|false|page_after_release
2754370|Voidsayer|2025-06-02|Jun 2, 2025||2025-12-28|released|true|false|missing_proxy
3180670|Undying Flower|2025-05-16|May 16, 2025||2025-12-28|released|true|false|missing_proxy
3410640|Rogue Worlds|2025-05-14|May 14, 2025|2025-07-24|2025-12-28|released|true|true|page_after_release
1048860|Crypterion|2025-04-29|Apr 29, 2025||2025-12-28|released|true|false|missing_proxy
3317660|Kaamos: Puzzle Roguelike|2025-04-28|Apr 28, 2025||2025-12-28|released|true|false|missing_proxy
2679660|Traveler's Refrain|2025-04-11|Apr 11, 2025|2025-05-01|2025-12-28|released|true|false|page_after_release
2446600|Dark Deity 2|2025-03-24|Mar 24, 2025|2026-03-12|2025-12-28|released|true|false|page_after_release
2271200|Assault On Proxima|2025-03-10|Mar 10, 2025|2025-03-06|2025-12-28|released|true|false|page_before_release
2348730|Hauntsville|2025-03-10|Mar 10, 2025||2025-12-28|released|true|false|missing_proxy
1465550|One Lonely Outpost|2025-03-06|Mar 6, 2025|2025-03-06|2025-12-28|released|true|false|same_day
2336760|Immortal Hunters|2025-03-05|Mar 5, 2025|2025-08-14|2025-12-28|released|true|false|page_after_release
2307170|Everwarder|2025-02-06|Feb 6, 2025||2025-12-28|released|true|false|missing_proxy
1184790|SCP: Fragmented Minds|2025-01-27|Jan 27, 2025|2025-05-29|2025-12-28|released|true|false|page_after_release
3329220|Yet Another Climbing Game|2024-11-28|Nov 28, 2024||2025-12-28|released|true|false|missing_proxy
2533020|Renaissance Kingdom Wars|2024-11-26|Nov 26, 2024||2025-12-28|released|true|false|missing_proxy
2083240|Asterogues|2024-11-20|Nov 20, 2024||2025-12-28|released|true|false|missing_proxy
946880|World of Football|2024-11-20|Nov 20, 2024|2025-06-05|2025-12-28|released|true|false|page_after_release
2312520|Everholm|2024-11-11|Nov 11, 2024|2026-02-18|2025-12-28|released|true|false|page_after_release
1933840|Moon Mystery|2024-10-28|Oct 28, 2024|2025-08-14|2025-12-28|released|true|false|page_after_release
3206410|The Sinking Forest - 沈んだ森 -|2024-10-28|Oct 28, 2024||2025-12-28|released|true|false|missing_proxy
2393580|The Dead Await|2024-10-24|Oct 24, 2024|2025-10-04|2025-12-28|released|true|false|page_after_release
2107180|The Hungry Fly|2024-10-23|Oct 23, 2024||2025-12-28|released|true|false|missing_proxy
2601940|Pinball Spire|2024-10-02|Oct 2, 2024|2025-05-21|2025-12-28|released|true|false|page_after_release
2516170|G.I. Joe: Wrath of Cobra|2024-09-26|Sep 26, 2024|2024-09-26|2025-12-28|released|true|false|same_day
841600|Aura of Worlds|2024-09-24|Sep 24, 2024|2025-08-14|2025-12-28|released|true|false|page_after_release
3095720|Stick It!|2024-09-24|Sep 24, 2024||2025-12-28|released|true|false|missing_proxy
2866640|A Death in the Red Light|2024-09-23|Sep 23, 2024||2025-12-28|released|true|false|missing_proxy
2816570|The Land of the Magnates|2024-08-27|Aug 27, 2024||2025-12-28|released|true|false|missing_proxy
2721530|Afterplace|2024-07-22|Jul 22, 2024||2025-12-28|released|true|false|missing_proxy
2146430|Siegebreaker|2024-07-19|Jul 19, 2024||2025-12-28|released|true|false|missing_proxy
1896570|Final Stardust: Cosmic Nexus|2024-06-24|Jun 24, 2024|2025-08-05|2025-12-28|released|true|false|page_after_release
1830700|ScreenPlay CCG|2024-05-13|May 13, 2024||2025-12-28|released|true|true|missing_proxy
1536090|Echoes of the Plum Grove|2024-04-29|Apr 29, 2024|2025-06-16|2025-12-28|released|true|false|page_after_release
2235820|Jack Holmes : Master of Puppets|2024-04-26|Apr 26, 2024||2025-12-28|released|true|false|missing_proxy
2446700|Doomies (Damikira)|2024-04-24|Apr 24, 2024||2025-12-28|released|true|false|missing_proxy
1897650|Dream Tactics|2024-04-15|Apr 15, 2024||2025-12-28|released|true|false|missing_proxy
1902870|Vertical Kingdom|2024-04-15|Apr 15, 2024||2025-12-28|released|true|false|missing_proxy
1937110|Tetra Tactics|2024-04-09|Apr 9, 2024||2025-12-28|released|true|false|missing_proxy
2835180|Unlinked Mask|2024-03-29|Mar 29, 2024||2025-12-28||true|false|missing_proxy
1573100|Subterrain: Mines of Titan|2024-03-12|Mar 12, 2024||2025-12-28|released|true|false|missing_proxy
1802190|Puzzles For Clef|2024-03-06|Mar 6, 2024||2025-12-28|released|true|false|missing_proxy
1550010|The Witch of Fern Island|2024-02-27|Feb 27, 2024||2025-12-28|released|true|false|missing_proxy
2091410|March of Shrooms|2023-11-13|Nov 13, 2023||2025-12-28|released|true|false|missing_proxy
1839060|Polylithic|2023-11-09|Nov 9, 2023|2025-08-26|2025-12-28|released|true|false|page_after_release
1119840|Sands of Aura|2023-10-27|Oct 27, 2023|2026-02-27|2025-12-28|released||false|page_after_release
1952540|Voltaire: The Vegan Vampire|2023-10-26|Oct 26, 2023||2025-12-28|released|true|false|missing_proxy
2287560|Vengeance of Mr. Peppermint|2023-10-23|Oct 23, 2023||2025-12-28|released|true|false|missing_proxy
1826060|Night Loops|2023-10-16|Oct 16, 2023||2025-12-28|released|true|false|missing_proxy
1932680|LunarLux|2023-09-25|Sep 25, 2023|2024-03-13|2025-12-28|released|true|false|page_after_release
1597310|Airship: Kingdoms Adrift|2023-09-21|Sep 21, 2023|2024-10-28|2025-12-28|released|true|false|page_after_release
1813130|Sugar Shack|2023-09-14|Sep 14, 2023|2024-01-29|2025-12-28|released|true|false|page_after_release
406160|Dust Fleet|2023-08-23|Aug 23, 2023|2024-12-19|2025-12-28|released|true|false|page_after_release
704510|Mercury Fallen|2023-08-22|Aug 22, 2023|2025-02-20|2025-12-28|released|true|false|page_after_release
1302850|Tails of Trainspot|2023-07-30|Jul 30, 2023||2025-12-28|released|true|false|missing_proxy
2155280|Defend Earth: Xenos Survivors|2023-06-19|Jun 19, 2023|2025-05-01|2025-12-28|released|true|false|page_after_release
1789090|Hello Goodboy|2023-05-25|May 25, 2023|2025-05-09|2025-12-28|released|true|false|page_after_release
1906510|Arto|2023-05-01|May 1, 2023|2024-01-26|2025-12-28|released|true|false|page_after_release
1470390|City of Beats|2023-05-01|May 1, 2023||2025-12-28|released|true|false|missing_proxy
2086140|RICE - Repetitive Indie Combat Experience™|2023-05-01|May 1, 2023||2025-12-28|released|true|false|missing_proxy
1682330|The Dead Await: Prologue|2023-05-01|May 1, 2023||2025-12-28|released|true|true|missing_proxy
1607240|Mail Time|2023-04-27|Apr 27, 2023||2025-12-28|released|true|false|missing_proxy
887420|Warman|2023-04-03|Apr 3, 2023|2025-12-17|2025-12-28|released|true|false|page_after_release
1498740|Troublemaker|2023-03-31|Mar 31, 2023||2025-12-28|released|true|false|missing_proxy
1402120|9 Years of Shadows|2023-03-27|Mar 27, 2023||2025-12-28|released|true|false|missing_proxy
2206490|Ruined Kingdom|2023-02-28|Feb 28, 2023||2025-12-28|released|true|false|missing_proxy
623340|Stars End|2023-01-08|Jan 8, 2023||2025-12-28|released|true|false|missing_proxy
2095140|Locked in my Darkness|2022-12-09|Dec 9, 2022|2025-05-12|2025-12-28|released|true|false|page_after_release
748020|TERRACOTTA|2022-11-14|Nov 14, 2022||2025-12-28|released|true|false|missing_proxy
1293730|Broken Pieces|2022-09-09|Sep 9, 2022|2025-07-30|2025-12-28|released|true|false|page_after_release
1520760|Tyrant's Blessing|2022-08-08|Aug 8, 2022||2025-12-28|released|true|false|missing_proxy
1556490|Retreat To Enen|2022-08-01|Aug 1, 2022||2025-12-28|released|true|false|missing_proxy
1488200|Symphony of War: The Nephilim Saga|2022-06-10|Jun 10, 2022||2025-12-28|released|true|false|missing_proxy
1454160|One More Island|2022-05-16|May 16, 2022||2025-12-28|released|true|false|missing_proxy
1386620|Anuchard|2022-04-21|Apr 21, 2022|2025-05-09|2025-12-28|released|true|false|page_after_release
1354830|Cat Cafe Manager|2022-04-14|Apr 14, 2022|2025-08-14|2025-12-28|released|true|false|page_after_release
1218210|Coromon|2022-03-31|Mar 31, 2022|2026-03-12|2025-12-28|released|true|false|page_after_release
1849820|Telepath Tactics Liberated|2022-03-14|Mar 14, 2022|2025-05-20|2025-12-28|released|true|false|page_after_release
982290|Airborne Kingdom|2022-03-07|Mar 7, 2022||2025-12-28|released|true|false|missing_proxy
1270850|Karma City Police|2021-12-16|Dec 16, 2021||2025-12-28|released|true|false|missing_proxy
946720|To The Rescue!|2021-11-02|Nov 2, 2021||2025-12-28|released|true|false|missing_proxy
1300700|Kingdom Wars 4|2021-10-22|Oct 22, 2021|2024-05-21|2025-12-28|released|true|false|page_after_release
1262720|Ruin Raiders|2021-10-14|Oct 14, 2021|2024-01-29|2025-12-28|released|true|false|page_after_release
1402900|Twilight Memoria|2021-08-20|Aug 20, 2021|2025-07-14|2025-12-28|released|true|false|page_after_release
1040420|Dreamscaper|2021-08-05|Aug 5, 2021|2024-01-29|2025-12-28|released|true|false|page_after_release
1374840|Dark Deity|2021-06-15|Jun 15, 2021||2025-12-28|released|true|false|missing_proxy
1476170|Godstrike|2021-04-15|Apr 15, 2021|2025-05-01|2025-12-28|released|true|false|page_after_release
1181600|Jetboard Joust|2020-10-23|Oct 23, 2020|2025-05-01|2025-12-28|released|true|false|page_after_release
1253950|Dreamscaper: Prologue|2020-04-08|Apr 8, 2020||2025-12-28|released|true|true|missing_proxy
1258970|LunarLux Chapter 1|2020-03-23|Mar 23, 2020||2025-12-28|released|true|true|missing_proxy
1036440|Kingdom Wars 2: Definitive Edition|2019-07-09|Jul 9, 2019||2025-12-28|released|true|false|missing_proxy
499660|Medieval Kingdom Wars|2019-01-03|Jan 3, 2019||2025-12-28|released|true|false|missing_proxy
642600|Burst Fighter|2017-09-16|Sep 16, 2017||2025-12-28|released|true|false|missing_proxy
2892380|AI.VI||Mar 18, 2026|2026-02-20|2025-12-28|prerelease||true|missing_release_date
3843760|Ashes of the Damned: The Forgotten Ward||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
2398140|Bail Force: Cyberpunk Bounty Hunters||Jan 16, 2026|2026-01-16|2025-12-28|released||false|missing_release_date
1908380|Binary Golf||Coming soon|2025-11-22|2025-12-28|prerelease|false|true|missing_release_date
4066390|City States: Medieval||To be announced|2025-12-31|2025-12-28|prerelease|false|true|missing_release_date
2810210|Codename CURE II||Coming soon|2026-01-26|2025-12-28|prerelease|false|true|missing_release_date
2878390|Conjurers||Coming soon|2026-01-08|2025-12-28|prerelease|false|true|missing_release_date
3415380|CoreRunner||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
3195360|Coromon: Rogue Planet||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
4059000|Cozy Builder||Coming soon|2025-11-30|2025-12-28|prerelease|false|true|missing_release_date
2440030|Crownless Abyss||Coming soon|2025-08-07|2025-12-28|prerelease|false|true|missing_release_date
4063600|Cryorise||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
3575650|Dark Adelita||Coming soon|2025-12-31|2025-12-28|prerelease|false|true|missing_release_date
3437580|Descension||Coming soon|2025-10-28|2025-12-28|prerelease|false|true|missing_release_date
2906040|Destiny of Heroes||Coming soon|2024-12-17|2025-12-28|prerelease|false|true|missing_release_date
3967790|Disgrace - When Our Beautiful World Disappears||Coming soon|2025-10-07|2025-12-28|prerelease|false|true|missing_release_date
3849020|Don't Burst My Balloon||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
3034660|Dunebound Tactics||Coming soon|2025-06-03|2025-12-28|prerelease|false|true|missing_release_date
2237320|Dwarf Delve||To be announced|2026-02-09|2025-12-28|prerelease|false|true|missing_release_date
2927490|Dwellink: War of the Nine||To be announced|2024-07-13|2025-12-28|prerelease|false|true|missing_release_date
3766600|Eclipse of Fate||Coming soon|2025-12-08|2025-12-28|prerelease|false|true|missing_release_date
2749950|Esports Manager 2026||Coming soon|2026-02-03|2025-12-28|prerelease|false|true|missing_release_date
3373440|Everybody Herds||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
1475310|Factory Magnate||Coming soon|2026-01-06|2025-12-28|prerelease|false|true|missing_release_date
3393740|Firefly Village||Aug 11, 2025|2025-12-15|2025-12-28|released||false|missing_release_date
2174750|Get Your Tentacles Off My Waifu!||To be announced||2025-12-28|prerelease|false|true|missing_release_date
3080560|Graphite||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
2127570|Greenhearth Necromancer||Coming soon|2025-12-15|2025-12-28|prerelease|false|true|missing_release_date
3068230|Mad Metal||Coming soon|2025-11-17|2025-12-28|prerelease|false|true|missing_release_date
1686230|Mayday: The Survival Island||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
3146560|Mentari||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
3536950|Mini Worlds Dioramas||Coming soon|2026-02-11|2025-12-28|prerelease|false|true|missing_release_date
3517930|Nemorsys ||Coming soon|2026-01-29|2025-12-28|prerelease|false|true|missing_release_date
3094210|Nullstar: Solus||Coming soon|2025-11-14|2025-12-28|prerelease|false|true|missing_release_date
3316970|Once Upon A Kingdom||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
3638080|Outcity||Coming soon|2025-11-24|2025-12-28|prerelease|false|true|missing_release_date
2926700|Presidential Rise||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
2664400|Renaissance Kingdom Wars - Prologue||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
2958410|Rise of The Newborns||To be announced||2025-12-28|prerelease|false|true|missing_release_date
3445360|Rust & Roots||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
2912820|Sages of Vandaleria: Rebirth of an Empire||To be announced|2024-09-20|2025-12-28|prerelease|false|true|missing_release_date
1513430|Saghala: Heroes of the Last World||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
3494450|Skyvern||Coming soon|2025-05-21|2025-12-28|prerelease|false|true|missing_release_date
2748520|Sunflowers and the Goddess of Death||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
3411970|The Abbess Garden||Mar 2, 2026|2026-02-23|2025-12-28|released||false|missing_release_date
3553150|The Cascadier||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
2173770|The Wings of Dawn||To be announced||2025-12-28|prerelease|false|true|missing_release_date
1814570|Transcendence Legacy - Voidswept||Apr 4, 2022|2025-07-14|2025-12-28|released||false|missing_release_date
2440010|Twilight Memoria : Freedom||Coming soon|2025-07-30|2025-12-28|prerelease|false|true|missing_release_date
3957950|Undockable||To be announced|2026-02-10|2025-12-28|prerelease|false|true|missing_release_date
1754250|We Took That Trip||Coming soon||2025-12-28|prerelease|false|true|missing_release_date
```

## Full Live Catalog Table

Sorted by owner midpoint, then review count.

```text
appid|name|release_date|owners_midpoint|ccu_peak|total_reviews|positive_pct|price_cents|trend_30d_pct
1488200|Symphony of War: The Nephilim Saga|2022-06-10|750000|409|14181|94.6|1999|1.25
1218210|Coromon|2022-03-31|750000|83|6682|85.3|1999|21.22
1766060|HumanitZ|2026-02-06|350000|2446|11158|74.7|1999|9.90
1040420|Dreamscaper|2021-08-05|350000|5|3139|88.0|2499|-100.00
1374840|Dark Deity|2021-06-15|350000|8|2753|72.5|2499|45.83
982290|Airborne Kingdom|2022-03-07|350000|12|2323|86.9|2499|-17.24
1354830|Cat Cafe Manager|2022-04-14|150000|5|3097|88.0|1999|10.53
1402120|9 Years of Shadows|2023-03-27|150000|10|3075|76.7|1999|-6.25
1536090|Echoes of the Plum Grove|2024-04-29|150000|84|3013|87.9|1999|18.52
946720|To The Rescue!|2021-11-02|150000|5|2114|66.2|799|-100.00
2446600|Dark Deity 2|2025-03-24|150000|22|1453|91.2|2499|2.34
623340|Stars End|2023-01-08|150000|0|1392|62.6|1999|-100.00
1293730|Broken Pieces|2022-09-09|150000|0|450|73.6|299|80.00
499660|Medieval Kingdom Wars|2019-01-03|75000|6|2601|76.2|494|-100.00
1607240|Mail Time|2023-04-27|75000|2|1601|84.9|1999|35.71
1597310|Airship: Kingdoms Adrift|2023-09-21|75000|7|828|73.2|2999|-41.07
1550010|The Witch of Fern Island|2024-02-27|75000|19|809|71.0|2499|36.36
2168260|Forgotten Seas|2025-10-11|75000|7|297|81.8|2499|-28.57
2086140|RICE - Repetitive Indie Combat Experience™|2023-05-01|75000|0|260|74.2|499|100.00
1454160|One More Island|2022-05-16|75000|3|238|68.1|1999|-100.00
2348730|Hauntsville|2025-03-10|75000|1|193|70.5|1899|33.33
2721530|Afterplace|2024-07-22|75000|0|121|97.5|1499|0.00
2866640|A Death in the Red Light|2024-09-23|75000|0|38|76.3|999|0.00
1402900|Twilight Memoria|2021-08-20|75000|0|25|96.0|699|0.00
1498740|Troublemaker|2023-03-31|35000|2|977|88.3|1999|40.00
1184790|SCP: Fragmented Minds|2025-01-27|35000|4|842|92.6|999|10.11
1573100|Subterrain: Mines of Titan|2024-03-12|35000|6|635|76.7|1999|42.86
1465550|One Lonely Outpost|2025-03-06|35000|1|572|63.8|1999|0.00
1933840|Moon Mystery|2024-10-28|35000|0|561|70.1|1999|8.33
2601940|Pinball Spire|2024-10-02|35000|0|515|84.5|1499|-57.41
1897650|Dream Tactics|2024-04-15|35000|5|508|91.7|1799|0.00
1036440|Kingdom Wars 2: Definitive Edition|2019-07-09|35000|0|440|66.8|999|-100.00
1932680|LunarLux|2023-09-25|35000|3|416|95.4|1999|16.67
1556490|Retreat To Enen|2022-08-01|35000|0|384|62.0|2499|-100.00
1520760|Tyrant's Blessing|2022-08-08|35000|0|356|70.2|1999|33.33
704510|Mercury Fallen|2023-08-22|35000|1|287|81.2|1249|-100.00
1300700|Kingdom Wars 4|2021-10-22|35000|0|226|67.7|1499|-100.00
406160|Dust Fleet|2023-08-23|35000|5|154|70.8|1999|22.22
1849820|Telepath Tactics Liberated|2022-03-14|35000|2|142|86.6|1999|0.00
1318240|Shields of Loyalty|2025-08-12|35000|0|104|84.6|1299|-100.00
887420|Warman|2023-04-03|35000|0|91|59.3|1999|0.00
3317660|Kaamos: Puzzle Roguelike|2025-04-28|35000|1|54|88.9|999|0.00
642600|Burst Fighter|2017-09-16|35000|0|28|89.3|999|0.00
1813130|Sugar Shack|2023-09-14|10000|0|306|68.0|1999|0.00
2312520|Everholm|2024-11-11|10000|20|273|78.8|1999|38.46
1476170|Godstrike|2021-04-15|10000|0|234|65.0|599|0.00
946880|World of Football|2024-11-20|10000|26|187|81.8|499|25.00
1386620|Anuchard|2022-04-21|10000|1|159|83.6|599|-100.00
1952540|Voltaire: The Vegan Vampire|2023-10-26|10000|2|157|69.4|1999|0.00
1270850|Karma City Police|2021-12-16|10000|0|143|81.1|239|-100.00
2533020|Renaissance Kingdom Wars|2024-11-26|10000|0|143|76.2|1999|-100.00
2235820|Jack Holmes : Master of Puppets|2024-04-26|10000|0|137|84.7|749|-100.00
2336760|Immortal Hunters|2025-03-05|10000|1|134|66.4|1999|-100.00
1902870|Vertical Kingdom|2024-04-15|10000|0|129|82.2|1999|-100.00
1470390|City of Beats|2023-05-01|10000|0|126|80.2|1999|-100.00
1802190|Puzzles For Clef|2024-03-06|10000|0|125|89.6|824|-100.00
1789090|Hello Goodboy|2023-05-25|10000|0|122|91.0|1499|25.00
1826060|Night Loops|2023-10-16|10000|0|121|92.6|999|-100.00
2393580|The Dead Await|2024-10-24|10000|1|118|78.8|909|0.00
2287560|Vengeance of Mr. Peppermint|2023-10-23|10000|0|116|78.4|1999|-100.00
748020|TERRACOTTA|2022-11-14|10000|0|106|82.1|399|0.00
1839060|Polylithic|2023-11-09|10000|1|105|71.4|1499|71.43
841600|Aura of Worlds|2024-09-24|10000|1|103|93.2|1499|0.00
2083240|Asterogues|2024-11-20|10000|0|99|91.9|1499|0.00
1896570|Final Stardust: Cosmic Nexus|2024-06-24|10000|0|99|77.8|1499|-100.00
2516170|G.I. Joe: Wrath of Cobra|2024-09-26|10000|0|95|63.2|2499|-100.00
1181600|Jetboard Joust|2020-10-23|10000|0|90|81.1|999|-100.00
2107180|The Hungry Fly|2024-10-23|10000|1|82|96.3|999|-100.00
1262720|Ruin Raiders|2021-10-14|10000|0|79|70.9|799|0.00
2307170|Everwarder|2025-02-06|10000|0|72|95.8|899|0.00
2146430|Siegebreaker|2024-07-19|10000|2|71|81.7|1199|-100.00
1906510|Arto|2023-05-01|10000|0|67|68.7|999|0.00
1937110|Tetra Tactics|2024-04-09|10000|0|53|81.1|599|0.00
2155280|Defend Earth: Xenos Survivors|2023-06-19|10000|0|52|86.5|499|0.00
1302850|Tails of Trainspot|2023-07-30|10000|0|49|98.0|1199|-100.00
2095140|Locked in my Darkness|2022-12-09|10000|0|48|79.2|599|-100.00
2679660|Traveler's Refrain|2025-04-11|10000|0|48|93.8|1999|0.00
3206410|The Sinking Forest - 沈んだ森 -|2024-10-28|10000|0|46|87.0|149|0.00
3440120| Knights of the Crusades|2025-09-06|10000|2|41|82.9|1999|-100.00
2271200|Assault On Proxima|2025-03-10|10000|0|39|76.9|999|-100.00
3095720|Stick It!|2024-09-24|10000|0|37|97.3|499|0.00
2206490|Ruined Kingdom|2023-02-28|10000|0|36|66.7|799|0.00
2754370|Voidsayer|2025-06-02|10000|0|34|79.4|1499|0.00
1048860|Crypterion|2025-04-29|10000|0|28|92.9|1299|-100.00
2091410|March of Shrooms|2023-11-13|10000|0|27|85.2|699|0.00
3329220|Yet Another Climbing Game|2024-11-28|10000|0|27|96.3|499|0.00
2446700|Doomies (Damikira)|2024-04-24|10000|0|26|80.8|299|0.00
2835180|Unlinked Mask|2024-03-29|10000|0|26|80.8|399|0.00
3180670|Undying Flower|2025-05-16|10000|1|19|100.0|999|-100.00
1435410|Shrine's Legacy|2025-10-07|0|7|162|88.3|0|22.22
2479770|Troublemaker 2: Beyond Dream|2025-09-15|0|2|95|97.9|0|0.00
2052160|Don't Die, Collect Loot|2025-09-19|0|8|86|90.7|0|-8.33
1604630|Kriophobia|2025-11-20|0|1|74|90.5|0|200.00
2412110|Rogue Labyrinth|2025-09-01|0|1|72|98.6|0|0.00
2761000|Tales of Old: Dominus|2025-11-03|0|1|50|72.0|0|-100.00
3357380|NEDRA|2025-06-23|0|0|44|93.2|0|-100.00
2567770|BoneField: Bodycam Horror|2025-10-27|0|0|28|64.3|0|0.00
3639120|Vartio|2025-08-12|0|0|28|75.0|0|33.33
1689390|Mythrealm|2025-10-27|0|0|25|92.0|0|-100.00
2816570|The Land of the Magnates|2024-08-27|0|0|25|92.0|0|0.00
2412280|Valiant Tactics|2025-08-04|0|0|24|70.8|0|0.00
3006080|Aris Arcanum|2025-10-27|0|0|18|88.9|0|0.00
3819310|The Scarlet Harvest|2025-10-23|0|0|18|66.7|0|-100.00
2733070|Heroes of Mount Dragon|2025-06-25|0|0|16|68.8|0|-100.00
3226540|Void Scout|2025-06-02|0|0|16|93.8|0|0.00
1075880|Elemental Brawl|2026-01-13|0|0|15|100.0|0|-100.00
2932990|The Zombie Slayers|2025-10-31|0|0|14|85.7|0|-100.00
3256850|Tic Tactic|2025-09-18|0|0|14|92.9|0|0.00
3629840|Blast Rush LS|2025-08-21|0|0|11|100.0|0|0.00
3472300|Medievaly: Battle Simulator|2025-07-16|0|0|11|72.7|0|0.00
1631230|Grimstar: Crystals are the New Oil!|2025-06-16|0|0|10|90.0|0|0.00
3168930|Infect Cam|2025-11-17|0|0|10|50.0|0|-100.00
3128940|Rune Ark|2025-11-18|0|0|10|60.0|0|0.00
2876640|Color Breakers 2|2025-10-09|0|0|9|100.0|0|0
3213790|Red Pistol|2025-07-15|0|0|9|100.0|0|0.00
3407990|Second Chances|2025-06-25|0|0|8|100.0|0|0
2653120|Donna: The Canine Quest|2025-11-10|0|0|7|100.0|0|-100.00
3805100|PLAGUN – The Plague Goes On|2025-11-05|0|0|5|100.0|0|-100.00
2578140|I Mother|2025-10-22|0|0|3|100.0|0|-100.00
2201620|Adaptory|2026-01-26|0|0|0|0|0|-25.74
3544390|Air Hares|2026-01-14|0|0|0|0|0|-100.00
2944590|Chowdown Kitty|2026-02-12|0|0|0|0|0|0.00
3330930|Locked in my Darkness 2: The Room|2026-02-11|0|0|0|0|0|0.00
3644160|Monsters and Me 🧟♂🤷♂|2026-02-10|0|0|0|0|0|-20.00
2941360|Pie in the Sky|2026-02-02|0|0|0|0|0|0.00
3057670|Pluto|2026-03-09|0|0|0|0|0|0
3531630|Tomb of the Bloodletter|2026-02-05|0|0|0|0|0|-22.81
3922140|Yankee Rabbits|2026-03-04|0|0|0|0|0|0
```

## External Source Log

| Source | Date | What it supports |
| --- | --- | --- |
| [indie.io homepage](https://www.indie.io/) | Accessed 2026-03-13 | Official positioning, 2020 founding, founders, services, remote team, `wiki.gg`, 60+ channels |
| [A Celebration of Indie Games...](https://www.indie.io/post/a-celebration-of-indie-games-four-game-launches-fresh-updates-and-deep-discounts) | 2025-04-11 | Official team-size statement, sale scale, catalog merchandising |
| [Introducing indie.io](https://www.gamespress.com/Introducing-indieio---The-Next-Evolution-of-Indie-Game-Development-Mar) | 2024-06-03 | Rebrand chronology from Freedom Games to indie.io |
| [GamesBeat funding story](https://gamesbeat.com/freedom-games-raises-10m-to-publish-indie-games/) | 2022-11-04 | $10M funding round under Freedom Games |
| [Steam publisher page](https://store.steampowered.com/publisher/indieio) | Accessed 2026-03-13 | Official follower count and storefront scale |
| [Two worlds, one abyss...](https://www.indie.io/post/two-worlds-one-abyss-voidsayer-and-void-scout-launch-today-on-steam) | 2025-06-02 | Official showcase and themed event activity |
| [indie.io is headed to PAX West](https://www.indie.io/post/indie-io-is-headed-to-pax-west) | 2025-08-21 | Convention presence and showcase strategy |
| [Echoes of the Plum Grove on Xbox](https://www.indie.io/post/echoes-of-the-plum-grove-launches-today-on-xbox-series-x-s-and-xbox-one) | 2025-09-29 | Official console rollout evidence |
| [Gematsu: Dark Deity II console announcement](https://www.gematsu.com/2025/10/dark-deity-ii-coming-to-ps5-xbox-series-on-november-7) | 2025-10-30 | Third-party confirmation of console publishing reach |
| [HumanitZ exits Early Access](https://www.indie.io/post/sandbox-zombie-survival-humanitz-exits-steam-early-access-on-feb-6) | 2026-01-14 | Official lead-in to HumanitZ full launch |
| [SteamDB publisher page](https://steamdb.info/publisher/Indie.io/) | Accessed 2026-03-13 | Public player/follower context and HumanitZ flagship validation |
| [LinkedIn company profile](https://www.linkedin.com/company/join-indie-io) | Accessed 2026-03-13 | Secondary corroboration of team size band, remote structure, former-name note |
| [support.wiki.gg Indie.io page](https://support.wiki.gg/wiki/Indie.io) | Accessed 2026-03-13 | Official founder names, executive roles, remote team size, service model |
| [Freedom Games org chart on The Org](https://theorg.com/org/freedom-games) | Accessed 2026-03-13 | Public leadership roster and role mapping across Freedom Games / indie.io |
| [Runway customer story](https://runway.com/customer-stories/indie-io) | Accessed 2026-03-13 | CFO confirmation and finance-stack / operating-scale context |
| [DevGAMM Lisbon 2025 highlights](https://devgamm.com/portugal2025/event-highlights/) | 2025-11-05 | Marketing leadership attribution for Jessica Mitchell |
| [Plagun launches on Steam](https://www.gamespress.com/Plagun-Launches-on-Steam-November-5th) | 2025-11-05 | Ben Smith title attribution and official PR voice |
| [TooManyGames Ben Smith bio](https://toomanygames.com/special-guest/ben-smith/) | Accessed 2026-03-13 | Ben Smith prior public background outside indie.io |
| [Niche Gamer PAX East 2025 interview](https://nichegamer.com/indie-io-pax-east-2025-interview-and-previews/) | Accessed 2026-03-13 | Supplemental public bio context for Ben Smith and indie.io event activity |
| [One Lonely Outpost credits](https://onelonelyoutpost.wiki.gg/wiki/Credits) | Accessed 2026-03-13 | Official game-credit evidence for multiple indie.io roles |
| [MobyGames John C. Boone II bio](https://www.mobygames.com/person/30516/john-c-boone-ii/) | Accessed 2026-03-13 | Prior game-industry history for John C. Boone II |
| [Echoes of the Plum Grove credits](https://www.mobygames.com/game/226431/echoes-of-the-plum-grove/credits/windows/) | Accessed 2026-03-13 | Public credits-based staff map across marketing, ops, tech, design, QA |
| [Mars Base credits](https://www.mobygames.com/game/192198/mars-base/credits/windows/) | Accessed 2026-03-13 | Earlier Freedom Games organizational roles before the indie.io rebrand |
| [Patrick Johnston MobyGames credits](https://www.mobygames.com/person/1314838/patrick-johnston/credits/) | Accessed 2026-03-13 | `wiki.gg` / publishing-support role evidence across multiple titles |

## Notes on External Source Quality

- Official indie.io sources and Steam storefront pages are treated as primary.
- SteamDB is used only for public market corroboration, not as a replacement for internal database metrics.
- The Org, LinkedIn company pages, conference bios, and public bylines are used for people-mapping corroboration, but not treated as authoritative employee censuses.
- MobyGames and official game-credit pages are useful for reconstructing visible roles and historical operating structure, but credits do not by themselves prove current employment status.
- Gematsu is useful for press pickup and platform-release validation, but not for corporate founding chronology.
- Gematsu's `2017` founding-year listing conflicts with official and LinkedIn signals; this report uses `2020`.
