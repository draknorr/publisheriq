# Chat Quality Workflow

## Goal

Improve chat quality without paying for hundreds of queries every iteration and without trusting the latest run blindly.

The loop is:

1. make a targeted chat change
2. run the smallest relevant pack
3. manually score the results from the assigned persona viewpoint
4. compare against the blessed baseline
5. only escalate to larger packs when risk or regressions justify it

If you are resuming after interruption, start with:

```bash
pnpm chat-evals:resume
```

That wizard reads and updates `docs/chat-evals/status.md`, which is the canonical checklist and resume document.

## Tiered Run Model

### Tier 0: Manual Smoke

Use `apps/admin/src/app/(main)/admin/chat-smoke/page.tsx` for `1-3` manual prompts while shaping the fix.

- no ledger update
- no baseline gate
- cheapest possible loop

### Tier 1: Mini Pack

Run `mini.company`, `mini.similarity`, or `mini.trend`.

- default development loop
- `5` prompts
- catches obvious routing or answer-shape regressions early
- not a ship gate by itself

### Tier 2: Golden Pack

Run `golden.company`, `golden.similarity`, or `golden.trend`.

- required before merge or deploy for changes in that area
- `6` prompts or fewer
- this is the normal regression gate

### Tier 3: Full Touched Section

Run the full section pack only when:

- the change touches shared prompt synthesis
- the change affects tool routing across multiple families
- the mini or golden pack regressed and you need broader visibility
- the change is broad enough that the touched surface is no longer obvious

### Tier 4: Full Active Suite

Run full sections `1-5` only for:

- release candidates
- scheduled quality passes
- broad chat refactors

Do not run section `6` by default in this loop.

## Area Mapping

Use this mapping unless the change clearly spans more than one area.

- `company`
  - game lookup and filtered discovery answers in sections `1-2`
  - publisher/developer/company answers
  - entity lookup, role disambiguation, portfolio answers, company similarity
- `similarity`
  - sections `3-4`
  - comp-finding, semantic retrieval, taste-based discovery, franchise logic
- `trend`
  - section `5`
  - time-relative, trend, breakout, momentum, sentiment, `screen_games` routing

If a change touches shared answer synthesis or generic tool-choice logic, skip straight to `section` or full active `1-5`.

## Baseline Policy

Two baselines exist conceptually:

- `latest`
  - the newest scored run that covers the same prompts
  - useful for context
- `blessed`
  - the approved comparison target for ship decisions
  - configured in `scripts/chat-evals/blessed-baselines.json`

Use `blessed` for normal regression gates.

## Current Regression Budgets

- any golden prompt below `7.0` is a violation
- any prompt drop greater than `0.5` vs baseline is a violation
- average score drop greater than `0.3` vs baseline is a violation
- weak/failure count increase greater than `0` is a violation

Mini packs surface the same comparison data, but they are warning-oriented rather than release-blocking.

## Manual Scoring Rule

The tooling does not auto-judge answer quality.

You still score from the prompt’s primary persona using:

- Directness
- Completeness
- Relevance
- Trustworthiness
- Decision value / usefulness
- Grace under ambiguity

The comparison files are only meaningful after that curation is filled in.

If you already ran the prompts and only want to rebuild the comparison after scoring, use:

```bash
node scripts/chat-evals/run-cycle.mjs --compare-only --pack <packKey> --run-dir <run-dir> --baseline blessed
```

## Promotion Rule

Promote a run to a new blessed baseline only when:

- the touched golden pack stays inside budget
- the change is genuinely better, not just differently formatted
- no adjacent answers obviously lost trustworthiness
- you have manually reviewed the results and want that run to become the new reference point
