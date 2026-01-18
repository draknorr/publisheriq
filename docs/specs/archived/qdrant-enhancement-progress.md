# Qdrant Enhancement Progress

## Overview
Tracking progress for Qdrant Cloud optimization enhancements. Each sprint can be completed independently after `/clear`.

**Plan Reference**: `~/.claude/plans/linked-beaming-cray.md`

---

## Sprint 1: Foundation + Concept Search
- [x] 1.1 Fix publisher/developer filters in search-service.ts
- [x] 1.2 Add search_by_concept tool to cube-tools.ts
- [x] 1.3 Add concept search handler in route.ts
- [x] 1.4 Update system prompt with concept search docs
- [ ] 1.5 Test: "Find tactical roguelikes with deck building"

## Sprint 2: Temporal Infrastructure
- [x] 2.1 Create get_game_momentum RPC in Supabase
- [x] 2.2 Create get_sentiment_trajectory RPC in Supabase
- [x] 2.3 Update buildGameEmbeddingText with momentum metrics
- [x] 2.4 Run full re-embed (manually via embedding-sync)
- [ ] 2.5 Test: Verify new embeddings include trend text

## Sprint 3: Trend-Based Discovery
- [x] 3.1 Add discover_trending tool to cube-tools.ts
- [x] 3.2 Add trend discovery handler in route.ts
- [x] 3.3 Update system prompt with trend tool docs
- [ ] 3.4 Test: "Games gaining players this week"

## Sprint 4: Multi-Reference Search
- [ ] 4.1 Extend find_similar to accept array of reference names
- [ ] 4.2 Implement vector averaging in search-service.ts
- [ ] 4.3 Test: "Games like Hades AND Celeste"

## Sprint 5: Negative Similarity
- [ ] 5.1 Add exclude_similar_to parameter to find_similar
- [ ] 5.2 Implement vector subtraction
- [ ] 5.3 Test: "Games like Hades but NOT like Dead Cells"

---

## Notes
<!-- Add implementation notes, issues, or deferred items here -->

### Sprint 2.4 Embedding Sync Notes (2026-01-12)
- Ran embedding-sync locally with momentum-enhanced embedding text
- Results in 5.3 minutes:
  - Games: 9,838 embedded, 2,102 skipped (unchanged hash)
  - Publishers: 0 (RPC timeout - known issue with get_publishers_for_embedding)
  - Developers: 7,284 embedded
- Tokens used: ~2.07M, estimated cost: $0.04
- Note: Publisher embeddings failed due to statement timeout on RPC - may need optimization

### Sprint 3 Implementation Notes (2026-01-12)
- Added `discover_trending` tool for trend-based game discovery
- Trend types supported:
  - `review_momentum`: Games with highest review activity (most reviews/day)
  - `accelerating`: Games where review rate is increasing (7d > 30d × 1.2)
  - `breaking_out`: Hidden gems gaining attention (accelerating + 100-10K reviews)
  - `declining`: Games losing momentum (7d < 30d × 0.8)
- Uses existing Discovery cube segments: `activelyReviewed`, `acceleratingVelocity`, `deceleratingVelocity`
- Queries Cube.js (not raw SQL) for consistency and caching benefits
- Returns velocity metrics: velocity7d, velocity30d, velocityTier, reviewsAdded7d/30d
- Supports filters: platforms, steam_deck, min/max_reviews, is_free, release_year
- Note: tags/genres filtering logged but requires search_games for full support
- Files modified:
  - `apps/admin/src/lib/llm/cube-tools.ts` - Tool definition + CUBE_TOOLS array
  - `apps/admin/src/lib/search/trend-discovery.ts` - New execution function
  - `apps/admin/src/app/api/chat/stream/route.ts` - Handler wiring
  - `apps/admin/src/lib/llm/cube-system-prompt.ts` - Documentation

### Sprint 2.3 Implementation Notes (2026-01-12)
- Updated `get_apps_for_embedding` RPC with 7 new columns:
  - `ccu_growth_7d`, `ccu_growth_30d`: CCU momentum (% change)
  - `velocity_7d`, `velocity_acceleration`: Review velocity metrics
  - `recent_review_pct`, `historical_review_pct`, `sentiment_delta`: Sentiment trajectory
- Inlined momentum calculations in RPC (more efficient for batch processing vs per-appid calls)
- Added MOMENTUM section to embedding text (only shows if growth >= 10%):
  - Example: "Momentum: +45% CCU week-over-week, +120% vs 30-day avg"
- Added Review velocity line with acceleration indicator (only if velocity > 0):
  - Example: "Review velocity: 5.2/day, Accelerating (+2.1/day)"
- Added SENTIMENT section (only shows if delta >= 2%):
  - Example: "Recent sentiment: 97% positive (vs 95% historical, improving)"
- Migration: `20260112000002_add_momentum_to_embedding.sql`

### Sprint 2.1-2.2 Implementation Notes (2026-01-12)
- Created `get_game_momentum(p_appid)` RPC returning:
  - `ccu_growth_7d`: Week-over-week CCU % change (from ccu_snapshots)
  - `ccu_growth_30d`: Deviation from 30-day baseline % (from ccu_snapshots)
  - `velocity_7d`: Reviews/day 7-day avg (from review_velocity_stats)
  - `velocity_acceleration`: velocity_7d - velocity_30d
- Created `get_sentiment_trajectory(p_appid)` RPC returning:
  - `recent_review_pct`: Positive % of last 30 days reviews
  - `historical_review_pct`: Positive % of all-time reviews
  - `sentiment_delta`: recent - historical (positive = improving)
- Migration: `20260112000001_add_momentum_rpcs.sql`
- Both RPCs handle NULL data gracefully and prevent division by zero

### Sprint 1 Implementation Notes (2026-01-12)
- Added `search_by_concept` tool for semantic concept search
- Uses OpenAI text-embedding-3-small (512 dims) to embed user descriptions
- Searches `publisheriq_games` collection with embedded vector
- Supports same filters as `find_similar` (price, platforms, Steam Deck, etc.)
- Added comprehensive system prompt documentation with examples
- Key difference from `find_similar`: No reference game needed, pure concept matching

---

## New Query Types Enabled

**After Sprint 1:**
- "Find tactical roguelikes with deck building"
- "Horror games with investigation elements"
- "Publishers similar to Devolver with 10+ games"

**After Sprint 2-3:**
- "Games gaining players this week"
- "Games whose reviews improved recently"
- "Underrated games breaking out now"

**After Sprint 4-5:**
- "Games like Hades AND Celeste"
- "Games like Hollow Knight but NOT souls-like"
