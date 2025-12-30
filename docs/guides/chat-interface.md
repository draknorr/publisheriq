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

### Publisher & Developer Data
- Game counts per publisher/developer
- Portfolio analysis
- First release dates
- Company comparisons

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

**Complex Queries:**
- "Find indie games with workshop support and over 1000 reviews"
- "Show me games released in 2024 with Very Positive reviews"
- "Which developers have multiple games with Overwhelmingly Positive ratings?"

## Understanding Responses

### Tables
When your query returns multiple results, they're displayed in a formatted table:

| Game | Reviews | Score |
|------|---------|-------|
| Half-Life 2 | 250,000 | Overwhelmingly Positive |
| Portal 2 | 400,000 | Overwhelmingly Positive |

### Clickable Game Links
Game names appear as blue links. Click them to view the game's detail page with full metrics and history.

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
