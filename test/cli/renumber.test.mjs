import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { insert, move } from '../../src/cli/renumber.mjs';
import { resolveConfig } from '../../src/core/config.mjs';
import { tree } from '../helpers/tree.mjs';

const configOf = (root, raw = {}) => resolveConfig({ title: 'T', ...raw }, root);
const namesOf = async (dir) => (await readdir(dir)).toSorted();

test('inserting a workshop shifts the later ones and their solutions, turned-off ones included', async () => {
  const root = await tree({
    'workshops/README.md': '',
    'workshops/1-first/README.md': '',
    'workshops/2-forms/README.md': '# Forms\n',
    'workshops/_3-draft/README.md': '',
    'solutions/1-first/index.js': '',
    'solutions/2-forms/index.js': '',
  });

  const { renamed, created } = await insert(configOf(root), 'workshop', 2, 'Routing');

  assert.deepEqual(await namesOf(join(root, 'workshops')), [
    '1-first',
    '2-routing',
    '3-forms',
    'README.md',
    '_4-draft',
  ]);
  assert.deepEqual(await namesOf(join(root, 'solutions')), ['1-first', '2-routing', '3-forms']);
  assert.equal(await readFile(join(root, 'workshops/3-forms/README.md'), 'utf8'), '# Forms\n');
  assert.deepEqual(await readdir(join(root, 'solutions/3-forms')), ['index.js']);
  assert.deepEqual(created, [join(root, 'workshops/2-routing/README.md'), join(root, 'solutions/2-routing')]);
  assert.deepEqual(renamed, [
    { from: join(root, 'workshops/2-forms'), to: join(root, 'workshops/3-forms') },
    { from: join(root, 'workshops/_3-draft'), to: join(root, 'workshops/_4-draft') },
    { from: join(root, 'solutions/2-forms'), to: join(root, 'solutions/3-forms') },
  ]);
});

test('inserting a chapter keeps the padding and the separator of the names it shifts', async () => {
  const root = await tree({
    'slides/01_intro.md': '',
    'slides/02_first_steps.md': '',
    'slides/notes.md': '',
    'slides/deck.generated.md': '',
  });

  await insert(configOf(root), 'chapter', 1, 'Welcome');

  assert.deepEqual(await namesOf(join(root, 'slides')), [
    '02_intro.md',
    '03_first_steps.md',
    '1-welcome.md',
    'deck.generated.md',
    'notes.md',
  ]);
});

test('inserting at the next free number shifts nothing', async () => {
  const root = await tree({ 'slides/1-intro.md': '' });

  const { renamed } = await insert(configOf(root), 'chapter', 2, 'Forms');

  assert.deepEqual(renamed, []);
  assert.deepEqual(await namesOf(join(root, 'slides')), ['1-intro.md', '2-forms.md']);
});

test('refuses to insert past the next free number, which would leave a hole', async () => {
  const root = await tree({ 'slides/1-intro.md': '' });

  await assert.rejects(insert(configOf(root), 'chapter', 3, 'Forms'), /between 1 and 2/);
  assert.deepEqual(await namesOf(join(root, 'slides')), ['1-intro.md']);
});

test('moving a workshop earlier shifts the ones in between up, solutions along', async () => {
  const root = await tree({
    'workshops/1-a/README.md': '',
    'workshops/2-b/README.md': '',
    'workshops/3-c/README.md': '',
    'workshops/4-d/README.md': '',
    'solutions/2-b/index.js': '',
    'solutions/4-d/index.js': '',
  });

  await move(configOf(root), 'workshop', 4, 2);

  assert.deepEqual(await namesOf(join(root, 'workshops')), ['1-a', '2-d', '3-b', '4-c']);
  assert.deepEqual(await namesOf(join(root, 'solutions')), ['2-d', '3-b']);
});

test('moving a chapter later shifts the ones in between down', async () => {
  const root = await tree({ 'slides/1-a.md': 'A', 'slides/2-b.md': 'B', 'slides/3-c.md': 'C' });

  const { renamed } = await move(configOf(root), 'chapter', 1, 3);

  assert.deepEqual(await namesOf(join(root, 'slides')), ['1-b.md', '2-c.md', '3-a.md']);
  assert.equal(await readFile(join(root, 'slides/3-a.md'), 'utf8'), 'A');
  assert.equal(renamed.length, 3);
});

test('refuses to move a number that nothing uses', async () => {
  const root = await tree({ 'slides/1-a.md': '', 'slides/2-b.md': '' });

  await assert.rejects(move(configOf(root), 'chapter', 5, 1), /no chapter numbered 5/);
});

test('refuses to move past the last number', async () => {
  const root = await tree({ 'slides/1-a.md': '', 'slides/2-b.md': '' });

  await assert.rejects(move(configOf(root), 'chapter', 1, 3), /between 1 and 2/);
  assert.deepEqual(await namesOf(join(root, 'slides')), ['1-a.md', '2-b.md']);
});

test('refuses to renumber a folder where two entries already share a number', async () => {
  const root = await tree({ 'slides/1-a.md': '', 'slides/01-b.md': '', 'slides/2-c.md': '' });

  await assert.rejects(insert(configOf(root), 'chapter', 1, 'Intro'), /number 1 is used twice/);
});
