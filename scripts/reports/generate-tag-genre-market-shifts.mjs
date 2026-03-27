import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPORT_TZ = 'America/Los_Angeles';
const PSQL_BIN = '/opt/homebrew/opt/libpq/bin/psql';
const FIELD_SEPARATOR = '\u001f';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const REPORT_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const REPORT_SLUG = `tag-genre-market-shifts-${REPORT_DATE}`;
const SQL_PATH = path.join(REPO_ROOT, 'docs', 'reports', 'sql', `${REPORT_SLUG}.sql`);
const RAW_CSV_PATH = path.join(
  REPO_ROOT,
  'docs',
  'reports',
  'data',
  `${REPORT_SLUG.replace(`-${REPORT_DATE}`, '')}-daily-raw-${REPORT_DATE}.csv`
);
const THEME_CSV_PATH = path.join(
  REPO_ROOT,
  'docs',
  'reports',
  'data',
  `${REPORT_SLUG.replace(`-${REPORT_DATE}`, '')}-daily-themes-${REPORT_DATE}.csv`
);
const SUMMARY_CSV_PATH = path.join(
  REPO_ROOT,
  'docs',
  'reports',
  'data',
  `${REPORT_SLUG.replace(`-${REPORT_DATE}`, '')}-summary-${REPORT_DATE}.csv`
);
const TREND_CSV_PATH = path.join(
  REPO_ROOT,
  'docs',
  'reports',
  'data',
  `${REPORT_SLUG.replace(`-${REPORT_DATE}`, '')}-visual-metrics-${REPORT_DATE}.csv`
);
const MD_PATH = path.join(REPO_ROOT, 'docs', 'reports', `${REPORT_SLUG}.md`);
const HTML_PATH = path.join(REPO_ROOT, 'docs', 'reports', `${REPORT_SLUG}.html`);
const TRUE_ENV_VALUES = new Set(['1', 'true', 'TRUE', 'yes', 'YES']);

const THEME_VALUES = [
  ['indie', 'Indie & Casual'],
  ['casual', 'Indie & Casual'],
  ['cozy', 'Indie & Casual'],
  ['cute', 'Indie & Casual'],
  ['family friendly', 'Indie & Casual'],
  ['funny', 'Indie & Casual'],
  ['comedy', 'Indie & Casual'],
  ['relaxing', 'Indie & Casual'],
  ['colorful', 'Indie & Casual'],
  ['action', 'Action & Combat'],
  ['action-adventure', 'Action & Combat'],
  ['arcade', 'Action & Combat'],
  ['combat', 'Action & Combat'],
  ['third person', 'Action & Combat'],
  ['top-down', 'Action & Combat'],
  ['difficult', 'Action & Combat'],
  ['adventure', 'Adventure & Story'],
  ['story rich', 'Adventure & Story'],
  ['choices matter', 'Adventure & Story'],
  ['exploration', 'Adventure & Story'],
  ['strategy', 'Strategy & Management'],
  ['management', 'Strategy & Management'],
  ['simulation', 'Simulation & Sandbox'],
  ['sandbox', 'Simulation & Sandbox'],
  ['physics', 'Simulation & Sandbox'],
  ['job simulator', 'Simulation & Sandbox'],
  ['rpg', 'RPG & Fantasy'],
  ['fantasy', 'RPG & Fantasy'],
  ['roguelite', 'RPG & Fantasy'],
  ['medieval', 'RPG & Fantasy'],
  ['character customization', 'RPG & Fantasy'],
  ['singleplayer', 'Play Modes & Social'],
  ['multiplayer', 'Play Modes & Social'],
  ['co-op', 'Play Modes & Social'],
  ['online co-op', 'Play Modes & Social'],
  ['party game', 'Play Modes & Social'],
  ['massively multiplayer', 'Play Modes & Social'],
  ['2d', 'Visual & Format'],
  ['3d', 'Visual & Format'],
  ['stylized', 'Visual & Format'],
  ['pixel graphics', 'Visual & Format'],
  ['retro', 'Visual & Format'],
  ['early access', 'Lifecycle & Business Model'],
  ['free to play', 'Lifecycle & Business Model'],
  ['atmospheric', 'Atmosphere & Horror'],
  ['dark', 'Atmosphere & Horror'],
  ['psychological horror', 'Atmosphere & Horror'],
  ['sports', 'Sports & Racing'],
  ['racing', 'Sports & Racing'],
  ['artificial intelligence', 'Tech & AI'],
];

const THEME_LOOKUP = new Map(THEME_VALUES);
const THEME_ORDER = [...new Set(THEME_VALUES.map(([, theme]) => theme)), 'Other'];
const THEME_COLORS = new Map([
  ['Indie & Casual', '#6f8f72'],
  ['Action & Combat', '#b35c44'],
  ['Adventure & Story', '#3f6f8f'],
  ['Strategy & Management', '#9b7a3e'],
  ['Simulation & Sandbox', '#6e7f54'],
  ['RPG & Fantasy', '#7a5f9a'],
  ['Play Modes & Social', '#4b8c8c'],
  ['Visual & Format', '#9f6b58'],
  ['Lifecycle & Business Model', '#8a6c3c'],
  ['Atmosphere & Horror', '#6a5a7a'],
  ['Sports & Racing', '#5c7d5c'],
  ['Tech & AI', '#4f668d'],
  ['Other', '#7b7b7b'],
]);

function parseDotEnv(envPath) {
  const contents = fs.readFileSync(envPath, 'utf8');
  const env = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let [, key, value] = match;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function getRuntimeEnv() {
  return {
    ...parseDotEnv(path.join(REPO_ROOT, '.env')),
    ...process.env,
  };
}

function isTruthyEnv(value, defaultValue = false) {
  if (value == null) {
    return defaultValue;
  }
  return TRUE_ENV_VALUES.has(String(value));
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const THEME_MAP_SQL = THEME_VALUES.map(
  ([labelKey, theme]) => `(${sqlString(labelKey)}, ${sqlString(theme)})`
).join(',\n    ');

const COMMON_CTE = `
WITH source_events AS (
  SELECT
    e.appid,
    a.name AS app_name,
    a.is_released,
    e.occurred_at,
    'tag'::text AS dimension_type,
    'add'::text AS direction,
    COALESCE(st.name, x.value) AS label_display_raw
  FROM app_change_events e
  JOIN apps a ON a.appid = e.appid
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(e.context -> 'added', '[]'::jsonb)) AS x(value)
  LEFT JOIN steam_tags st
    ON st.tag_id = CASE WHEN x.value ~ '^[0-9]+$' THEN x.value::int ELSE NULL END
  WHERE a.type = 'game'
    AND e.change_type = 'tags_added'

  UNION ALL

  SELECT
    e.appid,
    a.name AS app_name,
    a.is_released,
    e.occurred_at,
    'tag'::text AS dimension_type,
    'remove'::text AS direction,
    COALESCE(st.name, x.value) AS label_display_raw
  FROM app_change_events e
  JOIN apps a ON a.appid = e.appid
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(e.context -> 'removed', '[]'::jsonb)) AS x(value)
  LEFT JOIN steam_tags st
    ON st.tag_id = CASE WHEN x.value ~ '^[0-9]+$' THEN x.value::int ELSE NULL END
  WHERE a.type = 'game'
    AND e.change_type = 'tags_removed'

  UNION ALL

  SELECT
    e.appid,
    a.name AS app_name,
    a.is_released,
    e.occurred_at,
    'genre'::text AS dimension_type,
    'add'::text AS direction,
    COALESCE(sg.name, x.value) AS label_display_raw
  FROM app_change_events e
  JOIN apps a ON a.appid = e.appid
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(e.context -> 'added', '[]'::jsonb)) AS x(value)
  LEFT JOIN steam_genres sg
    ON sg.genre_id = CASE WHEN x.value ~ '^[0-9]+$' THEN x.value::int ELSE NULL END
  WHERE a.type = 'game'
    AND e.change_type = 'genres_changed'

  UNION ALL

  SELECT
    e.appid,
    a.name AS app_name,
    a.is_released,
    e.occurred_at,
    'genre'::text AS dimension_type,
    'remove'::text AS direction,
    COALESCE(sg.name, x.value) AS label_display_raw
  FROM app_change_events e
  JOIN apps a ON a.appid = e.appid
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(e.context -> 'removed', '[]'::jsonb)) AS x(value)
  LEFT JOIN steam_genres sg
    ON sg.genre_id = CASE WHEN x.value ~ '^[0-9]+$' THEN x.value::int ELSE NULL END
  WHERE a.type = 'game'
    AND e.change_type = 'genres_changed'
),
normalized_events AS (
  SELECT
    appid,
    app_name,
    is_released,
    occurred_at,
    (occurred_at AT TIME ZONE '${REPORT_TZ}')::date AS day_pt,
    dimension_type,
    direction,
    CASE
      WHEN lower(regexp_replace(btrim(label_display_raw), '\\s+', ' ', 'g')) = 'free to play'
        THEN 'free to play'
      ELSE lower(regexp_replace(btrim(label_display_raw), '\\s+', ' ', 'g'))
    END AS label_key,
    CASE
      WHEN lower(regexp_replace(btrim(label_display_raw), '\\s+', ' ', 'g')) = 'free to play'
        THEN 'Free to Play'
      ELSE btrim(label_display_raw)
    END AS label_display
  FROM source_events
  WHERE label_display_raw IS NOT NULL
    AND btrim(label_display_raw) <> ''
),
raw_dedup AS (
  SELECT
    appid,
    MIN(app_name) AS app_name,
    BOOL_OR(is_released) AS is_released,
    day_pt,
    dimension_type,
    label_key,
    MIN(label_display) AS label_display,
    MAX(occurred_at) AS latest_occurred_at,
    BOOL_OR(direction = 'add') AS has_add,
    BOOL_OR(direction = 'remove') AS has_remove
  FROM normalized_events
  GROUP BY appid, day_pt, dimension_type, label_key
),
raw_directional AS (
  SELECT
    appid,
    app_name,
    is_released,
    day_pt,
    latest_occurred_at,
    dimension_type,
    label_key,
    label_display,
    'add'::text AS direction
  FROM raw_dedup
  WHERE has_add = TRUE
    AND has_remove = FALSE

  UNION ALL

  SELECT
    appid,
    app_name,
    is_released,
    day_pt,
    latest_occurred_at,
    dimension_type,
    label_key,
    label_display,
    'remove'::text AS direction
  FROM raw_dedup
  WHERE has_add = FALSE
    AND has_remove = TRUE
),
window_bounds AS (
  SELECT
    MIN(latest_occurred_at) AS window_start_utc,
    MAX(latest_occurred_at) AS window_end_utc,
    MIN(day_pt) AS window_start_pt,
    MAX(day_pt) AS window_end_pt
  FROM raw_directional
),
calendar AS (
  SELECT
    generate_series(window_start_pt, window_end_pt, INTERVAL '1 day')::date AS day_pt
  FROM window_bounds
),
raw_daily AS (
  SELECT
    day_pt,
    dimension_type,
    label_key,
    MIN(label_display) AS label_display,
    COUNT(*) FILTER (WHERE direction = 'add')::int AS adds,
    COUNT(*) FILTER (WHERE direction = 'remove')::int AS removes,
    COUNT(*)::int AS total_moves
  FROM raw_directional
  GROUP BY day_pt, dimension_type, label_key
),
raw_labels AS (
  SELECT
    dimension_type,
    label_key,
    MIN(label_display) AS label_display
  FROM raw_directional
  GROUP BY dimension_type, label_key
),
raw_series AS (
  SELECT
    c.day_pt,
    l.dimension_type,
    l.label_key,
    l.label_display,
    COALESCE(rd.adds, 0)::int AS adds,
    COALESCE(rd.removes, 0)::int AS removes,
    (COALESCE(rd.adds, 0) - COALESCE(rd.removes, 0))::int AS net_apps,
    COALESCE(rd.total_moves, 0)::int AS total_moves,
    SUM(COALESCE(rd.adds, 0) - COALESCE(rd.removes, 0)) OVER (
      PARTITION BY l.dimension_type, l.label_key
      ORDER BY c.day_pt
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::int AS cumulative_net_apps
  FROM calendar c
  CROSS JOIN raw_labels l
  LEFT JOIN raw_daily rd
    ON rd.day_pt = c.day_pt
   AND rd.dimension_type = l.dimension_type
   AND rd.label_key = l.label_key
),
theme_map(label_key, theme) AS (
  VALUES
    ${THEME_MAP_SQL}
),
theme_directional AS (
  SELECT
    r.appid,
    MIN(r.app_name) AS app_name,
    r.day_pt,
    COALESCE(tm.theme, 'Other') AS theme,
    r.direction
  FROM raw_directional r
  LEFT JOIN theme_map tm
    ON tm.label_key = r.label_key
  GROUP BY r.appid, r.day_pt, COALESCE(tm.theme, 'Other'), r.direction
),
theme_daily AS (
  SELECT
    day_pt,
    theme,
    COUNT(*) FILTER (WHERE direction = 'add')::int AS adds,
    COUNT(*) FILTER (WHERE direction = 'remove')::int AS removes,
    COUNT(*)::int AS total_moves
  FROM theme_directional
  GROUP BY day_pt, theme
),
theme_labels AS (
  SELECT DISTINCT theme
  FROM theme_directional
),
theme_series AS (
  SELECT
    c.day_pt,
    t.theme,
    COALESCE(td.adds, 0)::int AS adds,
    COALESCE(td.removes, 0)::int AS removes,
    (COALESCE(td.adds, 0) - COALESCE(td.removes, 0))::int AS net_apps,
    COALESCE(td.total_moves, 0)::int AS total_moves,
    SUM(COALESCE(td.adds, 0) - COALESCE(td.removes, 0)) OVER (
      PARTITION BY t.theme
      ORDER BY c.day_pt
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::int AS cumulative_net_apps
  FROM calendar c
  CROSS JOIN theme_labels t
  LEFT JOIN theme_daily td
    ON td.day_pt = c.day_pt
   AND td.theme = t.theme
),
raw_samples AS (
  SELECT
    dimension_type,
    label_key,
    STRING_AGG(app_name, ', ' ORDER BY latest_day DESC, app_name) AS sample_apps
  FROM (
    SELECT
      dimension_type,
      label_key,
      app_name,
      MAX(day_pt) AS latest_day,
      ROW_NUMBER() OVER (
        PARTITION BY dimension_type, label_key
        ORDER BY MAX(day_pt) DESC, app_name
      ) AS rn
    FROM raw_directional
    GROUP BY dimension_type, label_key, app_name
  ) ranked
  WHERE rn <= 3
  GROUP BY dimension_type, label_key
),
theme_samples AS (
  SELECT
    theme,
    STRING_AGG(app_name, ', ' ORDER BY latest_day DESC, app_name) AS sample_apps
  FROM (
    SELECT
      theme,
      app_name,
      MAX(day_pt) AS latest_day,
      ROW_NUMBER() OVER (
        PARTITION BY theme
        ORDER BY MAX(day_pt) DESC, app_name
      ) AS rn
    FROM theme_directional
    GROUP BY theme, app_name
  ) ranked
  WHERE rn <= 3
  GROUP BY theme
),
raw_totals AS (
  SELECT
    'all-games'::text AS scope,
    CASE
      WHEN dimension_type = 'tag' THEN 'raw-tag'
      ELSE 'raw-genre'
    END AS series_type,
    dimension_type,
    label_key,
    MIN(label_display) AS label,
    SUM(adds)::int AS adds,
    SUM(removes)::int AS removes,
    SUM(net_apps)::int AS net_apps,
    SUM(total_moves)::int AS total_moves
  FROM raw_series
  GROUP BY dimension_type, label_key
),
theme_totals AS (
  SELECT
    'all-games'::text AS scope,
    'theme'::text AS series_type,
    'theme'::text AS dimension_type,
    lower(theme) AS label_key,
    theme AS label,
    SUM(adds)::int AS adds,
    SUM(removes)::int AS removes,
    SUM(net_apps)::int AS net_apps,
    SUM(total_moves)::int AS total_moves
  FROM theme_series
  GROUP BY theme
),
summary AS (
  SELECT
    rt.scope,
    rt.series_type,
    rt.label,
    rt.adds,
    rt.removes,
    rt.net_apps,
    rt.total_moves,
    COALESCE(rs.sample_apps, '') AS sample_apps
  FROM raw_totals rt
  LEFT JOIN raw_samples rs
    ON rs.dimension_type = rt.dimension_type
   AND rs.label_key = rt.label_key

  UNION ALL

  SELECT
    tt.scope,
    tt.series_type,
    tt.label,
    tt.adds,
    tt.removes,
    tt.net_apps,
    tt.total_moves,
    COALESCE(ts.sample_apps, '') AS sample_apps
  FROM theme_totals tt
  LEFT JOIN theme_samples ts
    ON ts.theme = tt.label
)
`;

const METADATA_SQL = `
${COMMON_CTE}
SELECT
  window_start_utc,
  window_end_utc,
  window_start_pt,
  window_end_pt,
  (SELECT COUNT(DISTINCT appid) FROM raw_directional)::int AS games_touched,
  (SELECT COUNT(*) FROM raw_directional WHERE dimension_type = 'tag')::int AS raw_tag_moves,
  (SELECT COUNT(*) FROM raw_directional WHERE dimension_type = 'genre')::int AS raw_genre_moves
FROM window_bounds;
`.trim();

const RAW_EXPORT_SQL = `
${COMMON_CTE}
SELECT
  day_pt,
  dimension_type,
  label_key,
  label_display,
  adds,
  removes,
  net_apps,
  cumulative_net_apps,
  total_moves
FROM raw_series
ORDER BY dimension_type, label_display, day_pt;
`.trim();

const THEME_EXPORT_SQL = `
${COMMON_CTE}
SELECT
  day_pt,
  theme,
  adds,
  removes,
  net_apps,
  cumulative_net_apps,
  total_moves
FROM theme_series
ORDER BY theme, day_pt;
`.trim();

const SUMMARY_SQL = `
${COMMON_CTE}
SELECT
  scope,
  series_type,
  label,
  adds,
  removes,
  net_apps,
  total_moves,
  sample_apps
FROM summary
ORDER BY series_type, total_moves DESC, ABS(net_apps) DESC, label;
`.trim();

function buildSqlArtifact() {
  return `-- ${REPORT_SLUG}
-- Purpose:
-- Aggregate tag and genre change history for all game-type apps,
-- export raw daily series, theme daily series, and summary tables,
-- and support a one-off report with CSV outputs.
--
-- Reporting timezone: ${REPORT_TZ}
-- Scope:
-- - apps.type = 'game'
-- - includes released and prerelease games
-- - excludes categories
-- - cancels same-day same-label add/remove churn per app

-- Metadata
${METADATA_SQL}

-- Daily raw series
${RAW_EXPORT_SQL}

-- Daily theme series
${THEME_EXPORT_SQL}

-- Summary
${SUMMARY_SQL}
`;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function getDatabaseUrl() {
  const env = getRuntimeEnv();
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in .env');
  }
  return databaseUrl;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return 'text/csv; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  if (ext === '.sql') return 'application/sql; charset=utf-8';
  return 'application/octet-stream';
}

async function uploadArtifactsToStorage(filePaths) {
  const env = getRuntimeEnv();
  if (!isTruthyEnv(env.REPORT_UPLOAD_TO_STORAGE, true)) {
    return [];
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    console.warn('Skipping report upload because SUPABASE_URL or SUPABASE_SERVICE_KEY is missing.');
    return [];
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const bucket = env.REPORT_STORAGE_BUCKET || 'reports';
  const prefix = env.REPORT_STORAGE_PREFIX || 'reports';
  const uploaded = [];

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const objectPath = `${prefix}/${REPORT_SLUG}/${REPORT_DATE}/${path.basename(filePath)}`;
    const { error } = await supabase.storage.from(bucket).upload(objectPath, fs.readFileSync(filePath), {
      contentType: getContentType(filePath),
      cacheControl: '31536000',
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload ${path.basename(filePath)} to Storage: ${error.message}`);
    }

    uploaded.push(`${bucket}/${objectPath}`);
  }

  return uploaded;
}

function runPsql(sql, mode = 'rows') {
  const databaseUrl = getDatabaseUrl();
  const args = [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1'];
  const trimmedSql = sql.trim().replace(/;$/, '');

  if (mode === 'rows') {
    args.push('-A', '-F', FIELD_SEPARATOR, '-P', 'footer=off', '-c', trimmedSql);
  } else if (mode === 'csv') {
    args.push('-c', `COPY (${trimmedSql}) TO STDOUT WITH CSV HEADER`);
  } else {
    throw new Error(`Unsupported psql mode: ${mode}`);
  }

  return execFileSync(PSQL_BIN, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
  });
}

function queryRows(sql) {
  const raw = runPsql(sql, 'rows').trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/).filter(Boolean);
  const [headerLine, ...rowLines] = lines;
  const headers = headerLine.split(FIELD_SEPARATOR);

  return rowLines.map((line) => {
    const values = line.split(FIELD_SEPARATOR);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function exportCsv(sql, filePath) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, runPsql(sql, 'csv'), 'utf8');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatNumber(value) {
  return Number(value).toLocaleString('en-US');
}

function formatDecimal(value, digits = 2) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatSigned(value) {
  const num = Number(value);
  return `${num >= 0 ? '+' : ''}${num.toLocaleString('en-US')}`;
}

function formatSignedDecimal(value, digits = 2) {
  const num = Number(value);
  return `${num >= 0 ? '+' : ''}${formatDecimal(num, digits)}`;
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function csvEscape(value) {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function writeCsv(filePath, headers, rows) {
  ensureDir(filePath);
  const contents = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');
  fs.writeFileSync(filePath, `${contents}\n`, 'utf8');
}

function summarizeDateRange(days) {
  if (days.length === 0) return 'n/a';
  if (days.length === 1) return days[0];
  return `${days[0]} to ${days[days.length - 1]}`;
}

function getSortedDays(rows) {
  return [...new Set(rows.map((row) => row.day_pt))].sort();
}

function getWindowSegments(days) {
  const segmentSize = Math.max(1, Math.floor(days.length / 3));
  const earlyDays = days.slice(0, segmentSize);
  const lateDays = days.slice(days.length - segmentSize);
  return {
    allDays: days,
    segmentSize,
    earlyDays,
    lateDays,
    earlyLabel: summarizeDateRange(earlyDays),
    lateLabel: summarizeDateRange(lateDays),
  };
}

function buildSummaryLookup(summaryRows) {
  return new Map(summaryRows.map((row) => [`${row.series_type}::${row.label}`, row]));
}

function buildTrendMetrics(rows, {
  seriesType,
  labelField,
  labelKeyField = null,
  dimensionType,
  groupLabelForRow,
  summaryLookup,
  segments,
}) {
  const grouped = new Map();

  for (const row of rows) {
    const label = row[labelField];
    if (!grouped.has(label)) {
      grouped.set(label, {
        label,
        labelKey: labelKeyField ? row[labelKeyField] : label.toLowerCase(),
        groupLabel: groupLabelForRow(row),
        byDay: new Map(),
      });
    }

    grouped.get(label).byDay.set(row.day_pt, {
      day: row.day_pt,
      adds: Number(row.adds),
      removes: Number(row.removes),
      netApps: Number(row.net_apps),
      totalMoves: Number(row.total_moves),
      cumulativeNetApps: Number(row.cumulative_net_apps),
    });
  }

  return [...grouped.values()].map((entry) => {
    const daily = segments.allDays.map((day) => {
      const value = entry.byDay.get(day);
      if (value) return value;
      return {
        day,
        adds: 0,
        removes: 0,
        netApps: 0,
        totalMoves: 0,
        cumulativeNetApps: 0,
      };
    });

    const earlyValues = daily.slice(0, segments.segmentSize);
    const lateValues = daily.slice(daily.length - segments.segmentSize);
    const summaryRow = summaryLookup.get(`${seriesType}::${entry.label}`);

    return {
      dimensionType,
      seriesType,
      label: entry.label,
      labelKey: entry.labelKey,
      groupLabel: entry.groupLabel,
      adds: daily.reduce((sum, point) => sum + point.adds, 0),
      removes: daily.reduce((sum, point) => sum + point.removes, 0),
      windowNet: daily.reduce((sum, point) => sum + point.netApps, 0),
      totalMoves: daily.reduce((sum, point) => sum + point.totalMoves, 0),
      earlyAvgNet: average(earlyValues.map((point) => point.netApps)),
      lateAvgNet: average(lateValues.map((point) => point.netApps)),
      momentumDelta:
        average(lateValues.map((point) => point.netApps)) -
        average(earlyValues.map((point) => point.netApps)),
      sampleApps: summaryRow?.sample_apps ?? '',
      daily,
    };
  });
}

function enrichTrendMetrics(rawRows, themeRows, summaryRows) {
  const segments = getWindowSegments(getSortedDays(rawRows));
  const summaryLookup = buildSummaryLookup(summaryRows);

  const rawTagMetrics = buildTrendMetrics(
    rawRows.filter((row) => row.dimension_type === 'tag'),
    {
      seriesType: 'raw-tag',
      labelField: 'label_display',
      labelKeyField: 'label_key',
      dimensionType: 'tag',
      groupLabelForRow: (row) => THEME_LOOKUP.get(row.label_key) ?? 'Other',
      summaryLookup,
      segments,
    }
  );

  const rawGenreMetrics = buildTrendMetrics(
    rawRows.filter((row) => row.dimension_type === 'genre'),
    {
      seriesType: 'raw-genre',
      labelField: 'label_display',
      labelKeyField: 'label_key',
      dimensionType: 'genre',
      groupLabelForRow: () => 'Genres',
      summaryLookup,
      segments,
    }
  );

  const themeMetrics = buildTrendMetrics(themeRows, {
    seriesType: 'theme',
    labelField: 'theme',
    dimensionType: 'theme',
    groupLabelForRow: (row) => row.theme,
    summaryLookup,
    segments,
  });

  const trendRows = [...themeMetrics, ...rawGenreMetrics, ...rawTagMetrics].map((metric) => ({
    dimension_type: metric.dimensionType,
    series_type: metric.seriesType,
    label: metric.label,
    label_key: metric.labelKey,
    group_label: metric.groupLabel,
    adds: metric.adds,
    removes: metric.removes,
    window_net: metric.windowNet,
    total_moves: metric.totalMoves,
    early_avg_net: metric.earlyAvgNet.toFixed(4),
    late_avg_net: metric.lateAvgNet.toFixed(4),
    momentum_delta: metric.momentumDelta.toFixed(4),
    sample_apps: metric.sampleApps,
  }));

  return {
    segments,
    rawTagMetrics,
    rawGenreMetrics,
    themeMetrics,
    trendRows,
  };
}

function getThemeColor(theme) {
  return THEME_COLORS.get(theme) ?? THEME_COLORS.get('Other');
}

function renderNarrativeList(items) {
  return items
    .map((item) => `- **${item.label}**: ${item.copy}`)
    .join('\n');
}

function renderMomentumScatter(title, metrics, { annotateThreshold = 6 } = {}) {
  if (metrics.length === 0) {
    return `<section class="chart-card"><h2>${escapeHtml(title)}</h2><p>No data available.</p></section>`;
  }

  const width = 1080;
  const height = 640;
  const padding = { top: 48, right: 36, bottom: 60, left: 72 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xMax = Math.max(...metrics.map((metric) => Math.abs(metric.windowNet)), 1);
  const yMax = Math.max(...metrics.map((metric) => Math.abs(metric.momentumDelta)), 0.5);
  const xDomain = xMax * 1.15;
  const yDomain = yMax * 1.2;
  const xAt = (value) => padding.left + ((value + xDomain) / (xDomain * 2)) * chartWidth;
  const yAt = (value) => padding.top + ((yDomain - value) / (yDomain * 2)) * chartHeight;
  const xTicks = [-xDomain, -xDomain / 2, 0, xDomain / 2, xDomain];
  const yTicks = [-yDomain, -yDomain / 2, 0, yDomain / 2, yDomain];
  const labelSet = new Set(
    [...metrics]
      .filter((metric) => metric.totalMoves >= annotateThreshold)
      .sort(
        (left, right) =>
          Math.abs(right.windowNet) +
          Math.abs(right.momentumDelta) * 2 +
          right.totalMoves / 10 -
          (Math.abs(left.windowNet) + Math.abs(left.momentumDelta) * 2 + left.totalMoves / 10)
      )
      .slice(0, 18)
      .map((metric) => metric.label)
  );

  const grid = [
    ...xTicks.map((tick) => {
      const x = xAt(tick);
      return `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#ece0cf" />`;
    }),
    ...yTicks.map((tick) => {
      const y = yAt(tick);
      return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#ece0cf" />`;
    }),
  ].join('');

  const xLabels = xTicks
    .map((tick) => `<text x="${xAt(tick)}" y="${height - 18}" text-anchor="middle" font-size="11" fill="#61584f">${escapeHtml(formatSigned(Math.round(tick)))}</text>`)
    .join('');

  const yLabels = yTicks
    .map((tick) => `<text x="${padding.left - 10}" y="${yAt(tick) + 4}" text-anchor="end" font-size="11" fill="#61584f">${escapeHtml(formatSignedDecimal(tick, 1))}</text>`)
    .join('');

  const points = metrics
    .map((metric) => {
      const x = xAt(metric.windowNet);
      const y = yAt(metric.momentumDelta);
      const radius = clamp(3 + Math.sqrt(metric.totalMoves) * 0.6, 3, 16);
      const fill = getThemeColor(metric.groupLabel);
      const opacity = metric.totalMoves >= annotateThreshold ? 0.82 : 0.28;
      const label = labelSet.has(metric.label)
        ? `<text x="${x + 8}" y="${y - 8}" font-size="11" fill="#3b342d">${escapeHtml(metric.label)}</text>`
        : '';
      return `<g><circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" fill-opacity="${opacity}" stroke="#f8f4ee" stroke-width="1.2" />${label}</g>`;
    })
    .join('');

  const legend = THEME_ORDER
    .map(
      (theme) =>
        `<span class="legend-item"><span class="legend-swatch" style="background:${getThemeColor(theme)}"></span>${escapeHtml(theme)}</span>`
    )
    .join('');

  return `
    <section class="chart-card chart-card--wide">
      <div class="chart-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>
            X-axis is full-window net change. Y-axis is momentum delta, comparing the late-window daily net average to the early-window daily net average.
          </p>
        </div>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
        ${grid}
        <line x1="${xAt(0)}" y1="${padding.top}" x2="${xAt(0)}" y2="${height - padding.bottom}" stroke="#c8b59f" stroke-width="1.6" />
        <line x1="${padding.left}" y1="${yAt(0)}" x2="${width - padding.right}" y2="${yAt(0)}" stroke="#c8b59f" stroke-width="1.6" />
        ${xLabels}
        ${yLabels}
        <text x="${width / 2}" y="${height - 2}" text-anchor="middle" font-size="12" fill="#61584f">Window net change</text>
        <text x="20" y="${height / 2}" text-anchor="middle" font-size="12" fill="#61584f" transform="rotate(-90 20 ${height / 2})">Momentum delta</text>
        <text x="${padding.left + 14}" y="${padding.top + 22}" font-size="12" fill="#61584f">Recovering</text>
        <text x="${width - padding.right - 98}" y="${padding.top + 22}" font-size="12" fill="#61584f">Accelerating</text>
        <text x="${padding.left + 14}" y="${height - padding.bottom - 12}" font-size="12" fill="#61584f">Weakening</text>
        <text x="${width - padding.right - 70}" y="${height - padding.bottom - 12}" font-size="12" fill="#61584f">Cooling</text>
        ${points}
      </svg>
      <div class="legend">${legend}</div>
    </section>
  `;
}

function renderDumbbellChart(title, metrics, { earlyLabel, lateLabel, exclude = [] } = {}) {
  const excluded = new Set(exclude);
  const rows = metrics.filter((metric) => !excluded.has(metric.label));
  if (rows.length === 0) {
    return `<section class="chart-card"><h2>${escapeHtml(title)}</h2><p>No data available.</p></section>`;
  }

  const ordered = [...rows].sort(
    (left, right) => right.momentumDelta - left.momentumDelta || right.totalMoves - left.totalMoves
  );
  const width = 1040;
  const rowHeight = 34;
  const height = 90 + ordered.length * rowHeight;
  const padding = { top: 42, right: 82, bottom: 28, left: 220 };
  const chartWidth = width - padding.left - padding.right;
  const domainMax = Math.max(
    ...ordered.flatMap((metric) => [
      Math.abs(metric.earlyAvgNet),
      Math.abs(metric.lateAvgNet),
      Math.abs(metric.momentumDelta),
    ]),
    0.5
  ) * 1.2;
  const xAt = (value) => padding.left + ((value + domainMax) / (domainMax * 2)) * chartWidth;
  const ticks = [-domainMax, -domainMax / 2, 0, domainMax / 2, domainMax];

  const tickMarkup = ticks
    .map((tick) => {
      const x = xAt(tick);
      return `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#ece0cf" /><text x="${x}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#61584f">${escapeHtml(formatSignedDecimal(tick, 1))}</text>`;
    })
    .join('');

  const rowsMarkup = ordered
    .map((metric, index) => {
      const y = padding.top + 22 + index * rowHeight;
      const xStart = xAt(metric.earlyAvgNet);
      const xEnd = xAt(metric.lateAvgNet);
      const stroke = metric.momentumDelta >= 0 ? '#3a7d44' : '#b35c44';
      return `
        <g>
          <text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" font-size="12" fill="#302923">${escapeHtml(metric.label)}</text>
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f4ece0" />
          <line x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}" stroke="${stroke}" stroke-width="3" stroke-linecap="round" />
          <circle cx="${xStart}" cy="${y}" r="5.5" fill="#fdf9f2" stroke="${stroke}" stroke-width="2" />
          <circle cx="${xEnd}" cy="${y}" r="5.5" fill="${stroke}" />
          <text x="${width - padding.right + 10}" y="${y + 4}" font-size="11" fill="#61584f">${escapeHtml(formatSignedDecimal(metric.momentumDelta, 2))}</text>
        </g>
      `;
    })
    .join('');

  return `
    <section class="chart-card chart-card--wide">
      <div class="chart-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>Open dots show the early-window average daily net. Filled dots show the late-window average daily net.</p>
        </div>
        <div class="chart-head-note"><span>${escapeHtml(earlyLabel)}</span><span>${escapeHtml(lateLabel)}</span></div>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
        ${tickMarkup}
        <line x1="${xAt(0)}" y1="${padding.top}" x2="${xAt(0)}" y2="${height - padding.bottom}" stroke="#c8b59f" stroke-width="1.6" />
        <text x="${width - padding.right + 10}" y="${padding.top - 10}" font-size="11" fill="#61584f">Delta</text>
        ${rowsMarkup}
      </svg>
    </section>
  `;
}

function heatmapColor(value, maxAbs) {
  const intensity = maxAbs === 0 ? 0 : clamp(Math.abs(value) / maxAbs, 0, 1);
  if (value === 0) return 'rgba(221, 209, 191, 0.22)';
  if (value > 0) return `rgba(63, 128, 111, ${0.12 + intensity * 0.68})`;
  return `rgba(179, 92, 68, ${0.12 + intensity * 0.68})`;
}

function renderHeatmapTable(title, metrics, days) {
  const grouped = new Map();
  for (const theme of THEME_ORDER) grouped.set(theme, []);
  for (const metric of metrics) {
    if (!grouped.has(metric.groupLabel)) grouped.set(metric.groupLabel, []);
    grouped.get(metric.groupLabel).push(metric);
  }

  const maxAbsNet = Math.max(
    ...metrics.flatMap((metric) => metric.daily.map((point) => Math.abs(point.netApps))),
    1
  );
  const dayHeaders = days.map((day) => `<th>${escapeHtml(day.slice(5))}</th>`).join('');

  const groups = [...grouped.entries()]
    .filter(([, values]) => values.length > 0)
    .map(([groupLabel, values]) => {
      const rows = values
        .sort(
          (left, right) =>
            right.momentumDelta - left.momentumDelta ||
            right.windowNet - left.windowNet ||
            right.totalMoves - left.totalMoves
        )
        .map((metric) => {
          const cells = metric.daily
            .map((point) => {
              const titleText = `${metric.label} ${point.day} ${formatSigned(point.netApps)}`;
              return `<td class="heat-cell" style="background:${heatmapColor(point.netApps, maxAbsNet)}" title="${escapeHtml(titleText)}">${escapeHtml(point.netApps === 0 ? '' : formatSigned(point.netApps))}</td>`;
            })
            .join('');

          return `
            <tr>
              <td class="heat-label">${escapeHtml(metric.label)}</td>
              ${cells}
              <td class="heat-summary">${escapeHtml(formatSigned(metric.windowNet))}</td>
              <td class="heat-summary">${escapeHtml(formatSignedDecimal(metric.momentumDelta, 2))}</td>
              <td class="heat-summary">${escapeHtml(formatNumber(metric.totalMoves))}</td>
            </tr>
          `;
        })
        .join('');

      return `
        <tbody>
          <tr class="heat-group-row"><th colspan="${days.length + 4}">${escapeHtml(groupLabel)}</th></tr>
          ${rows}
        </tbody>
      `;
    })
    .join('');

  return `
    <section class="chart-card heatmap-card">
      <div class="chart-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>Every raw tag is included. Rows are grouped by theme and sorted by momentum delta within each group.</p>
        </div>
      </div>
      <div class="heatmap-wrap">
        <table class="heatmap-table">
          <thead>
            <tr>
              <th>Tag</th>
              ${dayHeaders}
              <th>Net</th>
              <th>Delta</th>
              <th>Moves</th>
            </tr>
          </thead>
          ${groups}
        </table>
      </div>
    </section>
  `;
}

function renderMetricTable(title, metrics, columns) {
  const head = columns.map((column) => `<th>${escapeHtml(column.heading)}</th>`).join('');
  const body = metrics
    .map((metric) => `<tr>${columns.map((column) => `<td>${column.render(metric)}</td>`).join('')}</tr>`)
    .join('');

  return `
    <section class="table-card">
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
}

function topMetrics(metrics, sortFn, limit, predicate = () => true) {
  return [...metrics].filter(predicate).sort(sortFn).slice(0, limit);
}

function buildMarkdown(metadata, trendData) {
  const { segments, rawTagMetrics, rawGenreMetrics, themeMetrics } = trendData;
  const acceleratingTags = topMetrics(
    rawTagMetrics,
    (left, right) => right.momentumDelta - left.momentumDelta || right.totalMoves - left.totalMoves,
    15,
    (metric) => metric.totalMoves >= 6
  );
  const deceleratingTags = topMetrics(
    rawTagMetrics,
    (left, right) => left.momentumDelta - right.momentumDelta || right.totalMoves - left.totalMoves,
    15,
    (metric) => metric.totalMoves >= 6
  );
  const themeMomentum = topMetrics(
    themeMetrics.filter((metric) => metric.label !== 'Other'),
    (left, right) => right.momentumDelta - left.momentumDelta,
    12
  );
  const genreMomentum = topMetrics(
    rawGenreMetrics,
    (left, right) => right.momentumDelta - left.momentumDelta,
    10
  );

  const renderRows = (rows, { includeGroup = false } = {}) =>
    rows
      .map((row) => {
        const groupCell = includeGroup ? `| \`${row.groupLabel}\` ` : '';
        return `| \`${row.label}\` ${groupCell}| \`${formatSignedDecimal(row.earlyAvgNet)}\` | \`${formatSignedDecimal(row.lateAvgNet)}\` | \`${formatSignedDecimal(row.momentumDelta)}\` | \`${formatSigned(row.windowNet)}\` | \`${formatNumber(row.totalMoves)}\` | ${row.sampleApps || '—'} |`;
      })
      .join('\n');

  const signalNarrative = [
    {
      label: 'Primary read',
      copy:
        'Use the HTML scatter first. Upper-right labels are net-up and accelerating; lower-left labels are net-down and weakening.',
    },
    {
      label: 'Dumbbell logic',
      copy: `Themes and genres compare early-window average daily net (${segments.earlyLabel}) to late-window average daily net (${segments.lateLabel}).`,
    },
    {
      label: 'Full inventory',
      copy:
        'The heatmap includes every raw tag, grouped by theme, so lower-activity labels stay visible without turning the overview chart into noise.',
    },
  ];

  return `# Tag and Genre Momentum Report

As of ${REPORT_DATE}

## Window

- Raw event window UTC: **${metadata.window_start_utc}** to **${metadata.window_end_utc}**
- Reporting day buckets (${REPORT_TZ}): **${metadata.window_start_pt}** to **${metadata.window_end_pt}**
- Early comparison window: **${segments.earlyLabel}**
- Late comparison window: **${segments.lateLabel}**
- Games touched: **${formatNumber(metadata.games_touched)}**
- Raw tag moves: **${formatNumber(metadata.raw_tag_moves)}**
- Raw genre moves: **${formatNumber(metadata.raw_genre_moves)}**

## How To Read This

${renderNarrativeList(signalNarrative)}

## Themes By Momentum Delta

| Theme | Early Avg Net | Late Avg Net | Delta | Window Net | Moves | Sample Games |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${renderRows(themeMomentum)}

## Accelerating Tags

| Tag | Theme | Early Avg Net | Late Avg Net | Delta | Window Net | Moves | Sample Games |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${renderRows(acceleratingTags, { includeGroup: true })}

## Decelerating Tags

| Tag | Theme | Early Avg Net | Late Avg Net | Delta | Window Net | Moves | Sample Games |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${renderRows(deceleratingTags, { includeGroup: true })}

## Genres By Momentum Delta

| Genre | Early Avg Net | Late Avg Net | Delta | Window Net | Moves | Sample Games |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${renderRows(genreMomentum)}

## Raw Artifacts

- [SQL](${path.relative(path.dirname(MD_PATH), SQL_PATH)})
- [Daily Raw CSV](${path.relative(path.dirname(MD_PATH), RAW_CSV_PATH)})
- [Daily Themes CSV](${path.relative(path.dirname(MD_PATH), THEME_CSV_PATH)})
- [Summary CSV](${path.relative(path.dirname(MD_PATH), SUMMARY_CSV_PATH)})
- [Visual Metrics CSV](${path.relative(path.dirname(MD_PATH), TREND_CSV_PATH)})
`;
}

function buildHtml(metadata, trendData) {
  const { segments, rawTagMetrics, rawGenreMetrics, themeMetrics } = trendData;
  const acceleratingTags = topMetrics(
    rawTagMetrics,
    (left, right) => right.momentumDelta - left.momentumDelta || right.totalMoves - left.totalMoves,
    15,
    (metric) => metric.totalMoves >= 6
  );
  const deceleratingTags = topMetrics(
    rawTagMetrics,
    (left, right) => left.momentumDelta - right.momentumDelta || right.totalMoves - left.totalMoves,
    15,
    (metric) => metric.totalMoves >= 6
  );
  const netGainers = topMetrics(
    rawTagMetrics,
    (left, right) => right.windowNet - left.windowNet || right.totalMoves - left.totalMoves,
    10,
    (metric) => metric.totalMoves >= 6
  );
  const netDecliners = topMetrics(
    rawTagMetrics,
    (left, right) => left.windowNet - right.windowNet || right.totalMoves - left.totalMoves,
    10,
    (metric) => metric.totalMoves >= 6
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tag and Genre Momentum Report</title>
    <style>
      :root {
        --paper: #faf6ef;
        --page: #f2eadf;
        --ink: #24201b;
        --ink-soft: #61584f;
        --rule: #ddd1bf;
        --rule-strong: #cabaa4;
        --panel: rgba(255,255,255,0.7);
        --accent: #9e5a4d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "DM Sans", "Avenir Next", "Segoe UI", sans-serif;
        color: var(--ink);
        background: var(--page);
      }
      svg {
        width: 100%;
        height: auto;
        display: block;
      }
      main {
        max-width: 1180px;
        margin: 0 auto;
        padding: 32px 24px 48px;
      }
      h1, h2, h3 { margin: 0; }
      h1 {
        font-family: "Iowan Old Style", Georgia, serif;
        font-size: 42px;
        line-height: 1;
        letter-spacing: -0.04em;
        margin-bottom: 10px;
      }
      h2 {
        font-family: "Iowan Old Style", Georgia, serif;
        font-size: 24px;
        line-height: 1.1;
        margin-bottom: 12px;
      }
      p, li { color: var(--ink-soft); line-height: 1.55; }
      .hero {
        display: grid;
        gap: 12px;
        margin-bottom: 24px;
      }
      .eyebrow {
        color: var(--ink-soft);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 11px;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 12px;
        margin: 20px 0 30px;
      }
      .meta-card, .chart-card, .table-card {
        background: var(--panel);
        border: 1px solid var(--rule);
        padding: 16px 18px;
        backdrop-filter: blur(6px);
      }
      .meta-card strong {
        display: block;
        font-size: 28px;
        margin-bottom: 4px;
      }
      .charts {
        display: grid;
        gap: 18px;
        margin-bottom: 22px;
      }
      .chart-pair {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }
      .chart-card--wide {
        padding-bottom: 12px;
      }
      .chart-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 12px;
      }
      .chart-head p {
        margin: 6px 0 0;
        max-width: 760px;
      }
      .chart-head-note {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        color: var(--ink-soft);
        font-size: 12px;
      }
      .callouts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }
      .callout {
        padding: 14px 16px;
        border: 1px solid var(--rule);
        background: rgba(255,255,255,0.48);
      }
      .callout strong {
        display: block;
        margin-bottom: 6px;
        color: var(--ink);
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 14px;
        margin-top: 10px;
        font-size: 12px;
        color: var(--ink-soft);
      }
      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .legend-swatch {
        width: 10px;
        height: 10px;
        border-radius: 999px;
      }
      .tables {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th, td {
        text-align: left;
        padding: 8px 10px;
        border-top: 1px solid var(--rule);
        vertical-align: top;
      }
      th {
        color: var(--ink-soft);
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .heatmap-card {
        overflow: hidden;
      }
      .heatmap-wrap {
        overflow-x: auto;
      }
      .heatmap-table {
        min-width: 980px;
        font-size: 11px;
      }
      .heatmap-table th,
      .heatmap-table td {
        padding: 6px 8px;
        white-space: nowrap;
      }
      .heatmap-table thead th {
        position: sticky;
        top: 0;
        background: #fbf7f1;
        z-index: 2;
      }
      .heat-group-row th {
        background: #efe4d2;
        color: var(--ink);
        text-align: left;
        font-size: 12px;
      }
      .heat-label {
        font-weight: 600;
        min-width: 180px;
        background: rgba(255,255,255,0.66);
      }
      .heat-cell {
        min-width: 44px;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .heat-summary {
        font-variant-numeric: tabular-nums;
      }
      .artifacts {
        margin-top: 22px;
      }
      .artifacts a {
        color: var(--accent);
        text-decoration: none;
      }
      @media (max-width: 980px) {
        .meta-grid, .tables, .chart-pair, .callouts {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="eyebrow">One-off change-intelligence report</div>
        <h1>Tag and Genre Momentum Report</h1>
        <p>
          This pass measures market-facing taxonomy drift across all Steam games in the current change-history window.
          The main question is not just what moved, but what is accelerating versus cooling.
        </p>
        <p>
          Raw event window UTC: <strong>${escapeHtml(metadata.window_start_utc)}</strong> to
          <strong>${escapeHtml(metadata.window_end_utc)}</strong>.
          Report day buckets use <strong>${REPORT_TZ}</strong>, covering
          <strong>${escapeHtml(metadata.window_start_pt)}</strong> to
          <strong>${escapeHtml(metadata.window_end_pt)}</strong>.
        </p>
      </section>

      <section class="meta-grid">
        <div class="meta-card"><strong>${formatNumber(metadata.games_touched)}</strong><span>Games touched</span></div>
        <div class="meta-card"><strong>${formatNumber(metadata.raw_tag_moves)}</strong><span>Raw tag moves</span></div>
        <div class="meta-card"><strong>${formatNumber(metadata.raw_genre_moves)}</strong><span>Raw genre moves</span></div>
        <div class="meta-card"><strong>${escapeHtml(segments.earlyLabel)}</strong><span>Early comparison window</span></div>
        <div class="meta-card"><strong>${escapeHtml(segments.lateLabel)}</strong><span>Late comparison window</span></div>
      </section>

      <section class="callouts">
        <div class="callout">
          <strong>Primary read</strong>
          <p>Use the scatter first. Upper-right tags are net-up and accelerating. Lower-left tags are net-down and weakening.</p>
        </div>
        <div class="callout">
          <strong>Dumbbell logic</strong>
          <p>Open dots are the early-window average daily net. Filled dots are the late-window average daily net.</p>
        </div>
        <div class="callout">
          <strong>Full inventory</strong>
          <p>The heatmap keeps every raw tag visible without turning the overview into label soup.</p>
        </div>
      </section>

      <section class="charts">
        ${renderMomentumScatter('All Raw Tags: Net Change vs Momentum Delta', rawTagMetrics)}
        <div class="chart-pair">
          ${renderDumbbellChart('Themes: Early vs Late Daily Net', themeMetrics, {
            earlyLabel: segments.earlyLabel,
            lateLabel: segments.lateLabel,
            exclude: ['Other'],
          })}
          ${renderDumbbellChart('Genres: Early vs Late Daily Net', rawGenreMetrics, {
            earlyLabel: segments.earlyLabel,
            lateLabel: segments.lateLabel,
          })}
        </div>
        ${renderHeatmapTable('All Raw Tags by Day', rawTagMetrics, segments.allDays)}
      </section>

      <section class="tables">
        ${renderMetricTable('Top Accelerating Tags', acceleratingTags, [
          { heading: 'Tag', render: (metric) => escapeHtml(metric.label) },
          { heading: 'Theme', render: (metric) => escapeHtml(metric.groupLabel) },
          { heading: 'Early', render: (metric) => escapeHtml(formatSignedDecimal(metric.earlyAvgNet, 2)) },
          { heading: 'Late', render: (metric) => escapeHtml(formatSignedDecimal(metric.lateAvgNet, 2)) },
          { heading: 'Delta', render: (metric) => escapeHtml(formatSignedDecimal(metric.momentumDelta, 2)) },
          { heading: 'Moves', render: (metric) => escapeHtml(formatNumber(metric.totalMoves)) },
        ])}
        ${renderMetricTable('Top Decelerating Tags', deceleratingTags, [
          { heading: 'Tag', render: (metric) => escapeHtml(metric.label) },
          { heading: 'Theme', render: (metric) => escapeHtml(metric.groupLabel) },
          { heading: 'Early', render: (metric) => escapeHtml(formatSignedDecimal(metric.earlyAvgNet, 2)) },
          { heading: 'Late', render: (metric) => escapeHtml(formatSignedDecimal(metric.lateAvgNet, 2)) },
          { heading: 'Delta', render: (metric) => escapeHtml(formatSignedDecimal(metric.momentumDelta, 2)) },
          { heading: 'Moves', render: (metric) => escapeHtml(formatNumber(metric.totalMoves)) },
        ])}
        ${renderMetricTable('Top Net Gainers', netGainers, [
          { heading: 'Tag', render: (metric) => escapeHtml(metric.label) },
          { heading: 'Theme', render: (metric) => escapeHtml(metric.groupLabel) },
          { heading: 'Net', render: (metric) => escapeHtml(formatSigned(metric.windowNet)) },
          { heading: 'Delta', render: (metric) => escapeHtml(formatSignedDecimal(metric.momentumDelta, 2)) },
          { heading: 'Moves', render: (metric) => escapeHtml(formatNumber(metric.totalMoves)) },
        ])}
        ${renderMetricTable('Top Net Decliners', netDecliners, [
          { heading: 'Tag', render: (metric) => escapeHtml(metric.label) },
          { heading: 'Theme', render: (metric) => escapeHtml(metric.groupLabel) },
          { heading: 'Net', render: (metric) => escapeHtml(formatSigned(metric.windowNet)) },
          { heading: 'Delta', render: (metric) => escapeHtml(formatSignedDecimal(metric.momentumDelta, 2)) },
          { heading: 'Moves', render: (metric) => escapeHtml(formatNumber(metric.totalMoves)) },
        ])}
      </section>

      <section class="artifacts">
        <h2>Artifacts</h2>
        <ul>
          <li><a href="sql/${escapeHtml(path.basename(SQL_PATH))}">${escapeHtml(path.basename(SQL_PATH))}</a></li>
          <li><a href="data/${escapeHtml(path.basename(RAW_CSV_PATH))}">${escapeHtml(path.basename(RAW_CSV_PATH))}</a></li>
          <li><a href="data/${escapeHtml(path.basename(THEME_CSV_PATH))}">${escapeHtml(path.basename(THEME_CSV_PATH))}</a></li>
          <li><a href="data/${escapeHtml(path.basename(SUMMARY_CSV_PATH))}">${escapeHtml(path.basename(SUMMARY_CSV_PATH))}</a></li>
          <li><a href="data/${escapeHtml(path.basename(TREND_CSV_PATH))}">${escapeHtml(path.basename(TREND_CSV_PATH))}</a></li>
          <li><a href="${escapeHtml(path.basename(MD_PATH))}">${escapeHtml(path.basename(MD_PATH))}</a></li>
        </ul>
      </section>
    </main>
  </body>
</html>`;
}

async function main() {
  ensureDir(SQL_PATH);
  ensureDir(RAW_CSV_PATH);
  ensureDir(TREND_CSV_PATH);
  ensureDir(MD_PATH);

  fs.writeFileSync(SQL_PATH, buildSqlArtifact(), 'utf8');
  exportCsv(RAW_EXPORT_SQL, RAW_CSV_PATH);
  exportCsv(THEME_EXPORT_SQL, THEME_CSV_PATH);
  exportCsv(SUMMARY_SQL, SUMMARY_CSV_PATH);

  const metadata = queryRows(METADATA_SQL)[0];
  const rawRows = queryRows(RAW_EXPORT_SQL);
  const themeRows = queryRows(THEME_EXPORT_SQL);
  const summaryRows = queryRows(SUMMARY_SQL);
  const trendData = enrichTrendMetrics(rawRows, themeRows, summaryRows);

  writeCsv(
    TREND_CSV_PATH,
    [
      'dimension_type',
      'series_type',
      'label',
      'label_key',
      'group_label',
      'adds',
      'removes',
      'window_net',
      'total_moves',
      'early_avg_net',
      'late_avg_net',
      'momentum_delta',
      'sample_apps',
    ],
    trendData.trendRows
  );

  fs.writeFileSync(MD_PATH, buildMarkdown(metadata, trendData), 'utf8');
  fs.writeFileSync(HTML_PATH, buildHtml(metadata, trendData), 'utf8');

  const uploadedArtifacts = await uploadArtifactsToStorage([
    SQL_PATH,
    RAW_CSV_PATH,
    THEME_CSV_PATH,
    SUMMARY_CSV_PATH,
    TREND_CSV_PATH,
    MD_PATH,
    HTML_PATH,
  ]);

  console.log(`Wrote ${path.relative(REPO_ROOT, SQL_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, RAW_CSV_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, THEME_CSV_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, SUMMARY_CSV_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, TREND_CSV_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, MD_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, HTML_PATH)}`);
  for (const uploadedArtifact of uploadedArtifacts) {
    console.log(`Uploaded ${uploadedArtifact}`);
  }
}

await main();
