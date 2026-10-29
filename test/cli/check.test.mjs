import { test } from 'vitest';
import assert from 'node:assert/strict';
import { check, renderCheck } from '../../src/cli/check.mjs';
import { resolveConfig } from '../../src/core/config.mjs';
import { tree } from '../helpers/tree.mjs';

const configOf = (root, raw = {}) => resolveConfig({ title: 'T', ...raw }, root);

const SOUND = {
  'slides/1-intro.md': '# Intro\n',
  'workshops/1-first/README.md': '# First\n',
  'solutions/1-first/index.js': '',
};

test('finds nothing wrong with a sound training', async () => {
  const root = await tree(SOUND);

  assert.deepEqual(await check(configOf(root)), []);
});

test('reports two chapters, or two workshops, sharing a number', async () => {
  const root = await tree({
    ...SOUND,
    'slides/01-again.md': '',
    'workshops/01-again/README.md': '',
    'solutions/01-again/index.js': '',
  });

  const problems = await check(configOf(root));

  assert.deepEqual(
    problems.map((problem) => problem.file),
    ['slides', 'workshops'],
  );
  assert.match(problems[0].message, /number 1 is used twice: 01-again\.md and 1-intro\.md/);
  assert.match(problems[1].message, /number 1 is used twice: 01-again and 1-first/);
});

test('reports a workshop without a README', async () => {
  const root = await tree({ ...SOUND, 'workshops/2-draft/index.js': '', 'solutions/2-draft/index.js': '' });

  assert.deepEqual(await check(configOf(root)), [
    { file: 'workshops/2-draft', message: 'no README.md, so no page and no handbook chapter' },
  ]);
});

test('reports a workshop without a solution, and a solution that matches no workshop', async () => {
  const root = await tree({ ...SOUND, 'workshops/2-routing/README.md': '', 'solutions/2-routng/index.js': '' });

  assert.deepEqual(await check(configOf(root)), [
    { file: 'workshops/2-routing', message: 'no solution: solutions/2-routing/ does not exist' },
    { file: 'solutions/2-routng', message: 'matches no workshop folder — check its name' },
  ]);
});

test('does not ask for solutions when the training has none', async () => {
  const root = await tree({ 'slides/1-intro.md': '', 'workshops/1-first/README.md': '' });

  assert.deepEqual(await check(configOf(root, { solutions: false })), []);
});

test('reports the relative links and images of a README that lead nowhere', async () => {
  const root = await tree({
    ...SOUND,
    'workshops/1-first/README.md': [
      '# First',
      '[the code](./src/index.js) and [the next one](../2-next/README.md#steps)',
      '![schema](images/schema.png) <img src="./images/flow.svg" alt="">',
      '[kept](./README.md#top) [web](https://example.com) [mail](mailto:a@b.c) [anchor](#steps)',
    ].join('\n'),
    'workshops/README.md': '[first](./1-first/README.md) [gone](./0-gone/README.md)',
  });

  assert.deepEqual(await check(configOf(root)), [
    { file: 'workshops/1-first/README.md', message: 'broken link: ./src/index.js' },
    { file: 'workshops/1-first/README.md', message: 'broken link: ../2-next/README.md#steps' },
    { file: 'workshops/1-first/README.md', message: 'broken image: images/schema.png' },
    { file: 'workshops/1-first/README.md', message: 'broken image: ./images/flow.svg' },
    { file: 'workshops/README.md', message: 'broken link: ./0-gone/README.md' },
  ]);
});

test('reads a slide asset that starts with / from the public folder of the slides', async () => {
  const root = await tree({
    ...SOUND,
    'slides/public/logo.png': '',
    'slides/1-intro.md': [
      '---',
      'layout: image-right',
      'image: /missing.jpg',
      '---',
      '',
      '![logo](/logo.png) ![chart](/chart.png) ![local](./img/local.png)',
      '',
      '---',
      'background: /logo.png',
      '---',
    ].join('\n'),
  });

  assert.deepEqual(await check(configOf(root)), [
    { file: 'slides/1-intro.md', message: 'missing asset: /missing.jpg (slides/public/missing.jpg)' },
    { file: 'slides/1-intro.md', message: 'missing asset: /chart.png (slides/public/chart.png)' },
    { file: 'slides/1-intro.md', message: 'broken image: ./img/local.png' },
  ]);
});

test('reports a slide imported with src: that does not exist', async () => {
  const root = await tree({ ...SOUND, 'slides/1-intro.md': '---\nsrc: ./parts/gone.md\n---\n' });

  assert.deepEqual(await check(configOf(root)), [
    { file: 'slides/1-intro.md', message: 'broken import: ./parts/gone.md' },
  ]);
});

test('leaves the code alone: a link inside a code block or a code span is not checked', async () => {
  const root = await tree({
    ...SOUND,
    'workshops/1-first/README.md': '# First\n\n```md\n![x](./nope.png)\n```\n\nUse `[a](./nope.md)` here.\n',
  });

  assert.deepEqual(await check(configOf(root)), []);
});

test('leaves out what is turned off', async () => {
  const root = await tree({ ...SOUND, 'slides/_2-draft.md': '![x](./nope.png)', 'workshops/_2-off/README.md': '' });

  assert.deepEqual(await check(configOf(root)), []);
});

test('lists the problems one per line, or says all is well', () => {
  assert.equal(renderCheck([]), '✔ nothing to fix');
  assert.equal(
    renderCheck([
      { file: 'slides/1-intro.md', message: 'broken image: ./a.png' },
      { file: 'workshops/2-x', message: 'no README.md' },
    ]),
    ['✖ slides/1-intro.md: broken image: ./a.png', '✖ workshops/2-x: no README.md', '', '2 problems'].join('\n'),
  );
});
