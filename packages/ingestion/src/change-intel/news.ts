import { normalizeText, normalizeUrl } from './hashing.js';
import type { AppChangeEventDraft, NormalizedNewsVersion } from './types.js';

export interface SteamNewsItemInput {
  gid: string;
  title: string;
  url: string;
  author: string;
  contents: string;
  feedlabel: string;
  date: number;
  feedname: string;
}

export function normalizeNewsVersion(item: SteamNewsItemInput): NormalizedNewsVersion {
  return {
    gid: item.gid,
    title: normalizeText(item.title) ?? '',
    url: normalizeUrl(item.url) ?? '',
    author: normalizeText(item.author),
    contents: normalizeText(item.contents),
    feedlabel: normalizeText(item.feedlabel),
    feedname: normalizeText(item.feedname),
    publishedAt: new Date(item.date * 1000).toISOString(),
  };
}

export function diffNewsVersions(
  previousVersion: NormalizedNewsVersion | null,
  nextVersion: NormalizedNewsVersion
): AppChangeEventDraft[] {
  if (!previousVersion) {
    return [
      {
        eventType: 'news_published',
        source: 'news',
        afterValue: nextVersion,
      },
    ];
  }

  if (JSON.stringify(previousVersion) === JSON.stringify(nextVersion)) {
    return [];
  }

  return [
    {
      eventType: 'news_edited',
      source: 'news',
      beforeValue: previousVersion,
      afterValue: nextVersion,
    },
  ];
}
