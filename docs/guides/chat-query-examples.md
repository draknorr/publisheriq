# Chat Query Examples

A comprehensive collection of example queries for the PublisherIQ chat interface. These examples demonstrate the full range of capabilities from basic lookups to advanced multi-criteria discovery.

**Last Updated:** January 12, 2026

> **Related Documentation:**
> - [Chat Interface Guide](./chat-interface.md) - How to use the chat interface
> - [Chat Data System Architecture](../architecture/chat-data-system.md) - Technical details

---

## Quick Reference

| Want to... | Example Query |
|------------|---------------|
| Find games by tag | "Show me roguelike games" |
| Find games by concept | "Tactical games with deck building" |
| Find similar games | "Games similar to Hades" |
| Find trending games | "What's breaking out right now?" |
| Look up a specific game | "Tell me about Elden Ring" |
| Find publisher games | "Show me all games by Valve" |
| Find Steam Deck games | "Steam Deck verified roguelikes" |
| Find hidden gems | "Games like Hollow Knight but less popular" |

---

## Tool Selection Guide

The chat uses different tools based on your query type:

```
"Games like Hades"              → find_similar (vector similarity)
"Tactical roguelikes"           → search_by_concept (semantic search) [v2.4]
"Roguelike games"               → search_games (tag-based)
"What's breaking out?"          → discover_trending (momentum) [v2.4]
"Top 10 games by reviews"       → query_analytics (structured data)
"Tell me about Elden Ring"      → lookup_games → query_analytics
"Games by FromSoftware"         → lookup_developers → query_analytics
```

---

## 1. Getting Started

Basic queries for new users to understand what's possible.

### Examples

**1.1 Top games by metric**
```
What are the top 10 games by reviews?
```
Returns the most-reviewed games on Steam with review counts and scores.

**1.2 Specific game lookup**
```
Tell me about Elden Ring
```
Returns detailed information about a specific game including reviews, price, platforms, and Steam Deck status.

**1.3 Publisher overview**
```
How many games has Valve published?
```
Returns the publisher's game count and portfolio summary.

**1.4 Simple category**
```
Show me free-to-play games
```
Uses the `free` segment to find all F2P games, sorted by popularity.

**1.5 Trending overview**
```
What games are trending right now?
```
Uses the `trending` segment to find games with positive 30-day review momentum.

---

## 2. Game Discovery by Tags & Genres

Find games using Steam's tag system, genres, and categories. Uses the `search_games` tool for structured filtering.

### Examples

**2.1 Simple tag search**
```
Show me roguelike games
```
Finds games tagged as "Roguelike" sorted by reviews.

**2.2 Tag with year filter**
```
CRPG games released in 2024
```
Combines tag filtering with release year to find recent CRPGs.

**2.3 Tag with Steam Deck**
```
Souls-like games on Steam Deck
```
Finds Souls-like games that are verified or playable on Steam Deck.

**2.4 Multiple criteria**
```
Linux games with Workshop support and 90%+ reviews
```
Combines platform, category (Workshop), and review quality filters.

**2.5 Tag with price and features**
```
Metroidvania games under $20 with full controller support
```
Filters by tag, maximum price, and controller support level.

### More Tag Examples

```
VR games with co-op support
Action RPGs on Mac with positive reviews
Pixel graphics games released this year
Horror games with achievements and controller support
Open world games on Linux under $30
```

---

## 3. Concept Search [v2.4]

Search using natural language descriptions without needing exact tag names. Uses the `search_by_concept` tool for semantic understanding.

### Examples

**3.1 Gameplay mechanics**
```
Tactical roguelikes with deck building
```
Finds games matching the concept even if they don't have all those exact tags.

**3.2 Atmosphere and genre**
```
Cozy farming games with crafting elements
```
Uses semantic understanding to find relaxing farming games with crafting systems.

**3.3 Multiple concepts**
```
Horror games with investigation and puzzle elements
```
Finds horror games that emphasize detective work and puzzles.

**3.4 Concept with filters**
```
Atmospheric exploration games under $15 on Steam Deck
```
Combines semantic search with price and platform filters.

**3.5 Nuanced description**
```
Games that feel like Hollow Knight but with more story focus
```
Searches for games with similar gameplay but different emphasis.

### More Concept Examples

```
Fast-paced shooters with roguelike elements
Relaxing puzzle games with beautiful art
Dark fantasy games with deep lore
City builders with survival mechanics
Retro-style platformers with tight controls
```

---

## 4. Trend Discovery [v2.4]

Find games based on review momentum and velocity patterns. Uses the `discover_trending` tool for momentum-based discovery.

### Trend Types

| Type | Description |
|------|-------------|
| `review_momentum` | Highest current review activity (most reviews/day) |
| `accelerating` | Review rate increasing (7d > 30d rate) |
| `breaking_out` | Hidden gems gaining attention (accelerating + 100-10K reviews) |
| `declining` | Review velocity dropping |

### Examples

**4.1 Accelerating games**
```
What games are gaining traction this week?
```
Finds games where 7-day review velocity exceeds 30-day average.

**4.2 Breaking out (hidden gems)**
```
Show me breaking out games right now
```
Finds games with 100-10K reviews that are accelerating - perfect for discovering tomorrow's hits.

**4.3 Most active**
```
Most active games by reviews
```
Returns games with the highest current review velocity (reviews per day).

**4.4 Declining games**
```
Which roguelites are declining in popularity?
```
Finds roguelites where review velocity is decreasing.

**4.5 Complex trend filter**
```
Free-to-play games with accelerating reviews from 2025
```
Combines trend type with price and release year filters.

### More Trend Examples

```
Breaking out indie games this month
Accelerating games on Steam Deck
What horror games are gaining momentum?
Declining multiplayer games
Games breaking out with overwhelmingly positive reviews
```

---

## 5. Similar Games Discovery

Find games semantically similar to a reference game using vector embeddings. Uses the `find_similar` tool.

### Similarity Filters

| Filter | Description |
|--------|-------------|
| `less_popular` | Fewer reviews than reference (hidden gems) |
| `similar` | Similar review count |
| `more_popular` | More reviews than reference |
| `better_reviews` | Higher review percentage |
| Price filters | Max price, free only |
| Platform filters | Steam Deck, Linux, Mac |

### Examples

**5.1 Basic similarity**
```
Games similar to Hades
```
Returns games semantically similar based on genres, tags, mechanics, and style.

**5.2 Hidden gems (less popular)**
```
Games like Dead Cells but less popular
```
Finds similar games with significantly fewer reviews - great for discovering underrated titles.

**5.3 Platform-specific**
```
Steam Deck verified games similar to Celeste
```
Combines similarity search with Steam Deck compatibility filter.

**5.4 Multiple filters**
```
Free games similar to Stardew Valley with better reviews
```
Finds F2P games similar to Stardew Valley that are even more positively reviewed.

**5.5 Price and platform**
```
Cheaper alternatives to Elden Ring on Linux
```
Finds similar games at lower price points that work on Linux.

### More Similarity Examples

```
Games like Hollow Knight but with pixel art
Multiplayer games similar to Deep Rock Galactic
RPGs like Baldur's Gate 3 but shorter
Games like Vampire Survivors under $5
Steam Deck games similar to Hades with better reviews
```

---

## 6. Publisher & Developer Analysis

Analyze publisher and developer portfolios, releases, and performance.

### Examples

**6.1 Developer catalog**
```
Show me all games by FromSoftware
```
Lists all games developed by FromSoftware with reviews and scores.

**6.2 Publisher rankings**
```
Which publishers released the most games in 2025?
```
Ranks publishers by number of releases in a specific year.

**6.3 Quality rankings**
```
Top developers by average review score
```
Finds developers with the highest average review percentages across their catalogs.

**6.4 Similar publishers**
```
Publishers similar to Devolver Digital
```
Uses vector similarity to find publishers with similar game portfolios.

**6.5 Developer comparison**
```
Compare FromSoftware and Team Cherry by reviews
```
Side-by-side comparison of two developers' review metrics.

### More Publisher/Developer Examples

```
What are Valve's highest rated games?
Indie developers with 3+ games and 90%+ average reviews
Which publishers have the most Steam Deck verified games?
Show me developers similar to Supergiant Games
Publishers with the most games released in the past 6 months
```

---

## 7. Steam Deck & Platform Queries

Find games based on platform support and Steam Deck compatibility.

### Steam Deck Categories

| Category | Description |
|----------|-------------|
| `verified` | Fully optimized for Steam Deck |
| `playable` | Works on Steam Deck (may need tweaks) |

### Examples

**7.1 Steam Deck verified**
```
Steam Deck verified games
```
Returns all games with "Verified" Steam Deck status.

**7.2 Mac with quality filter**
```
Mac games with Very Positive reviews
```
Finds Mac-compatible games with 80%+ positive reviews.

**7.3 Platform with tag**
```
Linux-native roguelikes released this year
```
Combines Linux platform filter with roguelike tag and release year.

**7.4 Steam Deck with similarity**
```
Steam Deck playable games similar to Hades
```
Finds Hades-like games that work on Steam Deck.

**7.5 Cross-platform**
```
Games with full controller support on all platforms
```
Finds games available on Windows, Mac, and Linux with full controller support.

### More Platform Examples

```
Best VR games on Steam
Linux games with Workshop support
Steam Deck verified games under $20
Mac-native multiplayer games with positive reviews
Games that support all platforms and Steam Deck
```

---

## 8. Price & Deals Queries

Find games based on pricing, discounts, and free-to-play status.

### Examples

**8.1 F2P quality filter**
```
What free-to-play games have the best reviews?
```
Finds the highest-rated free-to-play games.

**8.2 Current sales**
```
Games currently on sale
```
Returns games with active discounts.

**8.3 Deep discounts**
```
Best deals over 50% off with positive reviews
```
Finds heavily discounted games that are still well-reviewed.

**8.4 Genre on sale**
```
Strategy games on sale with high Metacritic scores
```
Combines genre, sale status, and Metacritic filtering.

**8.5 Budget with quality**
```
Highly rated games under $10 released in the past year
```
Finds recent, affordable, well-reviewed games.

### More Price Examples

```
Free roguelikes with positive reviews
Games under $5 with overwhelmingly positive reviews
Indie games on sale this week
Best value games (high reviews, low price)
Premium games over $40 with great reviews
```

---

## 9. Time-Based & Historical Queries

Analyze games and trends over time periods.

### Time Filters

| Filter | Description |
|--------|-------------|
| `releaseYear` | Specific year (e.g., 2025) |
| `recentlyReleased` | Past 30 days |
| `recentlyUpdated` | Content update in past 30 days |
| `lastYear` | Rolling 12 months |
| `last6Months` | Rolling 6 months |
| `last3Months` | Rolling 3 months |

### Examples

**9.1 Specific year**
```
Games released in 2025
```
Returns all games from 2025 sorted by reviews.

**9.2 Recent releases**
```
New releases from the past 30 days
```
Uses the `recentlyReleased` segment for the freshest games.

**9.3 Updated with trends**
```
Games updated recently with positive review trends
```
Finds games that received content updates and have improving sentiment.

**9.4 Year range**
```
Indie games from 2020-2022 with overwhelmingly positive reviews
```
Multi-year filter with indie segment and high review threshold.

**9.5 Milestone tracking**
```
Which games crossed 100K reviews this month?
```
Uses time-series data to find games hitting review milestones.

### More Time Examples

```
Best games of 2024
Games released last month with positive reviews
Oldest games still getting new reviews
Games updated this week
Publishers with releases in every year since 2020
```

---

## 10. Review & Velocity Analysis

Analyze review scores, velocity, and sentiment patterns.

### Velocity Tiers

| Tier | Reviews/Day |
|------|-------------|
| High | 5+ |
| Medium | 1-5 |
| Low | 0.1-1 |
| Dormant | <0.1 |

### Examples

**10.1 Top tier reviews**
```
Games with overwhelmingly positive reviews
```
Uses the `overwhelminglyPositive` segment (95%+ positive).

**10.2 High velocity**
```
High velocity games (5+ reviews per day)
```
Finds games in the "high" velocity tier.

**10.3 Accelerating velocity**
```
Games with accelerating review velocity
```
Finds games where 7-day velocity exceeds 30-day velocity by 20%+.

**10.4 Weekly activity**
```
Which games have the most reviews added this week?
```
Ranks games by 7-day review count.

**10.5 Sentiment improvement**
```
Games with improving sentiment in the past 30 days
```
Finds games where review percentage is trending upward.

### More Review Examples

```
Games that went from Mixed to Positive reviews
Highly rated games with low review velocity (stable classics)
Which games have the best review-to-owner ratio?
Games with over 100K reviews and 95%+ positive
Most reviewed games of all time
```

---

## 11. Hidden Gem Queries

Powerful combinations for discovering underrated or overlooked games.

### Examples

**11.1 Breaking out indies**
```
Breaking out indie games right now
```
Uses `discover_trending` with "breaking_out" type and indie filter.

**11.2 Less popular alternatives**
```
Games like Hollow Knight but with fewer than 10K reviews
```
Similarity search with `less_popular` filter for undiscovered alternatives.

**11.3 Quality + low visibility**
```
Highly rated games under 5000 reviews on Steam Deck
```
Finds Steam Deck games with great reviews but low visibility.

**11.4 Accelerating niche**
```
Accelerating roguelites from 2024 with under 20K reviews
```
Combines trend momentum, tag, year, and review count ceiling.

**11.5 Niche quality**
```
Cozy games with 95%+ reviews and fewer than 50K owners
```
Finds exceptional but undiscovered cozy games.

### More Hidden Gem Examples

```
Indie games with 98%+ reviews under 5000 reviews
Similar to Celeste but less popular
Breaking out games on Steam Deck under $15
Strategy games with high reviews but low CCU
Best games you've never heard of (under 1000 reviews, 90%+)
```

---

## 12. Advanced Multi-Criteria Queries

Complex queries demonstrating the full power of combining multiple tools and filters.

### Examples

**12.1 Similarity + concept**
```
Find tactical deck-builders on Steam Deck similar to Slay the Spire
```
Combines concept search with similarity and platform filtering.

**12.2 Publisher portfolio analysis**
```
Publishers with 5+ games averaging 85%+ reviews in the past 3 years
```
Aggregates publisher metrics with quality and time filters.

**12.3 Comparative analysis**
```
Compare top 5 roguelites by review velocity and CCU
```
Multi-metric comparison across a filtered set of games.

**12.4 Full filter stack**
```
Breaking out horror games for Steam Deck under $25
```
Combines trend type, genre, platform, and price in one query.

**12.5 Developer similarity + time**
```
Developers similar to Supergiant who released games in 2024
```
Vector similarity on developers with release recency filter.

### More Advanced Examples

```
Publishers like Devolver Digital with releases in 2025 averaging 85%+ reviews
Roguelikes similar to Hades breaking out on Steam Deck
Compare review velocity trends for top 10 indie hits of 2024
Free games with accelerating velocity and Steam Deck verified status
Developers with 3+ games, all above 90% reviews, with a release in the past year
```

---

## v2.4 Feature Highlights

### Concept Search (`search_by_concept`)

Search for games using natural language descriptions instead of exact tags:

```
"Atmospheric horror with investigation"    (not "Horror" + "Mystery" tags)
"Fast-paced roguelike with deck building"  (semantic understanding)
"Cozy life sim with farming"               (describes the feel, not tags)
```

**When to use:** When you want to describe what you're looking for rather than specify exact tags.

### Trend Discovery (`discover_trending`)

Four distinct momentum patterns to discover:

| Pattern | What It Finds |
|---------|---------------|
| `review_momentum` | Most actively reviewed games right now |
| `accelerating` | Games gaining steam (velocity increasing) |
| `breaking_out` | Hidden gems going viral (accelerating + 100-10K reviews) |
| `declining` | Games losing momentum (velocity decreasing) |

**When to use:** When you want to find what's hot, what's cooling off, or tomorrow's hits.

### Enhanced Embeddings

Game embeddings now include:
- CCU momentum (player activity trends)
- Review velocity (activity level)
- Sentiment trajectory (improving/declining reviews)

This makes similarity searches more accurate for finding games with similar "lifecycle" patterns.

---

## Common Query Patterns

### Finding Games

| Goal | Query Pattern |
|------|---------------|
| By tag | "Show me [TAG] games" |
| By concept | "[DESCRIPTION] games" |
| Like another game | "Games similar to [GAME]" |
| Hidden gems | "Games like [GAME] but less popular" |
| By trend | "What's breaking out / gaining traction?" |

### Filtering Results

| Filter | Query Pattern |
|--------|---------------|
| Platform | "...on Steam Deck / Linux / Mac" |
| Price | "...under $[X]" or "free [TYPE] games" |
| Quality | "...with positive / 90%+ reviews" |
| Time | "...released in [YEAR] / this year / recently" |
| Features | "...with controller support / Workshop / VR" |

### Combining Filters

Build complex queries by chaining filters:

```
[TAG] games on [PLATFORM] with [QUALITY] reviews under $[PRICE] released [TIME]

Example: "Roguelike games on Steam Deck with 90%+ reviews under $20 released this year"
```

---

## Tips for Best Results

1. **Be specific** - "Top 10 roguelikes by reviews" works better than "best roguelikes"
2. **Use concepts for vibes** - "cozy farming with crafting" vs exact tags
3. **Use tags for precision** - When you know the exact Steam tag name
4. **Combine filters thoughtfully** - Platform + quality + price works well
5. **Try breaking_out for discovery** - Best way to find tomorrow's hits
6. **Use similarity + filters** - "Games like X but cheaper/better reviewed"
