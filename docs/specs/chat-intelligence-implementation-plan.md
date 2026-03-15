# Chat Intelligence Implementation Plan

## Summary
PublisherIQ chat already has a strong base: Cube.js for structured analytics, Qdrant for semantic retrieval, and a typed tool loop for orchestration. The next step is not a rewrite. It is an additive upgrade that makes chat more context-aware, more explainable, and more useful as a product surface.

The recommended delivery order is:

1. Thread memory and persistence
2. Hybrid retrieval and reranking
3. Knowledge graph read model and graph tools
4. Personalization in chat
5. Planner, grounding, and answer assembly
6. Evals, admin debugging, and rollout

## Goals
- Improve follow-up continuity and reduce context loss.
- Improve discovery quality for exact, fuzzy, and concept-style prompts.
- Add explainable multi-hop reasoning across games, publishers, developers, franchises, genres, and tags.
- Make chat more useful to signed-in users through pins, alerts, and recent entity context.
- Keep the current stack intact and additive rather than replacing it.

## Current Product Baseline
The existing chat product already does several things well:

- Structured analytics through Cube.js
- Semantic similarity and concept search through Qdrant
- Typed tools for lookups, trends, and retrieval
- Streaming responses over SSE
- Existing personalization data through pins and alerts

The main gaps today are:

- Weak follow-up memory across turns
- Limited exact-plus-semantic retrieval fusion
- No explicit relationship traversal layer
- No first-class personalization inside chat ranking
- No planner for complex queries
- Limited grounding, evals, and operator visibility

## Recommended Architecture
### Keep
- Cube.js for metrics, rankings, aggregations, and time-series.
- Qdrant for dense retrieval and similarity search.
- The current custom typed tool loop.
- The current SSE streaming API shape.

### Add
- Durable thread storage in Postgres
- Hot thread/context cache in Redis
- Hybrid retrieval service combining exact lookup, full-text search, Qdrant, and reranking
- A graph read model built from current relational data
- A planner for multi-step prompts
- Stronger grounding and evaluation infrastructure

### Do Not Do
- Do not replace Postgres, Cube.js, or Qdrant.
- Do not make a graph database the primary datastore.
- Do not introduce a heavy orchestration framework unless the current custom tool loop becomes a blocker.

## Recommended Technical Decisions
| Area | Recommendation | Why |
|---|---|---|
| Orchestration | Keep custom typed tool loop | Fits the current codebase and keeps migration risk low |
| Thread persistence | Postgres | Already present, durable, simple to inspect |
| Hot thread cache | Upstash Redis | Vercel-friendly, low-friction, inexpensive |
| Dense retrieval | Existing Qdrant | Already integrated and useful |
| Hybrid retrieval | Exact lookup + Postgres full-text + Qdrant + reranker | Best quality lift without changing the core stack |
| Knowledge graph v1 | Postgres-backed graph read model | Lowest infra cost and easiest migration path |
| Knowledge graph v2 | Neo4j Aura only if needed later | Only justified if graph usage becomes frequent and latency-sensitive |
| Reranker | Hosted first, self-host later if needed | Fastest path to quality gains |

## Capability Breakdown

### 1. Thread Memory
#### What it adds
- Durable chat threads and resumable conversations
- Canonical entity resolution across turns
- Active filters and time-window memory
- Summarized long-thread context

#### Implementation
- Add `chat_threads`, `chat_messages`, and `chat_thread_entities`.
- Store resolved entities, active constraints, and thread summaries.
- Add a `context_resolver` step before each LLM call.
- Cache hot thread state in Redis.

#### What this will improve to the user
- Follow-up prompts will feel natural instead of forcing the user to restate everything.
- The chat will remember which game, publisher, time period, and filters the user was talking about.
- Longer conversations will stay coherent instead of degrading after a few turns.

#### User-facing examples
- Current:
  - User: "Show me breakout indie games from 2025."
  - User: "Only the ones under $20."
  - Risk: the chat may lose the earlier context or rerun too broad a search.
- Improved:
  - User: "Show me breakout indie games from 2025."
  - User: "Only the ones under $20."
  - User: "Which of those are Steam Deck verified?"
  - Result: the chat keeps the same candidate set and narrows it correctly.
- Current:
  - User: "Tell me about Hades 2."
  - User: "How does the publisher compare to similar studios?"
  - Risk: "the publisher" may not resolve reliably.
- Improved:
  - Result: the chat understands the publisher reference without requiring the user to say the name again.

#### Pros
- Highest impact on perceived intelligence
- Cheap to run
- Makes follow-ups materially better

#### Cons
- Bad summaries can preserve wrong assumptions
- Requires careful overwrite rules when the user changes topic

#### Difficulty
- Medium

### 2. Hybrid Retrieval + Reranking
#### What it adds
- Better exact-name and acronym handling
- Better long-tail discovery
- Better ranking for concept search and recommendation prompts

#### Implementation
- Build a shared `retrieve_candidates` service.
- Stage 1: exact lookup
- Stage 2: Postgres full-text or BM25-style retrieval
- Stage 3: Qdrant dense retrieval
- Stage 4: rerank top candidates
- Return retrieval reasons and scores to the chat layer

#### What this will improve to the user
- The chat will find the right entity more reliably, especially for ambiguous names and abbreviations.
- Discovery prompts will return more relevant results instead of semantically close but wrong matches.
- Recommendations will feel sharper and less noisy.

#### User-facing examples
- Current:
  - User: "Tell me about PoE."
  - Risk: the system may confuse Path of Exile, Pillars of Eternity, or another near match.
- Improved:
  - Result: the system either ranks the most likely exact matches first or asks a short clarification.
- Current:
  - User: "Find atmospheric deckbuilders with low player counts but strong reviews."
  - Risk: pure semantic search may pull vaguely related strategy games.
- Improved:
  - Result: exact terms, metadata, and semantic candidates are combined and reranked into a tighter list.
- Current:
  - User: "Games like Balatro but less mainstream."
  - Risk: relevant but popularity-insensitive matches may dominate.
- Improved:
  - Result: retrieval understands the title exactly, combines similarity with popularity filters, and ranks better alternatives.

#### Pros
- Strongest relevance upgrade after memory
- Fixes weaknesses of dense-only or exact-only retrieval

#### Cons
- More ranking complexity
- Extra usage cost if using a paid reranker

#### Difficulty
- Medium

### 3. Knowledge Graph Read Model
#### What it adds
- Multi-hop relationship reasoning
- Explainable recommendation paths
- Better ecosystem-style discovery and portfolio analysis

#### Implementation
- Build graph nodes for `game`, `publisher`, `developer`, `franchise`, `genre`, `tag`, `category`, `user_pin`, and `alert_signal`.
- Build edges such as `published_by`, `developed_by`, `in_franchise`, `has_tag`, `has_genre`, `has_category`, `pinned_by_user`, and `alerted_for_user`.
- Add derived edges like `shares_developer_with` and `shares_publisher_with`.
- Add graph-native tools:
  - `get_related_entities`
  - `explain_relationship_path`

#### What this will improve to the user
- The chat will be able to answer "how are these connected?" instead of only "what is similar?"
- Recommendations will become more explainable.
- Relationship-driven discovery will improve for users doing market mapping, publisher research, or competitor analysis.

#### User-facing examples
- Current:
  - User: "How is this studio connected to the games I’m tracking?"
  - Risk: the system can only answer loosely from embeddings or prose.
- Improved:
  - Result: the chat can say "You pinned Game A. It shares a publisher with Game B, and that publisher released two titles in the same genre cluster."
- Current:
  - User: "Find games adjacent to Slay the Spire through shared dev or publisher ecosystems."
  - Risk: current tools can find similar games but not explicit relationship paths.
- Improved:
  - Result: the chat can traverse `game -> developer -> other games` and `game -> publisher -> portfolio -> related tags`.
- Current:
  - User: "Explain how these two publishers are related."
  - Risk: the answer may be vague or generic.
- Improved:
  - Result: the chat can list shared developers, overlapping genre clusters, related franchises, or other path-based evidence.

#### Pros
- Adds genuinely new capability that Qdrant and Cube do not cover well
- Improves explainability
- Enables better personalized discovery

#### Cons
- Highest modeling complexity
- Easy to overbuild if it gets used for simple analytics queries

#### Difficulty
- High

### 4. Personalization Layer
#### What it adds
- Relevance boosting from pins, alerts, recent entities, and recent chat history
- Better "what should I watch?" behavior
- Better "related to my portfolio" behavior

#### Implementation
- Add `user_recent_entities` and `user_chat_preferences`.
- Use pins, recent alerts, recent navigation, and thread history as ranking signals.
- Support a `neutral research mode` that disables personalization.

#### What this will improve to the user
- The chat will feel like a product assistant instead of a generic analytics interface.
- Users will get better suggestions based on what they already care about.
- Monitoring and discovery workflows will become faster and more relevant.

#### User-facing examples
- Current:
  - User: "What should I keep an eye on this week?"
  - Risk: the answer is generic and not tied to tracked entities.
- Improved:
  - Result: the chat prioritizes pinned publishers, recently alerted games, and related breakout titles.
- Current:
  - User: "Anything similar to my watchlist?"
  - Risk: there is no first-class watchlist-aware retrieval inside chat.
- Improved:
  - Result: the chat uses pins and recent alerts as ranking context.
- Current:
  - User: "Show me competitors to the publishers I track."
  - Risk: the chat starts from scratch.
- Improved:
  - Result: the chat starts from the user’s actual pinned companies and expands from there.

#### Pros
- High product leverage from existing user data
- Makes chat feel like part of the product rather than a bolt-on

#### Cons
- Risk of over-biasing toward familiar entities
- Requires transparent UX and clear controls

#### Difficulty
- Medium

### 5. Query Planner + Grounding
#### What it adds
- Fewer wasted tool loops
- Better decomposition of hard prompts
- Clearer answers with provenance

#### Implementation
- Add `plan_query` for complex prompts only.
- Planner emits structured steps, tool budget, and whether graph or personalization is needed.
- Attach citations and retrieval reasons to final answers.
- Show relationship paths and retrieval justifications in Query Details.

#### What this will improve to the user
- Answers will feel more structured and less likely to wander.
- Hard questions will be broken down more intelligently.
- Users will be able to see why the answer was produced.

#### User-facing examples
- Current:
  - User: "Find breakout roguelikes from 2025, compare their publishers, and tell me which ones look most promising for Steam Deck."
  - Risk: the chat may burn multiple tool loops inefficiently.
- Improved:
  - Result: the planner splits the task into discovery, publisher comparison, and Steam Deck filtering before answer assembly.
- Current:
  - User: "Why did you recommend these?"
  - Risk: the answer may be vague.
- Improved:
  - Result: the chat can cite retrieval reasons, graph paths, and tool outputs.
- Current:
  - User: "What data are you basing this on?"
  - Risk: provenance is implicit.
- Improved:
  - Result: the chat surfaces query origin, metric source, and relationship evidence.

#### Pros
- Improves reliability and debugging
- Reduces 3-5 iteration tool churn

#### Cons
- Can slow simple queries if overused
- Requires careful gating

#### Difficulty
- Medium to High

### 6. Evals + Debugging
#### What it adds
- Safe rollout
- Measurable quality improvement
- Better operator visibility

#### Implementation
- Create eval sets from `chat_query_logs`.
- Add admin views for retrieval runs, graph paths, thread state, and planner decisions.
- Track hit rate, MRR/NDCG, iterations, latency, and user usefulness ratings.

#### What this will improve to the user
- Fewer silent regressions
- More stable quality over time
- Faster improvement cycle when chat makes mistakes

#### User-facing examples
- Current:
  - A retrieval change might quietly make exact-name prompts worse.
- Improved:
  - Eval runs catch the regression before rollout.
- Current:
  - Users may see inconsistent behavior across similar prompts.
- Improved:
  - Debug and evaluation systems make it easier to tune the product toward consistency.

#### Pros
- Necessary for safe iteration
- Makes future improvement much easier

#### Cons
- Not user-visible by itself
- Requires disciplined labeling and maintenance

#### Difficulty
- Medium

## Delivery Plan
| Phase | Outcome | Difficulty | Estimated Time |
|---|---|---:|---:|
| 0 | Instrumentation, threads, eval scaffolding | Medium | 3-5 days |
| 1 | Durable thread memory and context resolver | Medium | 1-2 weeks |
| 2 | Hybrid retrieval and reranking | Medium | 1-2 weeks |
| 3 | Knowledge graph read model and graph tools | High | 2-3 weeks |
| 4 | Personalization in chat | Medium | 1 week |
| 5 | Planner, grounding, answer assembly | Medium-High | 1-2 weeks |
| 6 | Evals, admin debug views, canary rollout | Medium | 1 week |

### Phase 0
- Add first-class thread IDs and persistence scaffolding.
- Extend logging for retrieval, planning, memory, and personalization decisions.
- Add evaluation tables and initial seed cases.

### Phase 1
- Build thread memory, entity resolution, summary generation, and Redis hot-state cache.

### Phase 2
- Build hybrid retrieval and reranking service.
- Integrate candidate fusion into chat flows.

### Phase 3
- Build graph read model from current relational truth.
- Add graph tools and relationship explanation paths.

### Phase 4
- Add personalization ranking and neutral mode.
- Expose whether personalization was used.

### Phase 5
- Add planner for complex prompts only.
- Add citations, retrieval reasons, and relationship grounding.

### Phase 6
- Add offline eval harness, admin debugging views, canary rollout, and regression monitoring.

## Public APIs, Interfaces, and Types
### API Changes
- Extend `POST /api/chat/stream` request shape to include:
  - `threadId?: string`
  - `contextMode?: 'thread' | 'stateless'`
  - `usePersonalization?: boolean`
  - `debugRetrieval?: boolean`

### New Endpoints
- `POST /api/chat/threads`
- `GET /api/chat/threads`
- `GET /api/chat/threads/[id]`
- `POST /api/chat/threads/[id]/messages`
- `POST /api/chat/evals/run`

### New Tool Contracts
- `retrieve_candidates`
- `get_related_entities`
- `explain_relationship_path`
- `get_personalized_candidates`
- `plan_query`

### New or Extended Types
- `ChatThread`
- `ChatThreadState`
- `ResolvedEntity`
- `ActiveConstraint`
- `RetrievalCandidate`
- `Citation`
- `GraphEdge`
- `GraphPath`
- `PlannerOutput`
- `PersonalizationProfile`

## Data Model Additions
### New Durable Tables
- `chat_threads`
- `chat_messages`
- `chat_thread_entities`
- `chat_retrieval_runs`
- `chat_citations`
- `user_recent_entities`
- `user_chat_preferences`
- `chat_eval_cases`
- `chat_eval_runs`

### New Graph Read-Model Tables or Materialized Views
- `graph_nodes`
- `graph_edges`
- `graph_edge_features`

### Refresh Model
- Ingestion-triggered rebuild for changed entities
- Nightly full refresh for consistency
- Incremental invalidation when publishers, developers, tags, or franchises change

## Cost Overview
Pricing references below were checked on March 13, 2026 from official vendor pages and should be re-verified before procurement.

| Component | Lean | Recommended | Notes |
|---|---:|---:|---|
| Thread persistence | ~$0 incremental | ~$0 incremental | Uses existing Postgres |
| Redis cache | $0 to low | $10+/month | Upstash fixed plans start at $10/month; pay-as-you-go is also available |
| Reranker | $0 if deferred or self-hosted | Usage-based | Cohere Rerank 3.5 is listed at $2 per 1K searches |
| Graph DB | $0 | $0 initially | Use Postgres graph read model first |
| Neo4j Aura later | n/a | $65.70+/month | AuraDB Professional starts at 1GB |
| Qdrant | Existing | Existing | No new spend if current cluster has headroom |

### Cost Recommendation
- Start with Postgres + Redis + hosted reranker.
- Delay Neo4j until graph queries prove valuable and frequent.
- Keep the first version cost-light by using a graph read model instead of a dedicated graph database.

## Pros, Cons, and Difficulty Summary
| Capability | Product Upside | Main Risk | Difficulty |
|---|---|---|---:|
| Thread memory | Biggest perceived quality upgrade for follow-ups | Wrong summaries can pollute context | Medium |
| Hybrid retrieval | Best relevance gain for search and discovery | Ranking complexity | Medium |
| Knowledge graph | Strongest explainability and multi-hop gain | Highest modeling complexity | High |
| Personalization | Makes chat feel product-native | Bias toward known entities | Medium |
| Planner | Reduces tool thrash on hard prompts | Overplanning simple prompts | Medium-High |
| Evals and debugging | Safer rollout and faster iteration | More operational work | Medium |

## Coding LLM Implementation Guidance
This plan is intended to be executable by a coding LLM or engineer with minimal ambiguity.

Recommended implementation pattern:

- Keep every subsystem behind a small typed interface.
- Isolate planner, retriever, graph provider, personalization provider, and answer assembler in separate service modules.
- Ship every major subsystem behind a feature flag.
- Add eval coverage before broad rollout.
- Preserve backward compatibility with current tools during migration.

Recommended module boundaries:

- `thread-state service`
- `context resolver`
- `retrieval service`
- `reranking service`
- `graph provider`
- `personalization provider`
- `planner`
- `answer assembler`
- `eval runner`

## Acceptance Criteria
- Follow-up queries correctly reuse entity and filter context.
- Exact-name queries return the intended entity in top results.
- Relationship questions return explicit paths, not only fuzzy similarity.
- Personalized mode changes ranking; neutral mode does not.
- Simple queries remain fast and use a fast path.
- Complex queries use fewer high-iteration tool loops.
- Metric-bearing answers include provenance.

## Risks
- Memory pollution from bad summaries
- Ranking complexity causing hard-to-debug retrieval failures
- Overuse of graph traversal for simple questions
- Personalization bias reducing discovery diversity
- Planner overhead on simple prompts

## Default Build Recommendation
Build in this order:

1. Memory
2. Hybrid retrieval
3. Graph read model
4. Personalization
5. Planner and grounding
6. Evals and rollout

This is the best balance of product value, implementation difficulty, and cost.

## References
- Current chat architecture: [chat-data-system.md](/Users/ryanbohmann/Desktop/publisheriq/docs/developer-guide/architecture/chat-data-system.md)
- Current chat review: [chat-page-review.md](/Users/ryanbohmann/Desktop/publisheriq/docs/chat-page-review.md)
- Personalization design: [personalization.md](/Users/ryanbohmann/Desktop/publisheriq/docs/developer-guide/features/personalization.md)
- Qdrant hybrid queries: https://qdrant.tech/documentation/concepts/hybrid-queries/
- Qdrant rerankers: https://qdrant.tech/documentation/fastembed/fastembed-rerankers/
- Upstash pricing: https://upstash.com/docs/redis/overall/pricing
- Neo4j pricing: https://neo4j.com/pricing/
- Cohere pricing: https://cohere.com/de/pricing
