import { test } from 'vitest';
import assert from 'node:assert/strict';
import { renderHandbook } from '../../src/downloads/handbook.mjs';

const workshops = [
  { name: '1-intro', order: 1, slug: '1-intro', title: 'TP 1 — Intro', body: '## Goal\n\nStart.' },
  { name: '10-last', order: 10, slug: '10-last', title: 'Last <one>', body: 'End.' },
];

test('opens on a cover that names the training, its author and how many workshops it holds', () => {
  const html = renderHandbook({ title: 'Vue & co', author: 'Jane Doe', workshops, overview: null });

  assert.match(html, /<section class="cover">[\s\S]*<h1>Vue &amp; co<\/h1>[\s\S]*2 workshops[\s\S]*Jane Doe/);
});

test('lists the contents under the number of each folder, linking to its page', () => {
  const html = renderHandbook({ title: 'T', author: '', workshops, overview: null });

  assert.match(html, /<a href="#tp-1-intro"><span class="n">1<\/span><span class="t">TP 1 — Intro<\/span>/);
  assert.match(html, /<a href="#tp-10-last"><span class="n">10<\/span><span class="t">Last &lt;one&gt;<\/span>/);
});

test('gives every workshop its own page, its README rendered from Markdown', () => {
  const html = renderHandbook({ title: 'T', author: '', workshops, overview: null });

  assert.match(
    html,
    /<section class="page workshop" id="tp-1-intro">\s*<h1>TP 1 — Intro<\/h1>\s*<p class="folder">1-intro\/<\/p>\s*<h2>Goal<\/h2>/,
  );
  assert.ok(html.indexOf('id="tp-1-intro"') < html.indexOf('id="tp-10-last"'));
});

test('puts the workshops README before the first workshop, only when there is one', () => {
  const withOverview = renderHandbook({ title: 'T', author: '', workshops, overview: { body: 'Read me.' } });
  const without = renderHandbook({ title: 'T', author: '', workshops, overview: null });

  assert.match(withOverview, /<section class="page intro"><h1>About these workshops<\/h1><p>Read me\.<\/p>/);
  assert.doesNotMatch(without, /About these workshops/);
});

test('leaves the hint blocks out of the printed handbook, the rest of the README kept', () => {
  const body = 'Before.\n\n:::hint[Spoiler]\nThe answer is `42`.\n:::\n\nAfter.';
  const html = renderHandbook({ title: 'T', author: '', workshops: [{ ...workshops[0], body }], overview: null });

  assert.doesNotMatch(html, /Spoiler|answer is|:::/);
  assert.match(html, /<p>Before\.<\/p>\s*<p>After\.<\/p>/);
});
