// `training-kit new chapter|workshop <name>`: the next file or folder, at the
// next free number, so nobody has to look up the last one nor type the padding.
//
//   training-kit new chapter "Forms and validation"   slides/12-forms-and-validation.md
//   training-kit new workshop Routing                 workshops/3-routing/README.md
//                                                     solutions/3-routing/
//
// A turned-off entry (`_11-draft.md`) keeps its number: turning it back on must
// not make it collide with the new one.

import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { slugOf } from '../core/numbering.mjs';

/** The highest number of `dir`, turned-off names included, plus one. 1 for a missing or empty folder. */
async function nextNumber(dir) {
  if (!existsSync(dir)) return 1;
  const numbers = (await readdir(dir))
    .map((name) => name.match(/^_?(\d+)/)?.[1])
    .filter(Boolean)
    .map(Number);
  return Math.max(0, ...numbers) + 1;
}

/** `Écrans & formulaires` -> `ecrans-formulaires`. */
function wordsOf(name) {
  const words = slugOf(name.normalize('NFD').replaceAll(/[̀-ͯ]/g, ''));
  if (!words) throw new Error(`a name is required, made of letters or digits: "${name}" has none`);
  return words;
}

function refuseExisting(config, path) {
  if (existsSync(path)) throw new Error(`${relative(config.root, path)} already exists — pick another name`);
}

/** Creates the next chapter of `config`; returns the paths it created. */
export async function newChapter(config, name) {
  const words = wordsOf(name);
  const dir = config.paths.slides;
  const file = join(dir, `${await nextNumber(dir)}-${words}.md`);
  refuseExisting(config, file);

  await mkdir(dir, { recursive: true });
  await writeFile(file, `# ${name.trim()}\n`);
  return [file];
}

const readmeOf = (title) =>
  [
    `# ${title}`,
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
  ].join('\n');

/**
 * Creates the next workshop of `config`: its folder with a README skeleton, and
 * the solution folder of the same name (a `.gitkeep` so that Git keeps it).
 * Returns the paths it created. Nothing is written when either already exists.
 */
export async function newWorkshop(config, name) {
  const words = wordsOf(name);
  const folder = `${await nextNumber(config.paths.workshops)}-${words}`;
  const workshop = join(config.paths.workshops, folder);
  const solution = config.paths.solutions && join(config.paths.solutions, folder);
  refuseExisting(config, workshop);
  if (solution) refuseExisting(config, solution);

  const readme = join(workshop, 'README.md');
  await mkdir(workshop, { recursive: true });
  await writeFile(readme, readmeOf(name.trim()));
  if (!solution) return [readme];

  await mkdir(solution, { recursive: true });
  await writeFile(join(solution, '.gitkeep'), '');
  return [readme, solution];
}
