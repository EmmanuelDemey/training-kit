import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { slideRecords, writeSlidesIndex } from '../../src/deck/deck-search.mjs';
import { tree } from '../helpers/tree.mjs';

const deck = async (chapter) => {
  const root = await tree({
    'slides/deck.md': '---\ntitle: Cover\n---\n\n# Cover\n\n---\nsrc: ./1-a.md\n---\n',
    'slides/1-a.md': chapter,
  });
  return join(root, 'slides/deck.md');
};

test('one search record per slide, linking its route in the deck, its text without the Markdown, tagged as a slide', async () => {
  const deckFile = await deck(
    '# Intro\n\nHello **world**, see [the docs](https://x.y)\n\n---\n\n## Second\n\n```js\nconst x = 1\n```\n',
  );

  const records = await slideRecords({ deckFile, base: '/slides/', lang: 'fr' });

  assert.deepEqual(records, [
    { url: '/slides/1', content: 'Cover', language: 'fr', meta: { title: 'Slide 1 — Cover', source: 'Slides' } },
    {
      url: '/slides/2',
      content: 'Intro Hello world, see the docs',
      language: 'fr',
      meta: { title: 'Slide 2 — Intro', source: 'Slides' },
    },
    {
      url: '/slides/3',
      content: 'Second const x = 1',
      language: 'fr',
      meta: { title: 'Slide 3 — Second', source: 'Slides' },
    },
  ]);
});

test('a hidden slide is not searchable, and has no route: the next slide takes its number', async () => {
  const deckFile = await deck('# A\n\n---\nhide: true\n---\n\n# Hidden\n\n---\n\n# B\n');

  const records = await slideRecords({ deckFile, base: '/slides/', lang: 'en' });

  assert.deepEqual(
    records.map(({ url, meta }) => [url, meta.title]),
    [
      ['/slides/1', 'Slide 1 — Cover'],
      ['/slides/2', 'Slide 2 — A'],
      ['/slides/3', 'Slide 3 — B'],
    ],
  );
});

test('writes a Pagefind index of the slides, for the site to merge into its own', async () => {
  const deckFile = await deck('# Reactivity\n\nA `ref` wraps a value.\n');
  const outDir = join(dirname(deckFile), 'out');

  const { pages } = await writeSlidesIndex({ deckFile, base: '/slides/', lang: 'en', outDir });

  assert.equal(pages, 2);
  assert.ok(existsSync(join(outDir, 'pagefind-entry.json')));
  const entry = JSON.parse(await readFile(join(outDir, 'pagefind-entry.json'), 'utf8'));
  assert.equal(entry.languages.en.page_count, 2);
});

test('a slide without a heading is named by its number alone', async () => {
  const deckFile = await deck('Just text\n');

  const [, record] = await slideRecords({ deckFile, base: '/slides/', lang: 'en' });

  assert.equal(record.meta.title, 'Slide 2');
});
