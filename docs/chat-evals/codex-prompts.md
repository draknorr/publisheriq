# Codex Restart Prompts

Use these prompts to start another quality cycle without rebuilding the workflow from scratch.

## 0. Resume The Loop

Start with:

```bash
pnpm chat-evals:resume
```

That wizard updates `docs/chat-evals/status.md` and prints the exact next Codex prompt for the current phase.

## 1. Start A Cheap Targeted Cycle

```md
Use `docs/chat-evals/README.md`, `docs/chat-evals/workflow.md`, `docs/chat-evals/packs.md`, and `docs/chat-evals/status.md` as the operating context for chat quality work.

Inspect the recent git diff and touched files under `apps/admin/src/lib/chat`, `apps/admin/src/lib/llm`, `apps/admin/src/lib/search`, and `packages/cube/model` if relevant.

Map the change to one active area among `company`, `similarity`, or `trend`.

Run the smallest relevant pack with:
`node scripts/chat-evals/run-cycle.mjs --mode mini --area <area> --baseline blessed`

Do not run section 6.
Do not escalate to a larger pack unless the change is broad or the mini pack shows instability.

Then:
1. summarize what regressed or improved
2. identify the most likely root cause
3. make the smallest next code change that improves the weak prompts without expanding scope
```

## 2. Run The Ship Gate For A Touched Area

```md
Use the Chat Quality Lab workflow in `docs/chat-evals/README.md` and the active cycle in `docs/chat-evals/status.md`.

This change is ready for a targeted release gate.

Run:
`node scripts/chat-evals/run-cycle.mjs --mode golden --area <company|similarity|trend> --baseline blessed`

Keep this targeted. Do not run the full 1-5 suite unless the change clearly touches shared routing or shared answer synthesis.
Do not run section 6.

After the run:
1. inspect `baseline-comparison.md`
2. score the curation template from the prompt personas
3. report whether the pack is pass, warn, or block
4. call out any prompt-level regressions larger than 0.5
```

## 3. Investigate A Regression Against Baseline

```md
Use the Chat Quality Lab docs, baseline files, and `docs/chat-evals/status.md` as the operating context.

I have a regression in the `<company|similarity|trend>` area.

1. inspect the latest `baseline-comparison.md` and `curation-template.json` for that pack
2. compare the weakest prompts to the blessed baseline in `scripts/chat-evals/blessed-baselines.json`
3. inspect the recent related git commits
4. identify the smallest likely code path causing the regression
5. propose the narrowest fix and the next validation command

Stay targeted. Do not run a full 1-5 cycle unless the evidence shows a shared-system regression.
```

## 4. Release Candidate Verification

```md
Use the Chat Quality Lab workflow and `docs/chat-evals/status.md`.

This is a release-candidate chat verification pass.

Run:
`node scripts/chat-evals/run-cycle.mjs --mode full --sections 1-5 --baseline blessed`

Exclude section 6 from blocking evaluation.

Then:
1. review the cycle summary
2. call out any packs that moved from pass to warn or block
3. identify the lowest-scoring prompts
4. tell me whether this release candidate is safer, flat, or riskier than the blessed baseline
```

## 5. Bless A New Baseline

```md
Use the Chat Quality Lab workflow, `docs/chat-evals/status.md`, and current ledgers.

I want to evaluate whether the latest scored run should replace the blessed baseline for `<company|similarity|trend>`.

1. compare the latest scored run to the current blessed baseline
2. focus on persona usefulness, not just formatting or tool success
3. tell me whether the new run is clearly better, flat, or worse
4. if it is clearly better, tell me exactly which `docPath` and `runId` should replace the current entry in `scripts/chat-evals/blessed-baselines.json`
```
