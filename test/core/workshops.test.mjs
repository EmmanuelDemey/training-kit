import { test } from 'vitest';
import assert from 'node:assert/strict';
import { labelOf, parseReadme, readWorkshops } from '../../src/core/workshops.mjs';
import { resolveConfig } from '../../src/core/config.mjs';
import { tree } from '../helpers/tree.mjs';

test('takes the title from the leading heading and drops it from the body', () => {
  const { title, body } = parseReadme('# TP 1 — Devtools\n\n> Find the wasted renders.\n\n## Goal\n', 'fallback');

  assert.equal(title, 'TP 1 — Devtools');
  assert.equal(body, '> Find the wasted renders.\n\n## Goal\n');
});

test('describes the workshop with its opening blockquote, flattened and unformatted', () => {
  const { description } = parseReadme('# T\n\n> This TP is **autonomous**:\n> it uses `npm`.\n\nMore.', 'f');

  assert.equal(description, 'This TP is autonomous: it uses npm.');
});

test('falls back to the first paragraph, then cuts a long description on a word', () => {
  const long = `# T\n\n${'word '.repeat(60)}`;

  const { description } = parseReadme(long, 'f');

  assert.ok(description.length <= 156);
  assert.ok(description.endsWith('word…'));
});

test('uses the folder name when there is no heading near the top', () => {
  assert.equal(parseReadme('Just text', '3-routing').title, '3-routing');
});

test('labels a workshop with its number, whatever its heading already says', () => {
  assert.equal(labelOf('TP 3 — Functions and arrays', 3), '3. Functions and arrays');
  assert.equal(labelOf('Workshop 3: Routing', 3), '3. Routing');
  assert.equal(labelOf('Routing', 3), '3. Routing');
});

test('reads every numbered workshop folder in order, with its README', async () => {
  const root = await tree({
    'workshops/README.md': '# About\n\nRead me first.',
    'workshops/10-last/README.md': '# Last',
    'workshops/2-second/README.md': '# TP 2 — Second\n\n> Two.',
    'workshops/_3-off/README.md': '# Off',
    'workshops/4-no-readme/index.html': '',
  });
  const config = resolveConfig({ title: 'T' }, root);

  const { workshops, ignored, withoutReadme, overview } = await readWorkshops(config);

  assert.deepEqual(
    workshops.map((workshop) => [workshop.order, workshop.slug, workshop.label, workshop.description]),
    [
      [2, '2-second', '2. Second', 'Two.'],
      [10, '10-last', '10. Last', ''],
    ],
  );
  assert.deepEqual(
    ignored.map((entry) => entry.name),
    ['_3-off'],
  );
  assert.deepEqual(withoutReadme, ['4-no-readme']);
  assert.deepEqual(overview, { title: 'About', description: 'Read me first.', body: 'Read me first.' });
});

test('has no overview when the workshops folder has no README of its own', async () => {
  const root = await tree({ 'workshops/1-a/README.md': '# A' });

  const { overview } = await readWorkshops(resolveConfig({ title: 'T' }, root));

  assert.equal(overview, null);
});
