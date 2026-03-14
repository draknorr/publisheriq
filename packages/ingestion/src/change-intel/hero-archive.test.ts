import assert from 'node:assert/strict';
import test from 'node:test';
import { extractHeroAssets, readImageMeta } from './hero-archive.js';

test('extractHeroAssets returns populated hero asset descriptors only', () => {
  const assets = extractHeroAssets({
    heroImages: {
      header: 'https://cdn.example.com/header.jpg',
      capsule: null,
      background: 'https://cdn.example.com/background.webp',
    },
    screenshots: [],
    movies: [],
  });

  assert.deepEqual(assets, [
    { kind: 'header', url: 'https://cdn.example.com/header.jpg' },
  ]);
});

test('readImageMeta parses PNG dimensions from headers', () => {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(640, 16);
  buffer.writeUInt32BE(360, 20);

  assert.deepEqual(readImageMeta(buffer, 'image/png'), {
    width: 640,
    height: 360,
    mimeType: 'image/png',
  });
});

test('readImageMeta parses JPEG and WebP dimensions from headers', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x03, 0x01]);
  assert.deepEqual(readImageMeta(jpeg, 'image/jpeg'), {
    width: 200,
    height: 100,
    mimeType: 'image/jpeg',
  });

  const webp = Buffer.alloc(30);
  webp.write('RIFF', 0, 'ascii');
  webp.write('WEBP', 8, 'ascii');
  webp.write('VP8X', 12, 'ascii');
  webp.writeUIntLE(1279, 24, 3);
  webp.writeUIntLE(719, 27, 3);

  assert.deepEqual(readImageMeta(webp, 'image/webp'), {
    width: 1280,
    height: 720,
    mimeType: 'image/webp',
  });
});
