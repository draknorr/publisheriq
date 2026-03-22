#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPackDefinition } from './lib/prompt-packs.mjs';
import { parseCommonArgs, runPackSuite } from './lib/suite-runner.mjs';

const PACK_KEY = 'full.section-6';

export const SUITE_ROWS = (await loadPackDefinition(PACK_KEY)).entries;

export async function main() {
  const args = parseCommonArgs(process.argv.slice(2));
  const summary = await runPackSuite({
    packKey: PACK_KEY,
    fromResults: args.fromResults,
    outDir: args.outDir,
    origin: args.origin,
    maxPrompts: args.maxPrompts,
  });

  console.log(`Draft run markdown: ${summary.draftRunPath}`);
  console.log(`Curation template: ${summary.curationTemplatePath}`);
  console.log(`Run summary: ${summary.runSummaryPath}`);
  console.log(`Raw artifacts: ${summary.sourceDir}`);
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
