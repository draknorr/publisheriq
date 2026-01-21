# Search & Discovery Guide

This guide explains how to use the various search and discovery features in PublisherIQ's chat interface.

---

## Overview

PublisherIQ provides four main search approaches:

| Approach | Best For | Tool |
|----------|----------|------|
| **Structured Query** | Metrics, rankings, filtered lists | `query_analytics` |
| **Concept Search** | Natural language game ideas | `search_by_concept` |
| **Similarity Search** | "Games like X" | `find_similar` |
| **Trend Discovery** | Momentum and velocity patterns | `discover_trending` |

---

## Concept Search

Find games matching a natural language description without needing a reference game.

### How It Works

1. You describe what you're looking for in natural language
2. Your description is converted to a vector embedding
3. Vector search finds games with similar characteristics
4. Results are ranked by similarity score

### Example Queries

> "tactical roguelikes with deck building"

> "cozy farming games with crafting"

> "horror games with investigation elements"

> "fast-paced action games with pixel art"

> "atmospheric puzzle games with beautiful art"

### Adding Filters

Combine concept search with filters:

> "cozy farming games under $20 that work on Steam Deck"

> "roguelikes with 90%+ reviews released in 2024"

### What Makes It Different

| Concept Search | Tag/Genre Search |
|---------------|------------------|
| Semantic understanding | Exact tag matching |
| Works with descriptions | Requires knowing tag names |
| Finds thematic matches | Finds categorized games |
| May miss edge cases | May miss uncategorized games |

**Tip:** Use concept search when you can't express what you want with specific tags.

---

## Trend Discovery

Find games based on review momentum and velocity patterns.

### Trend Types

| Type | What It Finds | Use Case |
|------|---------------|----------|
| **review_momentum** | Highest review activity right now | Hot games getting attention |
| **accelerating** | Review rate increasing | Games picking up steam |
| **breaking_out** | Hidden gems gaining traction | Undiscovered games worth watching |
| **declining** | Review velocity dropping | Games losing momentum |

### Example Queries

> "What games are trending right now?"

> "Show me games with accelerating reviews"

> "Find breaking out hidden gems"

> "Which games are declining this week?"

### Trend Criteria

**Accelerating:**
- 7-day velocity > 30-day velocity × 1.2
- Recent interest exceeds baseline by 20%+

**Breaking Out:**
- Accelerating velocity (see above)
- Between 100-10,000 total reviews
- Not yet mainstream

**Declining:**
- 7-day velocity < 30-day velocity × 0.8
- Interest dropping by 20%+

### Timeframes

| Option | Velocity Calculation |
|--------|---------------------|
| **7d** | Based on last 7 days of review data |
| **30d** | Based on last 30 days of review data |

---

## Similarity Search

Find games similar to a reference game.

### Basic Usage

> "Find games similar to Hades"

> "Games like Stardew Valley"

> "What's similar to Hollow Knight?"

### Filtering Similar Results

Add constraints to narrow results:

> "Games similar to Hades but cheaper"

> "Games like Elden Ring for Steam Deck"

> "Indie games similar to Celeste"

### Similarity Filters

| Filter | Options | Description |
|--------|---------|-------------|
| `popularity_comparison` | any, less_popular, similar, more_popular | Filter by owner count relative to reference |
| `review_comparison` | any, similar_or_better, better_only | Filter by review score |
| `max_price_cents` | number | Maximum price |
| `is_free` | boolean | Only free games |
| `platforms` | windows, macos, linux | Platform requirements |
| `steam_deck` | verified, playable | Steam Deck compatibility |
| `genres` | string[] | Required genres |
| `tags` | string[] | Required tags |
| `min_reviews` | number | Minimum review count |
| `release_year` | {gte, lte} | Release date range |

### How Similarity Works

1. Reference game's embedding captures its "essence":
   - Description and themes
   - Genre and tag combination
   - Price and popularity tier
   - Review sentiment
   - Playtime characteristics

2. Vector search finds games with similar embeddings

3. Filters are applied to narrow results

4. Top matches are returned with similarity scores

---

## Structured Queries

For specific metrics, rankings, and filtered lists.

### Example Queries

> "Top 10 games by CCU"

> "Valve games released in 2024"

> "Free-to-play games with 95%+ reviews"

> "Publishers with highest revenue this year"

### When to Use

- You need specific metrics (CCU, reviews, revenue)
- You want ranked lists
- You're filtering by concrete criteria (price, date, tags)
- You need data in tables

### Available Cubes

| Cube | Data |
|------|------|
| Discovery | Games with all metrics |
| PublisherMetrics | All-time publisher stats |
| DeveloperMetrics | All-time developer stats |
| *YearMetrics | By release year |
| *GameMetrics | Per-game with periods |
| DailyMetrics | Historical time-series |
| ReviewVelocity | Velocity statistics |

---

## Tag & Genre Search

Find games by specific content tags.

### Discovering Tags

Ask what's available first:

> "What roguelike tags exist?"

> "Show me puzzle-related genres"

> "What co-op categories are there?"

### Using Tags

> "Games with the Roguelike and Deck Building tags"

> "RPGs with the Open World tag"

> "Action games with Online Co-Op"

### Tag vs Genre vs Category

| Type | Examples | Source |
|------|----------|--------|
| **Tags** | Roguelike, Souls-like, Cozy | User-voted Steam tags |
| **Genres** | Action, RPG, Adventure | Steam store categories |
| **Categories** | Multiplayer, VR, Workshop | Steam feature flags |

---

## Combining Approaches

The most powerful queries combine multiple approaches:

### Concept + Filters

> "cozy farming games released in 2024 with Steam Deck support"

Concept: "cozy farming games"
Filters: 2024 release, Steam Deck verified/playable

### Similarity + Trend

> "Games similar to Hades that are trending"

First: Find similar games
Then: Filter by trend status

### Tag + Metrics

> "Roguelikes with over 1000 reviews and 90%+ rating"

Tags: Roguelike
Metrics: min_reviews: 1000, review_percentage: gte 90

---

## Tips for Better Results

### Be Specific

Vague queries produce vague results:

| Instead of | Try |
|------------|-----|
| "good games" | "games with 95%+ reviews and 100K+ owners" |
| "new games" | "games released in the last 30 days" |
| "popular" | "games with 1000+ peak CCU" |

### Use Reference Points

When you know a game you like:

> "Games similar to [game], but [constraint]"

### Mention Platforms

If platform matters:

> "...that works on Steam Deck"
> "...with Linux support"

### Specify Time Periods

For time-sensitive queries:

> "released this year"
> "in the last 30 days"
> "trending this week"

### Combine Positive and Negative

> "roguelikes without permadeath"
> "multiplayer games that aren't shooters"

---

## Search Tool Reference

| Tool | Purpose | Credits |
|------|---------|---------|
| `lookup_tags` | Discover tag names | 4 |
| `lookup_publishers` | Find publisher names | 4 |
| `lookup_developers` | Find developer names | 4 |
| `lookup_games` | Find game names | 4 |
| `search_games` | Tag/genre-based search | 8 |
| `query_analytics` | Structured Cube.js queries | 8 |
| `search_by_concept` | Semantic concept search | 12 |
| `discover_trending` | Trend-based discovery | 12 |
| `find_similar` | Vector similarity search | 12 |

---

## Related Documentation

- [Chat Interface Guide](./chat-interface.md) - Using the chat system
- [Chat Query Examples](./chat-query-examples.md) - 60+ example queries
- [Chat Data System](../developer-guide/architecture/chat-data-system.md) - Technical details
