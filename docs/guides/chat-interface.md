# Chat Interface Guide

A natural language interface for querying the Steam database. Ask questions in plain English and get instant answers with data tables, charts, and clickable game links.

**Last Updated:** January 8, 2026

> For technical implementation details, see [Chat Data System Architecture](../architecture/chat-data-system.md).

## Getting Started

1. Navigate to the **Chat** page in the admin dashboard (`/chat`)
2. Type your question in the text box at the bottom
3. Press **Enter** or click Send
4. View the response with formatted tables and clickable game names

## How It Works

The chat interface uses a multi-layered architecture:

1. **Natural Language Understanding**: Your question is analyzed by Claude (Anthropic's LLM)
2. **Tool Selection**: The AI selects the appropriate tool(s) to answer your question:
   - **query_analytics**: Structured queries via Cube.js semantic layer
   - **find_similar**: Vector similarity search via Qdrant
   - **search_games**: Tag/genre-based game discovery
   - **lookup_publishers/developers**: Name lookups for accurate filtering
   - **lookup_tags**: Discover available tags and genres
   - **lookup_games**: Find game appids by name (v2.1)
3. **Query Execution**: Queries run against PostgreSQL via Cube.js (not raw SQL)
4. **Entity Linking**: Results are pre-formatted with clickable links
5. **Response Generation**: The AI formats the results into a readable response

This architecture ensures:
- **Type-safe queries** through pre-defined Cube.js schemas
- **Consistent linking** for all game, publisher, and developer names
- **Fuzzy matching** for tags and entity names

---

## What You Can Ask

### Game Information
- Review scores and sentiment
- Player counts (CCU - concurrent users)
- Ownership estimates
- Playtime statistics
- Workshop support
- Pricing and discounts
- Steam tags and genres
- Steam Deck compatibility
- Controller support
- Platform availability (Windows, Mac, Linux)

### Publisher & Developer Data
- Game counts per publisher/developer
- Portfolio analysis
- First release dates
- Company comparisons
- Similar publishers/developers

### Similarity Search
- Find games similar to a reference game
- Find publishers with similar portfolios
- Find developers with similar catalogs
- Filter by popularity (less popular, similar, more popular)
- Filter by review quality, price, platforms

### Trending & Analysis
- Games trending up or down
- Review velocity (reviews per day)
- 30-day and 90-day trend changes
- Rising indie hits
- Velocity tiers (high/medium/low/dormant) (v2.1)
- Accelerating/decelerating games (v2.1)

### Historical Metrics
- Review trends over time
- Player count changes
- Price history

## Example Queries

**Top Games:**
- "What are the top 10 games by review score?"
- "Show me the most popular indie games by CCU"
- "Which free-to-play games have the best reviews?"

**Publisher/Developer:**
- "How many games has Valve published?"
- "Show me all games by CD Projekt Red"
- "Which publishers released the most games this year?"

**Trending:**
- "What games are trending up in reviews?"
- "Show me games with improving sentiment"
- "Which games had the biggest review increases this month?"
- "Show me high velocity games" (v2.1)
- "Which games have accelerating review velocity?" (v2.1)

**Specific Lookups:**
- "Tell me about Half-Life 2"
- "What's the review score for Elden Ring?"
- "Does Stardew Valley have workshop support?"

**Similarity Search:**
- "Find games similar to Hades"
- "Show me roguelikes similar to Dead Cells but with fewer reviews"
- "What publishers are similar to Devolver Digital?"
- "Find indie games like Stardew Valley"
- "Games similar to Hollow Knight with better reviews"

**PICS Data (Tags, Genres, Steam Deck):**
- "Show me Steam Deck verified games"
- "Which games have full controller support?"
- "Find Action RPGs released in 2024"
- "Linux-native games with Overwhelmingly Positive reviews"
- "Games tagged as 'roguelike' and 'pixel graphics'"

**Complex Queries:**
- "Find indie games with workshop support and over 1000 reviews"
- "Show me games released in 2024 with Very Positive reviews"
- "Which developers have multiple games with Overwhelmingly Positive ratings?"
- "Steam Deck verified games similar to Celeste"

## Understanding Responses

### Tables
When your query returns multiple results, they're displayed in a formatted table:

| Game | Reviews | Score |
|------|---------|-------|
| Half-Life 2 | 250,000 | Overwhelmingly Positive |
| Portal 2 | 400,000 | Overwhelmingly Positive |

### Clickable Links
- **Game names** appear as blue links. Click them to view the game's detail page.
- **Publisher names** are clickable and link to the publisher's detail page.
- **Developer names** are clickable and link to the developer's detail page.

### Similarity Results
When you ask for similar games/publishers/developers, results include:
- **Match percentage** - How similar the entity is (e.g., 92% match)
- **Key attributes** - Genres, tags, review score, platform support
- **Comparison filters applied** - Shows what filters were used (popularity, reviews, etc.)

### Code Blocks
SQL queries and code snippets are displayed with syntax highlighting. Use the copy button in the top-right corner to copy them.

### Long Responses
Very long responses are automatically collapsed. Click "Show more" to expand the full content.

## Query Details Panel

Each response has an expandable "Query Details" section that shows:

1. **Tool Calls** - Which tools were used (query_analytics, find_similar, etc.)
2. **Cube Query** - The structured Cube.js query that was executed
3. **Reasoning** - Why the AI chose this particular query structure
4. **Results** - Number of rows returned and data preview

This is useful for:
- Understanding how your question was interpreted
- Learning the Cube.js schema and available dimensions
- Debugging unexpected results
- Seeing which segments and filters were applied

## Tips for Better Results

### Be Specific
Instead of: "Show me good games"
Try: "Show me games with Overwhelmingly Positive reviews and over 10,000 total reviews"

### Mention Time Periods
Instead of: "What's trending?"
Try: "What games are trending up in the last 30 days?"

### Specify Fields
Instead of: "Tell me about Valve"
Try: "How many games has Valve published and what's their average review score?"

### Use Domain Terms
The system understands these terms and maps them to pre-defined query segments:

| Term | What It Means |
|------|---------------|
| **Indie** | Games with < 100K owners |
| **Popular** | Games with 1000+ reviews |
| **Mainstream** | Games with >= 100K owners |
| **Trending** | 30-day review trend is positive |
| **Highly rated** | 80%+ positive reviews |
| **Very positive** | 90%+ positive reviews |
| **Overwhelmingly positive** | 95%+ positive reviews |
| **Steam Deck Verified** | Fully compatible with Steam Deck |
| **Steam Deck Playable** | Works on Steam Deck (includes verified) |
| **Recently released** | Released in last 30 days |
| **Recently updated** | Content update in last 30 days |
| **Past 12 months** / **Last year** | Rolling 12-month window |
| **Past 6 months** | Rolling 6-month window |
| **Released in [YEAR]** | Specific year filter |

Other terms:
- **CCU** - Concurrent users (current players)
- **Review velocity** - Reviews per day (7-day average)
- **Similar** - Semantically related via vector embeddings
- **Controller support** - Full, partial, or none
- **Less popular** / **More popular** - Relative to reference game

## Similarity Search

The chat interface includes a powerful semantic similarity search feature powered by vector embeddings.

### How It Works

1. Each game, publisher, and developer has a vector embedding generated from their metadata (name, genres, tags, platforms, reviews, etc.)
2. When you ask for similar entities, the system finds the closest vectors in the embedding space
3. Results are filtered and ranked by similarity score

### Similarity Filters

You can refine similarity searches with these filters:

| Filter | Description | Example |
|--------|-------------|---------|
| Popularity | Compare by review count | "similar to Hades but less popular" |
| Reviews | Compare by review quality | "similar games with better reviews" |
| Price | Filter by price range | "similar free games" |
| Platforms | Filter by platform support | "similar Linux games" |
| Steam Deck | Filter by compatibility | "similar Steam Deck verified games" |
| Genres/Tags | Filter by specific attributes | "similar roguelikes" |

### Entity Types

- **Games**: Find games with similar themes, mechanics, and style
- **Publishers (Portfolio)**: Find publishers with similar overall catalogs
- **Publishers (Identity)**: Find publishers known for similar flagship games
- **Developers (Portfolio)**: Find developers with similar game catalogs
- **Developers (Identity)**: Find developers known for similar top games

### Popularity Comparison

When comparing popularity:
- **Less popular**: < 50% of the reference game's reviews
- **Similar popularity**: 50%-200% of reference reviews
- **More popular**: > 200% of reference reviews

## Entity Linking

All entity names in chat responses are automatically formatted as clickable links:

- **Game names**: Click to view the game's detail page
- **Publisher names**: Click to view the publisher's portfolio
- **Developer names**: Click to view the developer's portfolio

This linking is automatic and reliable because:
1. Results include entity IDs from the database
2. Links are pre-formatted before the AI sees the results
3. The AI uses the pre-formatted links directly in responses

**Note**: For linking to work correctly, the AI must include ID columns in queries. If you see plain text names (not clickable), the query may not have included the required IDs.

---

## Recent Updates

- **lookup_games tool** (v2.1): Search for games by name to get appid
- **ReviewVelocity cube** (v2.1): Query velocity stats and tiers
- **ReviewDeltas cube** (v2.1): Time-series data for trend charts
- **Entity linking now automatic**: All entity names are pre-formatted with links
- **Publisher/developer lookup**: System finds exact database names before querying (e.g., "Krafton" → "Krafton Inc.")
- **Default ordering**: Game lists are ordered by release date (newest first) by default
- **Cube.js integration**: Queries use semantic layer instead of raw SQL for safety and consistency
- **Fuzzy tag matching**: search_games tool matches tags loosely ("rogue" finds "Roguelike")

---

## Limitations

### Read-Only
The chat can only read data. It cannot modify, create, or delete anything in the database.

### Result Limits
Queries return a maximum of 50 rows. Ask for "top 10" or "top 20" to get focused results.

### Query Complexity
Very complex queries that take too long may time out. Try breaking complex questions into simpler parts.

### Data Freshness
Data is updated on a schedule:
- Popular games: Every 6-12 hours
- Moderate activity: Every 24-48 hours
- Low activity: Weekly

### Not Available
- Individual review text (only aggregates)
- Real-time player counts
- Store page screenshots
- User profiles

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Enter** | Send message |
| **Shift+Enter** | New line (multi-line input) |

## Troubleshooting

### "No results found"
- Try broadening your criteria
- Check spelling of game/publisher names
- Use partial matches: "games like 'half-life'" instead of exact names

### Unexpected Results
- Expand Query Details to see the SQL that was executed
- The query might have interpreted your question differently than expected
- Rephrase your question more specifically

### Slow Responses
- Complex aggregations take longer
- Try reducing the number of JOINs by asking simpler questions
- Ask for fewer results (top 10 instead of top 50)
