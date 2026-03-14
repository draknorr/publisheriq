import type { ParsedStorefrontApp } from '../apis/storefront.js';
import { arraysEqual, normalizeStringArray, normalizeText, normalizeUrl } from './hashing.js';
import type {
  AppChangeEventDraft,
  HeroAssetDescriptor,
  NormalizedMediaVersion,
  NormalizedStorefrontSnapshot,
  StorefrontMovie,
  StorefrontScreenshot,
} from './types.js';

function normalizeCategories(
  values: Array<{ id: number; description: string }>
): Array<{ id: number; description: string }> {
  return [...values]
    .map((entry) => ({
      id: entry.id,
      description: normalizeText(entry.description) ?? '',
    }))
    .sort((left, right) => left.id - right.id);
}

function normalizeGenres(
  values: Array<{ id: string; description: string }>
): Array<{ id: string; description: string }> {
  return [...values]
    .map((entry) => ({
      id: entry.id.trim(),
      description: normalizeText(entry.description) ?? '',
    }))
    .sort((left, right) => {
      const leftNumber = Number(left.id);
      const rightNumber = Number(right.id);

      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }

      return left.id.localeCompare(right.id);
    });
}

function normalizeScreenshots(values: ParsedStorefrontApp['screenshots']): StorefrontScreenshot[] {
  return values
    .map((entry, index) => ({
      id: entry.id ?? null,
      fullUrl: normalizeUrl(entry.fullUrl) ?? '',
      thumbnailUrl: normalizeUrl(entry.thumbnailUrl),
      order: index,
    }))
    .filter((entry) => entry.fullUrl.length > 0);
}

function normalizeMovies(values: ParsedStorefrontApp['movies']): StorefrontMovie[] {
  return values
    .map((entry, index) => ({
      id: entry.id ?? null,
      name: normalizeText(entry.name),
      highlight: Boolean(entry.highlight),
      thumbnailUrl: normalizeUrl(entry.thumbnailUrl),
      mp4Url: normalizeUrl(entry.mp4Url),
      webmUrl: normalizeUrl(entry.webmUrl),
      order: index,
    }))
    .filter((entry) => entry.mp4Url || entry.webmUrl || entry.thumbnailUrl);
}

function collectAdded<T>(nextValues: T[], previousValues: T[]): T[] {
  const previousSet = new Set(previousValues.map((value) => JSON.stringify(value)));
  return nextValues.filter((value) => !previousSet.has(JSON.stringify(value)));
}

function collectRemoved<T>(previousValues: T[], nextValues: T[]): T[] {
  const nextSet = new Set(nextValues.map((value) => JSON.stringify(value)));
  return previousValues.filter((value) => !nextSet.has(JSON.stringify(value)));
}

function maybePushArrayChange(
  events: AppChangeEventDraft[],
  eventType: AppChangeEventDraft['eventType'],
  source: AppChangeEventDraft['source'],
  previousValues: string[],
  nextValues: string[]
): void {
  if (arraysEqual(previousValues, nextValues)) {
    return;
  }

  events.push({
    eventType,
    source,
    beforeValue: previousValues,
    afterValue: nextValues,
    context: {
      added: collectAdded(nextValues, previousValues),
      removed: collectRemoved(previousValues, nextValues),
    },
  });
}

export function normalizeStorefrontSnapshot(details: ParsedStorefrontApp): NormalizedStorefrontSnapshot {
  return {
    name: details.name,
    type: details.type,
    isFree: details.isFree,
    isDelisted: details.isDelisted,
    comingSoon: details.comingSoon,
    releaseDate: details.releaseDate,
    releaseDateText: normalizeText(details.releaseDateRaw),
    descriptions: {
      short: normalizeText(details.shortDescription),
      about: normalizeText(details.aboutTheGame),
      detailed: normalizeText(details.detailedDescription),
    },
    supportedLanguages: normalizeText(details.supportedLanguages),
    developers: normalizeStringArray(details.developers),
    publishers: normalizeStringArray(details.publishers),
    price: {
      currentCents: details.priceCents,
      discountPercent: details.discountPercent,
    },
    categories: normalizeCategories(details.categories),
    genres: normalizeGenres(details.genres),
    platforms: {
      windows: Boolean(details.platforms.windows),
      mac: Boolean(details.platforms.mac),
      linux: Boolean(details.platforms.linux),
    },
    controllerSupport: normalizeText(details.controllerSupport),
    dlcAppids: [...details.dlcAppids].sort((left, right) => left - right),
    packageIds: [...details.packageIds].sort((left, right) => left - right),
    packageGroupSubs: [...details.packageGroupSubs].sort((left, right) => left - right),
    heroImages: {
      header: normalizeUrl(details.headerImage),
      capsule: normalizeUrl(details.capsuleImage),
      background: normalizeUrl(details.backgroundImage),
    },
    screenshots: normalizeScreenshots(details.screenshots),
    movies: normalizeMovies(details.movies),
  };
}

export function normalizeStorefrontMediaVersion(
  snapshot: NormalizedStorefrontSnapshot
): NormalizedMediaVersion {
  return {
    heroImages: snapshot.heroImages,
    screenshots: snapshot.screenshots,
    movies: snapshot.movies,
  };
}

export function diffStorefrontSnapshots(
  previousSnapshot: NormalizedStorefrontSnapshot | null,
  nextSnapshot: NormalizedStorefrontSnapshot
): AppChangeEventDraft[] {
  if (!previousSnapshot) {
    return [];
  }

  const events: AppChangeEventDraft[] = [];

  if (previousSnapshot.descriptions.short !== nextSnapshot.descriptions.short) {
    events.push({
      eventType: 'short_description_rewrite',
      source: 'storefront',
      beforeValue: previousSnapshot.descriptions.short,
      afterValue: nextSnapshot.descriptions.short,
    });
  }

  if (
    previousSnapshot.descriptions.about !== nextSnapshot.descriptions.about ||
    previousSnapshot.descriptions.detailed !== nextSnapshot.descriptions.detailed
  ) {
    events.push({
      eventType: 'description_rewrite',
      source: 'storefront',
      beforeValue: {
        about: previousSnapshot.descriptions.about,
        detailed: previousSnapshot.descriptions.detailed,
      },
      afterValue: {
        about: nextSnapshot.descriptions.about,
        detailed: nextSnapshot.descriptions.detailed,
      },
    });
  }

  if (previousSnapshot.releaseDateText !== nextSnapshot.releaseDateText) {
    events.push({
      eventType: 'release_date_text_change',
      source: 'storefront',
      beforeValue: previousSnapshot.releaseDateText,
      afterValue: nextSnapshot.releaseDateText,
    });
  }

  if (previousSnapshot.price.currentCents !== nextSnapshot.price.currentCents) {
    events.push({
      eventType: 'price_change',
      source: 'storefront',
      beforeValue: previousSnapshot.price.currentCents,
      afterValue: nextSnapshot.price.currentCents,
    });
  }

  if (previousSnapshot.price.discountPercent === 0 && nextSnapshot.price.discountPercent > 0) {
    events.push({
      eventType: 'discount_start',
      source: 'storefront',
      beforeValue: previousSnapshot.price.discountPercent,
      afterValue: nextSnapshot.price.discountPercent,
    });
  }

  if (previousSnapshot.price.discountPercent > 0 && nextSnapshot.price.discountPercent === 0) {
    events.push({
      eventType: 'discount_end',
      source: 'storefront',
      beforeValue: previousSnapshot.price.discountPercent,
      afterValue: nextSnapshot.price.discountPercent,
    });
  }

  maybePushArrayChange(
    events,
    'genres_changed',
    'storefront',
    previousSnapshot.genres.map((genre) => genre.description),
    nextSnapshot.genres.map((genre) => genre.description)
  );
  maybePushArrayChange(
    events,
    'categories_changed',
    'storefront',
    previousSnapshot.categories.map((category) => category.description),
    nextSnapshot.categories.map((category) => category.description)
  );
  maybePushArrayChange(
    events,
    'languages_changed',
    'storefront',
    normalizeStringArray([previousSnapshot.supportedLanguages]),
    normalizeStringArray([nextSnapshot.supportedLanguages])
  );
  maybePushArrayChange(
    events,
    'platforms_changed',
    'storefront',
    Object.entries(previousSnapshot.platforms)
      .filter(([, enabled]) => enabled)
      .map(([platform]) => platform),
    Object.entries(nextSnapshot.platforms)
      .filter(([, enabled]) => enabled)
      .map(([platform]) => platform)
  );
  maybePushArrayChange(events, 'developer_association_changed', 'storefront', previousSnapshot.developers, nextSnapshot.developers);
  maybePushArrayChange(events, 'publisher_association_changed', 'storefront', previousSnapshot.publishers, nextSnapshot.publishers);
  maybePushArrayChange(
    events,
    'dlc_references_changed',
    'storefront',
    previousSnapshot.dlcAppids.map(String),
    nextSnapshot.dlcAppids.map(String)
  );
  maybePushArrayChange(
    events,
    'package_references_changed',
    'storefront',
    [
      ...previousSnapshot.packageIds.map((packageId) => `package:${packageId}`),
      ...previousSnapshot.packageGroupSubs.map((packageId) => `group-sub:${packageId}`),
    ],
    [
      ...nextSnapshot.packageIds.map((packageId) => `package:${packageId}`),
      ...nextSnapshot.packageGroupSubs.map((packageId) => `group-sub:${packageId}`),
    ]
  );

  if (previousSnapshot.controllerSupport !== nextSnapshot.controllerSupport) {
    events.push({
      eventType: 'controller_support_changed',
      source: 'storefront',
      beforeValue: previousSnapshot.controllerSupport,
      afterValue: nextSnapshot.controllerSupport,
    });
  }

  return events;
}

export function diffStorefrontMedia(
  previousMedia: NormalizedMediaVersion | null,
  nextMedia: NormalizedMediaVersion
): AppChangeEventDraft[] {
  if (!previousMedia) {
    return [];
  }

  const events: AppChangeEventDraft[] = [];

  if (previousMedia.heroImages.header !== nextMedia.heroImages.header) {
    events.push({
      eventType: 'header_url_changed',
      source: 'media',
      beforeValue: previousMedia.heroImages.header,
      afterValue: nextMedia.heroImages.header,
    });
  }

  if (previousMedia.heroImages.capsule !== nextMedia.heroImages.capsule) {
    events.push({
      eventType: 'capsule_url_changed',
      source: 'media',
      beforeValue: previousMedia.heroImages.capsule,
      afterValue: nextMedia.heroImages.capsule,
    });
  }

  if (previousMedia.heroImages.background !== nextMedia.heroImages.background) {
    events.push({
      eventType: 'background_url_changed',
      source: 'media',
      beforeValue: previousMedia.heroImages.background,
      afterValue: nextMedia.heroImages.background,
    });
  }

  const previousScreenshotUrls = previousMedia.screenshots.map((entry) => entry.fullUrl);
  const nextScreenshotUrls = nextMedia.screenshots.map((entry) => entry.fullUrl);
  const addedScreenshots = collectAdded(nextScreenshotUrls, previousScreenshotUrls);
  const removedScreenshots = collectRemoved(previousScreenshotUrls, nextScreenshotUrls);

  if (addedScreenshots.length > 0) {
    events.push({
      eventType: 'screenshot_added',
      source: 'media',
      afterValue: addedScreenshots,
    });
  }

  if (removedScreenshots.length > 0) {
    events.push({
      eventType: 'screenshot_removed',
      source: 'media',
      beforeValue: removedScreenshots,
    });
  }

  if (addedScreenshots.length === 0 && removedScreenshots.length === 0 && !arraysEqual(previousScreenshotUrls, nextScreenshotUrls)) {
    events.push({
      eventType: 'screenshot_reordered',
      source: 'media',
      beforeValue: previousScreenshotUrls,
      afterValue: nextScreenshotUrls,
    });
  }

  const previousMovieKeys = previousMedia.movies.map((entry) => entry.mp4Url ?? entry.webmUrl ?? `movie:${entry.id ?? 'unknown'}`);
  const nextMovieKeys = nextMedia.movies.map((entry) => entry.mp4Url ?? entry.webmUrl ?? `movie:${entry.id ?? 'unknown'}`);
  const addedMovies = collectAdded(nextMovieKeys, previousMovieKeys);
  const removedMovies = collectRemoved(previousMovieKeys, nextMovieKeys);

  if (addedMovies.length > 0) {
    events.push({
      eventType: 'trailer_added',
      source: 'media',
      afterValue: addedMovies,
    });
  }

  if (removedMovies.length > 0) {
    events.push({
      eventType: 'trailer_removed',
      source: 'media',
      beforeValue: removedMovies,
    });
  }

  if (addedMovies.length === 0 && removedMovies.length === 0 && !arraysEqual(previousMovieKeys, nextMovieKeys)) {
    events.push({
      eventType: 'trailer_reordered',
      source: 'media',
      beforeValue: previousMovieKeys,
      afterValue: nextMovieKeys,
    });
  }

  const previousMovieThumbnails = new Map(
    previousMedia.movies.map((entry) => [entry.id ?? Number.NaN, entry.thumbnailUrl])
  );

  for (const movie of nextMedia.movies) {
    if (movie.id === null || !previousMovieThumbnails.has(movie.id)) {
      continue;
    }

    const previousThumbnailUrl = previousMovieThumbnails.get(movie.id) ?? null;
    if (previousThumbnailUrl !== movie.thumbnailUrl) {
      events.push({
        eventType: 'trailer_thumbnail_changed',
        source: 'media',
        beforeValue: previousThumbnailUrl,
        afterValue: movie.thumbnailUrl,
        context: { movieId: movie.id, movieName: movie.name },
      });
    }
  }

  return events;
}

export function collectChangedHeroAssets(
  previousMedia: NormalizedMediaVersion | null,
  nextMedia: NormalizedMediaVersion
): HeroAssetDescriptor[] {
  const assets: HeroAssetDescriptor[] = [];

  if (nextMedia.heroImages.header && previousMedia?.heroImages.header !== nextMedia.heroImages.header) {
    assets.push({ kind: 'header', url: nextMedia.heroImages.header });
  }

  if (nextMedia.heroImages.capsule && previousMedia?.heroImages.capsule !== nextMedia.heroImages.capsule) {
    assets.push({ kind: 'capsule', url: nextMedia.heroImages.capsule });
  }

  return assets;
}
