# Chat Interface Guide

A natural language interface for querying the Steam database. Ask questions in plain English and get instant answers with data tables, charts, and clickable game links.

## Getting Started

1. Navigate to the **Chat** page in the admin dashboard (`/chat`)
2. Type your question in the text box at the bottom
3. Press **Enter** or click Send
4. View the response with formatted tables and clickable game names

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

1. **SQL Query** - The exact database query that was executed
2. **Reasoning** - Why the AI chose this particular query structure
3. **Results** - Number of rows returned

This is useful for:
- Understanding how your question was interpreted
- Learning the database schema
- Copying queries for external use
- Debugging unexpected results

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
The system understands terms like:
- **Indie** - Games where developer = publisher
- **CCU** - Concurrent users (current players)
- **Review velocity** - Reviews per day
- **Trending** - Positive ratio change over time
- **Similar** - Semantically related based on tags, genres, description
- **Steam Deck Verified** - Fully compatible with Steam Deck
- **Steam Deck Playable** - Works on Steam Deck with minor issues
- **Controller support** - Full, partial, or none
- **Less popular** - Fewer reviews than reference game
- **More popular** - More reviews than reference game

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
