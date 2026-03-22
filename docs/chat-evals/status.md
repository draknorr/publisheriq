<!-- CHAT_EVAL_STATUS {"version":1,"updatedAt":"2026-03-21T22:57:51.367Z","activeCycle":{"id":"company-2026-03-21T22:42:01.871Z","area":"company","packKey":"full.sections-1-2","leadPrompt":"Publishers with releases in every year since 2020","critiqueRef":"#175","family":"company_ranking","primaryPersona":"Investor / Portfolio Analyst","phase":"local_mini_review","baseline":{"docPath":"docs/chat-prompt-evals-round-2.md","runId":"2026-03-21T20:48:09.907Z","critiqueRef":"#175","score":2.6,"verdict":"Failure","usefulnessSummary":"Iteration-limit failure after repeated empty analytics queries; no continuity screen was actually returned."},"sourceRun":{"docPath":"docs/chat-prompt-evals-round-2.md","runId":"2026-03-21T20:48:09.907Z"},"hypothesis":"PublisherYearMetrics queries regress when the model emits unprefixed members. prepareCompanyQuery does not canonicalize bare year-metric members like publisherId or releaseYear, so Cube rejects the query and the loop exhausts.","touchedFiles":["apps/admin/src/lib/chat/company-query-guardrails.ts"],"localRunDir":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company","goldenRunDir":null,"comparisonPath":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company/baseline-comparison.md","cycleSummaryPath":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/cycle-summary.md","curationTemplatePath":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company/curation-template.json","proposedCommitMessage":null,"notes":["2026-03-21T22:42:16.421Z: Cycle created from backlog.","2026-03-21T22:44:11Z: Research completed and code path identified. Raw SSE shows Cube 400 errors for unprefixed PublisherYearMetrics members."],"checklist":{"promptSelected":true,"baselineReviewed":true,"rawAnswerReviewed":true,"codePathIdentified":true,"localMiniCompleted":true,"localMiniPassed":false,"goldenRunCompleted":false,"goldenCurationCompleted":false,"compareOnlyCompleted":false,"acceptedForCommit":false,"committed":false},"startedAt":"2026-03-21T22:42:01.871Z","lastUpdatedAt":"2026-03-21T22:57:51.367Z"},"backlog":[{"area":"company","packKey":"full.sections-1-2","critiqueRef":"#175","critiqueId":175,"suiteKey":null,"prompt":"Publishers with releases in every year since 2020","family":"company_ranking","primaryPersona":"Investor / Portfolio Analyst","score":2.6,"verdict":"Failure","usefulnessSummary":"Iteration-limit failure after repeated empty analytics queries; no continuity screen was actually returned.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:48:09.907Z"},{"area":"company","packKey":"full.sections-1-2","critiqueRef":"#138","critiqueId":138,"suiteKey":null,"prompt":"Games currently on sale","family":"filtered_discovery","primaryPersona":"Publishing Strategy Lead","score":5,"verdict":"Weak","usefulnessSummary":"Still a massive on-sale leaderboard rather than a decision-ready shortlist.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:48:09.907Z"},{"area":"similarity","packKey":"full.sections-3-4","critiqueRef":"#132","critiqueId":132,"suiteKey":null,"prompt":"Games similar to Hollow Knight with better reviews","family":"game_similarity","primaryPersona":"Developer Studio Lead or Product Lead","score":5,"verdict":"Weak","usefulnessSummary":"The review constraint is fixed, but the actual comp set is still too broad to trust.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:51:12.336Z"},{"area":"company","packKey":"full.sections-1-2","critiqueRef":"#219","critiqueId":219,"suiteKey":null,"prompt":"Games under $5 with overwhelmingly positive reviews","family":"filtered_discovery","primaryPersona":"Publishing Strategy Lead","score":5.3,"verdict":"Weak","usefulnessSummary":"Transparent empty-set response, but it leaves the user with no fallback shortlist or supporting evidence.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:48:09.907Z"},{"area":"company","packKey":"full.sections-1-2","critiqueRef":"#170","critiqueId":170,"suiteKey":null,"prompt":"What publishers are similar to Devolver Digital?","family":"company_similarity","primaryPersona":"Publishing Strategy Lead","score":5.3,"verdict":"Weak","usefulnessSummary":"PLAYISM and Team17 help, but Square Enix and Xbox still make the peer set feel too scale-blind.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:48:09.907Z"},{"area":"similarity","packKey":"full.sections-3-4","critiqueRef":"#170","critiqueId":170,"suiteKey":null,"prompt":"What publishers are similar to Devolver Digital?","family":"publisher_similarity","primaryPersona":"Publishing Strategy Lead","score":5.3,"verdict":"Weak","usefulnessSummary":"PLAYISM and Team17 help, but Square Enix and Xbox still make the peer set feel too scale-blind.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:51:12.336Z"},{"area":"trend","packKey":"full.section-5","critiqueRef":"games-trending-right-now","critiqueId":null,"suiteKey":"games-trending-right-now","prompt":"what games are trending right now?","family":"trend_leaderboard","primaryPersona":"Competitive / Market Intelligence Analyst","score":5.4,"verdict":"Weak","usefulnessSummary":"The momentum table is clearer than before, but it still feels too long-tail to answer “trending right now.”","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:54:55.538Z"},{"area":"trend","packKey":"full.section-5","critiqueRef":"#102","critiqueId":102,"suiteKey":"roguelites-review-velocity-vs-ccu","prompt":"Compare top 5 roguelites by review velocity and CCU","family":"trend_comparison","primaryPersona":"Competitive / Market Intelligence Analyst","score":5.6,"verdict":"Mixed","usefulnessSummary":"Trustworthy sparse screen, but it misses CCU and only returns one qualifying roguelite.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:54:55.538Z"},{"area":"trend","packKey":"full.section-5","critiqueRef":"show-breaking-out-right-now","critiqueId":null,"suiteKey":"show-breaking-out-right-now","prompt":"Show me breaking out games right now","family":"trend_breakout","primaryPersona":"Competitive / Market Intelligence Analyst","score":5.7,"verdict":"Mixed","usefulnessSummary":"Similar breakout scan value as the sibling prompt, but still under-supported for decisive use.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:54:55.538Z"},{"area":"trend","packKey":"full.section-5","critiqueRef":"show-games-improving-sentiment","critiqueId":null,"suiteKey":"show-games-improving-sentiment","prompt":"Show me games with improving sentiment","family":"trend_sentiment","primaryPersona":"Competitive / Market Intelligence Analyst","score":5.8,"verdict":"Mixed","usefulnessSummary":"Signed deltas make this interpretable, but the tail still leans on very small recent-review samples.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:54:55.538Z"},{"area":"trend","packKey":"full.section-5","critiqueRef":"breaking-out-right-now","critiqueId":null,"suiteKey":"breaking-out-right-now","prompt":"What’s breaking out right now?","family":"trend_breakout","primaryPersona":"Competitive / Market Intelligence Analyst","score":5.8,"verdict":"Mixed","usefulnessSummary":"Reasonable breakout watchlist, but still noisy and uneven for high-confidence market decisions.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:54:55.538Z"},{"area":"company","packKey":"full.sections-1-2","critiqueRef":"#151","critiqueId":151,"suiteKey":null,"prompt":"Developers with 3+ games, all above 90% reviews, with a release in the past year","family":"company_ranking","primaryPersona":"Publishing Strategy Lead","score":5.9,"verdict":"Mixed","usefulnessSummary":"The exact screen is surfaced, but thin-review and zero-meaningful-release rows drag the result back under the trust bar.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:48:09.907Z"},{"area":"trend","packKey":"full.section-5","critiqueRef":"games-improving-sentiment-past-30-days","critiqueId":null,"suiteKey":"games-improving-sentiment-past-30-days","prompt":"Games with improving sentiment in the past 30 days","family":"trend_sentiment","primaryPersona":"Competitive / Market Intelligence Analyst","score":5.9,"verdict":"Mixed","usefulnessSummary":"A clearer 30-day sentiment screen, though several rows still have too little support to trust fully.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:54:55.538Z"},{"area":"trend","packKey":"full.section-5","critiqueRef":"accelerating-review-velocity","critiqueId":null,"suiteKey":"accelerating-review-velocity","prompt":"Which games have accelerating review velocity?","family":"trend_velocity","primaryPersona":"Competitive / Market Intelligence Analyst","score":6,"verdict":"Mixed","usefulnessSummary":"Decent high-activity watchlist, but it still does not really prove acceleration.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:54:55.538Z"},{"area":"trend","packKey":"full.section-5","critiqueRef":"breaking-out-indie-right-now","critiqueId":null,"suiteKey":"breaking-out-indie-right-now","prompt":"Breaking out indie games right now","family":"trend_breakout","primaryPersona":"Investor / Portfolio Analyst","score":6.1,"verdict":"Mixed","usefulnessSummary":"Better support floors help, but the “right now” indie list still leans too small for investor use.","sourceDocPath":"/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals-round-2.md","sourceRunId":"2026-03-21T20:54:55.538Z"}],"recentCycles":[],"recentEvidence":[{"area":"company","packKey":"mini.company","packType":"mini","mode":"mini","origin":"http://localhost:3001","writeDir":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company","curationTemplatePath":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company/curation-template.json","comparisonMarkdownPath":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company/baseline-comparison.md","cycleSummaryPath":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/cycle-summary.md","comparisonStatus":"awaiting_curation","recordedAt":"2026-03-21T22:57:51.367Z"},{"area":"company","packKey":"mini.company","packType":"mini","mode":"mini","origin":"http://localhost:3001","writeDir":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company","curationTemplatePath":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company/curation-template.json","comparisonMarkdownPath":"/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company/baseline-comparison.md","cycleSummaryPath":null,"comparisonStatus":"awaiting_curation","recordedAt":"2026-03-21T22:57:51.365Z"},{"area":"trend","packKey":"full.section-5","packType":"full","mode":"compare_only","origin":"compare-only","writeDir":"/tmp/publisheriq-chat-evals/round-2-section-5","curationTemplatePath":"/tmp/publisheriq-chat-evals/round-2-section-5/curation-template.json","comparisonMarkdownPath":"/tmp/publisheriq-chat-evals/round-2-section-5/baseline-comparison.md","cycleSummaryPath":"/tmp/publisheriq-chat-evals/round-2-section-5/cycle-summary.md","comparisonStatus":"pass","recordedAt":"2026-03-21T22:28:03.035Z"}]} -->
# Chat Quality Status

- Updated: 2026-03-21T22:57:51.367Z
- Resume command: `pnpm chat-evals:resume`
- Cycle runner: `pnpm chat-evals:cycle`

## Current Cycle

- Area: `company`
- Lead prompt: Publishers with releases in every year since 2020
- Critique ref: `#175`
- Phase: `local_mini_review`
- Baseline: `docs/chat-prompt-evals-round-2.md` run `2026-03-21T20:48:09.907Z` #175 (2.6 /10, Failure)
- Hypothesis: PublisherYearMetrics queries regress when the model emits unprefixed members. prepareCompanyQuery does not canonicalize bare year-metric members like publisherId or releaseYear, so Cube rejects the query and the loop exhausts.
- Touched files: `apps/admin/src/lib/chat/company-query-guardrails.ts`
- Started: 2026-03-21T22:42:01.871Z
- Last updated: 2026-03-21T22:57:51.367Z
- Next action: If the local mini pack looks good, run the live golden gate.
- Next command: node scripts/chat-evals/run-cycle.mjs --mode golden --area company --baseline blessed

## Checklist

- [x] Prompt selected
- [x] Baseline reviewed
- [x] Raw answer reviewed
- [x] Code path identified
- [x] Local mini run completed
- [ ] Local mini approved
- [ ] Live golden run completed
- [ ] Golden curation completed
- [ ] Compare-only completed
- [ ] Accepted for commit
- [ ] Committed

## Evidence

- Local run dir: /tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company
- Golden run dir: none
- Curation template: /tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company/curation-template.json
- Comparison: /tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company/baseline-comparison.md
- Cycle summary: /tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/cycle-summary.md
- Proposed commit message: Improve company chat for #175
- Notes:
  - 2026-03-21T22:42:16.421Z: Cycle created from backlog.
  - 2026-03-21T22:44:11Z: Research completed and code path identified. Raw SSE shows Cube 400 errors for unprefixed PublisherYearMetrics members.

### Recent Run Evidence

| Recorded | Area | Pack | Mode | Status | Output |
|---|---|---|---|---|---|
| 2026-03-21T22:57:51.367Z | `company` | `mini.company` | `mini` | `awaiting_curation` | `/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company` |
| 2026-03-21T22:57:51.365Z | `company` | `mini.company` | `mini` | `awaiting_curation` | `/tmp/publisheriq-chat-evals/cycles/mini-company-2026-03-21T22-56-20-056Z/mini-company` |
| 2026-03-21T22:28:03.035Z | `trend` | `full.section-5` | `compare_only` | `pass` | `/tmp/publisheriq-chat-evals/round-2-section-5` |

## Suggested Next

- Suggestion: `company` #175 Publishers with releases in every year since 2020 (2.6/10, Failure)
- Source: `docs/chat-prompt-evals-round-2.md` run `2026-03-21T20:48:09.907Z`

## Backlog

| Rank | Area | Critique Ref | Prompt | Score | Verdict | Source Run |
|---:|---|---|---|---:|---|---|
| 1 | `company` | `#175` | Publishers with releases in every year since 2020 | 2.6 | Failure | `2026-03-21T20:48:09.907Z` |
| 2 | `company` | `#138` | Games currently on sale | 5.0 | Weak | `2026-03-21T20:48:09.907Z` |
| 3 | `similarity` | `#132` | Games similar to Hollow Knight with better reviews | 5.0 | Weak | `2026-03-21T20:51:12.336Z` |
| 4 | `company` | `#219` | Games under $5 with overwhelmingly positive reviews | 5.3 | Weak | `2026-03-21T20:48:09.907Z` |
| 5 | `company` | `#170` | What publishers are similar to Devolver Digital? | 5.3 | Weak | `2026-03-21T20:48:09.907Z` |
| 6 | `similarity` | `#170` | What publishers are similar to Devolver Digital? | 5.3 | Weak | `2026-03-21T20:51:12.336Z` |
| 7 | `trend` | `games-trending-right-now` | what games are trending right now? | 5.4 | Weak | `2026-03-21T20:54:55.538Z` |
| 8 | `trend` | `#102` | Compare top 5 roguelites by review velocity and CCU | 5.6 | Mixed | `2026-03-21T20:54:55.538Z` |
| 9 | `trend` | `show-breaking-out-right-now` | Show me breaking out games right now | 5.7 | Mixed | `2026-03-21T20:54:55.538Z` |
| 10 | `trend` | `show-games-improving-sentiment` | Show me games with improving sentiment | 5.8 | Mixed | `2026-03-21T20:54:55.538Z` |
| 11 | `trend` | `breaking-out-right-now` | What’s breaking out right now? | 5.8 | Mixed | `2026-03-21T20:54:55.538Z` |
| 12 | `company` | `#151` | Developers with 3+ games, all above 90% reviews, with a release in the past year | 5.9 | Mixed | `2026-03-21T20:48:09.907Z` |
| 13 | `trend` | `games-improving-sentiment-past-30-days` | Games with improving sentiment in the past 30 days | 5.9 | Mixed | `2026-03-21T20:54:55.538Z` |
| 14 | `trend` | `accelerating-review-velocity` | Which games have accelerating review velocity? | 6.0 | Mixed | `2026-03-21T20:54:55.538Z` |
| 15 | `trend` | `breaking-out-indie-right-now` | Breaking out indie games right now | 6.1 | Mixed | `2026-03-21T20:54:55.538Z` |

## Recent Cycles

| Closed | Area | Critique Ref | Prompt | Outcome | Commit |
|---|---|---|---|---|---|
| - | - | - | No completed cycles yet | - | - |

## Next Codex Prompt

```md
Use `docs/chat-evals/status.md` as the source of truth for the active cycle.
Run the live golden gate for company.
Lead prompt: #175 Publishers with releases in every year since 2020
Command: node scripts/chat-evals/run-cycle.mjs --mode golden --area company --baseline blessed
After the run, score the curation template from the assigned personas and stop before any commit decision.
```

