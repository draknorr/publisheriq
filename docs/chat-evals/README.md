# Chat Quality Lab

This is the durable home for chat quality work inside PublisherIQ.

It packages the existing eval runners, ledgers, and prompt critique docs into a repeatable workflow that is cheap enough to use during normal development and strict enough to catch regressions before you ship.

## What This Covers

- Active blocking scope: sections `1-5` from `docs/chat-output-user-critique.md`
- Non-blocking for now: section `6`
- Source-of-truth prompts: `scripts/chat-evals/packs/`
- Execution entrypoint: `node scripts/chat-evals/run-cycle.mjs`
- Resume wizard: `pnpm chat-evals:resume`
- Resume/checklist doc: `docs/chat-evals/status.md`
- Historical ledgers:
  - `docs/chat-prompt-evals.md`
  - `docs/chat-prompt-evals-round-2.md`

## Default Workflow

Use the cheapest loop that matches the risk of the change.

1. `pnpm chat-evals:resume` to pick or resume one lead prompt
2. `mini` pack while developing
3. `golden` pack before merge or deploy
4. full touched `section` pack only when the change is broad or risky
5. full active `1-5` cycle only on release candidates or scheduled quality passes

Do not default to the full suite for normal chat iteration.

## Quick Start

Start here if you are resuming or do not want to remember the instructions:

```bash
pnpm chat-evals:resume
```

Company and lookup work:

```bash
node scripts/chat-evals/run-cycle.mjs --mode mini --area company
```

Similarity and concept work:

```bash
node scripts/chat-evals/run-cycle.mjs --mode mini --area similarity
```

Trend and momentum work:

```bash
node scripts/chat-evals/run-cycle.mjs --mode mini --area trend
```

Golden gate before shipping a company-related change:

```bash
node scripts/chat-evals/run-cycle.mjs --mode golden --area company --baseline blessed
```

Full active sections `1-5` verification:

```bash
node scripts/chat-evals/run-cycle.mjs --mode full --sections 1-5 --baseline blessed
```

Run against local Next instead of production:

```bash
node scripts/chat-evals/run-cycle.mjs --mode mini --area similarity --origin local
```

## Output Shape

Every pack run writes artifacts under `/tmp/publisheriq-chat-evals/`:

- `include-prompts.txt`
- `results.json`
- `report.md`
- `ledger-run-draft.md`
- `curation-template.json`
- `run-summary.json`
- `baseline-comparison.json`
- `baseline-comparison.md`

Cycle runs also write:

- `cycle-summary.json`
- `cycle-summary.md`

The resume wizard keeps [status.md](/Users/ryanbohmann/Desktop/publisheriq/docs/chat-evals/status.md) updated with:

- the current lead prompt
- the current checklist state
- the latest run and comparison paths
- the next command
- the next Codex prompt

## Cost Rules

- Start with `mini`
- Only run `golden` on the touched area
- Only run full `section` packs when shared routing, answer synthesis, or broad tool behavior changed
- Only run full `1-5` when you are validating a release candidate or doing a dedicated quality pass
- Keep section `6` out of the default ship gate until that workstream is active

## Where To Read Next

- `docs/chat-evals/workflow.md`
- `docs/chat-evals/packs.md`
- `docs/chat-evals/codex-prompts.md`
- `docs/chat-evals/status.md`
- `docs/chat-prompt-evals-runbook.md`
