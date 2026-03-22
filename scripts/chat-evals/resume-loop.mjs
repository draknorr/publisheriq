#!/usr/bin/env node

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { buildBacklog } from './lib/backlog.mjs';
import { getAreaConfig } from './lib/prompt-packs.mjs';
import {
  archiveActiveCycle,
  buildCycleFromBacklogItem,
  createInitialStatusState,
  getGuidanceForCycle,
  loadStatusState,
  saveStatusState,
  DEFAULT_STATUS_DOC_PATH,
} from './lib/status-doc.mjs';

async function main() {
  const docPath = DEFAULT_STATUS_DOC_PATH;
  let state = await loadStatusState(docPath);
  if (!state.updatedAt) {
    state = await saveStatusState(createInitialStatusState(), docPath);
  }

  const rl = readline.createInterface({ input, output });
  try {
    console.log(`Chat Quality status: ${docPath}`);
    console.log('');

    if (state.activeCycle) {
      printCurrentCycle(state.activeCycle);
      const action = await askChoice(rl, 'What do you want to do?', [
        'Resume current cycle',
        'Refresh backlog only',
        'Close this cycle as blocked and pick another problem',
        'Exit',
      ]);

      if (action === 0) {
        state = await handleResumeCurrentCycle(rl, state, docPath);
      } else if (action === 1) {
        state = await refreshBacklog(state, docPath);
      } else if (action === 2) {
        state = await closeAndRestart(rl, state, docPath);
      }
    } else {
      state = await handleNoActiveCycle(rl, state, docPath);
    }
  } finally {
    rl.close();
  }
}

async function handleNoActiveCycle(rl, state, docPath) {
  const refreshed = await refreshBacklog(state, docPath);
  if (!refreshed.backlog.length) {
    console.log('No backlog items were found in the current scored ledgers.');
    return refreshed;
  }

  printBacklogPreview(refreshed.backlog);
  const action = await askChoice(rl, 'How do you want to start?', [
    `Start suggested prompt (${refreshed.backlog[0].critiqueRef} ${refreshed.backlog[0].prompt})`,
    'Choose another prompt from the backlog',
    'Exit',
  ]);

  if (action === 2) {
    return refreshed;
  }

  const selectedItem = action === 0 ? refreshed.backlog[0] : await chooseBacklogItem(rl, refreshed.backlog);
  return startCycleFromItem(rl, refreshed, selectedItem, docPath);
}

async function handleResumeCurrentCycle(rl, state, docPath) {
  const cycle = state.activeCycle;
  const guidance = getGuidanceForCycle(cycle);
  console.log('');
  console.log(`Current phase: ${cycle.phase}`);
  console.log(`Next action: ${guidance.nextAction}`);
  console.log(`Next command: ${guidance.nextCommand}`);
  console.log('');

  switch (cycle.phase) {
    case 'research':
      return handleResearchPhase(rl, state, docPath);
    case 'editing':
      return handleEditingPhase(rl, state, docPath);
    case 'local_mini_pending':
    case 'local_mini_review':
      return handleLocalMiniPhase(rl, state, docPath);
    case 'golden_pending':
    case 'golden_review':
      return handleGoldenPhase(rl, state, docPath);
    case 'acceptance_pending':
      return handleAcceptancePhase(rl, state, docPath);
    case 'commit_ready':
      return handleCommitReadyPhase(rl, state, docPath);
    case 'blocked':
      return handleBlockedPhase(rl, state, docPath);
    default:
      printGuidance(state.activeCycle);
      return state;
  }
}

async function handleResearchPhase(rl, state, docPath) {
  printGuidance(state.activeCycle);
  const action = await askChoice(rl, 'What happened?', [
    'I reviewed the baseline and identified the code path',
    'I want the research prompt again',
    'Exit',
  ]);

  if (action === 1) {
    printGuidance(state.activeCycle);
    return state;
  }
  if (action === 2) {
    return state;
  }

  const hypothesis = await askInput(rl, 'What is the current fix hypothesis?', state.activeCycle.hypothesis);
  const touchedFiles = await askCsv(rl, 'Likely files to touch (comma-separated, optional)');
  const nextState = {
    ...state,
    activeCycle: {
      ...state.activeCycle,
      phase: 'editing',
      hypothesis,
      touchedFiles,
      checklist: {
        ...state.activeCycle.checklist,
        baselineReviewed: true,
        rawAnswerReviewed: true,
        codePathIdentified: true,
      },
      notes: appendNote(state.activeCycle.notes, 'Research completed and code path identified.'),
      lastUpdatedAt: new Date().toISOString(),
    },
  };
  const saved = await saveStatusState(nextState, docPath);
  printGuidance(saved.activeCycle);
  return saved;
}

async function handleEditingPhase(rl, state, docPath) {
  printGuidance(state.activeCycle);
  const action = await askChoice(rl, 'Where are you now?', [
    'The targeted change is ready, show me the local mini step',
    'I want the edit prompt again',
    'Exit',
  ]);

  if (action === 1) {
    printGuidance(state.activeCycle);
    return state;
  }
  if (action === 2) {
    return state;
  }

  const nextState = {
    ...state,
    activeCycle: {
      ...state.activeCycle,
      phase: 'local_mini_pending',
      notes: appendNote(state.activeCycle.notes, 'Code change ready for local mini validation.'),
      lastUpdatedAt: new Date().toISOString(),
    },
  };
  const saved = await saveStatusState(nextState, docPath);
  printGuidance(saved.activeCycle);
  return saved;
}

async function handleLocalMiniPhase(rl, state, docPath) {
  printGuidance(state.activeCycle);
  const action = await askChoice(rl, 'How did local mini go?', [
    'Local mini passed; move to live golden',
    'Local mini found issues; go back to editing',
    'Show the local mini command again',
    'Exit',
  ]);

  if (action === 2) {
    printGuidance({
      ...state.activeCycle,
      phase: 'local_mini_pending',
    });
    return state;
  }
  if (action === 3) {
    return state;
  }

  const runDir = await askInput(rl, 'Local mini run dir (optional)', state.activeCycle.localRunDir || '');
  const note = await askInput(rl, 'Short local mini note (optional)', '');

  const passed = action === 0;
  const nextState = {
    ...state,
    activeCycle: {
      ...state.activeCycle,
      phase: passed ? 'golden_pending' : 'editing',
      localRunDir: runDir || state.activeCycle.localRunDir,
      checklist: {
        ...state.activeCycle.checklist,
        localMiniCompleted: true,
        localMiniPassed: passed,
      },
      notes: appendNote(
        state.activeCycle.notes,
        note || (passed ? 'Local mini passed and is ready for live golden.' : 'Local mini showed issues; returning to editing.')
      ),
      lastUpdatedAt: new Date().toISOString(),
    },
  };
  const saved = await saveStatusState(nextState, docPath);
  printGuidance(saved.activeCycle);
  return saved;
}

async function handleGoldenPhase(rl, state, docPath) {
  printGuidance(state.activeCycle);
  const action = await askChoice(rl, 'Where are you in the golden step?', [
    'Golden run finished; I need compare and acceptance',
    'Golden failed or regressed; return to editing',
    'Show the golden instructions again',
    'Exit',
  ]);

  if (action === 2) {
    printGuidance({
      ...state.activeCycle,
      phase: 'golden_pending',
    });
    return state;
  }
  if (action === 3) {
    return state;
  }

  if (action === 1) {
    const note = await askInput(rl, 'Why is this blocked or regressed?', '');
    const nextState = {
      ...state,
      activeCycle: {
        ...state.activeCycle,
        phase: 'blocked',
        checklist: {
          ...state.activeCycle.checklist,
          goldenRunCompleted: true,
        },
        notes: appendNote(state.activeCycle.notes, note || 'Golden run regressed or failed.'),
        lastUpdatedAt: new Date().toISOString(),
      },
    };
    const saved = await saveStatusState(nextState, docPath);
    printGuidance(saved.activeCycle);
    return saved;
  }

  const runDir = await askInput(rl, 'Golden run dir (optional)', state.activeCycle.goldenRunDir || '');
  const comparisonPath = await askInput(
    rl,
    'Comparison path if you already have it (optional)',
    state.activeCycle.comparisonPath || ''
  );
  const note = await askInput(rl, 'Short golden note (optional)', '');

  const nextState = {
    ...state,
    activeCycle: {
      ...state.activeCycle,
      phase: 'acceptance_pending',
      goldenRunDir: runDir || state.activeCycle.goldenRunDir,
      comparisonPath: comparisonPath || state.activeCycle.comparisonPath,
      checklist: {
        ...state.activeCycle.checklist,
        goldenRunCompleted: true,
        goldenCurationCompleted: true,
        compareOnlyCompleted: true,
      },
      notes: appendNote(
        state.activeCycle.notes,
        note || 'Golden run completed; ready for acceptance review.'
      ),
      lastUpdatedAt: new Date().toISOString(),
    },
  };
  const saved = await saveStatusState(nextState, docPath);
  printGuidance(saved.activeCycle);
  return saved;
}

async function handleAcceptancePhase(rl, state, docPath) {
  printGuidance(state.activeCycle);
  const action = await askChoice(rl, 'What is the acceptance verdict?', [
    'Accept this cycle and prepare commit',
    'Block this cycle and keep investigating',
    'Show the acceptance prompt again',
    'Exit',
  ]);

  if (action === 2) {
    printGuidance(state.activeCycle);
    return state;
  }
  if (action === 3) {
    return state;
  }

  const note = await askInput(rl, 'Acceptance note (optional)', '');
  if (action === 1) {
    const nextState = {
      ...state,
      activeCycle: {
        ...state.activeCycle,
        phase: 'blocked',
        checklist: {
          ...state.activeCycle.checklist,
          acceptedForCommit: false,
        },
        notes: appendNote(state.activeCycle.notes, note || 'Cycle blocked during acceptance review.'),
        lastUpdatedAt: new Date().toISOString(),
      },
    };
    const saved = await saveStatusState(nextState, docPath);
    printGuidance(saved.activeCycle);
    return saved;
  }

  const commitMessage = await askInput(
    rl,
    'Proposed commit message',
    state.activeCycle.proposedCommitMessage || `Improve ${state.activeCycle.area} chat for ${state.activeCycle.critiqueRef}`
  );
  const nextState = {
    ...state,
    activeCycle: {
      ...state.activeCycle,
      phase: 'commit_ready',
      proposedCommitMessage: commitMessage,
      checklist: {
        ...state.activeCycle.checklist,
        acceptedForCommit: true,
      },
      notes: appendNote(state.activeCycle.notes, note || 'Cycle accepted and ready for commit review.'),
      lastUpdatedAt: new Date().toISOString(),
    },
  };
  const saved = await saveStatusState(nextState, docPath);
  printGuidance(saved.activeCycle);
  return saved;
}

async function handleCommitReadyPhase(rl, state, docPath) {
  printGuidance(state.activeCycle);
  const action = await askChoice(rl, 'What happened?', [
    'I committed this cycle',
    'Not yet, just show me the commit guidance again',
    'Exit',
  ]);

  if (action === 1) {
    printGuidance(state.activeCycle);
    return state;
  }
  if (action === 2) {
    return state;
  }

  const note = await askInput(rl, 'Short completion note (optional)', '');
  const archived = archiveActiveCycle(
    {
      ...state,
      activeCycle: {
        ...state.activeCycle,
        phase: 'committed',
        checklist: {
          ...state.activeCycle.checklist,
          committed: true,
        },
      },
    },
    'committed',
    note || 'Cycle committed.'
  );
  const withBacklog = await refreshBacklog(archived, docPath);
  console.log('');
  console.log('Cycle archived. The backlog has been refreshed for the next loop.');
  if (withBacklog.backlog.length) {
    console.log(`Next suggestion: ${withBacklog.backlog[0].critiqueRef} ${withBacklog.backlog[0].prompt}`);
  }
  return withBacklog;
}

async function handleBlockedPhase(rl, state, docPath) {
  printGuidance(state.activeCycle);
  const action = await askChoice(rl, 'What do you want to do next?', [
    'Return this prompt to editing',
    'Close it as blocked and pick another prompt',
    'Exit',
  ]);

  if (action === 2) {
    return state;
  }

  if (action === 0) {
    const nextState = {
      ...state,
      activeCycle: {
        ...state.activeCycle,
        phase: 'editing',
        notes: appendNote(state.activeCycle.notes, 'Blocked cycle moved back to editing.'),
        lastUpdatedAt: new Date().toISOString(),
      },
    };
    const saved = await saveStatusState(nextState, docPath);
    printGuidance(saved.activeCycle);
    return saved;
  }

  return closeAndRestart(rl, state, docPath);
}

async function closeAndRestart(rl, state, docPath) {
  const note = await askInput(rl, 'Why are you closing this cycle?', '');
  const archived = archiveActiveCycle(state, 'blocked', note || 'Cycle closed without commit.');
  return handleNoActiveCycle(rl, archived, docPath);
}

async function startCycleFromItem(rl, state, item, docPath) {
  const cycle = buildCycleFromBacklogItem(item);
  const hypothesis = await askInput(
    rl,
    'Initial hypothesis or note for why this prompt is weak (optional)',
    item.usefulnessSummary || ''
  );
  cycle.hypothesis = hypothesis;
  cycle.notes = appendNote(cycle.notes, 'Cycle created from backlog.');
  cycle.lastUpdatedAt = new Date().toISOString();

  const nextState = {
    ...state,
    activeCycle: cycle,
  };
  const saved = await saveStatusState(nextState, docPath);
  console.log('');
  console.log('Cycle started.');
  printGuidance(saved.activeCycle);
  return saved;
}

async function refreshBacklog(state, docPath) {
  const backlog = await buildBacklog();
  const filteredBacklog = state.activeCycle
    ? backlog.filter((item) => item.prompt !== state.activeCycle.leadPrompt)
    : backlog;
  const nextState = {
    ...state,
    backlog: filteredBacklog,
  };
  const saved = await saveStatusState(nextState, docPath);
  console.log(`Backlog refreshed with ${filteredBacklog.length} items.`);
  return saved;
}

function printCurrentCycle(cycle) {
  console.log(`Active cycle: ${cycle.critiqueRef} ${cycle.leadPrompt}`);
  console.log(`Area: ${cycle.area}`);
  console.log(`Phase: ${cycle.phase}`);
  console.log('');
}

function printBacklogPreview(backlog) {
  console.log('Top backlog items:');
  backlog.slice(0, 5).forEach((item, index) => {
    console.log(`${index + 1}. [${item.area}] ${item.critiqueRef} ${item.prompt} (${item.score.toFixed(1)}/10, ${item.verdict || 'unrated'})`);
  });
  console.log('');
}

function printGuidance(cycle) {
  const guidance = getGuidanceForCycle(cycle);
  console.log('');
  console.log(`Next action: ${guidance.nextAction}`);
  console.log(`Next command: ${guidance.nextCommand}`);
  console.log('');
  console.log('Codex prompt:');
  console.log('---');
  console.log(guidance.codexPrompt);
  console.log('---');
  console.log('');
}

async function chooseBacklogItem(rl, backlog) {
  const maxChoices = Math.min(backlog.length, 8);
  const options = backlog.slice(0, maxChoices).map((item) => `[${item.area}] ${item.critiqueRef} ${item.prompt} (${item.score.toFixed(1)}/10)`);
  const choiceIndex = await askChoice(rl, 'Choose the next prompt', options);
  return backlog[choiceIndex];
}

async function askChoice(rl, prompt, options) {
  console.log(prompt);
  options.forEach((option, index) => {
    console.log(`${index + 1}. ${option}`);
  });

  while (true) {
    const answer = (await rl.question('Select a number: ')).trim();
    const numeric = Number(answer);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= options.length) {
      return numeric - 1;
    }
    console.log(`Enter a number between 1 and ${options.length}.`);
  }
}

async function askInput(rl, prompt, defaultValue = '') {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = (await rl.question(`${prompt}${suffix}: `)).trim();
  return answer || defaultValue;
}

async function askCsv(rl, prompt) {
  const raw = (await rl.question(`${prompt}: `)).trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function appendNote(notes, note) {
  if (!note) return notes;
  return [...notes, `${new Date().toISOString()}: ${note}`].slice(-10);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
