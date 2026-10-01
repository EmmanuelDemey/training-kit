import { test } from 'vitest';
import assert from 'node:assert/strict';
import { listNumbered, orderOf } from '../src/numbering.mjs';
import { tree } from './tree.mjs';

test('reads the number a name starts with, whatever the separator and padding', () => {
  assert.equal(orderOf('1-introduction.md'), 1);
  assert.equal(orderOf('02_first_steps.md'), 2);
  assert.equal(orderOf('10 testing'), 10);
  assert.equal(orderOf('3.md'), 3);
});

test('has no number for a name that does not start with one, or that is turned off', () => {
  assert.equal(orderOf('introduction.md'), null);
  assert.equal(orderOf('_3-optional.md'), null);
  assert.equal(orderOf('v2-notes.md'), null);
});

test('sorts by number, not alphabetically: 10 comes after 9', async () => {
  const dir = await tree({ '10-ten.md': '', '9-nine.md': '', '1-one.md': '', '2-two.md': '' });

  const { entries } = await listNumbered(dir, { type: 'file', extension: '.md' });

  assert.deepEqual(
    entries.map((entry) => [entry.order, entry.name]),
    [
      [1, '1-one.md'],
      [2, '2-two.md'],
      [9, '9-nine.md'],
      [10, '10-ten.md'],
    ],
  );
});

test('lists folders or files, never both', async () => {
  const dir = await tree({ '1-intro/README.md': '', '2-notes.md': '' });

  const folders = await listNumbered(dir, { type: 'directory' });
  const files = await listNumbered(dir, { type: 'file' });

  assert.deepEqual(
    folders.entries.map((entry) => entry.name),
    ['1-intro'],
  );
  assert.deepEqual(
    files.entries.map((entry) => entry.name),
    ['2-notes.md'],
  );
});

test('reports what it leaves out: unnumbered, turned off, wrong extension', async () => {
  const dir = await tree({ '1-a.md': '', 'notes.md': '', '_2-b.md': '', '3-image.png': '' });

  const { entries, ignored } = await listNumbered(dir, { type: 'file', extension: '.md' });

  assert.deepEqual(
    entries.map((entry) => entry.name),
    ['1-a.md'],
  );
  assert.deepEqual(ignored, [
    { name: '3-image.png', reason: 'not a .md file' },
    { name: '_2-b.md', reason: 'turned off (starts with _)' },
    { name: 'notes.md', reason: 'no number at the start of its name' },
  ]);
});

test('never reports dotfiles or the names it is told to skip', async () => {
  const dir = await tree({ '1-a.md': '', '.DS_Store': '', 'deck.generated.md': '' });

  const { ignored } = await listNumbered(dir, { type: 'file', skip: ['deck.generated.md'] });

  assert.deepEqual(ignored, []);
});

test('refuses two entries with the same number, naming both', async () => {
  const dir = await tree({ '1-a.md': '', '01-b.md': '' });

  await assert.rejects(listNumbered(dir, { type: 'file' }), /number 1 is used twice: 01-b\.md and 1-a\.md/);
});

test('gives each entry its absolute path and a URL-safe slug', async () => {
  const dir = await tree({ '03_First Steps.md': '' });

  const { entries } = await listNumbered(dir, { type: 'file', extension: '.md' });

  assert.equal(entries[0].path, `${dir}/03_First Steps.md`);
  assert.equal(entries[0].slug, '3-first-steps');
});
