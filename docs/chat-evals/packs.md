# Chat Eval Packs

## Active Packs

| Pack | Type | Area | Prompts | Purpose | Manifest |
|---|---|---|---:|---|---|
| `mini.company` | `mini` | `company` | 5 | cheapest dev loop for sections `1-2` | `scripts/chat-evals/packs/mini/company.json` |
| `golden.company` | `golden` | `company` | 6 | normal ship gate for sections `1-2` | `scripts/chat-evals/packs/golden/company.json` |
| `full.sections-1-2` | `full` | `company` | 23 | full lookup and company regression pass | `scripts/chat-evals/packs/full/sections-1-2.json` |
| `mini.similarity` | `mini` | `similarity` | 5 | cheapest dev loop for sections `3-4` | `scripts/chat-evals/packs/mini/similarity.json` |
| `golden.similarity` | `golden` | `similarity` | 6 | normal ship gate for sections `3-4` | `scripts/chat-evals/packs/golden/similarity.json` |
| `full.sections-3-4` | `full` | `similarity` | 13 | full similarity and concept pass | `scripts/chat-evals/packs/full/sections-3-4.json` |
| `mini.trend` | `mini` | `trend` | 5 | cheapest dev loop for section `5` | `scripts/chat-evals/packs/mini/trend.json` |
| `golden.trend` | `golden` | `trend` | 6 | normal ship gate for section `5` | `scripts/chat-evals/packs/golden/trend.json` |
| `full.section-5` | `full` | `trend` | 16 | full trend and time-relative pass | `scripts/chat-evals/packs/full/section-5.json` |

## Non-Blocking Pack

| Pack | Type | Area | Prompts | Purpose | Manifest |
|---|---|---|---:|---|---|
| `full.section-6` | `full` | `change` | 20 | reference-only until section `6` becomes active work | `scripts/chat-evals/packs/full/section-6.json` |

## Golden Prompt Coverage

### Company

- `tell me about Hades II`
- `Highly rated games under $10 released in the past year`
- `Which indie developers have multiple hit games?`
- `Show me all games by FromSoftware`
- `What publishers are similar to Devolver Digital?`
- `Publishers with releases in every year since 2020`

### Similarity

- `Steam Deck games like Hades II`
- `Games similar to Hollow Knight with better reviews`
- `Show me developers similar to Supergiant Games`
- `Find games in the same series as Dark Souls`
- `horror games with investigation elements`
- `Relaxing puzzle games with beautiful art`

### Trend

- `Compare top 5 roguelites by review velocity and CCU`
- `What free-to-play games have the most players right now?`
- `What horror games are gaining momentum?`
- `What’s breaking out right now?`
- `Which games have the most reviews added this week?`
- `Show me games with improving sentiment`

## Notes

- Existing wrapper scripts still work and now load from these manifests.
- The manifests are the source of truth for prompt inventory.
- `full` section packs are intentionally larger and slower. Use them only when the change justifies the cost.
