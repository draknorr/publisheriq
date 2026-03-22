# Chat Prompt Evals Runbook

This is the low-level runner reference.

For the durable sub-project and the default targeted workflow, start with:

- `docs/chat-evals/README.md`
- `docs/chat-evals/workflow.md`
- `docs/chat-evals/packs.md`
- `docs/chat-evals/codex-prompts.md`

This runbook covers the critique-suite workflows for the prompts called out in:

- `docs/chat-output-user-critique.md` section `1. Game Lookups and Filtered Discovery`
- `docs/chat-output-user-critique.md` section `2. Publisher, Developer, and Company Answers`
- `docs/chat-output-user-critique.md` section `3. Similarity and Comp-Finding Answers`
- `docs/chat-output-user-critique.md` section `4. Concept and Taste-Based Discovery`
- `docs/chat-output-user-critique.md` section `5. Trending and Time-Relative Answers`
- `docs/chat-output-user-critique.md` section `6. Change Intelligence and Strategic / Prospecting Answers`

## What This Runner Does

Use one of the checked-in wrappers when you want a fresh live run against the production chat endpoint without rebuilding the prompt list by hand.

If you want the cheaper default workflow with baseline comparison, use:

```bash
node scripts/chat-evals/run-cycle.mjs --mode mini --area company
```

The cycle runner is the normal entrypoint for repeated chat-quality work. The wrappers remain useful when you want a single known section pack directly.

### Available Wrappers

| Scope | Script | Prompt Count |
|---|---|---:|
| Sections `1` and `2` | `scripts/chat-evals/run-critique-sections-1-2.mjs` | 23 |
| Sections `3` and `4` | `scripts/chat-evals/run-critique-sections-3-4.mjs` | 13 |
| Section `5` | `scripts/chat-evals/run-critique-section-5.mjs` | 16 |
| Section `6` | `scripts/chat-evals/run-critique-section-6.mjs` | 20 |

Each wrapper:

- loads the exact checked-in pack manifest for its scope from `scripts/chat-evals/packs/`
- runs that prompt set against `POST /api/chat/stream`
- reuses `scripts/chat-evals/run.mjs` for auth, transport, retries, SSE parsing, and raw capture
- writes a timestamped artifact folder under `/tmp/publisheriq-chat-evals/`
- generates a draft markdown run entry and a curation template so you can score the answers from the persona viewpoint
- checkpoints a first-prompt calibration failure as a scored error row instead of aborting the whole batch

It does not try to auto-judge user quality. The raw results are machine-captured; the persona scoring in `docs/chat-prompt-evals.md` is curated after the run.

## Prerequisites

- Root `.env` must contain:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `BYPASS_AUTH_EMAIL`
- Network access to `https://www.publisheriq.app`
- Node `>=20`

## Run A Fresh Live Suite

### Targeted Cycle Runner

Use this for the normal cheap loop:

```bash
node scripts/chat-evals/run-cycle.mjs --mode mini --area company
```

```bash
node scripts/chat-evals/run-cycle.mjs --mode golden --area similarity --baseline blessed
```

```bash
node scripts/chat-evals/run-cycle.mjs --mode full --sections 1-5 --baseline blessed
```

`run-cycle.mjs` writes the usual run artifacts plus:

- `baseline-comparison.json`
- `baseline-comparison.md`
- `cycle-summary.json`
- `cycle-summary.md`

It does not auto-score the answers. Manual persona curation is still required.

### Direct Wrapper Runs

From the repo root:

```bash
node scripts/chat-evals/run-critique-sections-1-2.mjs
```

Or for sections `3` and `4`:

```bash
node scripts/chat-evals/run-critique-sections-3-4.mjs
```

Or for section `5`:

```bash
node scripts/chat-evals/run-critique-section-5.mjs
```

Or for section `6`:

```bash
node scripts/chat-evals/run-critique-section-6.mjs
```

Optional overrides:

```bash
CHAT_EVAL_ORIGIN=https://www.publisheriq.app \
CHAT_EVAL_CONCURRENCY=1 \
CHAT_EVAL_DELAY_MS=3000 \
node scripts/chat-evals/run-critique-sections-1-2.mjs --out-dir /tmp/publisheriq-chat-evals/manual-run
```

```bash
CHAT_EVAL_ORIGIN=https://www.publisheriq.app \
CHAT_EVAL_CONCURRENCY=1 \
CHAT_EVAL_DELAY_MS=3000 \
node scripts/chat-evals/run-critique-sections-3-4.mjs --out-dir /tmp/publisheriq-chat-evals/manual-run-3-4
```

```bash
CHAT_EVAL_ORIGIN=https://www.publisheriq.app \
CHAT_EVAL_CONCURRENCY=1 \
CHAT_EVAL_DELAY_MS=3000 \
node scripts/chat-evals/run-critique-section-5.mjs --out-dir /tmp/publisheriq-chat-evals/manual-run-5
```

```bash
CHAT_EVAL_ORIGIN=https://www.publisheriq.app \
CHAT_EVAL_CONCURRENCY=1 \
CHAT_EVAL_DELAY_MS=3000 \
node scripts/chat-evals/run-critique-section-6.mjs --out-dir /tmp/publisheriq-chat-evals/manual-run-6
```

The wrapper prints the artifact paths when it finishes.

## Rebuild Draft Artifacts From An Existing Run

If the raw run already exists and you only want the draft markdown plus curation template again:

```bash
node scripts/chat-evals/run-critique-sections-1-2.mjs \
  --from-results /tmp/publisheriq-chat-evals/critique-sections-1-2-<timestamp>
```

```bash
node scripts/chat-evals/run-critique-sections-3-4.mjs \
  --from-results /tmp/publisheriq-chat-evals/critique-sections-3-4-<timestamp>
```

```bash
node scripts/chat-evals/run-critique-section-5.mjs \
  --from-results /tmp/publisheriq-chat-evals/critique-section-5-<timestamp>
```

```bash
node scripts/chat-evals/run-critique-section-6.mjs \
  --from-results /tmp/publisheriq-chat-evals/critique-section-6-<timestamp>
```

## Re-Test Only The Prompts You Changed

Use the generic runner when you want a targeted verification pass instead of a full wrapper suite.

1. Create a temporary include file in the same `critiqueId | prompt` format:

```text
89 | Which indie developers have multiple hit games?
140 | Publishers with 5+ games averaging 85%+ reviews in the past 3 years
141 | Highly rated games under $10 released in the past year
152 | What tags exist for colony sim games?
170 | What publishers are similar to Devolver Digital?
```

2. Run the subset against the target environment:

```bash
env \
  CHAT_EVAL_ORIGIN=https://www.publisheriq.app \
  CHAT_EVAL_INCLUDE_PROMPTS_FILE=/tmp/publisheriq-chat-evals/fix-under-5/include-prompts.txt \
  CHAT_EVAL_OUT_DIR=/tmp/publisheriq-chat-evals/fix-under-5/run \
  CHAT_EVAL_DOC_PATH=/tmp/publisheriq-chat-evals/fix-under-5/report.md \
  CHAT_EVAL_CONCURRENCY=1 \
  CHAT_EVAL_DELAY_MS=3000 \
  node scripts/chat-evals/run.mjs
```

3. For app-code verification before deploy, point the runner at local Next instead:

```bash
pnpm --filter @publisheriq/admin dev
```

Then in a second shell:

```bash
env \
  CHAT_EVAL_ORIGIN=http://localhost:3001 \
  CHAT_EVAL_INCLUDE_PROMPTS_FILE=/tmp/publisheriq-chat-evals/fix-under-5/include-prompts.txt \
  CHAT_EVAL_OUT_DIR=/tmp/publisheriq-chat-evals/fix-under-5/local-run \
  CHAT_EVAL_DOC_PATH=/tmp/publisheriq-chat-evals/fix-under-5/local-report.md \
  CHAT_EVAL_CONCURRENCY=1 \
  CHAT_EVAL_DELAY_MS=1000 \
  node scripts/chat-evals/run.mjs
```

4. If you only want the first prompt in the include file, add:

```bash
CHAT_EVAL_MAX_PROMPTS=1
```

## What Gets Written

Each run folder contains:

- `include-prompts.txt`: the exact prompts sent to the generic runner
- `manifest.json`: the generic runner manifest
- `results.json`: full structured results, tool calls, timings, and raw assistant text
- `report.md`: the generic runner's raw markdown report
- `ledger-run-draft.md`: scope-specific draft with persona metadata and placeholder curation fields
- `curation-template.json`: blank score/rationale template for manual evaluation
- `run-summary.json`: condensed metadata and timings for quick inspection

The section `5` wrapper also includes stable `suiteKey` values plus `usefulnessVerdict` and `usefulnessSummary` placeholders so later reruns remain comparable even when the original critique numbering is only partially recoverable.
The section `6` wrapper follows the same hybrid `critiqueId` / `suiteKey` pattern because several change-intel prompts are only recoverable from earlier run artifacts rather than exact checked-in critique numbering.

## Updating The Ledgers

Use this process after a fresh run:

1. Run the wrapper and note the artifact folder.
2. Review `ledger-run-draft.md` and `results.json`.
3. Score each prompt from the assigned primary persona's standpoint using the critique rubric:
   - `Directness`
   - `Completeness`
   - `Relevance`
   - `Trustworthiness`
   - `Decision value / usefulness`
   - `Grace under ambiguity`
4. Append a new run section to the appropriate ledger and update the run index at the top.
5. Keep the full assistant output and tool calls for each prompt so later runs can be compared directly.

Use `docs/chat-prompt-evals.md` for the historical round-1 ledger.
Use `docs/chat-prompt-evals-round-2.md` for the current full second-round live ledger.
Use local targeted reruns as implementation verification and only promote them into the live ledger after the corresponding deployment is live.

For the current round-2 helper workflow:

- `node scripts/chat-evals/fill-round-2-curation.mjs` fills the checked-out round-2 curation templates with the current manual scoring set
- `node scripts/chat-evals/build-round-2-ledger.mjs` regenerates `docs/chat-prompt-evals-round-2.md` plus per-batch `scored-run.md` files from the run artifacts

## Current Suite Inventory

The checked-in wrappers now load these prompt manifests:

- `scripts/chat-evals/packs/full/sections-1-2.json`
- `scripts/chat-evals/packs/full/sections-3-4.json`
- `scripts/chat-evals/packs/full/section-5.json`
- `scripts/chat-evals/packs/full/section-6.json`

The targeted cheap loops live in:

- `scripts/chat-evals/packs/mini/company.json`
- `scripts/chat-evals/packs/mini/similarity.json`
- `scripts/chat-evals/packs/mini/trend.json`
- `scripts/chat-evals/packs/golden/company.json`
- `scripts/chat-evals/packs/golden/similarity.json`
- `scripts/chat-evals/packs/golden/trend.json`

The full section manifests contain these critique prompts:

- Section 1: `2`, `10`, `21`, `138`, `141`, `219`, `242`
- Section 2: `89`, `97`, `127`, `130`, `140`, `151`, `152`, `155`, `156`, `157`, `161`, `170`, `171`, `175`, `178`, `179`
- Section 3: `51`, `49`, `132`, `134`, `170`, `171`, `190`
- Section 4: `18`, `195`, `19`, `186`, `42`, `229`

Section `5` uses a recovered 16-prompt suite keyed primarily by prompt text and stable `suiteKey` values:

- `Compare top 5 roguelites by review velocity and CCU`
- `What free-to-play games have the most players right now?`
- `What games are trending up in reviews right now?`
- `what games are trending right now?`
- `What horror games are gaining momentum?`
- `What’s breaking out right now?`
- `Show me breaking out games right now`
- `Breaking out indie games this month`
- `Breaking out indie games right now`
- `Games breaking out with overwhelmingly positive reviews`
- `Which games have accelerating review velocity?`
- `Most active games by reviews`
- `Which games have the most reviews added this week?`
- `Show me games with improving sentiment`
- `Games with improving sentiment in the past 30 days`
- `Which popular games are getting worse reviews lately?`

Section `6` uses a hybrid 20-prompt suite:

- exact critique prompts where the wording is explicit in `docs/chat-output-user-critique.md`
- stable `suiteKey` refs for the remaining change-intel prompts recovered from prior live artifacts

If the critique doc changes, update the relevant pack manifest in `scripts/chat-evals/packs/` rather than editing the wrapper script.

## Current Quality Guardrails

When you re-run the weak prompts, judge them against these product decisions:

- `indie` company screens:
  - treat `indie` as a heuristic, not a legal ownership claim
  - prefer mostly self-published studios with small catalogs
  - use a small-catalog cap around `10` games
  - use the Steam `Indie` tag only as supporting weight or a tie-breaker
- company trailing release windows:
  - recent company release-window screens only support the trailing past year today
  - if a prompt asks for `past 2 years`, `past 3 years`, etc., the answer should say that limitation directly instead of bluffing a broader screen
- broad filtered discovery with quality language:
  - start at `>=1000` reviews
  - relax once to `>=100` reviews if needed
  - do not drop below `100` reviews just to fill the table
  - when the relaxed floor is used, say so briefly
- tag-discovery answers:
  - answer with the canonical tag first
  - add adjacent tags the user would likely explore next
- company similarity:
  - one peer is not a complete peer set
  - if semantic peers are sparse, prefer a labeled heuristic portfolio fallback
  - if the final peer set is still sparse, say it is limited instead of padding with weak matches
- game similarity:
  - hard constraints like `better reviews`, `under 10K reviews`, and `Steam Deck` must be visibly obeyed
  - add a short per-row fit reason when the answer claims similarity
  - avoid lexical contamination from title words like `Hades`, `Hollow`, or `Souls`
- franchise / same-series answers:
  - stay inside the franchise first
  - if adjacent `Souls-like` or neighbor titles are added, split them into a clearly labeled secondary section
  - never blur `same series` into `similar to` without saying so
- concept and taste discovery:
  - treat prompts like `beautiful art`, `tactical deck building`, and `investigation horror` as concept interpretation tasks, not keyword matching
  - prefer quality floors and representative titles over filling the table with low-signal lexical matches
  - if the semantic set is weak, say that directly instead of padding with `Deck`, `Rogue`, `Pixel`, or `Investigation` title collisions
- trending and time-relative answers:
  - anchor `right now`, `this week`, and other relative windows to exact dates or timestamps in the answer
  - label the metric actually shown instead of blurring `CCU`, `owners`, `review count`, `review velocity`, `momentum`, or `sentiment delta`
  - explain why a title is trending, accelerating, breaking out, or declining instead of reusing a generic answer shape
  - keep hard filters like `free-to-play`, `horror`, and `indie` visibly intact
- change-intelligence and prospecting answers:
  - say what changed, when it changed, and what the old versus new state was whenever the prompt implies before/after evidence
  - keep the exact window intact; do not answer a `90 days` question with `30 days` evidence
  - for single-game change answers, avoid repeated generic rows like `Additional structured change detected`
  - for high-inference pattern prompts, show explicit evidence for why a title qualifies instead of only giving a label
  - when nothing fully qualifies, provide near-misses or explain what was checked instead of stopping at `no results`
  - prospecting rankings must include ordering logic and evidence quality, not only a flat list or a dead-end failure

## Deployment Notes

- Changes in `apps/admin/src/lib/chat/**` affect the app layer immediately in local Next, but not production until the admin app is deployed.
- Changes in `packages/cube/model/ChatCatalog.js` affect company-screen query availability only after the Cube service is deployed.
- If a local targeted rerun still shows old company-screen behavior on production-backed data, check whether the app deploy, Cube deploy, or both are still pending before re-scoring the live ledger.
