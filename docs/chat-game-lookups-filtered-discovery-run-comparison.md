# Game Lookups And Filtered Discovery Regression Runs

## Metadata

- Run 1 source: `docs/chat-prompt-evals.md`
- Run 2 environment: `https://www.publisheriq.app`
- Run 2 execution mode: authenticated production `POST /api/chat/stream`
- Run 2 date: March 19, 2026
- Run 3 environment: `https://www.publisheriq.app`
- Run 3 execution mode: authenticated production `POST /api/chat/stream`
- Run 3 date: March 19, 2026
- Run 3 prompts rerun: `#2`, `#219`
- Prompts: `#2`, `#10`, `#21`, `#138`, `#141`, `#219`, `#242`

## Summary

| Prompt | Query | Run 1 | Run 2 | Outcome |
|---|---|---|---|---|
| `#2` | `free metroidvania games` | Sparse 3-row answer with no context | Still 3 rows, but adds release date, review counts, developer, publisher | Fixed in Run 3: live now returns all 4 current matches and explicitly says the catalog is sparse |
| `#10` | `tell me about Hades II` | Called a released game "upcoming" | Correctly states `Released` and adds price, reviews, Steam Deck, platforms | Fixed |
| `#21` | `Show me all the DLC for Elden Ring` | Mixed in unrelated/base titles | Routes to `DlcRelations` and explicitly reports incomplete DLC metadata | Fixed |
| `#138` | `Games currently on sale` | Discount dump dominated by low-signal shovelware | Returns popular discounted titles ranked by review volume | Fixed |
| `#141` | `Highly rated games under $10 released in the past year` | Tiny-sample 100% titles dominated list | Returns high-signal games with real review volume and richer fields | Fixed |
| `#219` | `Games under $5 with overwhelmingly positive reviews` | Violated hard constraint in a second section | All listed titles stay under `$5` and are high-signal | Fixed in Run 3: live now canonicalizes the shared `Discovery` query to `GameCatalog` and preserves the hard constraint |
| `#242` | `Premium games over $40 with great reviews` | False zero-result answer | Returns relevant premium games over `$40` with strong review counts | Fixed |

## Prompt #2

- Prompt: `free metroidvania games`
- Run 1 score/verdict: `9/10` / `Strong`
- Run 1 tools: `search_games`
- Run 1 timing: `total 4696ms | llm 3944ms | tools 511ms | iterations 2`
- Run 2 status/timing: `success` / `200` / `12453ms`
- Run 2 tools: `search_games`
- Run 3 status/timing: `success` / `200` / `23254ms`
- Run 3 tools: `search_games`
- Assessment: fixed in Run 3. A direct read-only database query confirms there are exactly 4 released, non-delisted, free `Metroidvania` matches in the current catalog, and live chat now returns all 4 while explicitly labeling the result set as sparse.

### Database Validation

- Read-only database check on March 19, 2026 found exactly 4 matching apps for released, non-delisted, free `Metroidvania` games.
- Matching appids: `286100` `You Have to Win the Game`, `1761380` `Otherworld Legends 战魂铭人`, `1027480` `Birth of a Hunter`, `710130` `(Hidden Dragon Legend: Shadow Trace)`.

### Run 1 Output

```md
Here are some free Metroidvania games available on Steam:

| Game | Review Score |
|------|--------------|
| [You Have to Win the Game](game:286100) | 92.9% |
| [Birth of a Hunter](game:1027480) | 63.2% |
| [(Hidden Dragon Legend: Shadow Trace)](game:710130) | 66% |

Feel free to check them out!
```

### Run 2 Output

```md
Here are some free Metroidvania games available on Steam:

| Game | Release Date | Total Reviews | Review Percentage | Developer | Publisher |
|------|--------------|---------------|-------------------|-----------|-----------|
| [You Have to Win the Game](game:286100) | May 6, 2014 | 5,675 | 92.9% | [Minor Key Games](/developers/2614) | [Minor Key Games](/publishers/2585) |
| [Birth of a Hunter](game:1027480) | March 4, 2019 | 19 | 63.2% | [Alex Tritt](/developers/325069) | [Alex Tritt](/publishers/309114) |
| [(Hidden Dragon Legend: Shadow Trace)](game:710130) | March 13, 2018 | 0 | 66% | N/A | N/A |

These games offer a variety of experiences within the Metroidvania genre, with "You Have to Win the Game" being particularly well-reviewed. Enjoy exploring!
```

### Run 2 Tool Calls

```json
[
  {
    "name": "search_games",
    "arguments": {
      "tags": [
        "Metroidvania"
      ],
      "is_free": true,
      "order_by": "reviews"
    },
    "executionMs": 691,
    "success": true,
    "result_summary": "3 results"
  }
]
```

### Run 3 Output

```md
Here are some free Metroidvania games available on Steam:

| Game | Release Date | Total Reviews | Review Percentage | Developer | Publisher |
|------|--------------|---------------|-------------------|-----------|-----------|
| [You Have to Win the Game](game:286100) | May 6, 2014 | 5,675 | 92.9% | [Minor Key Games](/developers/2614) | [Minor Key Games](/publishers/2585) |
| [Otherworld Legends 战魂铭人](game:1761380) | October 30, 2024 | 1,287 | 62.3% | [ChillyRoom](/developers/47241) | [ChillyRoom](/publishers/45000) |
| [Birth of a Hunter](game:1027480) | March 4, 2019 | 19 | 63.2% | [Alex Tritt](/developers/325069) | [Alex Tritt](/publishers/309114) |
| [(Hidden Dragon Legend: Shadow Trace)](game:710130) | March 13, 2018 | 0 | 66% | N/A | N/A |

Please note that the catalog is sparse under the current filters, with only a few qualifying rows available.
```

### Run 3 Tool Calls

```json
[
  {
    "name": "search_games",
    "arguments": {
      "tags": [
        "Metroidvania"
      ],
      "is_free": true,
      "order_by": "reviews"
    },
    "executionMs": 1189,
    "success": true,
    "result_summary": "4 results",
    "coverage_complete": true,
    "sparse_result": true,
    "content_filter_backend": "app_filter_data"
  }
]
```

## Prompt #10

- Prompt: `tell me about Hades II`
- Run 1 score/verdict: `9/10` / `Strong`
- Run 1 tools: `lookup_games, query_analytics`
- Run 1 timing: `total 6734ms | llm 6156ms | tools 318ms | iterations 3`
- Run 2 status/timing: `success` / `200` / `11723ms`
- Run 2 tools: `lookup_games, query_analytics`
- Assessment: fixed the temporal error and now uses `GameCatalog` for a proper released-state lookup.

### Run 1 Output

```md
**[Hades II](game:1145350)** is an upcoming action roguelike game developed by Supergiant Games. It is set to be released on **September 25, 2025**. The game has received a **94.9%** positive review score, indicating strong anticipation and positive feedback from early access or previews.

If you have any specific questions about the game or its features, feel free to ask!
```

### Run 2 Output

```md
### Hades II Overview

- **Release Date:** September 25, 2025
- **Release State:** Released
- **Price:** $22.49 (currently discounted by 25%)
- **Total Reviews:** 115,199
- **Review Percentage:** 95.7% positive
- **Publisher:** [Supergiant Games](/publishers/2013)
- **Developer:** [Supergiant Games](/developers/2024)
- **Steam Deck Compatibility:** Verified
- **Platforms:** Windows, macOS

[Hades II](game:1145350) is the highly anticipated sequel to the critically acclaimed game Hades, developed by Supergiant Games. The game has received outstanding reviews, reflecting its quality and the strong reputation of its predecessor.
```

### Run 2 Tool Calls

```json
[
  {
    "name": "lookup_games",
    "arguments": {
      "query": "Hades II"
    },
    "executionMs": 413,
    "success": true,
    "result_summary": "5 results"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "GameCatalog",
      "dimensions": [
        "GameCatalog.appid",
        "GameCatalog.name",
        "GameCatalog.publisherId",
        "GameCatalog.publisherName",
        "GameCatalog.developerId",
        "GameCatalog.developerName",
        "GameCatalog.releaseDate",
        "GameCatalog.releaseState",
        "GameCatalog.isReleased",
        "GameCatalog.priceDollars",
        "GameCatalog.discountPercent",
        "GameCatalog.totalReviews",
        "GameCatalog.reviewPercentage",
        "GameCatalog.steamDeckCategory",
        "GameCatalog.platforms"
      ],
      "filters": [
        {
          "member": "GameCatalog.appid",
          "operator": "equals",
          "values": [
            1145350
          ]
        }
      ],
      "limit": 1
    },
    "executionMs": 2671,
    "success": true,
    "result_summary": "1 rows"
  }
]
```

## Prompt #21

- Prompt: `Show me all the DLC for Elden Ring`
- Run 1 score/verdict: `9/10` / `Strong`
- Run 1 tools: `lookup_games, query_analytics`
- Run 1 timing: `total 8012ms | llm 7357ms | tools 440ms | iterations 3`
- Run 2 status/timing: `success` / `200` / `10354ms`
- Run 2 tools: `lookup_games, query_analytics`
- Assessment: fixed the hallucinated DLC substitution. The response now reflects the actual catalog integrity issue instead of inventing a clean DLC list.

### Run 1 Output

```md
Here are the DLCs related to **Elden Ring**:

| Game | Release Date |
|------|--------------|
| [ELDEN RING NIGHTREIGN](game:2622380) | May 29, 2025 |
| [ELDEN RING](game:1245620) | February 24, 2022 |

If you need more information about any specific DLC, feel free to ask!
```

### Run 2 Output

```md
The catalog for DLC related to **[ELDEN RING](game:1245620)** contains several entries, but unfortunately, the metadata for these DLCs is incomplete. Here are the DLC entries identified:

| DLC App ID | DLC Name | Source |
|------------|----------|--------|
| [1799420](game:1799420) | Not Available | PICS |
| [1896300](game:1896300) | Not Available | PICS |
| [1896320](game:1896320) | Not Available | PICS |
| [1922350](game:1922350) | Not Available | PICS |
| [2778580](game:2778580) | Not Available | Storefront |
| [2778590](game:2778590) | Not Available | Storefront |
| [2855520](game:2855520) | Not Available | PICS |
| [2855530](game:2855530) | Not Available | PICS |

The metadata for these DLCs is currently unavailable, so specific details such as names, types, and release dates are not provided. If you have any other questions or need further assistance, feel free to ask!
```

### Run 2 Tool Calls

```json
[
  {
    "name": "lookup_games",
    "arguments": {
      "query": "Elden Ring"
    },
    "executionMs": 251,
    "success": true,
    "result_summary": "6 results"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "DlcRelations",
      "dimensions": [
        "DlcRelations.parentAppid",
        "DlcRelations.parentName",
        "DlcRelations.dlcAppid",
        "DlcRelations.dlcName",
        "DlcRelations.dlcType",
        "DlcRelations.dlcReleaseDate",
        "DlcRelations.dlcReleaseState",
        "DlcRelations.childMetadataAvailable",
        "DlcRelations.source"
      ],
      "filters": [
        {
          "member": "DlcRelations.parentAppid",
          "operator": "equals",
          "values": [
            1245620
          ]
        }
      ],
      "limit": 50
    },
    "executionMs": 722,
    "success": true,
    "result_summary": "8 rows"
  }
]
```

## Prompt #138

- Prompt: `Games currently on sale`
- Run 1 score/verdict: `9/10` / `Strong`
- Run 1 tools: `query_analytics`
- Run 1 timing: `total 24166ms | llm 23194ms | tools 570ms | iterations 2`
- Run 2 status/timing: `success` / `200` / `25447ms`
- Run 2 tools: `query_analytics`
- Assessment: fixed the ranking problem. The answer now looks like a professional discovery result instead of a discount-only dump.

### Run 1 Output

```md
Here are some games currently on sale:

| Game | Price | Discount |
|------|-------|----------|
| [3D PUZZLE - Kingdom in dark](game:2670730) | $9.99 | 95% |
| [Find Match Icons](game:1752850) | $9.99 | 95% |
| [Car Parkour](game:2374570) | $4.99 | 95% |
| [Ero Tennis](game:1521770) | $9.99 | 95% |
| [Bike Offroad Simulator](game:2400760) | $4.99 | 95% |
| [Climb Challenge - Find Items 5](game:2878340) | $9.99 | 95% |
| [Fears of Glasses o-o World War](game:2244840) | $9.99 | 95% |
| [Lasertron](game:1488060) | $0.74 | 95% |
| [Hidden Pirates Top-Down 3D](game:2878310) | $9.99 | 95% |
| [3D PUZZLE - Hospital 1](game:2947730) | $9.99 | 95% |
| [3D PUZZLE - Apocalyptic Wasteland](game:3165280) | $9.99 | 95% |
| [HEDE Game Engine](game:1313330) | $9.99 | 95% |
| [BeachRun](game:1970730) | $1.24 | 95% |
| [ROOM FOOTBALL - Junk Town](game:3710460) | $9.99 | 95% |
| [They Сame From Above](game:1821630) | $1.24 | 95% |
| [ROOM FOOTBALL - Wetlands](game:3612760) | $9.99 | 95% |
| [Hidden World 9 Top-Down 3D](game:2682820) | $9.99 | 95% |
| [Hidden Ghost Town 2](game:1885010) | $9.99 | 95% |
| [★Fallalypse ★ Disconnect ❄](game:978610) | $9.99 | 95% |
| [Space Ship DRIFT](game:1584340) | $9.99 | 95% |

Enjoy your gaming!
```

### Run 2 Output

```md
Here are some games currently on sale:

| Game | Price | Discount | Release Date | Total Reviews | Review Percentage | Publisher | Developer |
|------|-------|----------|---------------|---------------|-------------------|-----------|-----------|
| [Terraria](game:105600) | $4.99 | 50% | May 16, 2011 | 1,507,686 | 97.4% | [Re-Logic](/publishers/2840) | [Re-Logic](/developers/12459) |
| [Garry's Mod](game:4000) | $4.99 | 50% | November 29, 2006 | 1,223,495 | 96.9% | [Valve](/publishers/1527) | [Facepunch Studios](/developers/1790) |
| [ELDEN RING](game:1245620) | $38.99 | 35% | February 24, 2022 | 1,120,128 | 93.0% | [BANDAI NAMCO Entertainment](/publishers/1959) | [FromSoftware, Inc.](/developers/3005) |
| [HELLDIVERS™ 2](game:553850) | $29.99 | 25% | February 8, 2024 | 1,117,694 | 77.0% | [PlayStation Publishing LLC](/publishers/7110) | [Arrowhead Game Studios](/developers/2261) |
| [Left 4 Dead 2](game:550) | $1.99 | 80% | November 16, 2009 | 1,021,614 | 97.5% | [Valve](/publishers/1527) | [Valve](/developers/1530) |
| [Stardew Valley](game:413150) | $7.49 | 50% | February 26, 2016 | 986,471 | 98.5% | [ConcernedApe](/publishers/3187) | [ConcernedApe](/developers/3256) |
| [Cyberpunk 2077](game:1091500) | $20.99 | 65% | December 9, 2020 | 923,154 | 86.2% | [CD PROJEKT RED](/publishers/6624) | [CD PROJEKT RED](/developers/6900) |
| [Euro Truck Simulator 2](game:227300) | $4.99 | 75% | October 12, 2012 | 904,000 | 97.5% | [SCS Software](/publishers/2157) | [SCS Software](/developers/1817) |
| [Dead by Daylight](game:381210) | $7.99 | 60% | June 14, 2016 | 885,079 | 78.6% | [Behaviour Interactive Inc.](/publishers/2961) | [Behaviour Interactive Inc.](/developers/3017) |
| [The Witcher 3: Wild Hunt](game:292030) | $7.99 | 80% | May 18, 2015 | 862,639 | 96.8% | [CD PROJEKT RED](/publishers/6624) | [CD PROJEKT RED](/developers/6900) |
| [Red Dead Redemption 2](game:1174180) | $14.99 | 75% | December 5, 2019 | 854,037 | 92.2% | [Rockstar Games](/publishers/1791) | [Rockstar Games](/developers/7555) |
| [Phasmophobia](game:739630) | $13.99 | 30% | September 18, 2020 | 813,665 | 95.6% | [Kinetic Games](/publishers/194117) | [Kinetic Games](/developers/204136) |
| [Among Us](game:945360) | $2.99 | 40% | November 16, 2018 | 724,700 | 91.9% | [Innersloth](/publishers/5415) | [Innersloth](/developers/5621) |
| [The Forest](game:242760) | $4.39 | 78% | April 30, 2018 | 663,281 | 95.5% | [Endnight Games Ltd](/publishers/2205) | [Endnight Games Ltd](/developers/2220) |
| [PAYDAY 2](game:218620) | $4.99 | 50% | August 13, 2013 | 663,082 | 89.6% | [Starbreeze Entertainment](/publishers/1776) | [OVERKILL - a Starbreeze Studio.](/developers/1777) |
| [Geometry Dash](game:322170) | $2.49 | 50% | December 22, 2014 | 559,573 | 93.1% | [RobTop Games](/publishers/11912) | [RobTop Games](/developers/12466) |
| [Hollow Knight](game:367520) | $7.49 | 50% | February 24, 2017 | 532,001 | 96.9% | [Team Cherry](/publishers/2963) | [Team Cherry](/developers/3019) |
| [Valheim](game:892970) | $9.99 | 50% | February 2, 2021 | 528,526 | 94.1% | [Coffee Stain Publishing](/publishers/2042) | [Iron Gate AB](/developers/5177) |
| [Lethal Company](game:1966720) | $7.99 | 20% | October 23, 2023 | 503,386 | 97.0% | [Zeekerss](/publishers/7690) | [Zeekerss](/developers/8057) |
| [Don't Starve Together](game:322330) | $5.09 | 66% | April 21, 2016 | 499,061 | 95.3% | [Klei Entertainment](/publishers/1676) | [Klei Entertainment](/developers/1675) |

These games are currently discounted, offering great deals for players!
```

### Run 2 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "GameCatalog",
      "dimensions": [
        "GameCatalog.appid",
        "GameCatalog.name",
        "GameCatalog.priceDollars",
        "GameCatalog.discountPercent",
        "GameCatalog.releaseDate",
        "GameCatalog.releaseState",
        "GameCatalog.totalReviews",
        "GameCatalog.reviewPercentage",
        "GameCatalog.publisherId",
        "GameCatalog.publisherName",
        "GameCatalog.developerId",
        "GameCatalog.developerName"
      ],
      "segments": [
        "GameCatalog.onSale",
        "GameCatalog.released"
      ],
      "filters": [
        {
          "member": "GameCatalog.totalReviews",
          "operator": "set"
        }
      ],
      "order": {
        "GameCatalog.totalReviews": "desc"
      },
      "limit": 20
    },
    "executionMs": 1225,
    "success": true,
    "result_summary": "20 rows"
  }
]
```

## Prompt #141

- Prompt: `Highly rated games under $10 released in the past year`
- Run 1 score/verdict: `9/10` / `Strong`
- Run 1 tools: `query_analytics, query_analytics`
- Run 1 timing: `total 25259ms | llm 24211ms | tools 630ms | iterations 2`
- Run 2 status/timing: `success` / `200` / `22277ms`
- Run 2 tools: `query_analytics, query_analytics`
- Assessment: fixed the tiny-sample quality problem by biasing toward titles with real review volume and richer metadata.

### Run 1 Output

```md
Here are some highly rated games under $10 that were released in the past year:

| Game | Review Score |
|------|--------------|
| [Foodslingers](game:2145460) | 100.0% |
| [World's Goodest Pup](game:2867220) | 100.0% |
| [Crawling Angels](game:3958640) | 95% |
| [Shapes of Memory](game:1593320) | 100.0% |
| [Primarch](game:1668970) | 92% |
| [Sphere Shootout](game:1924670) | 100.0% |
| [Skeleseller](game:3226210) | 97% |
| [Everything Will Be Fine!](game:3682360) | 91% |
| [Postal Strike](game:3799200) | 100.0% |
| [Midnight Scenes: Among Graves](game:4113480) | 100.0% |
| [Twisted Fate](game:4210680) | 95% |
| [MíManny](game:4335660) | 100.0% |
| [EGGCONSOLE ZANAC EX MSX2](game:4402830) | 100.0% |
| [Corgi Survivor](game:4483200) | 100.0% |
| [Duck and the Land of Flightless Birds](game:1735030) | 100.0% |
| [Thelos](game:2131840) | 100.0% |
| [Little Chef: Cozy Cooking](game:3376500) | 97% |
| [Ritus Exorcismus](game:3691430) | 100.0% |
| [Deadline Escape](game:3872000) | 91% |
| [Fumpers: Dual Realms](game:4288990) | 100.0% |

These games have received excellent reviews and are priced under $10.
```

### Run 2 Output

```md
Here are some highly rated games under $10 that were released in the past year:

| Game | Price | Total Reviews | Review Percentage | Release Date | Publisher | Developer |
|------|-------|---------------|-------------------|--------------|-----------|-----------|
| [PEAK](game:3527290) | $4.95 | 300,073 | 94.8% | June 16, 2025 | [landfall](/publishers/8300) | [Team PEAK](/developers/55973) |
| [Escape the Backrooms](game:1943950) | $7.99 | 133,591 | 90.7% | October 23, 2025 | [Secret Mode](/publishers/3989) | [Blackbird Interactive](/developers/7504) |
| [Megabonk](game:3405340) | $6.99 | 98,469 | 94.8% | September 18, 2025 | [vedinad](/publishers/49050) | [vedinad](/developers/51498) |
| [Deep Rock Galactic: Survivor](game:2321470) | $9.09 | 46,396 | 86.6% | September 17, 2025 | [Ghost Ship Publishing](/publishers/12273) | [Funday Games](/developers/8207) |
| [Soulstone Survivors](game:2066020) | $8.99 | 26,098 | 91.4% | June 17, 2025 | [Game Smithing Limited](/publishers/11659) | [Game Smithing Limited](/developers/12192) |
| [Pro Soccer Online](game:1583320) | $2.49 | 24,180 | 89.8% | December 5, 2025 | [Skywall Studios LLC](/publishers/241523) | [Skywall Studios LLC](/developers/253812) |
| [Mage Arena](game:3716600) | $2.69 | 19,896 | 91.5% | July 24, 2025 | [jrsjams](/publishers/89777) | [jrsjams](/developers/94500) |
| [LOCKDOWN Protocol](game:2780980) | $6.99 | 18,803 | 86.3% | November 18, 2025 | [Mirage Creative Lab](/publishers/23942) | [Mirage Creative Lab](/developers/25015) |
| [Ghost Watchers](game:1850740) | $8.99 | 16,073 | 85.9% | July 24, 2025 | [Renderise](/publishers/5030) | [Renderise](/developers/5229) |
| [MIMESIS](game:2827200) | $7.99 | 8,485 | 84.9% | October 27, 2025 | [KRAFTON, Inc.](/publishers/1788) | [ReLU Games, Inc.](/developers/21158) |

These games have received positive reviews and are priced affordably, making them great options for budget-conscious gamers.
```

### Run 2 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "GameCatalog",
      "dimensions": [
        "GameCatalog.appid",
        "GameCatalog.name",
        "GameCatalog.priceDollars",
        "GameCatalog.totalReviews",
        "GameCatalog.reviewPercentage",
        "GameCatalog.releaseDate",
        "GameCatalog.releaseState",
        "GameCatalog.publisherId",
        "GameCatalog.publisherName",
        "GameCatalog.developerId",
        "GameCatalog.developerName"
      ],
      "segments": [
        "GameCatalog.released",
        "GameCatalog.lastYear"
      ],
      "filters": [
        {
          "member": "GameCatalog.priceDollars",
          "operator": "lte",
          "values": [
            "10"
          ]
        },
        {
          "member": "GameCatalog.totalReviews",
          "operator": "set"
        },
        {
          "member": "GameCatalog.reviewPercentage",
          "operator": "gte",
          "values": [
            "80"
          ]
        }
      ],
      "order": {
        "GameCatalog.totalReviews": "desc"
      },
      "limit": 20
    },
    "executionMs": 4957,
    "success": true,
    "result_summary": "20 rows"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "GameCatalog",
      "dimensions": [
        "GameCatalog.appid",
        "GameCatalog.name",
        "GameCatalog.priceDollars",
        "GameCatalog.totalReviews",
        "GameCatalog.reviewPercentage",
        "GameCatalog.releaseDate",
        "GameCatalog.releaseState",
        "GameCatalog.publisherId",
        "GameCatalog.publisherName",
        "GameCatalog.developerId",
        "GameCatalog.developerName"
      ],
      "segments": [
        "GameCatalog.released",
        "GameCatalog.lastYear"
      ],
      "filters": [
        {
          "member": "GameCatalog.priceDollars",
          "operator": "lte",
          "values": [
            "10"
          ]
        },
        {
          "member": "GameCatalog.totalReviews",
          "operator": "set"
        },
        {
          "member": "GameCatalog.reviewPercentage",
          "operator": "gte",
          "values": [
            "80"
          ]
        }
      ],
      "order": {
        "GameCatalog.releaseDate": "desc"
      },
      "limit": 20
    },
    "executionMs": 980,
    "success": true,
    "result_summary": "20 rows"
  }
]
```

## Prompt #219

- Prompt: `Games under $5 with overwhelmingly positive reviews`
- Run 1 score/verdict: `7/10` / `Acceptable`
- Run 1 tools: `search_games, search_games`
- Run 1 timing: `total 12390ms | llm 11562ms | tools 609ms | iterations 2`
- Run 2 status/timing: `success` / `200` / `18538ms`
- Run 2 tools: `query_analytics, query_analytics`
- Run 3 status/timing: `success` / `200` / `46529ms`
- Run 3 tools: `query_analytics, query_analytics`
- Assessment: fixed in Run 3. The model still initially emits a shared-field `Discovery` query, but the server-side canonicalization layer rewrites it to `GameCatalog`, so the guardrail now applies across future broad price/review discovery prompts without query-specific handling.

### Run 1 Output

```md
Here are some games under $5 with overwhelmingly positive reviews:

| Game | Price | Review Percentage | Developer | Publisher |
|------|-------|-------------------|-----------|-----------|
| [Corgi Survivor](game:4483200) | $4.24 | 100% | [Symbolic](/developers/3199485) | [Symbolic](/publishers/3050097) |
| [Sphere Shootout](game:1924670) | $4.79 | 100% | [Horace49 (程序员慧鹏)](/developers/305839) | [Horace49 (程序员慧鹏)](/publishers/290987) |
| [Shapes of Memory](game:1593320) | $3.39 | 100% | [Abyssal Studios](/developers/8911) | [Creative Hand](/publishers/129394) |

Additionally, here are some games currently on sale that also have overwhelmingly positive reviews:

| Game | Price | Review Percentage | Developer | Publisher |
|------|-------|-------------------|-----------|-----------|
| [AI.VI](game:2892380) | $11.19 | 100% | [Out of Time](/developers/30460) | [indie.io](/publishers/3794) |
| [Crawling Angels](game:3958640) | $7.99 | 95% | [ItsTheTalia](/developers/135466) | [2 Left Thumbs](/publishers/8709) |
| [World's Goodest Pup](game:2867220) | $6.29 | 100% | [Pandamander, LLC](/developers/29148) | [Pandamander, LLC](/publishers/27885) |
| [Twisted Fate](game:4210680) | $6.39 | 95% | [Game Dynasty](/developers/8798) | [Game Dynasty](/publishers/227853) |

*Note: Prices are subject to change and may vary based on discounts.*
```

### Run 2 Output

```md
Here are some games under $5 that have overwhelmingly positive reviews:

| Game | Price | Review Percentage | Total Reviews |
|------|-------|-------------------|---------------|
| [Terraria](game:105600) | $4.99 | 97.4% | 1,507,686 |
| [Garry's Mod](game:4000) | $4.99 | 96.9% | 1,223,495 |
| [Left 4 Dead 2](game:550) | $1.99 | 97.5% | 1,021,614 |
| [Euro Truck Simulator 2](game:227300) | $4.99 | 97.5% | 904,000 |
| [The Forest](game:242760) | $4.39 | 95.5% | 663,281 |
| [Dying Light](game:239140) | $2.49 | 95.2% | 480,491 |
| [Undertale](game:391540) | $2.49 | 96.8% | 317,184 |
| [Titanfall® 2](game:1237970) | $2.99 | 95.6% | 274,593 |
| [Half-Life 2](game:220) | $1.99 | 97.6% | 268,645 |
| [Tomb Raider Game of the Year](game:203160) | $2.99 | 96.1% | 262,426 |
| [Vampire Survivors](game:1794680) | $3.74 | 98.4% | 260,488 |
| [Counter-Strike](game:10) | $1.99 | 97.4% | 258,175 |
| [Fallout: New Vegas](game:22380) | $0.99 | 96.0% | 253,807 |
| [DOOM](game:379720) | $3.99 | 95.5% | 216,276 |
| [Sid Meier's Civilization® V](game:8930) | $2.99 | 95.8% | 204,265 |
| [Portal](game:400) | $1.99 | 98.5% | 191,591 |
| [Counter-Strike: Source](game:240) | $1.99 | 96.3% | 189,867 |
| [Life is Strange - Episode 1](game:319630) | $0.00 | 96.2% | 169,201 |
| [Mount & Blade: Warband](game:48700) | $4.99 | 97.7% | 166,405 |
| [Half-Life](game:70) | $1.99 | 96.5% | 158,774 |

These games are highly rated and offer great value for their price!
```

### Run 2 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "Discovery",
      "dimensions": [
        "Discovery.appid",
        "Discovery.name",
        "Discovery.priceDollars",
        "Discovery.reviewPercentage"
      ],
      "segments": [
        "Discovery.overwhelminglyPositive"
      ],
      "filters": [
        {
          "member": "Discovery.priceDollars",
          "operator": "lte",
          "values": [
            "5"
          ]
        }
      ],
      "order": {
        "Discovery.totalReviews": "desc"
      },
      "limit": 20
    },
    "executionMs": 1439,
    "success": true,
    "result_summary": "20 rows"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "Discovery",
      "dimensions": [
        "Discovery.appid",
        "Discovery.name",
        "Discovery.priceDollars",
        "Discovery.reviewPercentage"
      ],
      "segments": [
        "Discovery.overwhelminglyPositive"
      ],
      "filters": [
        {
          "member": "Discovery.priceDollars",
          "operator": "lte",
          "values": [
            "5"
          ]
        }
      ],
      "order": {
        "Discovery.totalReviews": "desc"
      },
      "limit": 20
    },
    "executionMs": 480,
    "success": true,
    "result_summary": "20 rows"
  }
]
```

### Run 3 Output

```md
Here are some games under $5 with overwhelmingly positive reviews:

| Game | Price | Total Reviews | Review Percentage |
|------|-------|---------------|-------------------|
| [Terraria](game:105600) | $4.99 | 1,507,686 | 97.4% |
| [Garry's Mod](game:4000) | $4.99 | 1,223,495 | 96.9% |
| [Left 4 Dead 2](game:550) | $1.99 | 1,021,614 | 97.5% |
| [Wallpaper Engine](game:431960) | $3.99 | 967,703 | 98.0% |
| [Euro Truck Simulator 2](game:227300) | $4.99 | 904,000 | 97.5% |
| [The Forest](game:242760) | $4.39 | 663,281 | 95.5% |
| [Dying Light](game:239140) | $2.49 | 480,491 | 95.2% |
| [Undertale](game:391540) | $2.49 | 317,184 | 96.8% |
| [Titanfall® 2](game:1237970) | $2.99 | 274,593 | 95.6% |
| [Half-Life 2](game:220) | $1.99 | 268,645 | 97.6% |
| [Tomb Raider Game of the Year](game:203160) | $2.99 | 262,426 | 96.1% |
| [Vampire Survivors](game:1794680) | $3.74 | 260,488 | 98.4% |
| [Counter-Strike](game:10) | $1.99 | 258,175 | 97.4% |
| [Fallout: New Vegas](game:22380) | $0.99 | 253,807 | 96.0% |
| [DOOM](game:379720) | $3.99 | 216,276 | 95.5% |
| [Sid Meier's Civilization® V](game:8930) | $2.99 | 204,265 | 95.8% |
| [Portal](game:400) | $1.99 | 191,591 | 98.5% |
| [Counter-Strike: Source](game:240) | $1.99 | 189,867 | 96.3% |
| [Mount & Blade: Warband](game:48700) | $4.99 | 166,405 | 97.7% |
| [Half-Life](game:70) | $1.99 | 158,774 | 96.5% |

These games have received high praise from players and are available at a very low price.
```

### Run 3 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "Discovery",
      "dimensions": [
        "Discovery.appid",
        "Discovery.name",
        "Discovery.priceDollars",
        "Discovery.totalReviews",
        "Discovery.reviewPercentage"
      ],
      "segments": [
        "Discovery.overwhelminglyPositive"
      ],
      "filters": [
        {
          "member": "Discovery.priceDollars",
          "operator": "lte",
          "values": [
            "5"
          ]
        }
      ],
      "order": {
        "Discovery.totalReviews": "desc"
      },
      "limit": 20
    },
    "executionMs": 1570,
    "success": true,
    "result_summary": "20 rows",
    "canonicalizedFromCube": "Discovery",
    "canonicalizedToCube": "GameCatalog"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "GameCatalog",
      "dimensions": [
        "GameCatalog.appid",
        "GameCatalog.name",
        "GameCatalog.priceDollars",
        "GameCatalog.totalReviews",
        "GameCatalog.reviewPercentage"
      ],
      "segments": [
        "GameCatalog.onSale"
      ],
      "filters": [
        {
          "member": "GameCatalog.priceDollars",
          "operator": "lte",
          "values": [
            "5"
          ]
        },
        {
          "member": "GameCatalog.reviewPercentage",
          "operator": "gte",
          "values": [
            "95"
          ]
        }
      ],
      "order": {
        "GameCatalog.totalReviews": "desc"
      },
      "limit": 20
    },
    "executionMs": 1444,
    "success": true,
    "result_summary": "20 rows"
  }
]
```

## Prompt #242

- Prompt: `Premium games over $40 with great reviews`
- Run 1 score/verdict: `6/10` / `Acceptable`
- Run 1 tools: `search_games, search_games`
- Run 1 timing: `total 4535ms | llm 3727ms | tools 506ms | iterations 2`
- Run 2 status/timing: `success` / `200` / `24779ms`
- Run 2 tools: `query_analytics, query_analytics`
- Assessment: fixed the false-zero-result behavior and now returns the expected premium/high-price discovery set.

### Run 1 Output

```md
It appears that there are currently no premium games tagged as such that meet the criteria of being released in 2020 or later with review scores of 80% or higher.

If you have other criteria or specific genres in mind, please let me know, and I can help you find suitable games!
```

### Run 2 Output

```md
Here are some premium games priced over $40 that have received great reviews:

| Game | Price | Total Reviews | Review Percentage | Publisher | Developer |
|------|-------|---------------|-------------------|-----------|-----------|
| [Black Myth: Wukong](game:2358720) | $59.99 | 1,195,963 | 96.5% | [Game Science](/publishers/123) | [Game Science](/developers/123) |
| [Baldur's Gate 3](game:1086940) | $59.99 | 829,902 | 96.8% | [Larian Studios](/publishers/456) | [Larian Studios](/developers/456) |
| [DARK SOULS™ III](game:374320) | $59.99 | 431,437 | 94.3% | [BANDAI NAMCO Entertainment](/publishers/789) | [FromSoftware, Inc.](/developers/789) |
| [S.T.A.L.K.E.R. 2: Heart of Chornobyl](game:1643320) | $41.99 | 113,346 | 80.5% | [GSC Game World (worldwide)](/publishers/101) | [GSC Game World](/developers/101) |
| [ARMORED CORE™ VI FIRES OF RUBICON™](game:1888160) | $59.99 | 82,675 | 91.6% | [FromSoftware, Inc.](/publishers/789) | [FromSoftware, Inc.](/developers/789) |
| [CODE VEIN](game:678960) | $59.99 | 61,143 | 83.4% | [BANDAI NAMCO Entertainment](/publishers/789) | [Bandai Namco Studios](/developers/789) |
| [Call of Duty: Black Ops II](game:202970) | $59.99 | 48,523 | 86.2% | [Activision](/publishers/102) | [Treyarch](/developers/102) |
| [Jurassic World Evolution 2](game:1244460) | $59.99 | 45,355 | 90.2% | [Frontier Developments](/publishers/103) | [Frontier Developments](/developers/103) |
| [LEGO Star Wars: The Skywalker Saga](game:920210) | $49.99 | 45,038 | 90.7% | [Warner Bros. Interactive Entertainment](/publishers/104) | [TT Games](/developers/104) |
| [God of War Ragnarök](game:2322010) | $40.19 | 44,031 | 88.3% | [PlayStation Publishing LLC](/publishers/105) | [Santa Monica Studio](/developers/105) |

These games are highly rated and have a significant number of reviews, indicating their popularity and quality.
```

### Run 2 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "GameCatalog",
      "dimensions": [
        "GameCatalog.appid",
        "GameCatalog.name",
        "GameCatalog.priceDollars",
        "GameCatalog.totalReviews",
        "GameCatalog.reviewPercentage",
        "GameCatalog.publisherName",
        "GameCatalog.developerName"
      ],
      "filters": [
        {
          "member": "GameCatalog.priceDollars",
          "operator": "gte",
          "values": [
            "40"
          ]
        },
        {
          "member": "GameCatalog.totalReviews",
          "operator": "set"
        }
      ],
      "segments": [
        "GameCatalog.released",
        "GameCatalog.highlyRated"
      ],
      "order": {
        "GameCatalog.totalReviews": "desc"
      },
      "limit": 20
    },
    "executionMs": 1848,
    "success": true,
    "result_summary": "20 rows"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "GameCatalog",
      "dimensions": [
        "GameCatalog.appid",
        "GameCatalog.name",
        "GameCatalog.priceDollars",
        "GameCatalog.totalReviews",
        "GameCatalog.reviewPercentage",
        "GameCatalog.publisherName",
        "GameCatalog.developerName"
      ],
      "filters": [
        {
          "member": "GameCatalog.priceDollars",
          "operator": "gte",
          "values": [
            "40"
          ]
        },
        {
          "member": "GameCatalog.totalReviews",
          "operator": "set"
        },
        {
          "member": "GameCatalog.totalReviews",
          "operator": "lt",
          "values": [
            "1000"
          ]
        }
      ],
      "segments": [
        "GameCatalog.released",
        "GameCatalog.highlyRated"
      ],
      "order": {
        "GameCatalog.totalReviews": "desc"
      },
      "limit": 20
    },
    "executionMs": 2563,
    "success": true,
    "result_summary": "20 rows"
  }
]
```

## Run 4 Company Answers Regression Run

### Metadata

- Run 4 environment: `https://www.publisheriq.app`
- Run 4 execution mode: authenticated production `POST /api/chat/stream`
- Run 4 date: March 19, 2026
- Run 4 deployed `origin/main`: `42f55a500e8ef48fc42998b75c1b3aee12fdda80`
- Run 4 company-fix commits on live: `ab6bad1` and `42f55a5`
- Run 4 source of truth for identity validation: read-only Postgres checks against `developers`, `developer_metrics`, and `developer_game_metrics`
- Run 4 prompts rerun: `#89`, `#97`, `#127`, `#130`, `#140`, `#151`, `#155`, `#156`, `#157`, `#161`, `#170`, `#171`, `#175`, `#178`, `#179`
- Run 1 baseline source: `docs/chat-prompt-evals.md`

### Database Source Of Truth Check

- Read-only database validation on March 19, 2026 confirmed the canonical metrics-backed FromSoftware developer row is `3005 | FromSoftware, Inc. | 12 games | 2,465,235 reviews`.
- Read-only `developer_game_metrics` validation returned `11` rows for `developer_id = 3005` and `1` row for `developer_id = 332003`.
- This confirms that live FromSoftware portfolio answers should resolve to `developer_id = 3005` and stay on the metrics-backed company row rather than a fuzzy name-only match.

### Latency Summary

- Run 1 company-suite latency across these 15 prompts: average `15.1s`, median `13.6s`, p95 `42.7s`.
- Run 4 company-suite latency across the 14 successful prompts: average `13.4s`, median `11.4s`, p95 `27.1s`.
- Overall latency improved, but `#89`, `#155`, `#156`, and `#161` are still slower than baseline because they now take extra resolution and analytics steps.
- `#170` returned a live streaming failure with `error_message: terminated`, so it is excluded from Run 4 latency aggregates.

### Before And After Summary

| Prompt | Run 1 | Run 4 | Timing | Outcome |
|---|---|---|---|---|
| `#89` `Which indie developers have multiple hit games?` | Included non-indie rows such as Ubisoft Montreal and CD PROJEKT RED. | Still wrong, and now broader: includes Sledgehammer Games, Raven Software, Beenox, Ubisoft Montreal, and CD PROJEKT RED. | `13.6s -> 27.1s` | Still broken |
| `#97` `Compare FromSoftware and Team Cherry by reviews` | Compared only average review score. | Now includes `gameCount`, `totalReviews`, and `positiveReviews`, but still omits representative titles. | `15.4s -> 7.3s` | Improved |
| `#127` `What publishers are releasing the most games this year?` | Returned bare game counts only. | Now adds `totalReviews` and `avgReviewScore`, but publisher links are still malformed as `(publishers/...)`. | `19.1s -> 9.1s` | Improved |
| `#130` `Publishers with the most games released in the past 6 months` | Returned one game and one release date per publisher instead of a volume answer. | Now returns counts and quality context, but the live rows match the all-year ranking too closely and likely are not honoring the rolling 6-month window. | `21.1s -> 10.9s` | Improved, still suspect |
| `#140` `Publishers with 5+ games averaging 85%+ reviews in the past 3 years` | Returned a weaker count/score table with less context. | Now returns `gameCount`, `avgReviewScore`, and `totalReviews` from the right company surface. | `25.1s -> 15.8s` | Improved |
| `#151` `Developers with 3+ games, all above 90% reviews, with a release in the past year` | Failed the constrained query and pivoted to an unrelated fallback leaderboard. | Now stays constrained and returns a clean no-match answer. | `42.7s -> 4.8s` | Fixed |
| `#155` `Show me all games by FromSoftware` | False no-match answer pointing to a SteamDB developer page. | Now resolves to `/developers/3005` and returns the actual FromSoftware portfolio from live metrics. | `6.2s -> 19.0s` | Fixed |
| `#156` `top games from FromSoftware` | False no-match answer. | Now returns real games, but the live run misroutes through publisher identity, uses a malformed `(publishers/2949)` link, and still does not clearly rank by “top”. | `6.4s -> 22.8s` | Improved |
| `#157` `Which publishers released the most games this year?` | Returned bare game counts only. | Now adds `totalReviews` and `avgReviewScore`, but publisher links are still malformed as `(publishers/...)`. | `6.7s -> 12.0s` | Improved |
| `#161` `games by FromSoftware` | False no-match answer pointing to a SteamDB developer page. | Now resolves to `/developers/3005` and returns the actual FromSoftware portfolio from live metrics. | `8.0s -> 23.6s` | Fixed |
| `#170` `What publishers are similar to Devolver Digital?` | Fell back to lexical lookalikes like `Evolver Dynamics` and `Revolver Nine`. | Still wrong: noisy lexical neighbors remain, bad rows like `-` and `N/A` remain, and the current live response terminated mid-stream. | `13.3s -> error` | Still broken |
| `#171` `Show me developers similar to Supergiant Games` | Returned lexical lookalikes with external Steam URLs. | Links are now internal, but the results are still lexical noise like `supergame`, `Supergonk`, and `Supernova Games`. | `16.9s -> 9.6s` | Still broken |
| `#175` `Publishers with releases in every year since 2020` | Hit the max iteration limit and failed to answer. | Now answers from one grouped year-based query and returns continuity rows successfully. | `22.1s -> 21.3s` | Fixed |
| `#178` `how many games has Krafton published?` | Returned a bare count only. | Still returns only a bare count, with no quality context or representative titles. | `5.1s -> 2.2s` | Still weak |
| `#179` `How many games has Valve published?` | Returned a bare count only. | Still returns only a bare count, with no quality context or representative titles. | `5.5s -> 2.2s` | Still weak |

### Live Notes

- The long-term company-resolution fix is live and validated for the FromSoftware portfolio family. `#155` and `#161` now resolve to the canonical database-backed developer row and stop producing false no-match answers.
- The constrained no-match behavior is also live. `#151` no longer broadens into an unrelated leaderboard after the requested company filter fails.
- Similarity is still not production-ready. `#170` and `#171` continue to return lexical or low-signal neighbors rather than durable portfolio peers, and `#170` still failed during streaming on the fresh live run.
- The company answer-shape improvements are live for several ranking queries, but they are incomplete. `#127`, `#157`, `#178`, and `#179` still need follow-through on link correctness and exemplar-title context.

## Run 5 Company Answers Regression Run

### Metadata

- Run 5 environment: `https://www.publisheriq.app`
- Run 5 execution mode: authenticated production `POST /api/chat/stream`
- Run 5 date: March 20, 2026
- Run 5 prompt include file: `scripts/chat-evals/company-run-5-prompts.txt`
- Run 5 raw artifacts: `/tmp/publisheriq-chat-evals/company-run-5-2026-03-20T05-23-59Z`
- Run 5 rendered eval report: `/tmp/publisheriq-chat-evals/company-run-5-2026-03-20T05-23-59Z/report.md`
- Run 1 baseline source: `/tmp/publisheriq-chat-evals/2026-03-19T09-08-50-101Z/results.json`
- Run 4 raw artifact status: no separate raw Run 4 artifact was recoverable locally, so historical Run 4 comparison uses the existing summary table and notes already in this document.

### Live Cube Preflight

- Live Cube `/meta` on March 20, 2026 confirms `DeveloperGameMetrics.reviewPercentage` and `DeveloperGameMetrics.positiveReviews` are now exposed.
- Live Cube `/meta` on March 20, 2026 confirms `PublisherGameMetrics.reviewPercentage` and `PublisherGameMetrics.positiveReviews` are now exposed.

### Latency Summary

- Run 1 company-suite latency across these 15 prompts: average `14655.9ms`, median `10803ms`, p95 `42707ms` across 12 successful prompts.
- Run 4 historical latency from the prior live comparison: average `13.4s`, median `11.4s`, p95 `27.1s` across 14 successful prompts.
- Run 5 company-suite latency across these 15 prompts: average `18999.8ms`, median `17034ms`, p95 `47974ms` across 15 successful prompts.
- Run 5 is materially slower than both Run 1 and Run 4, largely because the year-based publisher rankings and indie-developer query still trigger broad company analytics passes.

### Before And After Summary

| Prompt | Query | Run 1 | Run 4 | Run 5 | Outcome |
|---|---|---|---|---|---|
| `#89` | `Which indie developers have multiple hit games?` | Included non-indie rows such as Ubisoft Montreal and CD PROJEKT RED. | Still wrong, and now broader: includes Sledgehammer Games, Raven Software, Beenox, Ubisoft Montreal, and CD PROJEKT RED. | Still includes Ubisoft Montreal and CD PROJEKT RED; no indie filter. | still broken |
| `#97` | `Compare FromSoftware and Team Cherry by reviews` | Compared only average review score. | Now includes `gameCount`, `totalReviews`, and `positiveReviews`, but still omits representative titles. | Compares totals and positive reviews, but still omits representative titles and overall portfolio scale. | still incomplete |
| `#127` | `What publishers are releasing the most games this year?` | Returned bare game counts only. | Now adds `totalReviews` and `avgReviewScore`, but publisher links are still malformed as `(publishers/...)`. | Adds review context, but now appends an unnecessary 2025 comparison and remains slow. | improved over Run 1, but still weak |
| `#130` | `Publishers with the most games released in the past 6 months` | Returned one game and one release date per publisher instead of a volume answer. | Now returns counts and quality context, but the live rows match the all-year ranking too closely and likely are not honoring the rolling 6-month window. | Still not a volume answer; returns duplicate publisher/year rows instead of counts. | regressed and broken |
| `#140` | `Publishers with 5+ games averaging 85%+ reviews in the past 3 years` | Returned a weaker count/score table with less context. | Now returns `gameCount`, `avgReviewScore`, and `totalReviews` from the right company surface. | Returns year-scoped rows with many tiny-review publishers rather than a strong rolled-up shortlist. | improved, but still low-signal |
| `#151` | `Developers with 3+ games, all above 90% reviews, with a release in the past year` | Failed the constrained query and pivoted to an unrelated fallback leaderboard. | Now stays constrained and returns a clean no-match answer. | Regressed into a no-match plus fallback game list instead of staying constrained. | regressed from Run 4 |
| `#155` | `Show me all games by FromSoftware` | False no-match answer pointing to a SteamDB developer page. | Now resolves to `/developers/3005` and returns the actual FromSoftware portfolio from live metrics. | Returns real titles, but routes through publisher identity and malformed `(publishers/2949)` links. | improved over Run 1, but still routes through the wrong company type |
| `#156` | `top games from FromSoftware` | False no-match answer. | Now returns real games, but the live run misroutes through publisher identity, uses a malformed `(publishers/2949)` link, and still does not clearly rank by “top”. | Now uses developer metrics and ranks by review volume, but still includes low-signal tail rows. | mostly fixed |
| `#157` | `Which publishers released the most games this year?` | Returned bare game counts only. | Now adds `totalReviews` and `avgReviewScore`, but publisher links are still malformed as `(publishers/...)`. | Still adds quality context, but publisher links remain malformed `(publishers/...)`. | improved over Run 1, but not fully cleaned up |
| `#161` | `games by FromSoftware` | False no-match answer pointing to a SteamDB developer page. | Now resolves to `/developers/3005` and returns the actual FromSoftware portfolio from live metrics. | Returns the real developer portfolio with canonical `/developers/3005` links. | fixed |
| `#170` | `What publishers are similar to Devolver Digital?` | Fell back to lexical lookalikes like `Evolver Dynamics` and `Revolver Nine`. | Still wrong: noisy lexical neighbors remain, bad rows like `-` and `N/A` remain, and the current live response terminated mid-stream. | No longer terminates, but still returns lexical noise plus `-`/`N/A` publishers and external store links. | still broken |
| `#171` | `Show me developers similar to Supergiant Games` | Returned lexical lookalikes with external Steam URLs. | Links are now internal, but the results are still lexical noise like `supergame`, `Supergonk`, and `Supernova Games`. | Still returns lexical lookalikes such as `supergame` and `Supergonk`, with external store links. | still broken |
| `#175` | `Publishers with releases in every year since 2020` | Hit the max iteration limit and failed to answer. | Now answers from one grouped year-based query and returns continuity rows successfully. | Still answers from one grouped query and returns continuity rows successfully. | fixed |
| `#178` | `how many games has Krafton published?` | Returned a bare count only. | Still returns only a bare count, with no quality context or representative titles. | Still only returns a bare count, now via publisher lookup only and with an external store link. | still weak |
| `#179` | `How many games has Valve published?` | Returned a bare count only. | Still returns only a bare count, with no quality context or representative titles. | Still only returns a bare count with no context or exemplars. | still weak |

## Prompt #89

- Prompt: `Which indie developers have multiple hit games?`
- Run 1 score/verdict: `9/10` / `Strong`
- Run 1 tools: `query_analytics, query_analytics`
- Run 1 timing: `total 13639ms | llm 13081ms | tools 315ms | iterations 2`
- Run 4 historical summary: Still wrong, and now broader: includes Sledgehammer Games, Raven Software, Beenox, Ubisoft Montreal, and CD PROJEKT RED.
- Run 4 timing/outcome: `13.6s -> 27.1s` / `Still broken`
- Run 5 status/timing: `success` / `200` / `44035ms`
- Run 5 tools: `query_analytics, query_analytics`
- Assessment: still broken. The rerun keeps the same non-indie pattern as Run 1 and still surfaces large non-indie studios, with slower latency than both prior runs.

### Run 1 Output

```md
Here are some indie developers with multiple hit games, based on their total owners and game count:

| Developer | Game Count | Total Owners | Average Review Score |
|-----------|------------|--------------|-----------------------|
| [Feral Interactive (Linux)](/developers/1664) | 31 | 85,425,000 | 87 |
| [Ubisoft Montreal](/developers/1748) | 32 | 81,375,000 | 83 |
| [CD PROJEKT RED](/developers/6900) | 8 | 78,250,000 | 90 |
| [Pocketpair](/developers/11362) | 6 | 76,925,000 | 93 |
| [Game Science](/developers/4392) | 3 | 75,000,000 | 97 |
| [FromSoftware, Inc.](/developers/3005) | 12 | 72,260,000 | 92 |
| [Facepunch Studios](/developers/1790) | 6 | 70,010,000 | 92 |
| [Grinding Gear Games](/developers/21526) | 3 | 70,000,000 | 81 |
| [Aspyr (Mac)](/developers/1642) | 14 | 65,120,000 | 87 |
| [Larian Studios](/developers/3031) | 8 | 46,950,000 | 96 |

These developers have shown significant success with multiple games, achieving high ownership numbers and favorable review scores.
```

### Run 4 Historical Summary

- Run 4: Still wrong, and now broader: includes Sledgehammer Games, Raven Software, Beenox, Ubisoft Montreal, and CD PROJEKT RED.
- Timing: `13.6s -> 27.1s`
- Historical outcome: `Still broken`

### Run 5 Output

```md
Here are some indie developers with multiple hit games, based on their total owners and average review scores:

| Developer | Games Count | Total Owners | Average Review Score | Total Reviews |
|-----------|-------------|--------------|----------------------|---------------|
| [Feral Interactive (Linux)](/developers/1664) | 31 | 85,425,000 | 88 | 1,329,835 |
| [Ubisoft Montreal](/developers/1748) | 32 | 81,375,000 | 82 | 2,509,583 |
| [CD PROJEKT RED](/developers/6900) | 8 | 78,250,000 | 91 | 1,977,534 |
| [Pocketpair](/developers/11362) | 6 | 76,925,000 | 93 | 440,212 |
| [Game Science](/developers/4392) | 3 | 75,000,000 | 97 | 1,195,963 |
| [FromSoftware, Inc.](/developers/3005) | 12 | 72,260,000 | 92 | 2,465,235 |
| [Facepunch Studios](/developers/1790) | 6 | 70,010,000 | 92 | 2,564,528 |
| [Grinding Gear Games](/developers/21526) | 3 | 70,000,000 | 82 | 442,668 |
| [Aspyr (Mac)](/developers/1642) | 14 | 65,120,000 | 86 | 1,374,553 |
| [Firaxis Games](/developers/1648) | 24 | 61,750,000 | 86 | 886,967 |

These developers have shown significant success with their games, achieving high ownership numbers and positive reviews.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "DeveloperMetrics",
      "dimensions": [
        "DeveloperMetrics.developerId",
        "DeveloperMetrics.developerName",
        "DeveloperMetrics.gameCount",
        "DeveloperMetrics.totalOwners",
        "DeveloperMetrics.avgReviewScore",
        "DeveloperMetrics.totalReviews"
      ],
      "filters": [
        {
          "member": "DeveloperMetrics.gameCount",
          "operator": "gte",
          "values": [
            "3"
          ]
        },
        {
          "member": "DeveloperMetrics.totalOwners",
          "operator": "gte",
          "values": [
            "500000"
          ]
        }
      ],
      "order": {
        "DeveloperMetrics.totalOwners": "desc"
      },
      "reasoning": "Finding indie developers with multiple hit games based on game count and total owners."
    },
    "executionMs": 3360,
    "success": true,
    "result_summary": "50 rows"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "DeveloperMetrics",
      "dimensions": [
        "DeveloperMetrics.developerId",
        "DeveloperMetrics.developerName",
        "DeveloperMetrics.gameCount",
        "DeveloperMetrics.totalOwners",
        "DeveloperMetrics.avgReviewScore",
        "DeveloperMetrics.totalReviews"
      ],
      "filters": [
        {
          "member": "DeveloperMetrics.gameCount",
          "operator": "gte",
          "values": [
            "3"
          ]
        },
        {
          "member": "DeveloperMetrics.avgReviewScore",
          "operator": "gte",
          "values": [
            "80"
          ]
        }
      ],
      "order": {
        "DeveloperMetrics.totalOwners": "desc"
      },
      "reasoning": "Finding indie developers with multiple hit games based on game count and average review score."
    },
    "executionMs": 729,
    "success": true,
    "result_summary": "50 rows"
  }
]
```

## Prompt #97

- Prompt: `Compare FromSoftware and Team Cherry by reviews`
- Run 1 score/verdict: `9/10` / `Strong`
- Run 1 tools: `lookup_developers, lookup_developers, query_analytics, query_analytics, query_analytics`
- Run 1 timing: `total 15366ms | llm 14253ms | tools 880ms | iterations 4`
- Run 4 historical summary: Now includes `gameCount`, `totalReviews`, and `positiveReviews`, but still omits representative titles.
- Run 4 timing/outcome: `15.4s -> 7.3s` / `Improved`
- Run 5 status/timing: `success` / `200` / `25580ms`
- Run 5 tools: `lookup_developers, lookup_developers`
- Assessment: still incomplete. The response keeps the improved review-count comparison, but it still does not include representative titles and now skips analytics enrichment entirely.

### Run 1 Output

```md
Here's a comparison of the average review scores for **FromSoftware** and **Team Cherry**:

| Developer | Average Review Score |
|-----------|----------------------|
| [FromSoftware, Inc.](/developers/3005) | 92% |
| [Team Cherry](/developers/3019) | 93% |

Both developers have received high praise for their games, with Team Cherry having a slightly higher average review score.
```

### Run 4 Historical Summary

- Run 4: Now includes `gameCount`, `totalReviews`, and `positiveReviews`, but still omits representative titles.
- Timing: `15.4s -> 7.3s`
- Historical outcome: `Improved`

### Run 5 Output

```md
Here's a comparison of **[FromSoftware, Inc.](/developers/3005)** and **[Team Cherry](/developers/3019)** based on their reviews:

| Developer | Total Reviews | Average Review Score | Positive Reviews | Games Released Last Year |
|-----------|---------------|----------------------|------------------|--------------------------|
| [FromSoftware, Inc.](/developers/3005) | 2,465,235 | 92 | 2,272,208 | 4 |
| [Team Cherry](/developers/3019) | 929,808 | 94 | 869,970 | 1 |

### Summary:
- **FromSoftware** has a significantly higher total review count and a strong average review score of 92, with a large number of positive reviews.
- **Team Cherry** has a slightly higher average review score of 94, indicating that their games are very well received, but they have fewer total reviews compared to FromSoftware.

Both developers have released successful titles, with FromSoftware having a more extensive portfolio.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "lookup_developers",
    "arguments": {
      "query": "FromSoftware"
    },
    "executionMs": 0,
    "success": true,
    "result_summary": "10 results"
  },
  {
    "name": "lookup_developers",
    "arguments": {
      "query": "Team Cherry"
    },
    "executionMs": 0,
    "success": true,
    "result_summary": "10 results"
  }
]
```

## Prompt #127

- Prompt: `What publishers are releasing the most games this year?`
- Run 1 score/verdict: `9/10` / `Strong`
- Run 1 tools: `query_analytics, query_analytics`
- Run 1 timing: `total 19056ms | llm 18016ms | tools 618ms | iterations 2`
- Run 4 historical summary: Now adds `totalReviews` and `avgReviewScore`, but publisher links are still malformed as `(publishers/...)`.
- Run 4 timing/outcome: `19.1s -> 9.1s` / `Improved`
- Run 5 status/timing: `success` / `200` / `47974ms`
- Run 5 tools: `query_analytics, query_analytics`
- Assessment: improved over Run 1, but still weak. It now adds quality context, yet the rows remain low-signal and the extra 2025 comparison adds latency without helping the asked ranking.

### Run 1 Output

```md
Here are the publishers releasing the most games in 2026:

| Publisher | Number of Games |
|-----------|-----------------|
| [PlayWay S.A.](/publishers/3107) | 17 |
| [Hard Shark Games](/publishers/40464) | 17 |
| [indie.io](/publishers/3794) | 14 |
| [Bully Revenge Studios](/publishers/44859) | 14 |
| [Bell Studio](/publishers/237205) | 14 |
| [Valkeala Software](/publishers/8890) | 13 |
| [UwU](/publishers/26002) | 12 |
| [YAO](/publishers/52513) | 12 |
| [King Kong Gaming](/publishers/14077) | 11 |
| [Cyber Keks](/publishers/9685) | 10 |

These publishers are leading in terms of the number of game releases this year.
```

### Run 4 Historical Summary

- Run 4: Now adds `totalReviews` and `avgReviewScore`, but publisher links are still malformed as `(publishers/...)`.
- Timing: `19.1s -> 9.1s`
- Historical outcome: `Improved`

### Run 5 Output

```md
Here are the publishers releasing the most games in 2026 so far:

| Publisher | Games Released | Total Reviews | Average Review Score |
|-----------|----------------|---------------|----------------------|
| [PlayWay S.A.](/publishers/3107) | 17 | 2,488 | 74 |
| [Hard Shark Games](/publishers/40464) | 17 | 2 | 100 |
| [indie.io](/publishers/3794) | 14 | 11,346 | 75 |
| [Bully Revenge Studios](/publishers/44859) | 14 | 0 | N/A |
| [Bell Studio](/publishers/237205) | 14 | 10 | 40 |
| [Valkeala Software](/publishers/8890) | 13 | 117 | 91 |
| [King Kong Gaming](/publishers/14077) | 12 | 1 | 0 |
| [UwU](/publishers/26002) | 12 | 6 | 100 |
| [YAO](/publishers/52513) | 12 | 11 | 91 |
| [Cyber Keks](/publishers/9685) | 10 | 38 | 92 |

### Comparison with 2025
For context, here are the top publishers from 2025:

| Publisher | Games Released | Total Reviews | Average Review Score |
|-----------|----------------|---------------|----------------------|
| [Bully Revenge Studios](/publishers/44859) | 134 | 3 | 67 |
| [Gamersky Games](/publishers/5836) | 61 | 32,732 | 87 |
| [King Kong Gaming](/publishers/14077) | 51 | 5 | 80 |
| [PlayWay S.A.](/publishers/3107) | 50 | 7,720 | 78 |
| [NaipSoft](/publishers/23787) | 47 | 71 | 96 |
| [Hard Shark Games](/publishers/40464) | 47 | 61 | 30 |
| [hgmGame](/publishers/52906) | 47 | 6 | 83 |
| [indie.io](/publishers/3794) | 44 | 3,473 | 85 |
| [BFG Entertainment](/publishers/1701) | 42 | 13 | 85 |
| [Cyber Keks](/publishers/9685) | 41 | 0 | N/A |

This data shows a significant increase in the number of games released by some publishers in 2026 compared to 2025.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "PublisherYearMetrics",
      "dimensions": [
        "PublisherYearMetrics.publisherId",
        "PublisherYearMetrics.publisherName",
        "PublisherYearMetrics.releaseYear",
        "PublisherYearMetrics.gameCount"
      ],
      "filters": [
        {
          "member": "PublisherYearMetrics.releaseYear",
          "operator": "equals",
          "values": [
            "2026"
          ]
        }
      ],
      "order": {
        "PublisherYearMetrics.gameCount": "desc"
      },
      "limit": 10,
      "reasoning": "To find the publishers releasing the most games in 2026."
    },
    "executionMs": 4849,
    "success": true,
    "result_summary": "10 rows"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "PublisherYearMetrics",
      "dimensions": [
        "PublisherYearMetrics.publisherId",
        "PublisherYearMetrics.publisherName",
        "PublisherYearMetrics.releaseYear",
        "PublisherYearMetrics.gameCount"
      ],
      "filters": [
        {
          "member": "PublisherYearMetrics.releaseYear",
          "operator": "equals",
          "values": [
            "2025"
          ]
        }
      ],
      "order": {
        "PublisherYearMetrics.gameCount": "desc"
      },
      "limit": 10,
      "reasoning": "To compare with the previous year for context."
    },
    "executionMs": 720,
    "success": true,
    "result_summary": "10 rows"
  }
]
```

## Prompt #130

- Prompt: `Publishers with the most games released in the past 6 months`
- Run 1 score/verdict: `4/10` / `Failure`
- Run 1 tools: `query_analytics, query_analytics`
- Run 1 timing: `not captured`
- Run 4 historical summary: Now returns counts and quality context, but the live rows match the all-year ranking too closely and likely are not honoring the rolling 6-month window.
- Run 4 timing/outcome: `21.1s -> 10.9s` / `Improved, still suspect`
- Run 5 status/timing: `success` / `200` / `17815ms`
- Run 5 tools: `query_analytics, query_analytics`
- Assessment: regressed and broken. The rerun falls back to `PublisherGameMetrics` but still answers with duplicate publisher/year rows instead of release counts for a 6-month volume ranking.

### Run 1 Output

```md
[no assistant output captured]
```

### Run 4 Historical Summary

- Run 4: Now returns counts and quality context, but the live rows match the all-year ranking too closely and likely are not honoring the rolling 6-month window.
- Timing: `21.1s -> 10.9s`
- Historical outcome: `Improved, still suspect`

### Run 5 Output

```md
Here are the publishers with the most games released in the past 6 months:

| Publisher | Release Year |
|-----------|--------------|
| [Atari](/publishers/1529) | 2025 |
| [Atari](/publishers/1529) | 2026 |
| [Nightdive Studios](/publishers/1530) | 2025 |
| [Introversion Software](/publishers/1533) | 2026 |
| [Strategy First](/publishers/1536) | 2025 |
| [Strategy First](/publishers/1536) | 2026 |
| [Ubisoft](/publishers/1550) | 2025 |
| [Ubisoft](/publishers/1550) | 2026 |
| [Bohemia Interactive](/publishers/1553) | 2026 |
| [Activision](/publishers/1554) | 2025 |

This list includes publishers that have released games recently, showcasing their active engagement in the gaming market.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "PublisherYearMetrics",
      "dimensions": [
        "PublisherYearMetrics.publisherId",
        "PublisherYearMetrics.publisherName",
        "PublisherYearMetrics.releaseYear",
        "PublisherYearMetrics.gameCount"
      ],
      "segments": [
        "PublisherYearMetrics.releaseYear"
      ],
      "order": {
        "PublisherYearMetrics.gameCount": "desc"
      },
      "limit": 10
    },
    "executionMs": 638,
    "success": false,
    "result_summary": "0 rows"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "PublisherGameMetrics",
      "dimensions": [
        "PublisherGameMetrics.publisherId",
        "PublisherGameMetrics.publisherName",
        "PublisherGameMetrics.releaseYear",
        "PublisherGameMetrics.gameCount"
      ],
      "segments": [
        "PublisherGameMetrics.last6Months"
      ],
      "order": {
        "PublisherGameMetrics.gameCount": "desc"
      },
      "limit": 10
    },
    "executionMs": 3197,
    "success": true,
    "result_summary": "10 rows"
  }
]
```

## Prompt #140

- Prompt: `Publishers with 5+ games averaging 85%+ reviews in the past 3 years`
- Run 1 score/verdict: `9/10` / `Strong`
- Run 1 tools: `query_analytics, query_analytics`
- Run 1 timing: `total 25089ms | llm 24332ms | tools 506ms | iterations 2`
- Run 4 historical summary: Now returns `gameCount`, `avgReviewScore`, and `totalReviews` from the right company surface.
- Run 4 timing/outcome: `25.1s -> 15.8s` / `Improved`
- Run 5 status/timing: `success` / `200` / `24551ms`
- Run 5 tools: `query_analytics, query_analytics, query_analytics`
- Assessment: improved, but still low-signal. It uses richer company metrics than Run 1, yet the result is dominated by tiny-review 2026 rows rather than a strong 3-year rolled-up shortlist.

### Run 1 Output

```md
Here are the publishers with at least 5 games averaging 85%+ reviews in the past 3 years:

| Publisher | Games Count | Average Review Score |
|-----------|-------------|----------------------|
| [Valve](/publishers/1527) | 38 | 88 |
| [Nightdive Studios](/publishers/1530) | 111 | 89 |
| [Introversion Software](/publishers/1533) | 7 | 88 |
| [id Software](/publishers/1546) | 15 | 94 |
| [Bethesda Softworks](/publishers/1547) | 71 | 87 |
| [Frozenbyte](/publishers/1551) | 10 | 85 |
| [Techland](/publishers/1568) | 7 | 90 |
| [Techland Publishing](/publishers/1569) | 7 | 92 |
| [PopCap Games, Inc.](/publishers/1576) | 30 | 97 |
| [Rebellion](/publishers/1614) | 41 | 85 |
| [Tripwire Interactive](/publishers/1633) | 15 | 89 |
| [Aspyr (Mac)](/publishers/1644) | 14 | 87 |
| [Double Fine Productions](/publishers/1647) | 14 | 87 |
| [2K](/publishers/1648) | 103 | 85 |
| [SimBin](/publishers/1651) | 10 | 85 |
| [SEGA](/publishers/1658) | 214 | 87 |
| [Feral Interactive (Mac)](/publishers/1660) | 45 | 88 |
| [Feral Interactive (Linux)](/publishers/1661) | 31 | 87 |
| [GSC Game World](/publishers/1662) | 7 | 89 |
| [Unknown Worlds Entertainment](/publishers/1667) | 6 | 95 |

Additionally, here are the publishers with 5+ games averaging 85%+ reviews released in the past 3 years:

| Publisher | Release Year | Games Count | Average Review Score |
|-----------|--------------|-------------|----------------------|
| [Atari](/publishers/1529) | 2023 | 14 | 88 |
| [Atari](/publishers/1529) | 2025 | 10 | 94 |
| [Strategy First](/publishers/1536) | 2025 | 27 | 86 |
| [HandyGames](/publishers/1574) | 2025 | 9 | 88 |
| [Electronic Arts](/publishers/1577) | 2025 | 13 | 96 |
| [Focus Entertainment](/publishers/1653) | 2023 | 9 | 88 |
| [SEGA](/publishers/1658) | 2024 | 7 | 93 |
| [SEGA](/publishers/1658) | 2025 | 12 | 90 |
| [Square Enix](/publishers/1692) | 2023 | 9 | 86 |
| [Square Enix](/publishers/1692) | 2026 | 6 | 95 |
| [Assemble Entertainment](/publishers/1765) | 2023 | 11 | 89 |
| [KRAFTON, Inc.](/publishers/1788) | 2025 | 7 | 86 |
| [Microids](/publishers/1837) | 2025 | 6 | 93 |
| [Henteko Doujin](/publishers/1925) | 2024 | 7 | 99 |
| [Bandai Namco Entertainment](/publishers/1959) | 2023 | 7 | 85 |
| [Coffee Stain Publishing](/publishers/2042) | 2024 | 6 | 96 |
| [Daedalic Entertainment](/publishers/2063) | 2023 | 6 | 93 |
| [Serenity Forge](/publishers/2074) | 2023 | 5 | 96 |
| [NIS America, Inc.](/publishers/2088) | 2023 | 10 | 90 |
| [Curve Games](/publishers/2122) | 2024 | 5 | 91 |

These publishers have demonstrated a strong performance in terms of game quality and quantity.
```

### Run 4 Historical Summary

- Run 4: Now returns `gameCount`, `avgReviewScore`, and `totalReviews` from the right company surface.
- Timing: `25.1s -> 15.8s`
- Historical outcome: `Improved`

### Run 5 Output

```md
Here are the publishers with at least 5 games averaging 85% or higher in reviews over the past few years:

| Publisher | Release Year | Game Count | Average Review Score | Total Reviews |
|-----------|--------------|------------|----------------------|---------------|
| [Square Enix](/publishers/1692) | 2026 | 5 | 96 | 1994 |
| [Shiravune](/publishers/6360) | 2026 | 9 | 86 | 86 |
| [Gamesforgames](/publishers/8162) | 2026 | 5 | 92 | 13 |
| [Valkeala Software](/publishers/8890) | 2026 | 13 | 91 | 117 |
| [Cyber Keks](/publishers/9685) | 2026 | 10 | 92 | 38 |
| [STuNT](/publishers/12244) | 2026 | 8 | 86 | 110 |
| [072 Project](/publishers/12533) | 2026 | 6 | 96 | 99 |
| [072 News](/publishers/12534) | 2026 | 6 | 96 | 99 |
| [Limited Run Games](/publishers/19778) | 2026 | 7 | 100 | 22 |
| [NaipSoft](/publishers/23787) | 2026 | 8 | 100 | 74 |
| [UwU](/publishers/26002) | 2026 | 12 | 100 | 6 |
| [Hentai Panda](/publishers/30267) | 2026 | 6 | 100 | 12 |
| [Hard Shark Games](/publishers/40464) | 2026 | 17 | 100 | 2 |
| [Sexy Baguette Studio](/publishers/42896) | 2026 | 9 | 91 | 44 |
| [YAO](/publishers/52513) | 2026 | 12 | 91 | 11 |
| [hgmGame](/publishers/52906) | 2026 | 7 | 100 | 6 |
| [KMBOX](/publishers/134203) | 2026 | 7 | 100 | 9 |
| [Atari](/publishers/1529) | 2025 | 10 | 93 | 116 |
| [Electronic Arts](/publishers/1577) | 2025 | 13 | 93 | 147497 |

These publishers have demonstrated strong performance with their games, achieving high average review scores.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "PublisherMetrics",
      "dimensions": [
        "PublisherMetrics.publisherId",
        "PublisherMetrics.publisherName",
        "PublisherMetrics.gameCount",
        "PublisherMetrics.avgReviewScore"
      ],
      "filters": [
        {
          "member": "PublisherMetrics.gameCount",
          "operator": "gte",
          "values": [
            "5"
          ]
        },
        {
          "member": "PublisherMetrics.avgReviewScore",
          "operator": "gte",
          "values": [
            "85"
          ]
        }
      ],
      "reasoning": "Finding publishers with at least 5 games and an average review score of 85% or higher.",
      "segments": [
        "PublisherMetrics.last3Years"
      ],
      "order": {
        "PublisherMetrics.avgReviewScore": "desc"
      },
      "limit": 20
    },
    "executionMs": 615,
    "success": false,
    "result_summary": "0 rows"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "PublisherYearMetrics",
      "dimensions": [
        "PublisherYearMetrics.publisherId",
        "PublisherYearMetrics.publisherName",
        "PublisherYearMetrics.releaseYear",
        "PublisherYearMetrics.gameCount",
        "PublisherYearMetrics.avgScore"
      ],
      "filters": [
        {
          "member": "PublisherYearMetrics.gameCount",
          "operator": "gte",
          "values": [
            "5"
          ]
        },
        {
          "member": "PublisherYearMetrics.avgScore",
          "operator": "gte",
          "values": [
            "85"
          ]
        }
      ],
      "order": {
        "PublisherYearMetrics.avgScore": "desc"
      },
      "limit": 20
    },
    "executionMs": 1119,
    "success": false,
    "result_summary": "0 rows"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "PublisherYearMetrics",
      "dimensions": [
        "PublisherYearMetrics.publisherId",
        "PublisherYearMetrics.publisherName",
        "PublisherYearMetrics.releaseYear",
        "PublisherYearMetrics.gameCount",
        "PublisherYearMetrics.avgReviewScore"
      ],
      "filters": [
        {
          "member": "PublisherYearMetrics.gameCount",
          "operator": "gte",
          "values": [
            "5"
          ]
        },
        {
          "member": "PublisherYearMetrics.avgReviewScore",
          "operator": "gte",
          "values": [
            "85"
          ]
        }
      ],
      "order": {
        "PublisherYearMetrics.releaseYear": "desc"
      },
      "limit": 20
    },
    "executionMs": 1731,
    "success": true,
    "result_summary": "20 rows"
  }
]
```

## Prompt #151

- Prompt: `Developers with 3+ games, all above 90% reviews, with a release in the past year`
- Run 1 score/verdict: `9/10` / `Strong`
- Run 1 tools: `query_analytics, query_analytics, query_analytics, query_analytics, query_analytics, query_analytics`
- Run 1 timing: `total 42707ms | llm 41059ms | tools 1397ms | iterations 4`
- Run 4 historical summary: Now stays constrained and returns a clean no-match answer.
- Run 4 timing/outcome: `42.7s -> 4.8s` / `Fixed`
- Run 5 status/timing: `success` / `200` / `21061ms`
- Run 5 tools: `query_analytics, query_analytics`
- Assessment: regressed from Run 4. The no-match path broadened again into unrelated high-review games after correctly finding zero developers on the constrained query.

### Run 1 Output

```md
It seems that there are no developers with 3 or more games released in the past year, all having review scores above 90%. However, I found a list of developers who have released games in the past year with a total of 100 or more reviews. Here are the top developers based on total reviews:

| Developer | Total Reviews |
|-----------|---------------|
| [Team Cherry](/developers/3019) | 397,715 |
| [Embark Studios](/developers/270587) | 365,945 |
| [Gamepires](/developers/3956) | 112,115 |
| [Sandfall Interactive](/developers/11857) | 111,032 |
| [Blackbird Interactive](/developers/7504) | 102,529 |
| [Fancy Games](/developers/27757) | 102,529 |
| [vedinad](/developers/51498) | 98,420 |
| [Nokta Games](/developers/20374) | 68,341 |
| [FromSoftware, Inc.](/developers/3005) | 65,672 |
| [Supergiant Games](/developers/2024) | 64,132 |
| [Virtuos](/developers/18938) | 52,558 |
| [Bethesda Game Studios](/developers/1807) | 52,558 |
| [Funday Games](/developers/8207) | 36,558 |
| [Monomi Park](/developers/3338) | 33,619 |
| [Mechanistry](/developers/6624) | 31,678 |
| [Deep Field Games](/developers/3262) | 31,274 |
| [Sokar](/developers/368110) | 29,835 |
| [Saikono](/developers/344796) | 29,835 |
| [Steel Balalaika](/developers/291300) | 28,479 |
| [RubberBandGames](/developers/253915) | 26,940 |

If you need more specific information or a different query, feel free to ask!
```

### Run 4 Historical Summary

- Run 4: Now stays constrained and returns a clean no-match answer.
- Timing: `42.7s -> 4.8s`
- Historical outcome: `Fixed`

### Run 5 Output

```md
It appears that there are no developers who have released 3 or more games in the past year, all with an average review score above 90%. However, I found several games released in the past year with high review percentages. Here are some of them:

| Developer | Game | Release Date | Review Percentage |
|-----------|------|--------------|-------------------|
| [Nightdive Studios](/developers/1534) | [Heretic + Hexen](game:3286930) | 2025-08-07 | 95.1% |
| [id Software](/developers/1547) | [Heretic + Hexen](game:3286930) | 2025-08-07 | 95.1% |
| [Square Enix](/developers/1798) | [PARANORMASIGHT: The Mermaid's Curse](game:2701440) | 2026-02-19 | 95.4% |
| [Blendo Games](/developers/1867) | [Skin Deep](game:301280) | 2025-04-30 | 95.4% |
| [Supergiant Games](/developers/2024) | [Hades II](game:1145350) | 2025-09-25 | 95.7% |
| [Secret Exit Ltd.](/developers/2310) | [Turbo Dismount 2](game:2280350) | 2026-03-13 | 98.2% |
| [Shiny Shoe](/developers/2637) | [Monster Train 2](game:2742830) | 2025-05-21 | 95.7% |
| [Clifftop Games](/developers/3011) | [Kathy Rain 2: Soothsayer](game:1466390) | 2025-05-20 | 97.1% |
| [tobyfox](/developers/3109) | [DELTARUNE](game:1671210) | 2025-06-04 | 98.6% |
| [Deep Field Games](/developers/3262) | [Abiotic Factor](game:427410) | 2025-07-22 | 96.4% |
| [Happy Broccoli Games](/developers/7532) | [Duck Detective: The Ghost of Glamping](game:2714620) | 2025-05-22 | 99.2% |
| [Monster Prom 4](/developers/29364) | [Monster Prom 4: Monster Con](game:2869860) | 2025-04-24 | 99.1% |

If you have any other specific queries or need further assistance, feel free to ask!
```

### Run 5 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "DeveloperGameMetrics",
      "dimensions": [
        "DeveloperGameMetrics.developerId",
        "DeveloperGameMetrics.developerName",
        "DeveloperGameMetrics.gameCount",
        "DeveloperGameMetrics.totalReviews",
        "DeveloperGameMetrics.avgReviewScore"
      ],
      "filters": [
        {
          "member": "DeveloperGameMetrics.gameCount",
          "operator": "gte",
          "values": [
            "3"
          ]
        },
        {
          "member": "DeveloperGameMetrics.avgReviewScore",
          "operator": "gte",
          "values": [
            "9"
          ]
        }
      ],
      "segments": [
        "DeveloperGameMetrics.lastYear"
      ],
      "reasoning": "Finding developers with 3+ games released in the past year, all with an average review score above 90%",
      "limit": 100
    },
    "executionMs": 2090,
    "success": true,
    "result_summary": "0 rows"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "DeveloperGameMetrics",
      "dimensions": [
        "DeveloperGameMetrics.developerId",
        "DeveloperGameMetrics.developerName",
        "DeveloperGameMetrics.appid",
        "DeveloperGameMetrics.gameName",
        "DeveloperGameMetrics.releaseDate",
        "DeveloperGameMetrics.reviewPercentage"
      ],
      "filters": [
        {
          "member": "DeveloperGameMetrics.avgReviewScore",
          "operator": "gte",
          "values": [
            "9"
          ]
        }
      ],
      "segments": [
        "DeveloperGameMetrics.lastYear"
      ],
      "reasoning": "Finding games released in the past year with review scores above 90%",
      "limit": 100
    },
    "executionMs": 1127,
    "success": true,
    "result_summary": "100 rows"
  }
]
```

## Prompt #155

- Prompt: `Show me all games by FromSoftware`
- Run 1 score/verdict: `8/10` / `Strong`
- Run 1 tools: `lookup_developers, query_analytics`
- Run 1 timing: `total 6176ms | llm 5565ms | tools 344ms | iterations 3`
- Run 4 historical summary: Now resolves to `/developers/3005` and returns the actual FromSoftware portfolio from live metrics.
- Run 4 timing/outcome: `6.2s -> 19.0s` / `Fixed`
- Run 5 status/timing: `success` / `200` / `11768ms`
- Run 5 tools: `lookup_publishers, query_analytics`
- Assessment: improved over Run 1, but still routes through the wrong company type. It now returns real titles, yet it treats FromSoftware as a publisher and uses malformed publisher links.

### Run 1 Output

```md
It appears that there are currently no games listed under the developer [FromSoftware](https://steamdb.info/developer/285932/) in the Steam database. This could be due to various reasons, such as the games being removed or not yet released on the platform. If you have any specific titles in mind or need information about a particular game, feel free to ask!
```

### Run 4 Historical Summary

- Run 4: Now resolves to `/developers/3005` and returns the actual FromSoftware portfolio from live metrics.
- Timing: `6.2s -> 19.0s`
- Historical outcome: `Fixed`

### Run 5 Output

```md
Here are the games published by [FromSoftware, Inc.](publishers/2949):

| Game | Release Date | Total Reviews | Review Score |
|------|--------------|---------------|--------------|
| [ELDEN RING NIGHTREIGN](game:2622380) | May 29, 2025 | 177,914 | 82% |
| [ARMORED CORE™ VI FIRES OF RUBICON™](game:1888160) | August 24, 2023 | 82,675 | 91.6% |
| [ELDEN RING](game:1245620) | February 24, 2022 | 1,120,128 | 93% |
| [DARK SOULS™: REMASTERED](game:570940) | May 23, 2018 | 146,657 | 92.4% |
| [DARK SOULS™ III](game:374320) | April 11, 2016 | 431,437 | 94.3% |
| [DARK SOULS II: Scholar of the First Sin](game:335300) | April 1, 2015 | 116,710 | 84% |
| [DARK SOULS II](game:236430) | April 25, 2014 | 45,292 | 88.3% |

These titles showcase a mix of recent and classic games from the renowned developer.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "lookup_publishers",
    "arguments": {
      "query": "FromSoftware"
    },
    "executionMs": 378,
    "success": true,
    "result_summary": "10 results"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "PublisherGameMetrics",
      "dimensions": [
        "PublisherGameMetrics.appid",
        "PublisherGameMetrics.gameName",
        "PublisherGameMetrics.publisherId",
        "PublisherGameMetrics.publisherName",
        "PublisherGameMetrics.reviewPercentage",
        "PublisherGameMetrics.totalReviews"
      ],
      "filters": [
        {
          "member": "PublisherGameMetrics.publisherId",
          "operator": "equals",
          "values": [
            2949
          ]
        }
      ],
      "order": {
        "PublisherGameMetrics.releaseDate": "desc"
      },
      "limit": 20
    },
    "executionMs": 943,
    "success": true,
    "result_summary": "7 rows"
  }
]
```

## Prompt #156

- Prompt: `top games from FromSoftware`
- Run 1 score/verdict: `8/10` / `Strong`
- Run 1 tools: `lookup_developers, query_analytics`
- Run 1 timing: `total 6430ms | llm 5760ms | tools 386ms | iterations 3`
- Run 4 historical summary: Now returns real games, but the live run misroutes through publisher identity, uses a malformed `(publishers/2949)` link, and still does not clearly rank by “top”.
- Run 4 timing/outcome: `6.4s -> 22.8s` / `Improved`
- Run 5 status/timing: `success` / `200` / `17034ms`
- Run 5 tools: `lookup_developers, query_analytics`
- Assessment: mostly fixed. The answer now uses the canonical developer row and ranks top games by review volume, though the tail still includes near-empty mobile entries.

### Run 1 Output

```md
It appears that there are currently no games listed under the developer [FromSoftware](https://steamdb.info/developer/285932/) in the database. This could be due to various reasons, such as the games being removed or not properly indexed.

If you have a specific game in mind or would like to know about a particular title from FromSoftware, please let me know!
```

### Run 4 Historical Summary

- Run 4: Now returns real games, but the live run misroutes through publisher identity, uses a malformed `(publishers/2949)` link, and still does not clearly rank by “top”.
- Timing: `6.4s -> 22.8s`
- Historical outcome: `Improved`

### Run 5 Output

```md
Here are the top games developed by [FromSoftware, Inc.](/developers/3005):

| Game | Total Reviews | Review Percentage | Release Date | Owners |
|------|---------------|-------------------|--------------|--------|
| [ELDEN RING](game:1245620) | 1,120,128 | 93.0% | February 24, 2022 | 35,000,000 |
| [DARK SOULS™ III](game:374320) | 431,437 | 94.3% | April 11, 2016 | 7,500,000 |
| [Sekiro™: Shadows Die Twice - GOTY Edition](game:814380) | 344,386 | 95.3% | March 21, 2019 | 15,000,000 |
| [ELDEN RING NIGHTREIGN](game:2622380) | 177,914 | 82.0% | May 29, 2025 | 3,500,000 |
| [DARK SOULS™: REMASTERED](game:570940) | 146,657 | 92.4% | May 23, 2018 | 3,500,000 |
| [DARK SOULS II: Scholar of the First Sin](game:335300) | 116,710 | 84.0% | April 1, 2015 | 3,500,000 |
| [ARMORED CORE™ VI FIRES OF RUBICON™](game:1888160) | 82,675 | 91.6% | August 24, 2023 | 3,500,000 |
| [DARK SOULS II](game:236430) | 45,292 | 88.3% | April 25, 2014 | 750,000 |
| [G-MODEアーカイブス+ ARMORED CORE MOBILE MISSION](game:3633410) | 36 | 91.7% | April 29, 2025 | 10,000 |
| [G-MODEアーカイブス+ ARMORED CORE MOBILE 2](game:3713380) | 0 | N/A | June 18, 2025 | 0 |

These games showcase FromSoftware's reputation for high-quality titles, with several achieving overwhelmingly positive reviews.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "lookup_developers",
    "arguments": {
      "query": "FromSoftware"
    },
    "executionMs": 327,
    "success": true,
    "result_summary": "10 results"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "DeveloperGameMetrics",
      "dimensions": [
        "DeveloperGameMetrics.appid",
        "DeveloperGameMetrics.gameName",
        "DeveloperGameMetrics.totalReviews",
        "DeveloperGameMetrics.reviewPercentage",
        "DeveloperGameMetrics.releaseDate",
        "DeveloperGameMetrics.releaseState",
        "DeveloperGameMetrics.owners"
      ],
      "filters": [
        {
          "member": "DeveloperGameMetrics.developerId",
          "operator": "equals",
          "values": [
            3005
          ]
        }
      ],
      "order": {
        "DeveloperGameMetrics.totalReviews": "desc"
      },
      "limit": 10
    },
    "executionMs": 994,
    "success": true,
    "result_summary": "10 rows"
  }
]
```

## Prompt #157

- Prompt: `Which publishers released the most games this year?`
- Run 1 score/verdict: `8/10` / `Strong`
- Run 1 tools: `query_analytics`
- Run 1 timing: `total 6749ms | llm 6111ms | tools 388ms | iterations 2`
- Run 4 historical summary: Now adds `totalReviews` and `avgReviewScore`, but publisher links are still malformed as `(publishers/...)`.
- Run 4 timing/outcome: `6.7s -> 12.0s` / `Improved`
- Run 5 status/timing: `success` / `200` / `8870ms`
- Run 5 tools: `query_analytics`
- Assessment: improved over Run 1, but not fully cleaned up. It now includes review context, while the malformed publisher links and low-signal rows remain.

### Run 1 Output

```md
Here are the publishers that released the most games in 2026:

| Publisher | Games Released |
|-----------|----------------|
| [PlayWay S.A.](publishers/3107) | 17 |
| [Hard Shark Games](publishers/40464) | 17 |
| [indie.io](publishers/3794) | 14 |
| [Bully Revenge Studios](publishers/44859) | 14 |
| [Bell Studio](publishers/237205) | 14 |
| [Valkeala Software](publishers/8890) | 13 |
| [UwU](publishers/26002) | 12 |
| [YAO](publishers/52513) | 12 |
| [King Kong Gaming](publishers/14077) | 11 |
| [Cyber Keks](publishers/9685) | 10 |
```

### Run 4 Historical Summary

- Run 4: Now adds `totalReviews` and `avgReviewScore`, but publisher links are still malformed as `(publishers/...)`.
- Timing: `6.7s -> 12.0s`
- Historical outcome: `Improved`

### Run 5 Output

```md
Here are the publishers that released the most games in 2026 so far:

| Publisher | Games Released | Total Reviews | Average Review Score |
|-----------|----------------|---------------|-----------------------|
| [PlayWay S.A.](publishers/3107) | 17 | 2,488 | 74 |
| [Hard Shark Games](publishers/40464) | 17 | 2 | 100 |
| [indie.io](publishers/3794) | 14 | 11,346 | 75 |
| [Bully Revenge Studios](publishers/44859) | 14 | 0 | N/A |
| [Bell Studio](publishers/237205) | 14 | 10 | 40 |
| [Valkeala Software](publishers/8890) | 13 | 117 | 91 |
| [King Kong Gaming](publishers/14077) | 12 | 1 | 0 |
| [UwU](publishers/26002) | 12 | 6 | 100 |
| [YAO](publishers/52513) | 12 | 11 | 91 |
| [Cyber Keks](publishers/9685) | 10 | 38 | 92 |

These publishers have been quite active this year, with several releasing a significant number of titles.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "PublisherYearMetrics",
      "dimensions": [
        "PublisherYearMetrics.publisherId",
        "PublisherYearMetrics.publisherName",
        "PublisherYearMetrics.releaseYear",
        "PublisherYearMetrics.gameCount"
      ],
      "filters": [
        {
          "member": "PublisherYearMetrics.releaseYear",
          "operator": "equals",
          "values": [
            "2026"
          ]
        }
      ],
      "order": {
        "PublisherYearMetrics.gameCount": "desc"
      },
      "limit": 10
    },
    "executionMs": 1929,
    "success": true,
    "result_summary": "10 rows"
  }
]
```

## Prompt #161

- Prompt: `games by FromSoftware`
- Run 1 score/verdict: `8/10` / `Strong`
- Run 1 tools: `lookup_developers, query_analytics`
- Run 1 timing: `total 7967ms | llm 7366ms | tools 346ms | iterations 3`
- Run 4 historical summary: Now resolves to `/developers/3005` and returns the actual FromSoftware portfolio from live metrics.
- Run 4 timing/outcome: `8.0s -> 23.6s` / `Fixed`
- Run 5 status/timing: `success` / `200` / `13443ms`
- Run 5 tools: `lookup_developers, query_analytics`
- Assessment: fixed. The rerun resolves to the canonical developer row and returns the actual FromSoftware portfolio instead of the old false no-match answer.

### Run 1 Output

```md
It appears that there are currently no games listed under the developer [FromSoftware](https://steamdb.info/developer/285932/) in the Steam database. This could be due to various reasons, such as the games being published under a different name or not being available on Steam at this time. If you have a specific game in mind, please let me know!
```

### Run 4 Historical Summary

- Run 4: Now resolves to `/developers/3005` and returns the actual FromSoftware portfolio from live metrics.
- Timing: `8.0s -> 23.6s`
- Historical outcome: `Fixed`

### Run 5 Output

```md
Here are the games developed by [FromSoftware, Inc.](/developers/3005):

| Game | Release Date | Total Reviews | Review Percentage |
|------|--------------|---------------|-------------------|
| [G-MODEアーカイブス+ ARMORED CORE MOBILE 3](game:4192760) | January 21, 2026 | 0 | N/A |
| [G-MODEアーカイブス+ ARMORED CORE MOBILE 2](game:3713380) | June 18, 2025 | 0 | N/A |
| [ELDEN RING NIGHTREIGN](game:2622380) | May 29, 2025 | 177,914 | 82.0% |
| [G-MODEアーカイブス+ ARMORED CORE MOBILE MISSION](game:3633410) | April 29, 2025 | 36 | 91.7% |
| [ARMORED CORE™ VI FIRES OF RUBICON™](game:1888160) | August 24, 2023 | 82,675 | 91.6% |
| [ELDEN RING](game:1245620) | February 24, 2022 | 1,120,128 | 93.0% |
| [Sekiro™: Shadows Die Twice - GOTY Edition](game:814380) | March 21, 2019 | 344,386 | 95.3% |
| [DARK SOULS™: REMASTERED](game:570940) | May 23, 2018 | 146,657 | 92.4% |
| [DARK SOULS™ III](game:374320) | April 11, 2016 | 431,437 | 94.3% |
| [DARK SOULS II: Scholar of the First Sin](game:335300) | April 1, 2015 | 116,710 | 84.0% |
| [DARK SOULS II](game:236430) | April 25, 2014 | 45,292 | 88.3% |

These titles showcase a mix of recent releases and critically acclaimed classics from the developer.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "lookup_developers",
    "arguments": {
      "query": "FromSoftware"
    },
    "executionMs": 0,
    "success": true,
    "result_summary": "10 results"
  },
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "DeveloperGameMetrics",
      "dimensions": [
        "DeveloperGameMetrics.appid",
        "DeveloperGameMetrics.gameName",
        "DeveloperGameMetrics.releaseDate",
        "DeveloperGameMetrics.releaseYear",
        "DeveloperGameMetrics.releaseState",
        "DeveloperGameMetrics.totalReviews",
        "DeveloperGameMetrics.reviewPercentage",
        "DeveloperGameMetrics.publisherId",
        "DeveloperGameMetrics.publisherName"
      ],
      "filters": [
        {
          "member": "DeveloperGameMetrics.developerId",
          "operator": "equals",
          "values": [
            3005
          ]
        }
      ],
      "order": {
        "DeveloperGameMetrics.releaseDate": "desc"
      },
      "limit": 20
    },
    "executionMs": 970,
    "success": true,
    "result_summary": "11 rows"
  }
]
```

## Prompt #170

- Prompt: `What publishers are similar to Devolver Digital?`
- Run 1 score/verdict: `4/10` / `Failure`
- Run 1 tools: `find_similar, lookup_publishers, find_similar, lookup_publishers`
- Run 1 timing: `not captured`
- Run 4 historical summary: Still wrong: noisy lexical neighbors remain, bad rows like `-` and `N/A` remain, and the current live response terminated mid-stream.
- Run 4 timing/outcome: `13.3s -> error` / `Still broken`
- Run 5 status/timing: `success` / `200` / `10668ms`
- Run 5 tools: `find_similar`
- Assessment: still broken. The stream no longer terminates, but the results are still lexical noise with garbage publisher names and external Steam publisher links.

### Run 1 Output

```md
[no assistant output captured]
```

### Run 4 Historical Summary

- Run 4: Still wrong: noisy lexical neighbors remain, bad rows like `-` and `N/A` remain, and the current live response terminated mid-stream.
- Timing: `13.3s -> error`
- Historical outcome: `Still broken`

### Run 5 Output

```md
Here are some publishers similar to [Devolver Digital](https://store.steampowered.com/publisher/DevolverDigital):

| Publisher | Review Percentage | Game Count | Genres |
|----------|-------------------|------------|--------|
| [Existerror Digital](https://store.steampowered.com/publisher/55755) | 100% | 1 | Action |
| [Retroware](https://store.steampowered.com/publisher/7194) | 85% | 14 | Action, Adventure, Casual |
| [Entropy Digital Entertainment](https://store.steampowered.com/publisher/10338) | 65% | 23 | Action, Adventure, Casual |
| [Spawn Digital](https://store.steampowered.com/publisher/271503) | 54% | 2 | Action, Adventure, Indie |
| [-](https://store.steampowered.com/publisher/6152) | 79% | 20 | Action, Adventure, Casual |
| [Plug In Digital](https://store.steampowered.com/publisher/2392) | 68% | 171 | Action, Adventure, Animation & Modeling |
| [N/A](https://store.steampowered.com/publisher/3120) | 83% | 72 | Action, Adventure, Casual |
| [Negative Return](https://store.steampowered.com/publisher/136510) | 88% | 3 | Action, Adventure, Casual |
| [Abstract Digital](https://store.steampowered.com/publisher/54425) | N/A | 6 | Action, Adventure, Casual |
| [Digital Continue](https://store.steampowered.com/publisher/332397) | 62% | 3 | Action, Free to Play, Indie |

These publishers share similar genres and styles with Devolver Digital, making them noteworthy alternatives.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "find_similar",
    "arguments": {
      "entity_type": "publisher",
      "reference_name": "Devolver Digital"
    },
    "executionMs": 713,
    "success": true,
    "result_summary": "11 results"
  }
]
```

## Prompt #171

- Prompt: `Show me developers similar to Supergiant Games`
- Run 1 score/verdict: `4/10` / `Failure`
- Run 1 tools: `find_similar, lookup_developers`
- Run 1 timing: `not captured`
- Run 4 historical summary: Links are now internal, but the results are still lexical noise like `supergame`, `Supergonk`, and `Supernova Games`.
- Run 4 timing/outcome: `16.9s -> 9.6s` / `Still broken`
- Run 5 status/timing: `success` / `200` / `10916ms`
- Run 5 tools: `find_similar`
- Assessment: still broken. The results remain dominated by lexical lookalikes rather than real portfolio peers, and they still use external Steam developer links.

### Run 1 Output

```md
[no assistant output captured]
```

### Run 4 Historical Summary

- Run 4: Links are now internal, but the results are still lexical noise like `supergame`, `Supergonk`, and `Supernova Games`.
- Timing: `16.9s -> 9.6s`
- Historical outcome: `Still broken`

### Run 5 Output

```md
Here are some developers similar to [Supergiant Games](https://store.steampowered.com/developer/SupergiantGames):

| Developer | Game Count | Genres | Review Percentage |
|-----------|------------|--------|-------------------|
| [supergame](https://store.steampowered.com/developer/supergame) | 1 | Action, Adventure, Indie | N/A |
| [Supergonk](https://store.steampowered.com/developer/Supergonk) | 2 | Action, Casual, Indie | 53% |
| [Supergonk Ltd.](https://store.steampowered.com/developer/Supergonk%20Ltd.) | 1 | Casual, Free to Play, Indie | 67% |
| [Supergalactiс Gamedev](https://store.steampowered.com/developer/Supergalactiс%20Gamedev) | 2 | Action, Adventure, Indie | 86% |
| [Superelectric Games](https://store.steampowered.com/developer/Superelectric%20Games) | 3 | Action, Early Access, RPG | N/A |
| [Supernova Games](https://store.steampowered.com/developer/Supernova%20Games) | 14 | Action, Adventure, Casual | 94% |
| [White Giant RPG Studios](https://store.steampowered.com/developer/White%20Giant%20RPG%20Studios) | 4 | Indie, RPG, Sports | 85% |
| [Prime Games](https://store.steampowered.com/developer/Prime%20Games) | 5 | Adventure, Casual, Indie | 83% |
| [Supercap Games LLC](https://store.steampowered.com/developer/Supercap%20Games%20LLC) | 2 | Action, Casual, Indie | N/A |
| [Super-V](https://store.steampowered.com/developer/Super-V) | 1 | Action, Adventure, Indie | N/A |

These developers share similar genres and styles, making them comparable to Supergiant Games.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "find_similar",
    "arguments": {
      "entity_type": "developer",
      "reference_name": "Supergiant Games"
    },
    "executionMs": 713,
    "success": true,
    "result_summary": "11 results"
  }
]
```

## Prompt #175

- Prompt: `Publishers with releases in every year since 2020`
- Run 1 score/verdict: `8/10` / `Strong`
- Run 1 tools: `lookup_publishers, lookup_publishers, lookup_publishers, lookup_publishers, lookup_publishers, lookup_publishers, lookup_publishers, lookup_publishers, lookup_publishers, query_analytics, query_analytics, query_analytics, query_analytics, query_analytics, query_analytics`
- Run 1 timing: `total 22091ms | llm 18410ms | tools 3150ms | iterations 5`
- Run 4 historical summary: Now answers from one grouped year-based query and returns continuity rows successfully.
- Run 4 timing/outcome: `22.1s -> 21.3s` / `Fixed`
- Run 5 status/timing: `success` / `200` / `26231ms`
- Run 5 tools: `query_analytics`
- Assessment: fixed. The continuity query now succeeds from a single grouped analytics call and returns yearly rows instead of hitting the old iteration failure.

### Run 1 Output

```md
I executed 15 tool calls but wasn't able to generate a response. This may be due to hitting the maximum iteration limit (5). Please try rephrasing your question or being more specific.
```

### Run 4 Historical Summary

- Run 4: Now answers from one grouped year-based query and returns continuity rows successfully.
- Timing: `22.1s -> 21.3s`
- Historical outcome: `Fixed`

### Run 5 Output

```md
Here are the publishers that have released games in every year since 2020:

| Publisher | Year | Game Count | Total Reviews | Average Review Score |
|-----------|------|------------|---------------|-----------------------|
| [Valve](/publishers/1527) | 2020 | 1 | 97,229 | 98 |
| [Atari](/publishers/1529) | 2020 | 4 | 2,940 | 86 |
| [Atari](/publishers/1529) | 2021 | 10 | 4,702 | 68 |
| [Atari](/publishers/1529) | 2022 | 15 | 1,348 | 83 |
| [Atari](/publishers/1529) | 2023 | 14 | 17,590 | 87 |
| [Atari](/publishers/1529) | 2024 | 17 | 2,293 | 75 |
| [Atari](/publishers/1529) | 2025 | 10 | 116 | 93 |
| [Atari](/publishers/1529) | 2026 | 2 | 1 | 100 |
| [Nightdive Studios](/publishers/1530) | 2020 | 1 | 415 | 79 |
| [Nightdive Studios](/publishers/1530) | 2021 | 1 | 1,370 | 94 |
| [Nightdive Studios](/publishers/1530) | 2022 | 2 | 1,279 | 84 |
| [Nightdive Studios](/publishers/1530) | 2023 | 3 | 13,406 | 91 |
| [Nightdive Studios](/publishers/1530) | 2024 | 4 | 1,337 | 89 |
| [Nightdive Studios](/publishers/1530) | 2025 | 3 | 1,998 | 88 |
| [Bethesda Softworks](/publishers/1547) | 2020 | 4 | 364,778 | 84 |
| [Bethesda Softworks](/publishers/1547) | 2021 | 3 | 35,670 | 74 |
| [Bethesda Softworks](/publishers/1547) | 2022 | 6 | 57,638 | 76 |
| [Bethesda Softworks](/publishers/1547) | 2023 | 3 | 175,292 | 56 |
| [Bethesda Softworks](/publishers/1547) | 2024 | 2 | 18,877 | 91 |
| [Bethesda Softworks](/publishers/1547) | 2025 | 3 | 105,759 | 81 |
| [Ubisoft](/publishers/1550) | 2020 | 2 | 3,151 | 81 |
| [Ubisoft](/publishers/1550) | 2021 | 3 | 45,265 | 70 |
| [Ubisoft](/publishers/1550) | 2022 | 3 | 121,597 | 73 |
| [Ubisoft](/publishers/1550) | 2023 | 7 | 88,957 | 80 |
| [Ubisoft](/publishers/1550) | 2024 | 15 | 2,493 | 90 |
| [Ubisoft](/publishers/1550) | 2025 | 1 | 355 | 61 |
| [THQ Nordic](/publishers/1558) | 2020 | 9 | 55,223 | 91 |
| [THQ Nordic](/publishers/1558) | 2021 | 7 | 46,257 | 80 |
| [THQ Nordic](/publishers/1558) | 2022 | 9 | 46,553 | 74 |
| [THQ Nordic](/publishers/1558) | 2023 | 8 | 97,438 | 84 |
| [THQ Nordic](/publishers/1558) | 2024 | 5 | 11,587 | 71 |
| [THQ Nordic](/publishers/1558) | 2025 | 8 | 4,144 | 79 |

These publishers have consistently released games each year from 2020 through 2026.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "query_analytics",
    "arguments": {
      "cube": "PublisherYearMetrics",
      "dimensions": [
        "PublisherYearMetrics.publisherId",
        "PublisherYearMetrics.publisherName",
        "PublisherYearMetrics.releaseYear",
        "PublisherYearMetrics.gameCount"
      ],
      "filters": [
        {
          "member": "PublisherYearMetrics.releaseYear",
          "operator": "gte",
          "values": [
            "2020"
          ]
        }
      ],
      "reasoning": "To find publishers with releases in every year since 2020, we need to check the release years and count the games for each publisher.",
      "limit": 100
    },
    "executionMs": 4123,
    "success": true,
    "result_summary": "100 rows"
  }
]
```

## Prompt #178

- Prompt: `how many games has Krafton published?`
- Run 1 score/verdict: `7/10` / `Acceptable`
- Run 1 tools: `lookup_publishers, query_analytics`
- Run 1 timing: `total 5143ms | llm 4643ms | tools 269ms | iterations 3`
- Run 4 historical summary: Still returns only a bare count, with no quality context or representative titles.
- Run 4 timing/outcome: `5.1s -> 2.2s` / `Still weak`
- Run 5 status/timing: `success` / `200` / `2974ms`
- Run 5 tools: `lookup_publishers`
- Assessment: still weak. The rerun is faster, but it still answers with only a bare count and no portfolio or quality context.

### Run 1 Output

```md
KRAFTON, Inc. has published a total of **33 games**.
```

### Run 4 Historical Summary

- Run 4: Still returns only a bare count, with no quality context or representative titles.
- Timing: `5.1s -> 2.2s`
- Historical outcome: `Still weak`

### Run 5 Output

```md
[KRAFTON, Inc.](https://store.steampowered.com/publisher/KRAFTON) has published a total of **33 games**.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "lookup_publishers",
    "arguments": {
      "query": "Krafton"
    },
    "executionMs": 321,
    "success": true,
    "result_summary": "4 results"
  }
]
```

## Prompt #179

- Prompt: `How many games has Valve published?`
- Run 1 score/verdict: `7/10` / `Acceptable`
- Run 1 tools: `lookup_publishers, query_analytics`
- Run 1 timing: `total 5458ms | llm 4848ms | tools 340ms | iterations 3`
- Run 4 historical summary: Still returns only a bare count, with no quality context or representative titles.
- Run 4 timing/outcome: `5.5s -> 2.2s` / `Still weak`
- Run 5 status/timing: `success` / `200` / `2077ms`
- Run 5 tools: `lookup_publishers`
- Assessment: still weak. It remains a bare count answer with no exemplars or quality context.

### Run 1 Output

```md
Valve has published a total of **38 games**.
```

### Run 4 Historical Summary

- Run 4: Still returns only a bare count, with no quality context or representative titles.
- Timing: `5.5s -> 2.2s`
- Historical outcome: `Still weak`

### Run 5 Output

```md
Valve has published a total of **38 games**.
```

### Run 5 Tool Calls

```json
[
  {
    "name": "lookup_publishers",
    "arguments": {
      "query": "Valve"
    },
    "executionMs": 324,
    "success": true,
    "result_summary": "9 results"
  }
]
```

