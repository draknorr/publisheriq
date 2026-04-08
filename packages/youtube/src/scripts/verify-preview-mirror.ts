import type { Pool } from 'pg';

import { loadYoutubeConfig } from '../config.js';
import { createPgPool, closePools } from '../db.js';

interface MirrorCheckResult {
  max_time: string | null;
  min_time: string | null;
  row_count: number;
}

interface MirrorCheckDefinition {
  label: string;
  sql: string;
}

const CHECKS: MirrorCheckDefinition[] = [
  {
    label: 'docs.youtube_videos',
    sql: `
      SELECT
        count(*)::int AS row_count,
        min(published_at)::text AS min_time,
        max(last_hydrated_at)::text AS max_time
      FROM docs.youtube_videos
    `,
  },
  {
    label: 'docs.youtube_channels',
    sql: `
      SELECT
        count(*)::int AS row_count,
        min(published_at)::text AS min_time,
        max(last_hydrated_at)::text AS max_time
      FROM docs.youtube_channels
    `,
  },
  {
    label: 'docs.youtube_video_matches',
    sql: `
      SELECT
        count(*)::int AS row_count,
        min(matched_at)::text AS min_time,
        max(last_decision_at)::text AS max_time
      FROM docs.youtube_video_matches
    `,
  },
  {
    label: 'events.youtube_search_hits_30d',
    sql: `
      SELECT
        count(*)::int AS row_count,
        min(captured_at)::text AS min_time,
        max(captured_at)::text AS max_time
      FROM events.youtube_search_hits
      WHERE captured_at >= now() - INTERVAL '30 days'
    `,
  },
  {
    label: 'events.youtube_match_decisions_30d',
    sql: `
      SELECT
        count(*)::int AS row_count,
        min(decided_at)::text AS min_time,
        max(decided_at)::text AS max_time
      FROM events.youtube_match_decisions
      WHERE decided_at >= now() - INTERVAL '30 days'
    `,
  },
  {
    label: 'metrics.youtube_video_snapshots_30d',
    sql: `
      SELECT
        count(*)::int AS row_count,
        min(snapshot_time)::text AS min_time,
        max(snapshot_time)::text AS max_time
      FROM metrics.youtube_video_snapshots
      WHERE snapshot_time >= now() - INTERVAL '30 days'
    `,
  },
  {
    label: 'metrics.youtube_game_daily_30d',
    sql: `
      SELECT
        count(*)::int AS row_count,
        min(metric_date)::text AS min_time,
        max(metric_date)::text AS max_time
      FROM metrics.youtube_game_daily
      WHERE metric_date >= current_date - INTERVAL '30 days'
    `,
  },
];

async function queryCheck(pool: Pool, sql: string): Promise<MirrorCheckResult> {
  const result = await pool.query<MirrorCheckResult>(sql);
  const row = result.rows[0];
  return {
    max_time: row?.max_time ?? null,
    min_time: row?.min_time ?? null,
    row_count: row?.row_count ?? 0,
  };
}

async function main(): Promise<void> {
  const config = loadYoutubeConfig();
  const previewConnectionString = config.targetConnectionString;
  const productionConnectionString = config.mirrorSourceConnectionString;

  if (!productionConnectionString) {
    throw new Error('Missing YOUTUBE_MIRROR_SOURCE_URL or DATA_PLANE_SOURCE_URL for mirror verification.');
  }

  const previewPool = createPgPool({
    applicationName: 'publisheriq-youtube-verify-preview',
    connectionString: previewConnectionString,
    statementTimeoutMs: config.statementTimeoutMs,
  });
  const productionPool = createPgPool({
    applicationName: 'publisheriq-youtube-verify-production',
    connectionString: productionConnectionString,
    statementTimeoutMs: config.statementTimeoutMs,
  });

  try {
    const rows = await Promise.all(
      CHECKS.map(async (check) => {
        const [production, preview] = await Promise.all([
          queryCheck(productionPool, check.sql),
          queryCheck(previewPool, check.sql),
        ]);

        return {
          label: check.label,
          preview,
          production,
        };
      })
    );

    console.table(
      rows.map((row) => ({
        check: row.label,
        preview_max_time: row.preview.max_time ?? '-',
        preview_min_time: row.preview.min_time ?? '-',
        preview_rows: row.preview.row_count,
        production_max_time: row.production.max_time ?? '-',
        production_min_time: row.production.min_time ?? '-',
        production_rows: row.production.row_count,
      }))
    );

    const mismatches = rows.filter((row) =>
      row.preview.row_count !== row.production.row_count
      || row.preview.max_time !== row.production.max_time
      || row.preview.min_time !== row.production.min_time
    );

    if (mismatches.length > 0) {
      console.error('\nPreview mirror verification failed.');
      for (const mismatch of mismatches) {
        console.error(
          `- ${mismatch.label}: preview rows=${mismatch.preview.row_count}, production rows=${mismatch.production.row_count}, preview max=${mismatch.preview.max_time ?? '-'}, production max=${mismatch.production.max_time ?? '-'}`
        );
      }
      process.exitCode = 1;
      return;
    }

    console.log('\nPreview mirror verification passed.');
  } finally {
    await closePools([previewPool, productionPool]);
  }
}

await main();
