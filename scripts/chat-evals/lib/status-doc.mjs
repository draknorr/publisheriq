import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
export const DEFAULT_STATUS_DOC_PATH = path.join(ROOT, 'docs', 'chat-evals', 'status.md');
const STATUS_MARKER = '<!-- CHAT_EVAL_STATUS ';
const MAX_RECENT_CYCLES = 10;
const MAX_RECENT_EVIDENCE = 12;

export async function loadStatusState(docPath = DEFAULT_STATUS_DOC_PATH) {
  const text = await safeReadFile(docPath);
  if (!text) {
    return createInitialStatusState();
  }

  const match = text.match(/<!-- CHAT_EVAL_STATUS ([\s\S]*?) -->/);
  if (!match) {
    return createInitialStatusState();
  }

  const parsed = JSON.parse(match[1]);
  return normalizeStatusState(parsed);
}

export async function saveStatusState(state, docPath = DEFAULT_STATUS_DOC_PATH) {
  await fs.mkdir(path.dirname(docPath), { recursive: true });
  const normalized = normalizeStatusState({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  await fs.writeFile(docPath, renderStatusMarkdown(normalized));
  return normalized;
}

export function createInitialStatusState() {
  return normalizeStatusState({
    version: 1,
    updatedAt: null,
    activeCycle: null,
    backlog: [],
    recentCycles: [],
    recentEvidence: [],
  });
}

export function createChecklist() {
  return {
    promptSelected: false,
    baselineReviewed: false,
    rawAnswerReviewed: false,
    codePathIdentified: false,
    localMiniCompleted: false,
    localMiniPassed: false,
    goldenRunCompleted: false,
    goldenCurationCompleted: false,
    compareOnlyCompleted: false,
    acceptedForCommit: false,
    committed: false,
  };
}

export function buildCycleFromBacklogItem(item) {
  const startedAt = new Date().toISOString();
  return {
    id: `${item.area}-${startedAt}`,
    area: item.area,
    packKey: item.packKey,
    leadPrompt: item.prompt,
    critiqueRef: item.critiqueRef,
    family: item.family,
    primaryPersona: item.primaryPersona,
    phase: 'research',
    baseline: {
      docPath: relativePath(item.sourceDocPath),
      runId: item.sourceRunId,
      critiqueRef: item.critiqueRef,
      score: item.score,
      verdict: item.verdict,
      usefulnessSummary: item.usefulnessSummary,
    },
    sourceRun: {
      docPath: relativePath(item.sourceDocPath),
      runId: item.sourceRunId,
      generatedAt: item.sourceGeneratedAt,
    },
    hypothesis: '',
    touchedFiles: [],
    localRunDir: null,
    goldenRunDir: null,
    comparisonPath: null,
    cycleSummaryPath: null,
    curationTemplatePath: null,
    proposedCommitMessage: null,
    notes: [],
    checklist: {
      ...createChecklist(),
      promptSelected: true,
    },
    startedAt,
    lastUpdatedAt: startedAt,
  };
}

export function recordEvidence(state, evidence) {
  const normalizedEvidence = {
    ...evidence,
    recordedAt: evidence.recordedAt || new Date().toISOString(),
  };
  const recentEvidence = [normalizedEvidence, ...(state.recentEvidence || [])].slice(0, MAX_RECENT_EVIDENCE);
  return {
    ...state,
    recentEvidence,
  };
}

export function archiveActiveCycle(state, outcome, notes = '') {
  if (!state.activeCycle) {
    return state;
  }

  const archivedCycle = {
    area: state.activeCycle.area,
    critiqueRef: state.activeCycle.critiqueRef,
    leadPrompt: state.activeCycle.leadPrompt,
    outcome,
    closedAt: new Date().toISOString(),
    proposedCommitMessage: state.activeCycle.proposedCommitMessage || null,
    localRunDir: state.activeCycle.localRunDir,
    goldenRunDir: state.activeCycle.goldenRunDir,
    comparisonPath: state.activeCycle.comparisonPath,
    notes: notes || state.activeCycle.notes.at(-1) || '',
  };

  return normalizeStatusState({
    ...state,
    activeCycle: null,
    recentCycles: [archivedCycle, ...(state.recentCycles || [])].slice(0, MAX_RECENT_CYCLES),
  });
}

export function getGuidanceForCycle(cycle) {
  if (!cycle) {
    return {
      nextAction: 'Refresh the backlog or start the suggested next prompt.',
      nextCommand: 'pnpm chat-evals:resume',
      codexPrompt: 'Use `pnpm chat-evals:resume` to pick the next lead prompt and restart the loop.',
    };
  }

  const localMiniCommand = `node scripts/chat-evals/run-cycle.mjs --mode mini --area ${cycle.area} --origin local --baseline blessed`;
  const goldenCommand = `node scripts/chat-evals/run-cycle.mjs --mode golden --area ${cycle.area} --baseline blessed`;
  const compareOnlyCommand = `node scripts/chat-evals/run-cycle.mjs --compare-only --pack golden.${cycle.area} --run-dir <golden-run-dir> --baseline blessed`;
  const commitMessage = cycle.proposedCommitMessage || buildDefaultCommitMessage(cycle);

  switch (cycle.phase) {
    case 'research':
      return {
        nextAction: 'Review the weak answer, baseline, tool calls, and likely code path before editing.',
        nextCommand: 'No shell command yet. Use the Codex prompt below.',
        codexPrompt: buildResearchPrompt(cycle),
      };
    case 'editing':
      return {
        nextAction: 'Make the smallest targeted fix, then run the local mini pack.',
        nextCommand: localMiniCommand,
        codexPrompt: buildEditPrompt(cycle),
      };
    case 'local_mini_pending':
      return {
        nextAction: 'Run the local mini pack and review whether the lead prompt improved without collateral damage.',
        nextCommand: localMiniCommand,
        codexPrompt: buildLocalValidationPrompt(cycle),
      };
    case 'local_mini_review':
      return {
        nextAction: 'If the local mini pack looks good, run the live golden gate.',
        nextCommand: goldenCommand,
        codexPrompt: buildGoldenPrompt(cycle),
      };
    case 'golden_pending':
      return {
        nextAction: 'Run the live golden pack for the touched area.',
        nextCommand: goldenCommand,
        codexPrompt: buildGoldenPrompt(cycle),
      };
    case 'golden_review':
      return {
        nextAction: 'Finish manual curation and regenerate baseline comparison without rerunning the prompts.',
        nextCommand: compareOnlyCommand,
        codexPrompt: buildComparePrompt(cycle),
      };
    case 'acceptance_pending':
      return {
        nextAction: 'Decide whether the cycle is accepted or blocked.',
        nextCommand: 'pnpm chat-evals:resume',
        codexPrompt: buildAcceptancePrompt(cycle),
      };
    case 'commit_ready':
      return {
        nextAction: 'Review the tested diff and commit only if you still accept the cycle.',
        nextCommand: `git add <files> && git commit -m "${commitMessage}"`,
        codexPrompt: buildCommitPrompt(cycle),
      };
    case 'blocked':
      return {
        nextAction: 'Either continue iterating on this lead prompt or close it and pick the next backlog item.',
        nextCommand: 'pnpm chat-evals:resume',
        codexPrompt: buildBlockedPrompt(cycle),
      };
    default:
      return {
        nextAction: 'Use the resume wizard to continue this cycle.',
        nextCommand: 'pnpm chat-evals:resume',
        codexPrompt: buildResearchPrompt(cycle),
      };
  }
}

export function renderStatusMarkdown(state) {
  const activeCycle = state.activeCycle;
  const guidance = getGuidanceForCycle(activeCycle);
  const lines = [];

  lines.push(`${STATUS_MARKER}${JSON.stringify(state)} -->`);
  lines.push('# Chat Quality Status');
  lines.push('');
  lines.push(`- Updated: ${state.updatedAt || 'not yet saved'}`);
  lines.push(`- Resume command: \`pnpm chat-evals:resume\``);
  lines.push(`- Cycle runner: \`pnpm chat-evals:cycle\``);
  lines.push('');
  lines.push('## Current Cycle');
  lines.push('');

  if (!activeCycle) {
    lines.push('- Status: `idle`');
    lines.push(`- Next action: ${guidance.nextAction}`);
  } else {
    lines.push(`- Area: \`${activeCycle.area}\``);
    lines.push(`- Lead prompt: ${activeCycle.leadPrompt}`);
    lines.push(`- Critique ref: \`${activeCycle.critiqueRef}\``);
    lines.push(`- Phase: \`${activeCycle.phase}\``);
    lines.push(`- Baseline: ${formatBaseline(activeCycle.baseline)}`);
    lines.push(`- Hypothesis: ${activeCycle.hypothesis || 'TBD'}`);
    lines.push(`- Touched files: ${formatList(activeCycle.touchedFiles)}`);
    lines.push(`- Started: ${activeCycle.startedAt}`);
    lines.push(`- Last updated: ${activeCycle.lastUpdatedAt}`);
    lines.push(`- Next action: ${guidance.nextAction}`);
    lines.push(`- Next command: ${guidance.nextCommand}`);
  }

  lines.push('');
  lines.push('## Checklist');
  lines.push('');
  const checklist = activeCycle?.checklist || createChecklist();
  lines.push(renderCheckbox('Prompt selected', checklist.promptSelected));
  lines.push(renderCheckbox('Baseline reviewed', checklist.baselineReviewed));
  lines.push(renderCheckbox('Raw answer reviewed', checklist.rawAnswerReviewed));
  lines.push(renderCheckbox('Code path identified', checklist.codePathIdentified));
  lines.push(renderCheckbox('Local mini run completed', checklist.localMiniCompleted));
  lines.push(renderCheckbox('Local mini approved', checklist.localMiniPassed));
  lines.push(renderCheckbox('Live golden run completed', checklist.goldenRunCompleted));
  lines.push(renderCheckbox('Golden curation completed', checklist.goldenCurationCompleted));
  lines.push(renderCheckbox('Compare-only completed', checklist.compareOnlyCompleted));
  lines.push(renderCheckbox('Accepted for commit', checklist.acceptedForCommit));
  lines.push(renderCheckbox('Committed', checklist.committed));
  lines.push('');
  lines.push('## Evidence');
  lines.push('');
  if (!activeCycle) {
    lines.push('- No active cycle.');
  } else {
    lines.push(`- Local run dir: ${activeCycle.localRunDir || 'none'}`);
    lines.push(`- Golden run dir: ${activeCycle.goldenRunDir || 'none'}`);
    lines.push(`- Curation template: ${activeCycle.curationTemplatePath || 'none'}`);
    lines.push(`- Comparison: ${activeCycle.comparisonPath || 'none'}`);
    lines.push(`- Cycle summary: ${activeCycle.cycleSummaryPath || 'none'}`);
    lines.push(`- Proposed commit message: ${activeCycle.proposedCommitMessage || buildDefaultCommitMessage(activeCycle)}`);
    if (activeCycle.notes.length) {
      lines.push('- Notes:');
      for (const note of activeCycle.notes) {
        lines.push(`  - ${note}`);
      }
    } else {
      lines.push('- Notes: none');
    }
  }
  if (state.recentEvidence.length) {
    lines.push('');
    lines.push('### Recent Run Evidence');
    lines.push('');
    lines.push('| Recorded | Area | Pack | Mode | Status | Output |');
    lines.push('|---|---|---|---|---|---|');
    for (const evidence of state.recentEvidence) {
      lines.push(
        `| ${evidence.recordedAt} | \`${evidence.area}\` | \`${evidence.packKey}\` | \`${evidence.mode}\` | \`${evidence.comparisonStatus || '-'}\` | \`${escapeTable(evidence.writeDir || '-')}\` |`
      );
    }
  }

  lines.push('');
  lines.push('## Suggested Next');
  lines.push('');
  if (state.backlog.length) {
    const nextItem = state.backlog[0];
    lines.push(`- Suggestion: \`${nextItem.area}\` ${nextItem.critiqueRef} ${nextItem.prompt} (${nextItem.score.toFixed(1)}/10, ${nextItem.verdict || 'unrated'})`);
    lines.push(`- Source: \`${relativePath(nextItem.sourceDocPath)}\` run \`${nextItem.sourceRunId}\``);
  } else {
    lines.push('- No backlog items yet. Refresh the backlog from the ledgers.');
  }

  lines.push('');
  lines.push('## Backlog');
  lines.push('');
  lines.push('| Rank | Area | Critique Ref | Prompt | Score | Verdict | Source Run |');
  lines.push('|---:|---|---|---|---:|---|---|');
  if (!state.backlog.length) {
    lines.push('| 1 | - | - | No backlog items yet | - | - | - |');
  } else {
    state.backlog.forEach((item, index) => {
      lines.push(
        `| ${index + 1} | \`${item.area}\` | \`${item.critiqueRef}\` | ${escapeTable(item.prompt)} | ${item.score.toFixed(1)} | ${escapeTable(item.verdict || '-')} | \`${item.sourceRunId}\` |`
      );
    });
  }

  lines.push('');
  lines.push('## Recent Cycles');
  lines.push('');
  lines.push('| Closed | Area | Critique Ref | Prompt | Outcome | Commit |');
  lines.push('|---|---|---|---|---|---|');
  if (!state.recentCycles.length) {
    lines.push('| - | - | - | No completed cycles yet | - | - |');
  } else {
    for (const cycle of state.recentCycles) {
      lines.push(
        `| ${cycle.closedAt} | \`${cycle.area}\` | \`${cycle.critiqueRef}\` | ${escapeTable(cycle.leadPrompt)} | \`${cycle.outcome}\` | ${escapeTable(cycle.proposedCommitMessage || '-')} |`
      );
    }
  }

  lines.push('');
  lines.push('## Next Codex Prompt');
  lines.push('');
  lines.push('```md');
  lines.push(guidance.codexPrompt);
  lines.push('```');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

export function normalizeStatusState(state) {
  return {
    version: 1,
    updatedAt: state.updatedAt || null,
    activeCycle: state.activeCycle ? normalizeActiveCycle(state.activeCycle) : null,
    backlog: Array.isArray(state.backlog) ? state.backlog.map(normalizeBacklogItem) : [],
    recentCycles: Array.isArray(state.recentCycles) ? state.recentCycles.slice(0, MAX_RECENT_CYCLES) : [],
    recentEvidence: Array.isArray(state.recentEvidence) ? state.recentEvidence.slice(0, MAX_RECENT_EVIDENCE) : [],
  };
}

function normalizeActiveCycle(cycle) {
  const normalized = {
    id: cycle.id || `cycle-${Date.now()}`,
    area: cycle.area || null,
    packKey: cycle.packKey || null,
    leadPrompt: cycle.leadPrompt || null,
    critiqueRef: cycle.critiqueRef || null,
    family: cycle.family || null,
    primaryPersona: cycle.primaryPersona || null,
    phase: cycle.phase || 'research',
    baseline: cycle.baseline || null,
    sourceRun: cycle.sourceRun || null,
    hypothesis: cycle.hypothesis || '',
    touchedFiles: Array.isArray(cycle.touchedFiles) ? cycle.touchedFiles : [],
    localRunDir: cycle.localRunDir || null,
    goldenRunDir: cycle.goldenRunDir || null,
    comparisonPath: cycle.comparisonPath || null,
    cycleSummaryPath: cycle.cycleSummaryPath || null,
    curationTemplatePath: cycle.curationTemplatePath || null,
    proposedCommitMessage: cycle.proposedCommitMessage || null,
    notes: Array.isArray(cycle.notes) ? cycle.notes : [],
    checklist: {
      ...createChecklist(),
      ...(cycle.checklist || {}),
    },
    startedAt: cycle.startedAt || new Date().toISOString(),
    lastUpdatedAt: cycle.lastUpdatedAt || new Date().toISOString(),
  };
  return normalized;
}

function normalizeBacklogItem(item) {
  return {
    area: item.area,
    packKey: item.packKey,
    critiqueRef: item.critiqueRef,
    critiqueId: item.critiqueId ?? null,
    suiteKey: item.suiteKey ?? null,
    prompt: item.prompt,
    family: item.family,
    primaryPersona: item.primaryPersona,
    score: Number(item.score),
    verdict: item.verdict || null,
    usefulnessSummary: item.usefulnessSummary || null,
    sourceDocPath: item.sourceDocPath,
    sourceRunId: item.sourceRunId,
  };
}

function buildResearchPrompt(cycle) {
  return [
    'Use `docs/chat-evals/README.md`, `docs/chat-evals/workflow.md`, `docs/chat-evals/packs.md`, and `docs/chat-evals/status.md` as the operating context.',
    `Continue the active chat-quality cycle for ${cycle.area}.`,
    `Lead prompt: ${cycle.critiqueRef} ${cycle.leadPrompt}`,
    `Baseline: ${formatBaselineInline(cycle.baseline)}`,
    'Inspect the current answer shape, tool calls, critique notes, and the narrowest likely code path.',
    'Do not broaden scope beyond this lead prompt unless the evidence clearly shows shared routing or synthesis is broken.',
    'When you finish, tell me the smallest fix and the exact files to touch.',
  ].join('\n');
}

function buildEditPrompt(cycle) {
  return [
    'Use `docs/chat-evals/status.md` as the source of truth for the active cycle.',
    `Implement the smallest targeted fix for ${cycle.critiqueRef} ${cycle.leadPrompt}.`,
    `Current hypothesis: ${cycle.hypothesis || 'narrow scope fix required; hypothesis not recorded yet'}.`,
    'Keep the change as small as possible.',
    'After the edit, stop and tell me the exact local mini command to run next.',
  ].join('\n');
}

function buildLocalValidationPrompt(cycle) {
  return [
    'Use `docs/chat-evals/status.md` as the source of truth for the active cycle.',
    `Run the local mini validation loop for ${cycle.area}.`,
    `Lead prompt: ${cycle.critiqueRef} ${cycle.leadPrompt}`,
    `Command: node scripts/chat-evals/run-cycle.mjs --mode mini --area ${cycle.area} --origin local --baseline blessed`,
    'Then inspect whether the lead prompt improved and whether the mini pack introduced regressions.',
    'Do not run the live golden pack unless the local mini result is acceptable.',
  ].join('\n');
}

function buildGoldenPrompt(cycle) {
  return [
    'Use `docs/chat-evals/status.md` as the source of truth for the active cycle.',
    `Run the live golden gate for ${cycle.area}.`,
    `Lead prompt: ${cycle.critiqueRef} ${cycle.leadPrompt}`,
    `Command: node scripts/chat-evals/run-cycle.mjs --mode golden --area ${cycle.area} --baseline blessed`,
    'After the run, score the curation template from the assigned personas and stop before any commit decision.',
  ].join('\n');
}

function buildComparePrompt(cycle) {
  return [
    'Use `docs/chat-evals/status.md` as the source of truth for the active cycle.',
    `Finish the scored comparison for ${cycle.critiqueRef} ${cycle.leadPrompt}.`,
    `Golden run dir: ${cycle.goldenRunDir || '<golden-run-dir>'}`,
    `Command: node scripts/chat-evals/run-cycle.mjs --compare-only --pack golden.${cycle.area} --run-dir ${cycle.goldenRunDir || '<golden-run-dir>'} --baseline blessed`,
    'Review the updated baseline comparison and tell me whether the cycle should be accepted or blocked.',
  ].join('\n');
}

function buildAcceptancePrompt(cycle) {
  return [
    'Use `docs/chat-evals/status.md` as the source of truth for the active cycle.',
    `Review the golden comparison for ${cycle.critiqueRef} ${cycle.leadPrompt}.`,
    'Tell me whether the cycle should be accepted or blocked.',
    'Acceptance requires the lead prompt to be materially better and the golden pack to stay inside budget.',
    'Do not commit yet.',
  ].join('\n');
}

function buildCommitPrompt(cycle) {
  return [
    'Use `docs/chat-evals/status.md` as the source of truth for the active cycle.',
    `This cycle is accepted and ready for commit: ${cycle.critiqueRef} ${cycle.leadPrompt}.`,
    `Proposed commit message: ${cycle.proposedCommitMessage || buildDefaultCommitMessage(cycle)}`,
    'Review the diff, stage only the files that belong to this cycle, and stop for explicit approval before committing.',
  ].join('\n');
}

function buildBlockedPrompt(cycle) {
  return [
    'Use `docs/chat-evals/status.md` as the source of truth for the active cycle.',
    `The current cycle is blocked: ${cycle.critiqueRef} ${cycle.leadPrompt}.`,
    'Review the blocking note, decide whether to iterate again on the same prompt, or close it and return to the backlog.',
  ].join('\n');
}

function buildDefaultCommitMessage(cycle) {
  if (!cycle) return 'Improve chat quality cycle';
  return `Improve ${cycle.area} chat for ${cycle.critiqueRef}`;
}

function formatBaseline(baseline) {
  if (!baseline) return 'none';
  return `\`${baseline.docPath}\` run \`${baseline.runId}\` ${baseline.critiqueRef} (${baseline.score?.toFixed?.(1) ?? '-'} /10, ${baseline.verdict || 'unrated'})`;
}

function formatBaselineInline(baseline) {
  if (!baseline) return 'none';
  return `${baseline.critiqueRef} from ${baseline.docPath} run ${baseline.runId}`;
}

function renderCheckbox(label, checked) {
  return `- [${checked ? 'x' : ' '}] ${label}`;
}

function formatList(values) {
  return values.length ? values.map((value) => `\`${value}\``).join(', ') : 'none';
}

function relativePath(filePath) {
  if (!filePath) return filePath;
  return path.relative(ROOT, filePath) || filePath;
}

async function safeReadFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|');
}
