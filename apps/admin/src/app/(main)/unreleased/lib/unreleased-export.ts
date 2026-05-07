import type { UnreleasedGame } from './unreleased-types';

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join(' | ') : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function steamAppUrl(appid: number): string {
  return `https://store.steampowered.com/app/${appid}`;
}

export function publisheriqAppUrl(appid: number): string {
  return `/apps/${appid}`;
}

export function generateUnreleasedCsv(games: UnreleasedGame[]): string {
  const headers = [
    'appid',
    'name',
    'release_date',
    'release_date_raw',
    'release_status',
    'days_until_release',
    'publisher',
    'developer',
    'publisher_status',
    'opportunity_score',
    'latest_added_at',
    'latest_change_at',
    'latest_change_type',
    'latest_change_summary',
    'latest_news_at',
    'latest_news_title',
    'change_count_30d',
    'announcement_count_30d',
    'media_count_30d',
    'taxonomy_count_30d',
    'screenshots',
    'trailers',
    'adult_content',
    'genres',
    'tags',
    'categories',
    'platforms',
    'is_free',
    'has_purchase_packages',
    'steam_url',
    'publisheriq_url',
  ];

  const rows = games.map((game) => [
    game.appid,
    game.name,
    game.release_date,
    game.release_date_raw,
    game.release_status,
    game.days_until_release,
    game.publisher_name,
    game.developer_name,
    game.publisher_status,
    game.opportunity_score,
    game.latest_added_at,
    game.latest_change_at,
    game.latest_change_type,
    game.latest_change_summary,
    game.latest_news_at,
    game.latest_news_title,
    game.change_count_30d,
    game.announcement_count_30d,
    game.media_count_30d,
    game.taxonomy_count_30d,
    game.screenshot_count,
    game.movie_count,
    game.is_adult_content ? 'yes' : 'no',
    game.genre_names,
    game.tag_names,
    game.category_names,
    game.platform_array,
    game.is_free ? 'yes' : 'no',
    game.has_purchase_packages ? 'yes' : 'no',
    steamAppUrl(game.appid),
    publisheriqAppUrl(game.appid),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function unreleasedCsvFilename(scope: 'selected' | 'visible'): string {
  return `unreleased-games-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
}
