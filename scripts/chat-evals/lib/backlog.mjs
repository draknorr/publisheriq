import { ACTIVE_FULL_PACK_KEYS, loadPackDefinition } from './prompt-packs.mjs';
import { findLatestRunForPrompts } from './ledger-runs.mjs';

export async function buildBacklog({ area = null, limit = 15 } = {}) {
  const items = [];

  for (const packKey of ACTIVE_FULL_PACK_KEYS) {
    const pack = await loadPackDefinition(packKey);
    if (area && pack.area !== area) {
      continue;
    }

    const prompts = pack.entries.map((entry) => entry.prompt);
    const latestRun = await findLatestRunForPrompts(prompts);
    if (!latestRun) {
      continue;
    }

    const entriesByPrompt = new Map(latestRun.entries.map((entry) => [entry.prompt, entry]));
    for (const packEntry of pack.entries) {
      const runEntry = entriesByPrompt.get(packEntry.prompt);
      if (!runEntry || typeof runEntry.score !== 'number') {
        continue;
      }

      items.push({
        area: pack.area,
        packKey: pack.packKey,
        critiqueRef: packEntry.critiqueRef,
        critiqueId: packEntry.critiqueId,
        suiteKey: packEntry.suiteKey,
        prompt: packEntry.prompt,
        family: packEntry.family,
        primaryPersona: packEntry.primaryPersona,
        score: runEntry.score,
        verdict: runEntry.verdict,
        usefulnessSummary: runEntry.usefulnessSummary,
        rationale: runEntry.rationale,
        sourceDocPath: latestRun.docPath,
        sourceRunId: latestRun.metadata.runId,
        sourceGeneratedAt: latestRun.metadata.generatedAt || latestRun.metadata.runId,
      });
    }
  }

  items.sort(compareBacklogItems);
  return typeof limit === 'number' && limit > 0 ? items.slice(0, limit) : items;
}

export function compareBacklogItems(left, right) {
  if (left.score !== right.score) {
    return left.score - right.score;
  }
  return left.prompt.localeCompare(right.prompt);
}

export function findBacklogItem(backlog, critiqueRef) {
  return backlog.find((item) => item.critiqueRef === critiqueRef) || null;
}
