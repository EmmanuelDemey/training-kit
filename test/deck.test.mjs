import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DECK_FILE, renderDeck, writeDeck } from '../src/deck.mjs';
import { resolveConfig } from '../src/config.mjs';
import { tree } from './tree.mjs';

test('opens on a cover built from the headmatter, then imports every chapter in order', () => {
  const deck = renderDeck({
    title: 'Advanced Vue.js',
    author: 'Jane Doe',
    theme: 'seriph',
    headmatter: {},
    chapters: ['1-intro.md', '2-reactivity.md'],
  });

  assert.equal(
    deck,
    [
      '---',
      'theme: seriph',
      'title: Advanced Vue.js',
      '---',
      '',
      '# Advanced Vue.js',
      '',
      'Jane Doe',
      '',
      '---',
      'src: ./1-intro.md',
      '---',
      '',
      '---',
      'src: ./2-reactivity.md',
      '---',
      '',
    ].join('\n'),
  );
});

test('passes any other Slidev headmatter through, and lets it override the defaults', () => {
  const deck = renderDeck({
    title: 'T',
    theme: 'default',
    headmatter: { theme: 'seriph', lineNumbers: true, info: 'Two lines\nof info' },
    chapters: [],
  });

  assert.match(deck, /^---\ntheme: seriph\ntitle: T\nlineNumbers: true\ninfo: \|-\n  Two lines\n  of info\n---\n/);
});

test('writes the deck next to the chapters, which is where Slidev resolves `src:` from', async () => {
  const root = await tree({ 'slides/2-b.md': '# B', 'slides/1-a.md': '# A', 'slides/notes.md': '' });
  const config = resolveConfig({ title: 'T' }, root);

  const { file, chapters, ignored, changed } = await writeDeck(config);

  assert.equal(file, join(root, 'slides', DECK_FILE));
  assert.deepEqual(
    chapters.map((chapter) => chapter.name),
    ['1-a.md', '2-b.md'],
  );
  assert.deepEqual(
    ignored.map((entry) => entry.name),
    ['notes.md'],
  );
  assert.equal(changed, true);
  assert.match(await readFile(file, 'utf8'), /src: \.\/1-a\.md[\s\S]*src: \.\/2-b\.md/);
});

test('leaves the file alone when nothing changed, so a running Slidev does not reload for nothing', async () => {
  const root = await tree({ 'slides/1-a.md': '' });
  const config = resolveConfig({ title: 'T' }, root);

  await writeDeck(config);
  const second = await writeDeck(config);

  assert.equal(second.changed, false);
});

test('never lists the deck it generated among the chapters', async () => {
  const root = await tree({ 'slides/1-a.md': '' });
  const config = resolveConfig({ title: 'T' }, root);

  await writeDeck(config);
  const { ignored } = await writeDeck(config);

  assert.deepEqual(ignored, []);
});

test('says which folder is missing', async () => {
  const root = await tree({});
  const config = resolveConfig({ title: 'T', slides: 'chapters' }, root);

  await assert.rejects(writeDeck(config), /slides folder not found: .*chapters/);
});
