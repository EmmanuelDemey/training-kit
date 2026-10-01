import { test } from 'vitest';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { defineConfig, loadConfig, resolveConfig } from '../../src/core/config.mjs';
import { tree } from '../helpers/tree.mjs';

test('only the title is required: everything else has a default', () => {
  const config = resolveConfig({ title: 'Advanced Vue.js' }, '/work/vue');

  assert.equal(config.slug, 'advanced-vue-js');
  assert.equal(config.lang, 'en');
  assert.equal(config.paths.slides, '/work/vue/slides');
  assert.equal(config.paths.workshops, '/work/vue/workshops');
  assert.equal(config.paths.solutions, '/work/vue/solutions');
  assert.equal(config.paths.out, '/work/vue/build');
  assert.equal(config.paths.cache, '/work/vue/.training-kit');
  assert.equal(config.deck.theme, 'default');
  assert.equal(config.playground, false);
});

test("the slides and workshops folders are the user's to choose", () => {
  const config = resolveConfig({ title: 'T', slides: 'deck/chapters', workshops: 'tp' }, '/work/t');

  assert.equal(config.paths.slides, '/work/t/deck/chapters');
  assert.equal(config.paths.workshops, '/work/t/tp');
});

test('solutions can be turned off', () => {
  const config = resolveConfig({ title: 'T', solutions: false }, '/work/t');

  assert.equal(config.paths.solutions, null);
});

test('playground: true takes the defaults of a Node.js project', () => {
  const config = resolveConfig({ title: 'T', playground: true }, '/work/t');

  assert.deepEqual(config.playground, {
    template: 'node',
    openFile: ['README.md'],
    extraFiles: {},
    limits: '',
  });
});

test('a repository adds a branch, main by default, and the project at its root', () => {
  const config = resolveConfig({ title: 'T', repository: 'https://github.com/me/t' }, '/work/t');

  assert.deepEqual(config.repository, { url: 'https://github.com/me/t', branch: 'main', dir: '' });
});

test('a project in a sub-folder of its repository says which one', () => {
  const config = resolveConfig(
    { title: 'T', repository: { url: 'https://github.com/me/all', branch: 'dev', dir: 'trainings/t/' } },
    '/work/t',
  );

  assert.deepEqual(config.repository, { url: 'https://github.com/me/all', branch: 'dev', dir: 'trainings/t' });
});

test('lists every mistake at once, not one per run', () => {
  assert.throws(
    () => resolveConfig({ slides: 3, playground: 'yes' }, '/work/t'),
    (error) =>
      error.message.includes('`title` is required') &&
      error.message.includes('`slides` must be a folder path') &&
      error.message.includes('`playground` must be true, false or an object'),
  );
});

test('defineConfig hands the object back untouched — it only exists for editor hints', () => {
  const raw = { title: 'T' };
  assert.equal(defineConfig(raw), raw);
});

test('loads training.config.mjs from the project root', async () => {
  const root = await tree({
    'training.config.mjs': "export default { title: 'From disk', workshops: 'tp' };",
  });

  const config = await loadConfig(root);

  assert.equal(config.title, 'From disk');
  assert.equal(config.paths.workshops, join(root, 'tp'));
});

test('says where it looked when there is no config', async () => {
  const root = await tree({});

  await assert.rejects(loadConfig(root), /no training\.config\.mjs in /);
});
