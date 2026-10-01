import { test } from 'vitest';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.mjs';
import { renderHeaders, renderRedirects } from '../src/hosting.mjs';

test('sends every deck route to its index, since Slidev routes on the client', () => {
  assert.equal(renderRedirects(), '/slides/*  /slides/index.html  200\n');
});

test('isolates the workshop pages when they embed the online editor, and only them', () => {
  const config = resolveConfig({ title: 'T', playground: true }, '/work/t');

  assert.equal(
    renderHeaders(config),
    '/workshops/*\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n',
  );
});

test('sends no header at all without the online editor', () => {
  assert.equal(renderHeaders(resolveConfig({ title: 'T' }, '/work/t')), null);
});
