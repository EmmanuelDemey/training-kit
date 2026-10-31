import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { newChapter, newWorkshop } from '../../src/cli/new.mjs';
import { resolveConfig } from '../../src/core/config.mjs';
import { tree } from '../helpers/tree.mjs';

const configOf = (root, raw = {}) => resolveConfig({ title: 'T', ...raw }, root);

test('adds a chapter after the highest number, a turned-off one included', async () => {
  const root = await tree({
    'slides/1-intro.md': '',
    'slides/10-testing.md': '',
    'slides/_11-draft.md': '',
    'slides/notes.md': '',
  });

  const created = await newChapter(configOf(root), 'Forms and validation');

  assert.deepEqual(created, [join(root, 'slides/12-forms-and-validation.md')]);
  assert.equal(await readFile(created[0], 'utf8'), '# Forms and validation\n');
});

test('numbers the first chapter 1, creating the slides folder if needed', async () => {
  const root = await tree({});

  assert.deepEqual(await newChapter(configOf(root), 'intro'), [join(root, 'slides/1-intro.md')]);
});

test('adds a workshop with a README skeleton and its solution folder', async () => {
  const root = await tree({
    'workshops/1-first/README.md': '',
    'workshops/_2-off/README.md': '',
    'solutions/1-first/index.js': '',
  });

  const created = await newWorkshop(configOf(root), 'Routing');

  assert.deepEqual(created, [join(root, 'workshops/3-routing/README.md'), join(root, 'solutions/3-routing')]);
  assert.equal(
    await readFile(created[0], 'utf8'),
    [
      '# Routing',
      '',
      '> What the learner builds, in one sentence.',
      '',
      '## Steps',
      '',
      '1. …',
      '',
      '## Done when',
      '',
      '- …',
      '',
    ].join('\n'),
  );
  assert.deepEqual(await readdir(created[1]), ['.gitkeep']);
});

test('adds no solution folder when the training has none', async () => {
  const root = await tree({ 'workshops/1-first/README.md': '' });

  const created = await newWorkshop(configOf(root, { solutions: false }), 'routing');

  assert.deepEqual(created, [join(root, 'workshops/2-routing/README.md')]);
  assert.equal(existsSync(join(root, 'solutions')), false);
});

test('refuses to overwrite a solution folder that already has the name', async () => {
  const root = await tree({ 'workshops/1-first/README.md': '', 'solutions/2-routing/index.js': '' });

  await assert.rejects(newWorkshop(configOf(root), 'routing'), /solutions\/2-routing already exists/);
  assert.equal(existsSync(join(root, 'workshops/2-routing')), false);
});

test('refuses a name with nothing to put in a file name', async () => {
  const root = await tree({});

  await assert.rejects(newChapter(configOf(root), ' !? '), /a name is required/);
});
