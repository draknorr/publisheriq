import {
  getDefaultChangeActivitySort,
  parseChangeActivityView,
} from './change-feed-query';

export type ChangeFeedFilterUpdateValue = string | string[] | null;

export interface ChangeFeedSelectedGameParam {
  appid: number;
  name: string;
}

export function parseChangeFeedAppIds(value: string | null | undefined): number[] {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isInteger(entry) && entry > 0)
    )
  );
}

export function parseChangeFeedSelectedGames(
  searchParams: URLSearchParams
): ChangeFeedSelectedGameParam[] {
  const appIds = parseChangeFeedAppIds(searchParams.get('appIds'));
  const appNames = searchParams.getAll('appNames');

  return appIds.map((appid, index) => ({
    appid,
    name: appNames[index]?.trim() || `App ${appid}`,
  }));
}

export function buildChangeFeedUrl(
  pathname: string,
  searchParams: URLSearchParams,
  updates: Record<string, ChangeFeedFilterUpdateValue>
): string {
  const params = new URLSearchParams(searchParams.toString());
  const nextViewUpdate = Array.isArray(updates.view) ? updates.view[0] : updates.view;
  const nextView = parseChangeActivityView(nextViewUpdate ?? searchParams.get('view'));
  const defaultSort = getDefaultChangeActivitySort(nextView);

  for (const [key, value] of Object.entries(updates)) {
    params.delete(key);

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }

      if (key === 'appNames') {
        value.forEach((entry) => params.append(key, entry));
      } else {
        params.set(key, value.join(','));
      }
      continue;
    }

    const shouldDelete =
      value == null ||
      value === '' ||
      (value === 'all' && key !== 'history') ||
      (key === 'view' && value === 'overview') ||
      (key === 'mode' && value === 'all') ||
      (key === 'range' && value === '7d') ||
      (key === 'sort' && value === defaultSort) ||
      (key === 'history' && value === 'range') ||
      (key === 'inspector' && value !== 'full');

    if (!shouldDelete) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildChangeFeedActivityPermalink(
  activityId: string,
  origin: string
): string {
  const params = new URLSearchParams();
  params.set('activity', activityId);
  params.set('inspector', 'full');
  return `${origin}/changes?${params.toString()}`;
}
