// `training-kit insert|move`: renumbering without renaming files by hand.
//
//   training-kit insert workshop 3 routing   workshops/3-routing/, solutions/3-routing/;
//                                            3-… becomes 4-…, 4-… becomes 5-…, and so on
//   training-kit move chapter 5 2            slides/5-… becomes 2-…, 2-… to 4-… shift by one
//
// A workshop's solution folder follows it: same name before, same name after.
// Turned-off entries (`_4-draft`) keep their place in the sequence, as for `new`.
// A name keeps its padding and its separator: `02_intro.md` becomes `03_intro.md`.
//
// Every target is checked before anything is renamed, and the renames go through
// temporary names, so a shift never collides with the entry it replaces.

import { existsSync } from 'node:fs';
import { readdir, rename } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { listNumbered } from '../core/numbering.mjs';
import { DECK_FILE } from '../deck/deck.mjs';
import { newChapter, newWorkshop, wordsOf } from './new.mjs';

const KINDS = {
  chapter: { dir: (config) => config.paths.slides, type: 'file', extension: '.md', skip: [DECK_FILE] },
  workshop: { dir: (config) => config.paths.workshops, type: 'directory' },
};

function kindOf(kind) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`chapter or workshop, not "${kind}"`);
  return spec;
}

/**
 * The numbered entries of the folder, turned-off ones included:
 * `{ name, number, prefix, digits, rest }`. Throws, as every command does, when
 * two entries share a number.
 */
async function numberedOf(dir, spec) {
  if (!existsSync(dir)) return [];
  await listNumbered(dir, spec);
  return (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => (spec.type === 'directory' ? entry.isDirectory() : entry.isFile()))
    .filter((entry) => !spec.extension || extname(entry.name) === spec.extension)
    .map((entry) => entry.name.match(/^(_?)(\d+)(.*)$/s))
    .filter(Boolean)
    .map(([name, prefix, digits, rest]) => ({ name, prefix, digits, rest, number: Number(digits) }))
    .toSorted((a, b) => a.number - b.number || (a.name < b.name ? -1 : 1));
}

const renamedTo = (entry, number) => `${entry.prefix}${String(number).padStart(entry.digits.length, '0')}${entry.rest}`;

const range = (low, high) => `between ${low} and ${high}`;

function checkNumber(value, low, high, what) {
  if (!Number.isInteger(value) || value < low || value > high) {
    throw new Error(`${what} must be a whole number ${range(low, high)}, not ${value}`);
  }
}

/**
 * Renames the entries of `dir` that `numberOf` gives a new number, and the
 * solution folders of the same names for workshops. `reserved`: paths about to
 * be created, which must be free too. Returns `[{ from, to }]`, folder by folder.
 */
async function renumber(config, kind, entries, numberOf, reserved = []) {
  const dir = KINDS[kind].dir(config);
  const moves = entries
    .map((entry) => ({ entry, number: numberOf(entry.number) }))
    .filter(({ entry, number }) => number !== entry.number)
    .map(({ entry, number }) => ({ from: entry.name, to: renamedTo(entry, number) }));

  const folders = [{ dir, moves }];
  const solutions = kind === 'workshop' && config.paths.solutions;
  if (solutions) {
    folders.push({ dir: solutions, moves: moves.filter(({ from }) => existsSync(join(solutions, from))) });
  }

  const renamed = folders.flatMap((folder) =>
    folder.moves.map(({ from, to }) => ({ from: join(folder.dir, from), to: join(folder.dir, to) })),
  );

  const sources = new Set(renamed.map(({ from }) => from));
  for (const target of [...renamed.map(({ to }) => to), ...reserved]) {
    if (existsSync(target) && !sources.has(target)) {
      throw new Error(`${relative(config.root, target)} already exists — nothing was renamed`);
    }
  }

  const temporary = (index) => join(dirname(renamed[index].from), `.training-kit-renumber-${index}`);
  for (const [index, { from }] of renamed.entries()) await rename(from, temporary(index));
  for (const [index, { to }] of renamed.entries()) await rename(temporary(index), to);
  return renamed;
}

/**
 * Makes room at `number` for a new chapter or workshop, then creates it there:
 * every entry from `number` on moves one up. Returns `{ renamed, created }`.
 */
export async function insert(config, kind, number, name) {
  const spec = kindOf(kind);
  const words = wordsOf(name);
  const entries = await numberedOf(spec.dir(config), spec);
  const next = Math.max(0, ...entries.map((entry) => entry.number)) + 1;
  checkNumber(number, 1, next, 'the number');

  const slot = kind === 'chapter' ? `${number}-${words}.md` : `${number}-${words}`;
  const reserved = [join(spec.dir(config), slot)];
  if (kind === 'workshop' && config.paths.solutions) reserved.push(join(config.paths.solutions, slot));

  const renamed = await renumber(config, kind, entries, (n) => (n >= number ? n + 1 : n), reserved);
  const create = kind === 'chapter' ? newChapter : newWorkshop;
  return { renamed, created: await create(config, name, { number }) };
}

/**
 * Moves the chapter or workshop numbered `from` to `to`; the ones in between
 * shift by one to close the gap. Returns `{ renamed }`.
 */
export async function move(config, kind, from, to) {
  const spec = kindOf(kind);
  const entries = await numberedOf(spec.dir(config), spec);
  if (!entries.some((entry) => entry.number === from)) throw new Error(`no ${kind} numbered ${from}`);
  const last = entries.at(-1).number;
  checkNumber(to, 1, last, 'the new number');

  const numberOf = (n) => {
    if (n === from) return to;
    if (from < to && n > from && n <= to) return n - 1;
    if (to < from && n >= to && n < from) return n + 1;
    return n;
  };
  return { renamed: await renumber(config, kind, entries, numberOf) };
}
