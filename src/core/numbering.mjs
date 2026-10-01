// The one rule of a training-kit project: the position of a chapter or a
// workshop is the number its name starts with.
//
//   slides/1-introduction.md        chapter 1
//   slides/02_first_steps.md        chapter 2
//   slides/10-testing.md            chapter 10, after 9 — the sort is numeric
//   slides/_11-optional.md          turned off: kept on disk, left out of everything
//   slides/notes.md                 no number: left out, and reported
//
// The same rule picks the workshop folders, so the deck, the site, the handbook
// and the ZIPs can never disagree on what is in the training, or in which order.

import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

/** The number `name` starts with, or null — for an unnumbered or turned-off name. */
export function orderOf(name) {
  const match = name.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

/** `03_First Steps.md` -> `3-first-steps`: the number without its padding, then the words. */
export function slugOf(name, extension = '') {
  const base = extension && name.endsWith(extension) ? name.slice(0, -extension.length) : name;
  return base
    .replace(/^0+(?=\d)/, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

// By code point, not localeCompare: the order must not depend on the machine's locale.
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * The numbered entries of `dir`, in order.
 *
 * - `type`: `'file'` or `'directory'` — the other kind is never listed nor reported.
 * - `extension`: for files, the one extension that counts (`'.md'`).
 * - `skip`: names that live there on purpose and must not be reported.
 *
 * Returns `{ entries, ignored }`: `ignored` says what was left out and why, so a
 * typo in a name surfaces instead of a chapter silently missing from the deck.
 * Two entries with the same number is an error — their order would be a coin toss.
 */
export async function listNumbered(dir, { type, extension, skip = [] }) {
  const entries = [];
  const ignored = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const { name } = entry;
    const isWanted = type === 'directory' ? entry.isDirectory() : entry.isFile();
    if (!isWanted || name.startsWith('.') || skip.includes(name)) continue;

    if (extension && extname(name) !== extension) {
      ignored.push({ name, reason: `not a ${extension} file` });
    } else if (name.startsWith('_')) {
      ignored.push({ name, reason: 'turned off (starts with _)' });
    } else if (orderOf(name) === null) {
      ignored.push({ name, reason: 'no number at the start of its name' });
    } else {
      entries.push({ name, order: orderOf(name), path: join(dir, name), slug: slugOf(name, extension) });
    }
  }

  entries.sort((a, b) => a.order - b.order || byName(a, b));
  ignored.sort(byName);

  for (let index = 1; index < entries.length; index++) {
    const [previous, current] = [entries[index - 1], entries[index]];
    if (previous.order === current.order) {
      throw new Error(
        `${dir}: number ${current.order} is used twice: ${previous.name} and ${current.name} — renumber one of them`,
      );
    }
  }

  return { entries, ignored };
}
