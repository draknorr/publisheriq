#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  annotateCurationTemplate,
  buildPackComparison,
  loadBaselineBundle,
  renderComparisonMarkdown,
} from './lib/baseline-compare.mjs';
import { loadPackDefinition, resolvePackKeys } from './lib/prompt-packs.mjs';
import { buildDefaultOutDir, runPackSuite } from './lib/suite-runner.mjs';
import {
  DEFAULT_STATUS_DOC_PATH,
  loadStatusState,
  recordEvidence,
  saveStatusState,
} from './lib/status-doc.mjs';

const DEFAULT_LIVE_ORIGIN = 'https://www.publisheriq.app';
const DEFAULT_LOCAL_ORIGIN = 'http://localhost:3001';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.compareOnly) {
    await runCompareOnly(args);
    return;
  }

  const packKeys = resolvePackKeys({
    mode: args.mode,
    area: args.area,
    sections: args.sections,
  });
  if (args.fromResults && packKeys.length > 1) {
    throw new Error('--from-results only supports a single pack');
  }
  const origin = resolveOrigin(args.origin);
  const descriptors = await Promise.all(packKeys.map((packKey) => loadPackDefinition(packKey)));
  const cycleBaseOutDir = buildCycleBaseOutDir(args, descriptors);
  if (cycleBaseOutDir) {
    await fs.mkdir(cycleBaseOutDir, { recursive: true });
  }

  const packSummaries = [];

  for (const descriptor of descriptors) {
    const packOutDir = resolvePackOutDir({
      args,
      descriptor,
      cycleBaseOutDir,
      multiplePacks: descriptors.length > 1,
    });

    const summary = await runPackSuite({
      packKey: descriptor.packKey,
      fromResults: args.fromResults,
      outDir: packOutDir,
      origin,
      maxPrompts: args.maxPrompts,
    });

    const baselineBundle = await loadBaselineBundle({
      baselineMode: args.baseline,
      pack: summary.pack,
      prompts: summary.selectedEntries.map((entry) => entry.prompt),
    });
    await annotateCurationTemplate(summary.curationTemplatePath, baselineBundle);

    const curationEntries = JSON.parse(await fs.readFile(summary.curationTemplatePath, 'utf8'));
    const comparison = await buildPackComparison({
      pack: summary.pack,
      curationEntries,
      baselineBundle,
    });

    const comparisonJsonPath = path.join(summary.writeDir, 'baseline-comparison.json');
    const comparisonMarkdownPath = path.join(summary.writeDir, 'baseline-comparison.md');
    await fs.writeFile(comparisonJsonPath, `${JSON.stringify(comparison, null, 2)}\n`);
    await fs.writeFile(comparisonMarkdownPath, renderComparisonMarkdown(comparison));

    packSummaries.push({
      ...summary,
      comparison,
      comparisonJsonPath,
      comparisonMarkdownPath,
    });

    console.log(`Pack ${descriptor.packKey}: ${comparison.status}`);
    console.log(`- Draft run: ${summary.draftRunPath}`);
    console.log(`- Curation: ${summary.curationTemplatePath}`);
    console.log(`- Comparison: ${comparisonMarkdownPath}`);
    console.log(`- Raw artifacts: ${summary.sourceDir}`);

    if (args.statusDoc) {
      await updateStatusDocAfterRun({
        statusDocPath: args.statusDoc,
        pack: summary.pack,
        origin,
        mode: args.mode,
        writeDir: summary.writeDir,
        curationTemplatePath: summary.curationTemplatePath,
        comparisonMarkdownPath,
        cycleSummaryPath: null,
        comparison,
      });
    }
  }

  const cycleSummary = {
    generatedAt: new Date().toISOString(),
    mode: args.mode,
    area: args.area,
    sections: args.sections,
    origin,
    baselineMode: args.baseline,
    maxPrompts: args.maxPrompts,
    packs: packSummaries.map((summary) => ({
      packKey: summary.pack.packKey,
      label: summary.pack.label,
      packType: summary.pack.packType,
      promptCount: summary.selectedEntries.length,
      sourceDir: summary.sourceDir,
      writeDir: summary.writeDir,
      curationTemplatePath: summary.curationTemplatePath,
      comparisonStatus: summary.comparison.status,
      averageDelta: summary.comparison.averageDelta ?? null,
      weakFailureDelta: summary.comparison.weakFailureDelta ?? null,
    })),
  };

  const cycleSummaryMarkdown = renderCycleSummaryMarkdown(cycleSummary);
  const cycleSummaryBaseDir = cycleBaseOutDir ?? packSummaries[0]?.writeDir;
  if (cycleSummaryBaseDir) {
    await fs.writeFile(path.join(cycleSummaryBaseDir, 'cycle-summary.json'), `${JSON.stringify(cycleSummary, null, 2)}\n`);
    await fs.writeFile(path.join(cycleSummaryBaseDir, 'cycle-summary.md'), `${cycleSummaryMarkdown}\n`);
    console.log(`Cycle summary: ${path.join(cycleSummaryBaseDir, 'cycle-summary.md')}`);

    if (args.statusDoc) {
      for (const summary of packSummaries) {
        await updateStatusDocAfterRun({
          statusDocPath: args.statusDoc,
          pack: summary.pack,
          origin,
          mode: args.mode,
          writeDir: summary.writeDir,
          curationTemplatePath: summary.curationTemplatePath,
          comparisonMarkdownPath: summary.comparisonMarkdownPath,
          cycleSummaryPath: path.join(cycleSummaryBaseDir, 'cycle-summary.md'),
          comparison: summary.comparison,
        });
      }
    }
  }
}

async function runCompareOnly(args) {
  if (!args.pack) {
    throw new Error('--compare-only requires --pack');
  }
  if (!args.runDir) {
    throw new Error('--compare-only requires --run-dir');
  }

  const pack = await loadPackDefinition(args.pack);
  const curationTemplatePath = path.join(args.runDir, 'curation-template.json');
  const cycleSummaryPath = path.join(args.runDir, 'cycle-summary.md');
  const prompts = JSON.parse(await fs.readFile(curationTemplatePath, 'utf8')).map((entry) => entry.prompt);
  const baselineBundle = await loadBaselineBundle({
    baselineMode: args.baseline,
    pack,
    prompts,
  });

  await annotateCurationTemplate(curationTemplatePath, baselineBundle);
  const curationEntries = JSON.parse(await fs.readFile(curationTemplatePath, 'utf8'));
  const comparison = await buildPackComparison({
    pack,
    curationEntries,
    baselineBundle,
  });

  const comparisonJsonPath = path.join(args.runDir, 'baseline-comparison.json');
  const comparisonMarkdownPath = path.join(args.runDir, 'baseline-comparison.md');
  await fs.writeFile(comparisonJsonPath, `${JSON.stringify(comparison, null, 2)}\n`);
  await fs.writeFile(comparisonMarkdownPath, renderComparisonMarkdown(comparison));

  const cycleSummary = {
    generatedAt: new Date().toISOString(),
    mode: 'compare_only',
    area: pack.area,
    sections: pack.sectionRefs?.join(',') || null,
    origin: 'n/a',
    baselineMode: args.baseline,
    maxPrompts: prompts.length,
    packs: [
      {
        packKey: pack.packKey,
        label: pack.label,
        packType: pack.packType,
        promptCount: prompts.length,
        sourceDir: args.runDir,
        writeDir: args.runDir,
        curationTemplatePath,
        comparisonStatus: comparison.status,
        averageDelta: comparison.averageDelta ?? null,
        weakFailureDelta: comparison.weakFailureDelta ?? null,
      },
    ],
  };
  const cycleSummaryMarkdown = renderCycleSummaryMarkdown(cycleSummary);
  await fs.writeFile(path.join(args.runDir, 'cycle-summary.json'), `${JSON.stringify(cycleSummary, null, 2)}\n`);
  await fs.writeFile(cycleSummaryPath, `${cycleSummaryMarkdown}\n`);

  console.log(`Pack ${pack.packKey}: ${comparison.status}`);
  console.log(`- Curation: ${curationTemplatePath}`);
  console.log(`- Comparison: ${comparisonMarkdownPath}`);
  console.log(`- Cycle summary: ${cycleSummaryPath}`);

  if (args.statusDoc) {
    await updateStatusDocAfterRun({
      statusDocPath: args.statusDoc,
      pack,
      origin: 'compare-only',
      mode: 'compare_only',
      writeDir: args.runDir,
      curationTemplatePath,
      comparisonMarkdownPath,
      cycleSummaryPath,
      comparison,
    });
  }
}

function parseArgs(argv) {
  const args = {
    mode: 'mini',
    area: null,
    sections: null,
    origin: 'live',
    baseline: 'blessed',
    maxPrompts: 0,
    outDir: null,
    fromResults: null,
    compareOnly: false,
    pack: null,
    runDir: null,
    statusDoc: DEFAULT_STATUS_DOC_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--compare-only') {
      args.compareOnly = true;
      continue;
    }
    if (arg === '--mode') {
      args.mode = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--area') {
      args.area = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--sections') {
      args.sections = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--origin') {
      args.origin = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--baseline') {
      args.baseline = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--max-prompts') {
      args.maxPrompts = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--out-dir') {
      args.outDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--from-results') {
      args.fromResults = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--pack') {
      args.pack = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--run-dir') {
      args.runDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--status-doc') {
      args.statusDoc = argv[index + 1];
      index += 1;
      continue;
    }
  }

  if (!args.compareOnly && !['mini', 'golden', 'section', 'full'].includes(args.mode)) {
    throw new Error(`Unsupported --mode value: ${args.mode}`);
  }
  if (!['blessed', 'latest', 'none'].includes(args.baseline)) {
    throw new Error(`Unsupported --baseline value: ${args.baseline}`);
  }

  return args;
}

function resolveOrigin(origin) {
  if (!origin || origin === 'live') {
    return process.env.CHAT_EVAL_ORIGIN || DEFAULT_LIVE_ORIGIN;
  }
  if (origin === 'local') {
    return DEFAULT_LOCAL_ORIGIN;
  }
  return origin;
}

function buildCycleBaseOutDir(args, descriptors) {
  if (args.fromResults && !args.outDir) {
    return null;
  }

  if (args.outDir) {
    return descriptors.length > 1 ? args.outDir : null;
  }

  const slugBits = [args.mode];
  if (args.area) slugBits.push(args.area);
  if (args.sections) slugBits.push(`sections-${args.sections}`);
  if (!args.area && !args.sections && args.mode === 'full') slugBits.push('active-1-5');

  return buildDefaultOutDir(path.join('cycles', slugBits.join('-')).replace(/\\/g, '/'));
}

function resolvePackOutDir({ args, descriptor, cycleBaseOutDir, multiplePacks }) {
  if (args.fromResults) {
    return args.outDir;
  }
  if (args.outDir && !multiplePacks) {
    return args.outDir;
  }
  if (cycleBaseOutDir) {
    return path.join(cycleBaseOutDir, descriptor.defaultOutDirPrefix);
  }
  return undefined;
}

function renderCycleSummaryMarkdown(summary) {
  const lines = [];
  lines.push('# Chat Eval Cycle Summary');
  lines.push('');
  lines.push(`- Generated: ${summary.generatedAt}`);
  lines.push(`- Mode: \`${summary.mode}\``);
  if (summary.area) {
    lines.push(`- Area: \`${summary.area}\``);
  }
  if (summary.sections) {
    lines.push(`- Sections: \`${summary.sections}\``);
  }
  lines.push(`- Origin: ${summary.origin}`);
  lines.push(`- Baseline mode: \`${summary.baselineMode}\``);
  lines.push(`- Max prompts override: ${summary.maxPrompts || 'none'}`);
  lines.push('');
  lines.push('| Pack | Type | Prompts | Status | Avg Delta | Weak+Failure Delta | Output |');
  lines.push('|---|---|---:|---|---:|---:|---|');
  for (const pack of summary.packs) {
    lines.push(
      `| \`${pack.packKey}\` | \`${pack.packType}\` | ${pack.promptCount} | \`${pack.comparisonStatus}\` | ${formatSigned(pack.averageDelta)} | ${formatSigned(pack.weakFailureDelta)} | \`${pack.writeDir}\` |`
    );
  }
  return lines.join('\n');
}

function formatSigned(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(1)}` : '-';
}

async function updateStatusDocAfterRun({
  statusDocPath,
  pack,
  origin,
  mode,
  writeDir,
  curationTemplatePath,
  comparisonMarkdownPath,
  cycleSummaryPath,
  comparison,
}) {
  const state = await loadStatusState(statusDocPath);
  const isLocal = isLocalOrigin(origin);
  const updatedState = recordEvidence(state, {
    area: pack.area,
    packKey: pack.packKey,
    packType: pack.packType,
    mode,
    origin,
    writeDir,
    curationTemplatePath,
    comparisonMarkdownPath,
    cycleSummaryPath,
    comparisonStatus: comparison.status,
  });

  if (updatedState.activeCycle && updatedState.activeCycle.area === pack.area) {
    const activeCycle = { ...updatedState.activeCycle };
    activeCycle.curationTemplatePath = curationTemplatePath;
    activeCycle.comparisonPath = comparisonMarkdownPath;
    activeCycle.cycleSummaryPath = cycleSummaryPath || activeCycle.cycleSummaryPath;
    activeCycle.lastUpdatedAt = new Date().toISOString();

    if (mode === 'compare_only') {
      activeCycle.checklist = {
        ...activeCycle.checklist,
        compareOnlyCompleted: comparison.status !== 'awaiting_curation',
      };
      if (comparison.status !== 'awaiting_curation') {
        activeCycle.phase = 'acceptance_pending';
      }
    } else if (isLocal) {
      activeCycle.localRunDir = writeDir;
      activeCycle.checklist = {
        ...activeCycle.checklist,
        localMiniCompleted: true,
      };
      activeCycle.phase = 'local_mini_review';
    } else {
      activeCycle.goldenRunDir = writeDir;
      activeCycle.checklist = {
        ...activeCycle.checklist,
        goldenRunCompleted: true,
      };
      activeCycle.phase = 'golden_review';
    }

    updatedState.activeCycle = activeCycle;
  }

  await saveStatusState(updatedState, statusDocPath);
}

function isLocalOrigin(origin) {
  return typeof origin === 'string' && /localhost|127\.0\.0\.1/.test(origin);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
