import { test } from 'vitest';
import assert from 'node:assert/strict';
import { renderList } from '../../src/cli/list.mjs';

test('shows the chapters and the workshops by number, then what was left out and why', () => {
  const text = renderList({
    slidesDir: 'slides',
    workshopsDir: 'workshops',
    chapters: [
      { order: 1, name: '1-intro.md' },
      { order: 10, name: '10-testing.md' },
    ],
    ignoredChapters: [{ name: 'notes.md', reason: 'no number at the start of its name' }],
    workshops: [{ order: 1, name: '1-first-steps', title: 'TP 1 — First steps' }],
    ignoredWorkshops: [{ name: '_2-off', reason: 'turned off (starts with _)' }],
    withoutReadme: ['3-draft'],
  });

  assert.equal(
    text,
    [
      'Slides — slides/',
      '   1  1-intro.md',
      '  10  10-testing.md',
      '   ⚠  notes.md: no number at the start of its name',
      '',
      'Workshops — workshops/',
      '   1  1-first-steps  TP 1 — First steps',
      '   ⚠  _2-off: turned off (starts with _)',
      '   ⚠  3-draft: no README.md, so no page and no handbook chapter',
      '',
    ].join('\n'),
  );
});

test('says so when a folder holds nothing numbered', () => {
  const text = renderList({
    slidesDir: 'slides',
    workshopsDir: 'tp',
    chapters: [],
    ignoredChapters: [],
    workshops: [],
    ignoredWorkshops: [],
    withoutReadme: [],
  });

  assert.match(text, /Slides — slides\/\n {3}\(nothing numbered yet: add 1-introduction\.md\)/);
  assert.match(text, /Workshops — tp\/\n {3}\(nothing numbered yet: add 1-first-steps\/README\.md\)/);
});
