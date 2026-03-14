import assert from 'node:assert/strict';
import test from 'node:test';
import { diffNewsVersions, normalizeNewsVersion } from './news.js';
import {
  collectChangedHeroAssets,
  diffStorefrontMedia,
  diffStorefrontSnapshots,
  normalizeStorefrontMediaVersion,
  normalizeStorefrontSnapshot,
} from './storefront.js';

const baseSnapshot = normalizeStorefrontSnapshot({
  appid: 10,
  name: 'Example',
  type: 'game',
  isFree: false,
  isDelisted: false,
  developers: ['Studio'],
  publishers: ['Publisher'],
  releaseDate: '2026-03-01',
  releaseDateRaw: 'Mar 1, 2026',
  comingSoon: false,
  hasWorkshop: false,
  priceCents: 1999,
  discountPercent: 0,
  categories: [{ id: 1, description: 'Single-player' }],
  genres: [{ id: '1', description: 'Action' }],
  platforms: { windows: true, mac: false, linux: false },
  metacriticScore: null,
  totalRecommendations: 100,
  dlcAppids: [],
  parentAppid: null,
  detailedDescription: 'Detailed copy',
  aboutTheGame: 'About copy',
  shortDescription: 'Short copy',
  supportedLanguages: 'English',
  controllerSupport: 'full',
  headerImage: 'https://cdn.example.com/header.jpg',
  capsuleImage: 'https://cdn.example.com/capsule.jpg',
  backgroundImage: 'https://cdn.example.com/background.jpg',
  website: 'https://example.com',
  packageIds: [1],
  packageGroupSubs: [10],
  screenshots: [{ id: 1, thumbnailUrl: 'https://cdn.example.com/shot-thumb.jpg', fullUrl: 'https://cdn.example.com/shot.jpg' }],
  movies: [{ id: 1, name: 'Trailer', thumbnailUrl: 'https://cdn.example.com/trailer.jpg', mp4Url: 'https://cdn.example.com/trailer.mp4', webmUrl: null, highlight: true }],
});

test('storefront snapshot diff detects content changes', () => {
  const changedSnapshot = {
    ...baseSnapshot,
    releaseDateText: 'March 15, 2026',
    descriptions: {
      ...baseSnapshot.descriptions,
      short: 'Sharper short copy',
      detailed: 'Updated copy',
    },
    price: {
      currentCents: 1499,
      discountPercent: 25,
    },
    developers: ['Studio', 'Co-Dev'],
    packageIds: [1, 2],
  };

  const events = diffStorefrontSnapshots(baseSnapshot, changedSnapshot);
  const types = events.map((event) => event.eventType);

  assert.ok(types.includes('description_rewrite'));
  assert.ok(types.includes('short_description_rewrite'));
  assert.ok(types.includes('release_date_text_change'));
  assert.ok(types.includes('price_change'));
  assert.ok(types.includes('discount_start'));
  assert.ok(types.includes('developer_association_changed'));
  assert.ok(types.includes('package_references_changed'));
});

test('storefront media diff detects hero, screenshot, and trailer changes', () => {
  const previousMedia = normalizeStorefrontMediaVersion(baseSnapshot);
  const nextMedia = {
    ...previousMedia,
    heroImages: {
      ...previousMedia.heroImages,
      header: 'https://cdn.example.com/header-v2.jpg',
    },
    screenshots: [
      previousMedia.screenshots[0],
      {
        id: 2,
        fullUrl: 'https://cdn.example.com/shot-2.jpg',
        thumbnailUrl: 'https://cdn.example.com/shot-2-thumb.jpg',
        order: 1,
      },
    ],
    movies: [
      {
        ...previousMedia.movies[0],
        thumbnailUrl: 'https://cdn.example.com/trailer-v2.jpg',
      },
    ],
  };

  const events = diffStorefrontMedia(previousMedia, nextMedia);
  const types = events.map((event) => event.eventType);

  assert.ok(types.includes('header_url_changed'));
  assert.ok(types.includes('screenshot_added'));
  assert.ok(types.includes('trailer_thumbnail_changed'));
});

test('collectChangedHeroAssets ignores background-only changes', () => {
  const previousMedia = normalizeStorefrontMediaVersion(baseSnapshot);
  const nextMedia = {
    ...previousMedia,
    heroImages: {
      ...previousMedia.heroImages,
      background: 'https://cdn.example.com/background-v2.jpg',
    },
  };

  assert.deepEqual(collectChangedHeroAssets(previousMedia, nextMedia), []);
});

test('news diff distinguishes publish from edit', () => {
  const published = normalizeNewsVersion({
    gid: '100',
    title: 'Patch Notes',
    url: 'https://store.steampowered.com/news/app/10/view/100',
    author: 'Valve',
    contents: 'Initial notes',
    feedlabel: 'Patchnotes',
    date: 1_700_000_000,
    feedname: 'steam_updates',
  });

  assert.deepEqual(diffNewsVersions(null, published).map((event) => event.eventType), ['news_published']);

  const edited = {
    ...published,
    contents: 'Updated notes',
  };
  assert.deepEqual(diffNewsVersions(published, edited).map((event) => event.eventType), ['news_edited']);
});
