import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync, spawnSync } from 'node:child_process';
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

const REPORT_SLUG = `news-topic-trends-${REPORT_DATE}`;
const SQL_PATH = path.join(REPO_ROOT, 'docs', 'reports', 'sql', `${REPORT_SLUG}.sql`);
const RAW_ARTICLES_CSV_PATH = path.join(
  REPO_ROOT,
  'docs',
  'reports',
  'data',
  `${REPORT_SLUG.replace(`-${REPORT_DATE}`, '')}-articles-${REPORT_DATE}.csv`
);
const TOPIC_TIMESERIES_CSV_PATH = path.join(
  REPO_ROOT,
  'docs',
  'reports',
  'data',
  `${REPORT_SLUG.replace(`-${REPORT_DATE}`, '')}-topics-timeseries-${REPORT_DATE}.csv`
);
const PHRASE_SUMMARY_CSV_PATH = path.join(
  REPO_ROOT,
  'docs',
  'reports',
  'data',
  `${REPORT_SLUG.replace(`-${REPORT_DATE}`, '')}-phrases-summary-${REPORT_DATE}.csv`
);
const MD_PATH = path.join(REPO_ROOT, 'docs', 'reports', `${REPORT_SLUG}.md`);
const HTML_PATH = path.join(REPO_ROOT, 'docs', 'reports', `${REPORT_SLUG}.html`);
const TMP_BASE_EXPORT_PATH = path.join(os.tmpdir(), `${REPORT_SLUG}-base-export.csv`);
const TRUE_ENV_VALUES = new Set(['1', 'true', 'TRUE', 'yes', 'YES']);

const FEED_SCOPES = [
  {
    key: 'community_announcements',
    label: 'Developer / Publisher Posts',
    description: 'First-party Steam posts published by the game teams themselves.',
    color: '#b35c44',
  },
  {
    key: 'external_coverage',
    label: 'Press / Editorial Coverage',
    description: 'Editorial, newswire, and other third-party coverage outside the Steam announcement feed.',
    color: '#3f6f8f',
  },
];

const THEME_DEFINITIONS = [
  {
    key: 'launches_release_timing',
    label: 'Launches & Release Timing',
    patterns: [
      /\bout now\b/i,
      /\brelease date\b/i,
      /\bcoming soon\b/i,
      /\bavailable now\b/i,
      /\blaunch\b/i,
      /\breleasing\b/i,
      /\bpre[- ]?order\b/i,
      /\bdemo now live\b/i,
      /\bopen beta\b/i,
      /\bclosed beta\b/i,
      /\bplaytest\b/i,
      /\bearly access launch\b/i,
    ],
    color: '#7a5f9a',
  },
  {
    key: 'major_content_updates',
    label: 'Major Content Updates',
    patterns: [
      /\bmajor update\b/i,
      /\bcontent update\b/i,
      /\bnew content\b/i,
      /\bnew map\b/i,
      /\bnew mode\b/i,
      /\bnew feature/i,
      /\bnew chapter\b/i,
      /\bnew quest\b/i,
      /\bintroducing\b/i,
      /\bfeature update\b/i,
      /\bcontent drop\b/i,
      /\bexpanding features\b/i,
    ],
    color: '#6f8f72',
  },
  {
    key: 'patches_hotfixes_bugfixes',
    label: 'Patch / Hotfix / Bug Fixes',
    patterns: [
      /\bpatch notes\b/i,
      /\bhotfix\b/i,
      /\bbug fix/i,
      /\bfixed\b/i,
      /\bfixes\b/i,
      /\bstability\b/i,
      /\bperformance\b/i,
      /\boptimization\b/i,
      /\bchangelog\b/i,
      /\bversion\s*\d/i,
      /\b0\.\d/i,
      /\b1\.\d/i,
      /\bupdate\b/i,
    ],
    color: '#5c7d5c',
  },
  {
    key: 'discounts_sales_promotions',
    label: 'Discounts / Sales / Promotions',
    patterns: [
      /\bsale\b/i,
      /\bdiscount\b/i,
      /\bdeep discount\b/i,
      /\b%\s*off\b/i,
      /\bpromo/i,
      /\bpromotion\b/i,
      /\bfree weekend\b/i,
      /\bbundle\b/i,
      /\bdeal\b/i,
      /\bspring sale\b/i,
      /\bsummer sale\b/i,
      /\bwinter sale\b/i,
      /\blaunch discount\b/i,
    ],
    color: '#9b7a3e',
  },
  {
    key: 'events_seasonal_anniversary',
    label: 'Events / Seasonal / Anniversary',
    patterns: [
      /\bevent\b/i,
      /\bseasonal\b/i,
      /\banniversary\b/i,
      /\bcelebration\b/i,
      /\bfestival\b/i,
      /\blimited[- ]time\b/i,
      /\bholiday\b/i,
      /\bdouble\b/i,
      /\bseason\b/i,
      /\bweekend event\b/i,
    ],
    color: '#9f6b58',
  },
  {
    key: 'dlc_expansions_episodes',
    label: 'DLC / Expansions / Episodes',
    patterns: [
      /\bdlc\b/i,
      /\bexpansion\b/i,
      /\bepisode\b/i,
      /\bseason pass\b/i,
      /\bnew pack\b/i,
      /\bstory pack\b/i,
      /\bexpansion pass\b/i,
      /\bchapter\b/i,
    ],
    color: '#8a6c3c',
  },
  {
    key: 'servers_maintenance_downtime',
    label: 'Servers / Maintenance / Downtime / Apologies',
    patterns: [
      /\bmaintenance\b/i,
      /\bserver\b/i,
      /\bdowntime\b/i,
      /\boutage\b/i,
      /\bissue\b/i,
      /\bissues\b/i,
      /\brestart\b/i,
      /\bapolog/i,
      /\binstability\b/i,
      /\bservice\b/i,
      /\boffline\b/i,
      /\bcompensation\b/i,
    ],
    color: '#b24b4b',
  },
  {
    key: 'roadmaps_devlogs_previews',
    label: 'Roadmaps / Devlogs / Feature Previews',
    patterns: [
      /\broadmap\b/i,
      /\bdevlog\b/i,
      /\bdeveloper update\b/i,
      /\bdevelopment update\b/i,
      /\bpreview\b/i,
      /\bupcoming feature/i,
      /\bwhat'?s next\b/i,
      /\bfuture plans\b/i,
      /\bprogress report\b/i,
      /\bbehind the scenes\b/i,
    ],
    color: '#4f668d',
  },
  {
    key: 'balance_characters_items_meta',
    label: 'Balance / Characters / Items / Meta Changes',
    patterns: [
      /\bbalance\b/i,
      /\bbuff\b/i,
      /\bnerf\b/i,
      /\bcharacter\b/i,
      /\bhero\b/i,
      /\bweapon\b/i,
      /\bclass\b/i,
      /\bskill\b/i,
      /\bitem\b/i,
      /\bloadout\b/i,
      /\bmeta\b/i,
      /\bspawn budget\b/i,
    ],
    color: '#6a5a7a',
  },
  {
    key: 'platform_account_crossplay',
    label: 'Platform / Account / Crossplay / Technical Changes',
    patterns: [
      /\bcrossplay\b/i,
      /\bcross-play\b/i,
      /\baccount\b/i,
      /\blauncher\b/i,
      /\bplatform\b/i,
      /\bsteam deck\b/i,
      /\blinux\b/i,
      /\bmac\b/i,
      /\bcontroller\b/i,
      /\bmigration\b/i,
      /\bregion transfer\b/i,
      /\btechnical\b/i,
      /\brequirements\b/i,
    ],
    color: '#4b8c8c',
  },
  {
    key: 'monetization_store_pass_currency',
    label: 'Monetization / Store / Pass / Currency',
    patterns: [
      /\bbattle pass\b/i,
      /\bseason pass\b/i,
      /\bstore update\b/i,
      /\bshop\b/i,
      /\bcurrency\b/i,
      /\bpricing\b/i,
      /\bprice change\b/i,
      /\bfounder'?s pack\b/i,
      /\bloot box\b/i,
      /\bgacha\b/i,
      /\bmicrotransaction/i,
      /\bin-game store\b/i,
    ],
    color: '#8d5b4c',
  },
  {
    key: 'community_creator_social',
    label: 'Community / Creator / Social / UGC',
    patterns: [
      /\bcommunity spotlight\b/i,
      /\bcreator\b/i,
      /\bugc\b/i,
      /\bworkshop\b/i,
      /\bfan art\b/i,
      /\bcontest\b/i,
      /\bdiscord\b/i,
      /\bsurvey\b/i,
      /\bfeedback\b/i,
      /\bq&a\b/i,
      /\bama\b/i,
    ],
    color: '#7b7b7b',
  },
  {
    key: 'partnerships_crossovers',
    label: 'Partnerships / Crossovers / IP Collaborations',
    patterns: [
      /\bcrossover\b/i,
      /\bcollaboration\b/i,
      /\bcollab\b/i,
      /\bpartnership\b/i,
      /\bguest character\b/i,
      /\bfeaturing\b/i,
      /\bwith\b.*\bfrom\b/i,
    ],
    color: '#915f7e',
  },
  {
    key: 'other',
    label: 'Other',
    patterns: [],
    color: '#7b7b7b',
  },
];

const THEME_ORDER = THEME_DEFINITIONS.map((theme) => theme.label);
const THEME_BY_LABEL = new Map(THEME_DEFINITIONS.map((theme) => [theme.label, theme]));
const THEME_BY_KEY = new Map(THEME_DEFINITIONS.map((theme) => [theme.key, theme]));

const TOKEN_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'your',
  'you',
  'our',
  'their',
  'are',
  'was',
  'were',
  'will',
  'now',
  'new',
  'all',
  'get',
  'its',
  'into',
  'just',
  'more',
  'than',
  'have',
  'has',
  'had',
  'about',
  'here',
  'what',
  'when',
  'where',
  'why',
  'how',
  'many',
  'players',
  'player',
  'game',
  'steam',
  'community',
  'announcements',
  'announcement',
  'please',
  'dear',
  'hello',
  'href',
  'rel',
  'img',
  'src',
  'clan',
  'image',
  'images',
  'uploaded',
  'checking',
  'good',
  'purchased',
  'blender',
]);

const SIGNAL_UNIGRAMS = new Set([
  'hotfix',
  'roadmap',
  'anniversary',
  'downtime',
  'maintenance',
  'discount',
  'sale',
  'release',
  'date',
  'launch',
  'coming',
  'soon',
  'content',
  'feature',
  'launch',
  'expansion',
  'episode',
  'server',
  'update',
  'patch',
  'fix',
  'fixes',
  'bug',
  'bugs',
  'event',
  'festival',
  'season',
  'chapter',
  'dlc',
  'crossplay',
  'crossover',
  'collab',
  'collaboration',
  'playtest',
  'demo',
  'preview',
  'devlog',
  'balance',
  'weapon',
  'character',
]);

const PHRASE_BLACKLIST = new Set([
  'hello players',
  'dear players',
  'community announcements',
  'steam community',
  'many you',
  'thank you',
]);

const MIN_THEME_DOCS = 20;
const MIN_PHRASE_DOCS = 10;
const MAX_THEME_EXAMPLES = 3;
const MAX_PHRASE_EXAMPLES = 3;
const MAX_CANDIDATE_PHRASES_PER_THEME = 250;

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

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function getDatabaseUrl() {
  const env = getRuntimeEnv();
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL not found in .env');
  }
  return env.DATABASE_URL;
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
  const trimmedSql = sql.trim().replace(/;$/, '');
  const args = [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1'];

  if (mode === 'rows') {
    args.push('-A', '-F', FIELD_SEPARATOR, '-P', 'footer=off', '-c', trimmedSql);
  } else {
    throw new Error(`Unsupported psql mode: ${mode}`);
  }

  return execFileSync(PSQL_BIN, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
  });
}

function exportLargeCsv(sql, filePath) {
  ensureDir(filePath);
  const databaseUrl = getDatabaseUrl();
  const trimmedSql = sql.trim().replace(/;$/, '');
  const fd = fs.openSync(filePath, 'w');
  const args = [
    databaseUrl,
    '-X',
    '-q',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'SET statement_timeout TO 0',
    '-c',
    `COPY (${trimmedSql}) TO STDOUT WITH CSV HEADER`,
  ];

  const result = spawnSync(PSQL_BIN, args, {
    cwd: REPO_ROOT,
    stdio: ['ignore', fd, 'pipe'],
    encoding: 'utf8',
  });

  fs.closeSync(fd);

  if (result.status !== 0) {
    throw new Error(result.stderr || `psql export failed with status ${result.status}`);
  }
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

function csvEscape(value) {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
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

function formatSignedDecimal(value, digits = 2) {
  const num = Number(value);
  return `${num >= 0 ? '+' : ''}${formatDecimal(num, digits)}`;
}

function formatChangeWord(value, digits = 1) {
  const num = Number(value);
  if (Math.abs(num) < 0.05) return 'Flat';
  return `${num > 0 ? 'Up' : 'Down'} ${formatDecimal(Math.abs(num), digits)}`;
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, ' and ')
    .replace(/[^a-z0-9%+'/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizePreview(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !TOKEN_STOPWORDS.has(token))
    .filter((token) => token.length >= 3 || SIGNAL_UNIGRAMS.has(token))
    .filter((token) => !/^\d+$/.test(token));
}

function extractPhrases(title, preview) {
  const tokens = tokenize(`${title} ${preview}`).slice(0, 24);
  const phrases = new Set();
  const hasSignalToken = (phraseTokens) => phraseTokens.some((token) => SIGNAL_UNIGRAMS.has(token));

  for (const token of tokens) {
    if (SIGNAL_UNIGRAMS.has(token)) {
      phrases.add(token);
    }
  }

  for (let index = 0; index < tokens.length; index += 1) {
    if (index + 1 < tokens.length) {
      const pairTokens = [tokens[index], tokens[index + 1]];
      const phrase = pairTokens.join(' ');
      if (hasSignalToken(pairTokens) && !PHRASE_BLACKLIST.has(phrase)) phrases.add(phrase);
    }
    if (index + 2 < tokens.length) {
      const tripletTokens = [tokens[index], tokens[index + 1], tokens[index + 2]];
      const phrase = tripletTokens.join(' ');
      if (hasSignalToken(tripletTokens) && !PHRASE_BLACKLIST.has(phrase)) phrases.add(phrase);
    }
  }

  return phrases;
}

function assignThemes(title, preview) {
  const haystack = `${title} ${preview}`;
  const matches = THEME_DEFINITIONS
    .filter((theme) => theme.key !== 'other')
    .filter((theme) => theme.patterns.some((pattern) => pattern.test(haystack)))
    .map((theme) => theme.label);

  if (matches.length === 0) {
    return ['Other'];
  }

  return matches;
}

function writeCsvHeader(stream, headers) {
  stream.write(`${headers.join(',')}\n`);
}

function writeCsvRow(stream, values) {
  stream.write(`${values.map((value) => csvEscape(value)).join(',')}\n`);
}

function compareIso(left, right) {
  return String(left).localeCompare(String(right));
}

function pushExample(list, item, maxItems) {
  const dedupKey = item.title;
  const existingIndex = list.findIndex((entry) => entry.key === dedupKey);
  const nextEntry = {
    key: dedupKey,
    sortTime: item.sortTime,
    title: item.title,
    appName: item.appName,
  };

  if (existingIndex >= 0) {
    if (compareIso(item.sortTime, list[existingIndex].sortTime) > 0) {
      list.splice(existingIndex, 1, nextEntry);
    }
  } else {
    list.push(nextEntry);
  }

  list.sort((left, right) => compareIso(right.sortTime, left.sortTime));
  if (list.length > maxItems) {
    list.length = maxItems;
  }
}

function summarizeExamples(list) {
  return list.map((item) => `${item.appName}: ${item.title}`).join(' | ');
}

function formatExamplesHtml(value) {
  const items = String(value ?? '')
    .split(' | ')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (items.length === 0) return '—';

  return items
    .map((item) => `<div class="example-item">${escapeHtml(item)}</div>`)
    .join('');
}

function formatPhrasesHtml(value) {
  const items = String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (items.length === 0) return '—';

  return items
    .map((item) => `<div class="phrase-item">${escapeHtml(item)}</div>`)
    .join('');
}

function initScopeStats(bucketKeys) {
  return {
    totalDocs: 0,
    bucketTotals: new Map(bucketKeys.map((bucketKey) => [bucketKey, 0])),
    themeStats: new Map(
      THEME_ORDER.map((themeLabel) => [
        themeLabel,
        {
          docCount: 0,
          bucketCounts: new Map(bucketKeys.map((bucketKey) => [bucketKey, 0])),
          examples: [],
        },
      ])
    ),
    phraseDocCounts: new Map(),
  };
}

function incrementMapCount(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function buildDateRange(startDay, endDay) {
  const dates = [];
  let current = new Date(`${startDay}T00:00:00Z`);
  const end = new Date(`${endDay}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function getWeekStart(day) {
  const date = new Date(`${day}T00:00:00Z`);
  const dayOfWeek = date.getUTCDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function buildWeekRange(startDay, endDay) {
  const startWeek = getWeekStart(startDay);
  const endWeek = getWeekStart(endDay);
  const weeks = [];
  let current = new Date(`${startWeek}T00:00:00Z`);
  const end = new Date(`${endWeek}T00:00:00Z`);
  while (current <= end) {
    weeks.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return weeks;
}

function bucketLabel(bucketMode, bucketKey) {
  return bucketMode === 'day' ? bucketKey.slice(5) : `${bucketKey.slice(5)} wk`;
}

function summarizeBucketRange(bucketKeys) {
  if (bucketKeys.length === 0) return 'n/a';
  if (bucketKeys.length === 1) return bucketKeys[0];
  return `${bucketKeys[0]} to ${bucketKeys[bucketKeys.length - 1]}`;
}

function buildSegments(bucketKeys) {
  const segmentSize = Math.max(1, Math.floor(bucketKeys.length / 3));
  const earlyBuckets = bucketKeys.slice(0, segmentSize);
  const lateBuckets = bucketKeys.slice(bucketKeys.length - segmentSize);
  return {
    segmentSize,
    earlyBuckets,
    lateBuckets,
    earlyLabel: summarizeBucketRange(earlyBuckets),
    lateLabel: summarizeBucketRange(lateBuckets),
  };
}

function sumCounts(map, keys) {
  return keys.reduce((sum, key) => sum + (map.get(key) ?? 0), 0);
}

function buildSqlArtifact() {
  return `-- ${REPORT_SLUG}
-- Purpose:
-- Extract the full available Steam news corpus for games, split it into
-- community announcements versus external coverage, and support a one-off
-- topic-intent trend report with CSV, Markdown, and HTML outputs.
--
-- Reporting timezone: ${REPORT_TZ}
-- Scope:
-- - apps.type = 'game'
-- - one row per news item gid using the latest news version text
-- - split feed scope into Community Announcements vs External Coverage
-- - reporting window uses first capture time, not original publish time,
--   so the trend window matches the data we actually have in the warehouse
-- - downstream classification and phrase mining happen in the report script

${BASE_NEWS_EXPORT_SQL}
`;
}

const BASE_NEWS_EXPORT_SQL = `
WITH base_news AS (
  SELECT
    n.gid,
    n.appid,
    a.name AS app_name,
    n.first_seen_at AS captured_at_utc,
    COALESCE(n.published_at, n.first_seen_at) AS published_at_utc,
    (n.first_seen_at AT TIME ZONE '${REPORT_TZ}')::date AS day_pt,
    date_trunc('week', n.first_seen_at AT TIME ZONE '${REPORT_TZ}')::date AS week_pt,
    CASE
      WHEN COALESCE(n.feedlabel, '') = 'Community Announcements' THEN 'community_announcements'
      ELSE 'external_coverage'
    END AS feed_scope,
    COALESCE(n.feedlabel, '') AS feedlabel,
    COALESCE(n.feedname, '') AS feedname,
    regexp_replace(COALESCE(lv.title, ''), E'[\\n\\r\\t]+', ' ', 'g') AS title,
    left(
      regexp_replace(
        regexp_replace(
          regexp_replace(COALESCE(lv.contents, ''), 'https?://\\S+', ' ', 'gi'),
          E'[\\n\\r\\t]+',
          ' ',
          'g'
        ),
        '\\s+',
        ' ',
        'g'
      ),
      220
    ) AS content_preview
  FROM steam_news_items n
  JOIN apps a ON a.appid = n.appid
  LEFT JOIN LATERAL (
    SELECT
      NULLIF(btrim(v.title), '') AS title,
      NULLIF(btrim(v.contents), '') AS contents
    FROM steam_news_versions v
    WHERE v.gid = n.gid
    ORDER BY v.first_seen_at DESC, v.id DESC
    LIMIT 1
  ) lv ON TRUE
  WHERE a.type = 'game'
)
SELECT
  gid,
  appid,
  app_name,
  captured_at_utc,
  published_at_utc,
  day_pt,
  week_pt,
  feed_scope,
  feedlabel,
  feedname,
  title,
  content_preview
FROM base_news
WHERE COALESCE(title, '') <> ''
   OR COALESCE(content_preview, '') <> '';
`.trim();

async function inspectExport(filePath) {
  const input = fs.createReadStream(filePath, 'utf8');
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let headers = [];
  let lineNumber = 0;
  const appids = new Set();
  const scopeCounts = new Map(FEED_SCOPES.map((scope) => [scope.key, 0]));
  let minCapturedAt = null;
  let maxCapturedAt = null;
  let minDay = null;
  let maxDay = null;

  for await (const line of rl) {
    if (!line) continue;
    lineNumber += 1;
    const values = parseCsvLine(line);
    if (lineNumber === 1) {
      headers = values;
      continue;
    }

    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    appids.add(row.appid);
    scopeCounts.set(row.feed_scope, (scopeCounts.get(row.feed_scope) ?? 0) + 1);

    if (!minCapturedAt || compareIso(row.captured_at_utc, minCapturedAt) < 0) minCapturedAt = row.captured_at_utc;
    if (!maxCapturedAt || compareIso(row.captured_at_utc, maxCapturedAt) > 0) maxCapturedAt = row.captured_at_utc;
    if (!minDay || row.day_pt < minDay) minDay = row.day_pt;
    if (!maxDay || row.day_pt > maxDay) maxDay = row.day_pt;
  }

  return {
    totalDocs: lineNumber - 1,
    totalApps: appids.size,
    scopeCounts,
    minCapturedAt,
    maxCapturedAt,
    minDay,
    maxDay,
  };
}

async function processExport(filePath, options) {
  const {
    bucketMode,
    bucketKeys,
    segments,
    writeRawArticles,
  } = options;

  const input = fs.createReadStream(filePath, 'utf8');
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let headers = [];
  let lineNumber = 0;
  const scopeStats = new Map(FEED_SCOPES.map((scope) => [scope.key, initScopeStats(bucketKeys)]));

  let rawWriter = null;
  if (writeRawArticles) {
    ensureDir(RAW_ARTICLES_CSV_PATH);
    rawWriter = fs.createWriteStream(RAW_ARTICLES_CSV_PATH, 'utf8');
    writeCsvHeader(rawWriter, [
      'gid',
      'appid',
      'app_name',
      'captured_at_utc',
      'published_at_utc',
      'day_pt',
      'bucket_key',
      'feed_scope',
      'feedlabel',
      'feedname',
      'title',
      'content_preview',
      'primary_theme',
      'themes',
    ]);
  }

  for await (const line of rl) {
    if (!line) continue;
    lineNumber += 1;
    const values = parseCsvLine(line);
    if (lineNumber === 1) {
      headers = values;
      continue;
    }

    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const scopeKey = row.feed_scope;
    const bucketKey = bucketMode === 'day' ? row.day_pt : row.week_pt;
    const scope = scopeStats.get(scopeKey);
    if (!scope) continue;

    scope.totalDocs += 1;
    incrementMapCount(scope.bucketTotals, bucketKey, 1);

    const title = sanitizePreview(row.title);
    const preview = sanitizePreview(row.content_preview);
    const themes = assignThemes(title, preview);
    const primaryTheme = themes[0];
    const phrases = extractPhrases(title, preview);
    const example = {
      sortTime: row.captured_at_utc,
      title,
      appName: row.app_name,
    };

    for (const themeLabel of themes) {
      const themeStat = scope.themeStats.get(themeLabel);
      if (!themeStat) continue;
      themeStat.docCount += 1;
      incrementMapCount(themeStat.bucketCounts, bucketKey, 1);
      pushExample(themeStat.examples, example, MAX_THEME_EXAMPLES);

      let themePhraseDocCounts = scope.phraseDocCounts.get(themeLabel);
      if (!themePhraseDocCounts) {
        themePhraseDocCounts = new Map();
        scope.phraseDocCounts.set(themeLabel, themePhraseDocCounts);
      }

      for (const phrase of phrases) {
        themePhraseDocCounts.set(phrase, (themePhraseDocCounts.get(phrase) ?? 0) + 1);
      }
    }

    if (rawWriter) {
      writeCsvRow(rawWriter, [
        row.gid,
        row.appid,
        row.app_name,
        row.captured_at_utc,
        row.published_at_utc,
        row.day_pt,
        bucketKey,
        scopeKey,
        row.feedlabel,
        row.feedname,
        title,
        preview,
        primaryTheme,
        themes.join(' | '),
      ]);
    }
  }

  if (rawWriter) {
    await new Promise((resolve, reject) => {
      rawWriter.end((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  const candidatePhraseStats = new Map();

  for (const scopeDef of FEED_SCOPES) {
    const scope = scopeStats.get(scopeDef.key);
    if (!scope) continue;

    const scopeCandidates = new Map();
    candidatePhraseStats.set(scopeDef.key, scopeCandidates);

    for (const themeLabel of THEME_ORDER) {
      const phraseDocCounts = scope.phraseDocCounts.get(themeLabel) ?? new Map();
      const candidates = [...phraseDocCounts.entries()]
        .filter(([, docCount]) => docCount >= MIN_PHRASE_DOCS)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, MAX_CANDIDATE_PHRASES_PER_THEME);

      scopeCandidates.set(
        themeLabel,
        new Map(
          candidates.map(([phrase, docCount]) => [
            phrase,
            {
              docCount,
              bucketCounts: new Map(bucketKeys.map((bucketKey) => [bucketKey, 0])),
              examples: [],
            },
          ])
        )
      );
    }
  }

  const detailInput = fs.createReadStream(filePath, 'utf8');
  const detailRl = readline.createInterface({ input: detailInput, crlfDelay: Infinity });
  let detailHeaders = [];
  let detailLineNumber = 0;

  for await (const line of detailRl) {
    if (!line) continue;
    detailLineNumber += 1;
    const values = parseCsvLine(line);
    if (detailLineNumber === 1) {
      detailHeaders = values;
      continue;
    }

    const row = Object.fromEntries(
      detailHeaders.map((header, index) => [header, values[index] ?? ''])
    );
    const bucketKey = bucketMode === 'day' ? row.day_pt : row.week_pt;
    const title = sanitizePreview(row.title);
    const preview = sanitizePreview(row.content_preview);
    const themes = assignThemes(title, preview);
    const phrases = extractPhrases(title, preview);
    const scopeCandidateStats = candidatePhraseStats.get(row.feed_scope);
    if (!scopeCandidateStats) continue;

    const example = {
      sortTime: row.captured_at_utc,
      title,
      appName: row.app_name,
    };

    for (const themeLabel of themes) {
      const themeCandidateStats = scopeCandidateStats.get(themeLabel);
      if (!themeCandidateStats || themeCandidateStats.size === 0) continue;

      for (const phrase of phrases) {
        const phraseStat = themeCandidateStats.get(phrase);
        if (!phraseStat) continue;
        incrementMapCount(phraseStat.bucketCounts, bucketKey, 1);
        pushExample(phraseStat.examples, example, MAX_PHRASE_EXAMPLES);
      }
    }
  }

  const topicTimeseriesRows = [];
  const phraseSummaryRows = [];
  const scopeSummaries = [];

  for (const scopeDef of FEED_SCOPES) {
    const scope = scopeStats.get(scopeDef.key);
    if (!scope) continue;

    const earlyTotal = sumCounts(scope.bucketTotals, segments.earlyBuckets);
    const lateTotal = sumCounts(scope.bucketTotals, segments.lateBuckets);
    const themeMetrics = [];
    const scopeCandidateStats = candidatePhraseStats.get(scopeDef.key) ?? new Map();

    for (const themeLabel of THEME_ORDER) {
      const themeStat = scope.themeStats.get(themeLabel);
      if (!themeStat) continue;

      const earlyCount = sumCounts(themeStat.bucketCounts, segments.earlyBuckets);
      const lateCount = sumCounts(themeStat.bucketCounts, segments.lateBuckets);
      const earlyShare = earlyTotal === 0 ? 0 : earlyCount / earlyTotal;
      const lateShare = lateTotal === 0 ? 0 : lateCount / lateTotal;
      const trendDelta = lateShare - earlyShare;

      for (const bucketKey of bucketKeys) {
        const bucketTotal = scope.bucketTotals.get(bucketKey) ?? 0;
        const docCount = themeStat.bucketCounts.get(bucketKey) ?? 0;
        topicTimeseriesRows.push({
          scope: scopeDef.key,
          bucket_granularity: bucketMode,
          bucket_key: bucketKey,
          bucket_label: bucketLabel(bucketMode, bucketKey),
          theme: themeLabel,
          doc_count: docCount,
          bucket_total_docs: bucketTotal,
          doc_share: bucketTotal === 0 ? '0.0000' : (docCount / bucketTotal).toFixed(4),
          early_share: earlyShare.toFixed(4),
          late_share: lateShare.toFixed(4),
          trend_delta: trendDelta.toFixed(4),
        });
      }

      const phraseStats = scopeCandidateStats.get(themeLabel) ?? new Map();
      const risingPhrases = [...phraseStats.entries()]
        .map(([phrase, phraseStat]) => {
          const themeEarlyTotal = earlyCount;
          const themeLateTotal = lateCount;
          const phraseEarlyCount = sumCounts(phraseStat.bucketCounts, segments.earlyBuckets);
          const phraseLateCount = sumCounts(phraseStat.bucketCounts, segments.lateBuckets);
          const phraseEarlyShare = themeEarlyTotal === 0 ? 0 : phraseEarlyCount / themeEarlyTotal;
          const phraseLateShare = themeLateTotal === 0 ? 0 : phraseLateCount / themeLateTotal;
          return {
            phrase,
            docCount: phraseStat.docCount,
            earlyShare: phraseEarlyShare,
            lateShare: phraseLateShare,
            trendDelta: phraseLateShare - phraseEarlyShare,
            sampleTitles: summarizeExamples(phraseStat.examples),
          };
        })
        .sort((left, right) => right.trendDelta - left.trendDelta || right.docCount - left.docCount);

      const fallingPhrases = [...risingPhrases]
        .sort((left, right) => left.trendDelta - right.trendDelta || right.docCount - left.docCount);

      for (const row of [...risingPhrases.slice(0, 8), ...fallingPhrases.slice(0, 8)]) {
        phraseSummaryRows.push({
          scope: scopeDef.key,
          theme: themeLabel,
          phrase: row.phrase,
          doc_count: row.docCount,
          early_share: row.earlyShare.toFixed(4),
          late_share: row.lateShare.toFixed(4),
          trend_delta: row.trendDelta.toFixed(4),
          sample_titles: row.sampleTitles,
        });
      }

      themeMetrics.push({
        theme: themeLabel,
        docCount: themeStat.docCount,
        docShare: scope.totalDocs === 0 ? 0 : themeStat.docCount / scope.totalDocs,
        earlyShare,
        lateShare,
        trendDelta,
        sampleTitles: summarizeExamples(themeStat.examples),
        driverPhrases: risingPhrases.slice(0, 3).map((row) => row.phrase).join(', '),
      });
    }

    scopeSummaries.push({
      scopeKey: scopeDef.key,
      scopeLabel: scopeDef.label,
      totalDocs: scope.totalDocs,
      earlyTotal,
      lateTotal,
      themeMetrics,
    });
  }

  return {
    scopeSummaries,
    topicTimeseriesRows,
    phraseSummaryRows,
  };
}

function sortThemesByTrend(themeMetrics, direction) {
  return [...themeMetrics]
    .filter((metric) => metric.theme !== 'Other')
    .filter((metric) => metric.docCount >= MIN_THEME_DOCS)
    .sort((left, right) => {
      if (direction === 'up') {
        return right.trendDelta - left.trendDelta || right.docCount - left.docCount;
      }
      return left.trendDelta - right.trendDelta || right.docCount - left.docCount;
    });
}

function renderDumbbellChart(title, metrics, { earlyLabel, lateLabel, color }) {
  const rows = metrics.filter((metric) => metric.docCount >= MIN_THEME_DOCS && metric.theme !== 'Other');
  if (rows.length === 0) {
    return `<section class="chart-card"><h2>${escapeHtml(title)}</h2><p>No data available.</p></section>`;
  }

  const ordered = [...rows].sort(
    (left, right) => right.trendDelta - left.trendDelta || right.docCount - left.docCount
  );
  const width = 1040;
  const rowHeight = 34;
  const height = 90 + ordered.length * rowHeight;
  const padding = { top: 42, right: 82, bottom: 28, left: 240 };
  const chartWidth = width - padding.left - padding.right;
  const domainMax =
    Math.max(
      ...ordered.flatMap((metric) => [metric.earlyShare, metric.lateShare]),
      0.01
    ) * 1.2;
  const xAt = (value) => padding.left + (value / domainMax) * chartWidth;
  const ticks = Array.from({ length: 5 }, (_, index) => (index / 4) * domainMax);

  const tickMarkup = ticks
    .map((tick) => {
      const x = xAt(tick);
      return `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#ece0cf" /><text x="${x}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#61584f">${escapeHtml(formatDecimal(tick * 100, 1))}%</text>`;
    })
    .join('');

  const rowsMarkup = ordered
    .map((metric, index) => {
      const y = padding.top + 22 + index * rowHeight;
      const xStart = xAt(metric.earlyShare);
      const xEnd = xAt(metric.lateShare);
      const stroke = metric.trendDelta >= 0 ? '#3a7d44' : '#b35c44';
      const shiftLabel = `${formatDecimal(metric.earlyShare * 100, 1)}% to ${formatDecimal(metric.lateShare * 100, 1)}%`;
      return `
        <g>
          <text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" font-size="12" fill="#302923">${escapeHtml(metric.theme)}</text>
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f4ece0" />
          <line x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}" stroke="${stroke}" stroke-width="3" stroke-linecap="round" />
          <circle cx="${xStart}" cy="${y}" r="5.5" fill="#fdf9f2" stroke="${stroke}" stroke-width="2" />
          <circle cx="${xEnd}" cy="${y}" r="5.5" fill="${color}" />
          <text x="${width - padding.right + 10}" y="${y + 4}" font-size="11" fill="#61584f">${escapeHtml(shiftLabel)}</text>
        </g>
      `;
    })
    .join('');

  return `
    <section class="chart-card chart-card--wide">
      <div class="chart-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>Hollow dots show the earlier part of the capture window. Solid dots show the most recent part.</p>
        </div>
        <div class="chart-head-note"><span>Earlier: ${escapeHtml(earlyLabel)}</span><span>Recent: ${escapeHtml(lateLabel)}</span></div>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
        ${tickMarkup}
        ${rowsMarkup}
      </svg>
    </section>
  `;
}

function heatmapColor(value, maxValue) {
  const intensity = maxValue === 0 ? 0 : Math.min(value / maxValue, 1);
  return `rgba(63, 128, 111, ${0.12 + intensity * 0.68})`;
}

function renderThemeHeatmap(title, metrics, bucketKeys, bucketMode) {
  const rows = metrics
    .filter((metric) => metric.docCount >= MIN_THEME_DOCS && metric.theme !== 'Other')
    .sort((left, right) => right.trendDelta - left.trendDelta || right.docCount - left.docCount);

  const maxShare = Math.max(...rows.flatMap((row) => row.bucketShares.map((entry) => entry.docShare)), 0.01);
  const headerCells = bucketKeys
    .map((bucketKey) => `<th>${escapeHtml(bucketLabel(bucketMode, bucketKey))}</th>`)
    .join('');
  const body = rows
    .map((metric) => {
      const shareCells = metric.bucketShares
        .map((entry) => `<td class="heat-cell" style="background:${heatmapColor(entry.docShare, maxShare)}">${escapeHtml(formatDecimal(entry.docShare * 100, 1))}%</td>`)
        .join('');
      return `
        <tr>
          <td class="heat-label">${escapeHtml(metric.theme)}</td>
          ${shareCells}
          <td class="heat-summary">${escapeHtml(formatChangeWord(metric.trendDelta * 100, 1))}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="chart-card heatmap-card">
      <div class="chart-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>Each cell shows how much of that day or week was about that topic. One article can fit more than one topic.</p>
        </div>
      </div>
      <div class="heatmap-wrap">
        <table class="heatmap-table">
          <thead>
            <tr>
              <th>Theme</th>
              ${headerCells}
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderThemeTable(title, rows) {
  const body = rows
    .map(
      (row) => `
        <tr>
          <td class="col-topic">${escapeHtml(row.theme)}</td>
          <td class="col-number">${escapeHtml(formatNumber(row.docCount))}</td>
          <td class="col-number">${escapeHtml(formatDecimal(row.earlyShare * 100, 1))}%</td>
          <td class="col-number">${escapeHtml(formatDecimal(row.lateShare * 100, 1))}%</td>
          <td class="col-direction">${escapeHtml(formatChangeWord(row.trendDelta * 100, 1))}</td>
          <td class="col-phrases">${formatPhrasesHtml(row.driverPhrases)}</td>
          <td class="col-examples">${formatExamplesHtml(row.sampleTitles)}</td>
        </tr>
      `
    )
    .join('');

  return `
    <section class="table-card">
      <h2>${escapeHtml(title)}</h2>
      <div class="table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th>Topic</th>
            <th>Articles</th>
            <th>Earlier</th>
            <th>Recent</th>
            <th>Direction</th>
            <th>Common Phrases</th>
            <th>Example Headlines</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      </div>
    </section>
  `;
}

function renderPhraseTable(title, rows) {
  const body = rows
    .map(
      (row) => `
        <tr>
          <td class="col-topic">${escapeHtml(row.theme)}</td>
          <td class="col-phrase">${escapeHtml(row.phrase)}</td>
          <td class="col-number">${escapeHtml(formatNumber(row.docCount))}</td>
          <td class="col-number">${escapeHtml(formatDecimal(row.earlyShare * 100, 1))}%</td>
          <td class="col-number">${escapeHtml(formatDecimal(row.lateShare * 100, 1))}%</td>
          <td class="col-examples">${formatExamplesHtml(row.sampleTitles)}</td>
        </tr>
      `
    )
    .join('');

  return `
    <section class="table-card">
      <h2>${escapeHtml(title)}</h2>
      <div class="table-wrap">
      <table class="report-table report-table--phrases">
        <thead>
          <tr>
            <th>Topic</th>
            <th>Phrase</th>
            <th>Articles</th>
            <th>Earlier</th>
            <th>Recent</th>
            <th>Example Headlines</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      </div>
    </section>
  `;
}

function buildMarkdown(metadata, report) {
  const renderThemeRows = (rows) =>
    rows
      .map(
        (row) =>
          `| \`${row.theme}\` | \`${formatNumber(row.docCount)}\` | \`${formatDecimal(row.earlyShare * 100, 1)}%\` | \`${formatDecimal(row.lateShare * 100, 1)}%\` | \`${formatChangeWord(row.trendDelta * 100, 1)}\` | ${row.driverPhrases || '—'} | ${row.sampleTitles || '—'} |`
      )
      .join('\n');

  const renderPhraseRows = (rows) =>
    rows
      .map(
        (row) =>
          `| \`${row.theme}\` | \`${row.phrase}\` | \`${formatNumber(row.docCount)}\` | \`${formatDecimal(row.earlyShare * 100, 1)}%\` | \`${formatDecimal(row.lateShare * 100, 1)}%\` | ${row.sampleTitles || '—'} |`
      )
      .join('\n');

  return `# News Topic Trend Report

As of ${REPORT_DATE}

## Window

- Capture window UTC: **${metadata.windowStartUtc}** to **${metadata.windowEndUtc}**
- Reporting ${metadata.bucketMode === 'day' ? 'days' : 'weeks'} (${REPORT_TZ}): **${metadata.windowStartDayPt}** to **${metadata.windowEndDayPt}**
- Earlier comparison period: **${metadata.segments.earlyLabel}**
- Most recent comparison period: **${metadata.segments.lateLabel}**

## Read This As

- **Topic share**: the percent of articles in that stream that were about the topic.
- **Earlier vs recent**: each topic is compared between the start of the capture window and the most recent part.
- **Common phrases**: repeated wording from titles and article snippets that helps explain why a topic moved.

## Developer / Publisher Posts: Topics Showing Up More Often

| Topic | Articles | Earlier | Recent | Direction | Common Phrases | Example Headlines |
| --- | ---: | ---: | ---: | ---: | --- | --- |
${renderThemeRows(report.community.upThemes)}

## Developer / Publisher Posts: Topics Showing Up Less Often

| Topic | Articles | Earlier | Recent | Direction | Common Phrases | Example Headlines |
| --- | ---: | ---: | ---: | ---: | --- | --- |
${renderThemeRows(report.community.downThemes)}

## Press / Editorial Coverage: Topics Showing Up More Often

| Topic | Articles | Earlier | Recent | Direction | Common Phrases | Example Headlines |
| --- | ---: | ---: | ---: | ---: | --- | --- |
${renderThemeRows(report.external.upThemes)}

## Press / Editorial Coverage: Topics Showing Up Less Often

| Topic | Articles | Earlier | Recent | Direction | Common Phrases | Example Headlines |
| --- | ---: | ---: | ---: | ---: | --- | --- |
${renderThemeRows(report.external.downThemes)}

## Phrases Showing Up More Often

| Topic | Phrase | Articles | Earlier | Recent | Example Headlines |
| --- | --- | ---: | ---: | ---: | --- |
${renderPhraseRows(report.topRisingPhrases)}

## Phrases Showing Up Less Often

| Topic | Phrase | Articles | Earlier | Recent | Example Headlines |
| --- | --- | ---: | ---: | ---: | --- |
${renderPhraseRows(report.topFallingPhrases)}
`;
}

function buildHtml(metadata, report) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>News Topic Trend Report</title>
    <style>
      :root {
        --paper: #faf6ef;
        --page: #f2eadf;
        --ink: #24201b;
        --ink-soft: #61584f;
        --rule: #ddd1bf;
        --panel: rgba(255,255,255,0.72);
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
        max-width: 1280px;
        margin: 0 auto;
        padding: 32px 24px 48px;
      }
      h1, h2 { margin: 0; }
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
      .hero { display: grid; gap: 12px; margin-bottom: 24px; }
      .eyebrow {
        color: var(--ink-soft);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 11px;
      }
      .window-note {
        margin: 4px 0 0;
        padding: 14px 16px;
        border: 1px solid var(--rule);
        background: rgba(255,255,255,0.54);
      }
      .chart-card, .table-card {
        background: var(--panel);
        border: 1px solid var(--rule);
        padding: 16px 18px;
        backdrop-filter: blur(6px);
      }
      .scope-block {
        display: grid;
        gap: 18px;
        margin-bottom: 28px;
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
      .scope-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
      }
      .tables {
        display: grid;
        grid-template-columns: 1fr;
        gap: 18px;
      }
      .table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th, td {
        text-align: left;
        padding: 12px 10px;
        border-top: 1px solid var(--rule);
        vertical-align: top;
      }
      th {
        color: var(--ink-soft);
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .report-table {
        table-layout: fixed;
      }
      .report-table th:nth-child(1),
      .report-table td:nth-child(1) { width: 18%; }
      .report-table th:nth-child(2),
      .report-table td:nth-child(2) { width: 8%; }
      .report-table th:nth-child(3),
      .report-table td:nth-child(3),
      .report-table th:nth-child(4),
      .report-table td:nth-child(4) { width: 8%; }
      .report-table th:nth-child(5),
      .report-table td:nth-child(5) { width: 10%; }
      .report-table th:nth-child(6),
      .report-table td:nth-child(6) { width: 16%; }
      .report-table th:nth-child(7),
      .report-table td:nth-child(7) { width: 32%; }
      .report-table--phrases th:nth-child(2),
      .report-table--phrases td:nth-child(2) { width: 14%; }
      .report-table--phrases th:nth-child(6),
      .report-table--phrases td:nth-child(6) { width: 44%; }
      .col-number,
      .col-direction {
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .col-topic,
      .col-phrase,
      .col-phrases,
      .col-examples {
        overflow-wrap: anywhere;
      }
      .phrase-item,
      .example-item {
        line-height: 1.4;
      }
      .phrase-item + .phrase-item,
      .example-item + .example-item {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(221, 209, 191, 0.55);
      }
      .heatmap-card { overflow: hidden; }
      .heatmap-wrap { overflow-x: auto; }
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
      .heat-label {
        font-weight: 600;
        min-width: 180px;
        background: rgba(255,255,255,0.66);
      }
      .heat-cell {
        min-width: 58px;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .heat-summary {
        font-variant-numeric: tabular-nums;
      }
      @media (max-width: 980px) {
        .tables { grid-template-columns: 1fr; }
        .scope-header,
        .chart-head {
          display: grid;
        }
        .report-table {
          min-width: 980px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="eyebrow">One-off news trend report</div>
        <h1>News Topic Trend Report</h1>
        <p>
          This report looks at the game-news items we have captured so far and answers a simple question:
          what topics are showing up more often, what topics are fading, and what language is driving that shift?
        </p>
        <p>
          Capture window UTC: <strong>${escapeHtml(metadata.windowStartUtc)}</strong> to
          <strong>${escapeHtml(metadata.windowEndUtc)}</strong>.
          The charts use <strong>${REPORT_TZ}</strong> ${metadata.bucketMode === 'day' ? 'days' : 'weeks'}, covering
          <strong>${escapeHtml(metadata.windowStartDayPt)}</strong> to
          <strong>${escapeHtml(metadata.windowEndDayPt)}</strong>.
        </p>
        <p>
          Important: this report uses when an item first entered our dataset, not the original article publish date.
          That keeps the trend window aligned with the data we actually have.
        </p>
        <p class="window-note">
          <strong>Capture window:</strong> ${escapeHtml(metadata.windowStartUtc)} to ${escapeHtml(metadata.windowEndUtc)} UTC.
          In ${escapeHtml(REPORT_TZ)}, that covers ${escapeHtml(metadata.windowStartDayPt)} to ${escapeHtml(metadata.windowEndDayPt)}.
        </p>
      </section>

      ${FEED_SCOPES.map((scopeDef) => {
        const scopeReport = scopeDef.key === 'community_announcements' ? report.community : report.external;
        return `
          <section class="scope-block">
            <div class="scope-header">
              <h2>${escapeHtml(scopeDef.label)}</h2>
              <p>${escapeHtml(scopeDef.description)}</p>
            </div>
            ${renderDumbbellChart(`${scopeDef.label}: What Showed Up More vs Less`, scopeReport.metrics, {
              earlyLabel: metadata.segments.earlyLabel,
              lateLabel: metadata.segments.lateLabel,
              color: scopeDef.color,
            })}
            ${renderThemeHeatmap(`${scopeDef.label}: Topic Share Over Time`, scopeReport.metrics, metadata.bucketKeys, metadata.bucketMode)}
            <section class="tables">
              ${renderThemeTable(`${scopeDef.label}: Topics Showing Up More Often`, scopeReport.upThemes)}
              ${renderThemeTable(`${scopeDef.label}: Topics Showing Up Less Often`, scopeReport.downThemes)}
            </section>
          </section>
        `;
      }).join('')}

      <section class="tables">
        ${renderPhraseTable('Phrases Showing Up More Often', report.topRisingPhrases)}
        ${renderPhraseTable('Phrases Showing Up Less Often', report.topFallingPhrases)}
      </section>
    </main>
  </body>
</html>`;
}

function buildScopeReport(scopeSummary) {
  const metrics = scopeSummary.themeMetrics
    .map((metric) => ({
      ...metric,
      bucketShares: scopeSummary.bucketKeys.map((bucketKey) => ({
        bucketKey,
        docShare: metric.bucketCountsByBucket.get(bucketKey) ?? 0,
      })),
    }));

  return {
    metrics,
    upThemes: sortThemesByTrend(metrics, 'up').slice(0, 8),
    downThemes: sortThemesByTrend(metrics, 'down').slice(0, 8),
  };
}

function writeCsv(filePath, headers, rows) {
  ensureDir(filePath);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const exportRawArticles = isTruthyEnv(process.env.EXPORT_RAW_ARTICLES, false);
  ensureDir(SQL_PATH);
  ensureDir(TOPIC_TIMESERIES_CSV_PATH);
  ensureDir(PHRASE_SUMMARY_CSV_PATH);
  ensureDir(MD_PATH);

  fs.writeFileSync(SQL_PATH, buildSqlArtifact(), 'utf8');
  if (fs.existsSync(TMP_BASE_EXPORT_PATH) && fs.statSync(TMP_BASE_EXPORT_PATH).size > 0) {
    console.log(`Reusing ${path.relative(REPO_ROOT, TMP_BASE_EXPORT_PATH)}`);
  } else {
    exportLargeCsv(BASE_NEWS_EXPORT_SQL, TMP_BASE_EXPORT_PATH);
  }

  const inspection = await inspectExport(TMP_BASE_EXPORT_PATH);
  const allDays = buildDateRange(inspection.minDay, inspection.maxDay);
  const daySpan = allDays.length;
  const bucketMode = daySpan <= 45 ? 'day' : 'week';
  const bucketKeys = bucketMode === 'day'
    ? allDays
    : buildWeekRange(inspection.minDay, inspection.maxDay);
  const segments = buildSegments(bucketKeys);

  const processed = await processExport(TMP_BASE_EXPORT_PATH, {
    bucketMode,
    bucketKeys,
    segments,
    writeRawArticles: exportRawArticles,
  });

  const scopeSummaryMap = new Map();
  for (const scopeSummary of processed.scopeSummaries) {
    const enrichedThemeMetrics = scopeSummary.themeMetrics.map((metric) => {
      const bucketCountsByBucket = new Map();
      for (const row of processed.topicTimeseriesRows) {
        if (row.scope !== scopeSummary.scopeKey || row.theme !== metric.theme) continue;
        bucketCountsByBucket.set(row.bucket_key, Number(row.doc_share));
      }
      return { ...metric, bucketCountsByBucket };
    });
    scopeSummaryMap.set(scopeSummary.scopeKey, {
      ...scopeSummary,
      bucketKeys,
      themeMetrics: enrichedThemeMetrics,
    });
  }

  const communitySummary = scopeSummaryMap.get('community_announcements');
  const externalSummary = scopeSummaryMap.get('external_coverage');

  const topRisingPhrases = [...processed.phraseSummaryRows]
    .sort((left, right) => Number(right.trend_delta) - Number(left.trend_delta) || Number(right.doc_count) - Number(left.doc_count))
    .slice(0, 12)
    .map((row) => ({
      theme: row.theme,
      phrase: row.phrase,
      docCount: Number(row.doc_count),
      earlyShare: Number(row.early_share),
      lateShare: Number(row.late_share),
      trendDelta: Number(row.trend_delta),
      sampleTitles: row.sample_titles,
    }));
  const topFallingPhrases = [...processed.phraseSummaryRows]
    .sort((left, right) => Number(left.trend_delta) - Number(right.trend_delta) || Number(right.doc_count) - Number(left.doc_count))
    .slice(0, 12)
    .map((row) => ({
      theme: row.theme,
      phrase: row.phrase,
      docCount: Number(row.doc_count),
      earlyShare: Number(row.early_share),
      lateShare: Number(row.late_share),
      trendDelta: Number(row.trend_delta),
      sampleTitles: row.sample_titles,
    }));

  const report = {
    community: communitySummary ? buildScopeReport(communitySummary) : { metrics: [], upThemes: [], downThemes: [] },
    external: externalSummary ? buildScopeReport(externalSummary) : { metrics: [], upThemes: [], downThemes: [] },
    topRisingPhrases,
    topFallingPhrases,
  };

  const metadata = {
    windowStartUtc: inspection.minCapturedAt,
    windowEndUtc: inspection.maxCapturedAt,
    windowStartDayPt: inspection.minDay,
    windowEndDayPt: inspection.maxDay,
    totalDocs: inspection.totalDocs,
    totalApps: inspection.totalApps,
    scopeCounts: inspection.scopeCounts,
    bucketMode,
    bucketKeys,
    segments,
  };

  writeCsv(TOPIC_TIMESERIES_CSV_PATH, [
    'scope',
    'bucket_granularity',
    'bucket_key',
    'bucket_label',
    'theme',
    'doc_count',
    'bucket_total_docs',
    'doc_share',
    'early_share',
    'late_share',
    'trend_delta',
  ], processed.topicTimeseriesRows);

  writeCsv(PHRASE_SUMMARY_CSV_PATH, [
    'scope',
    'theme',
    'phrase',
    'doc_count',
    'early_share',
    'late_share',
    'trend_delta',
    'sample_titles',
  ], processed.phraseSummaryRows);

  fs.writeFileSync(MD_PATH, buildMarkdown(metadata, report), 'utf8');
  fs.writeFileSync(HTML_PATH, buildHtml(metadata, report), 'utf8');

  const uploadedArtifacts = await uploadArtifactsToStorage([
    SQL_PATH,
    ...(exportRawArticles ? [RAW_ARTICLES_CSV_PATH] : []),
    TOPIC_TIMESERIES_CSV_PATH,
    PHRASE_SUMMARY_CSV_PATH,
    MD_PATH,
    HTML_PATH,
  ]);

  try {
    fs.unlinkSync(TMP_BASE_EXPORT_PATH);
  } catch {}

  console.log(`Wrote ${path.relative(REPO_ROOT, SQL_PATH)}`);
  if (exportRawArticles) {
    console.log(`Wrote ${path.relative(REPO_ROOT, RAW_ARTICLES_CSV_PATH)}`);
  } else {
    console.log('Skipped raw articles CSV. Set EXPORT_RAW_ARTICLES=1 to emit it.');
  }
  console.log(`Wrote ${path.relative(REPO_ROOT, TOPIC_TIMESERIES_CSV_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, PHRASE_SUMMARY_CSV_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, MD_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, HTML_PATH)}`);
  for (const uploadedArtifact of uploadedArtifacts) {
    console.log(`Uploaded ${uploadedArtifact}`);
  }
}

await main();
