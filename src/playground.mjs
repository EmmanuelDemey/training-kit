// Packs a workshop folder into a StackBlitz project, so the workshop page can
// open it in an editor running in the browser — no clone, no `npm install` on
// the learner's machine.
//
// The files are read from the repository at build time rather than fetched from
// GitHub by StackBlitz: a deploy preview then opens the starter of *its* branch,
// and the embed works whether the repository is public or not.

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/** Never part of the starter: installed, built or produced by a run. */
const SKIPPED = new Set(['node_modules', 'dist', 'coverage', '.vitest', '.DS_Store', '.netlify']);

/** A StackBlitz project only holds text: a file bigger than this is not a starter file. */
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Every text file of `dir`, keyed by its POSIX path relative to `dir`.
 * Binaries (a NUL byte in the content) and oversized files are left out and
 * reported, since the editor would show them as garbage anyway.
 */
export async function collectFiles(dir) {
  const files = {};
  const skipped = [];

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIPPED.has(entry.name)) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (!entry.isFile()) continue;

      const key = relative(dir, path).split(sep).join('/');
      const content = await readFile(path);
      if (content.length > MAX_FILE_SIZE || content.includes(0)) {
        skipped.push(key);
        continue;
      }
      files[key] = content.toString('utf8');
    }
  }

  await walk(dir);
  return { files: Object.fromEntries(Object.entries(files).toSorted(([a], [b]) => a.localeCompare(b))), skipped };
}

/**
 * The project handed to `sdk.embedProject` / `sdk.openProject`.
 * `openFile` lists candidates in order of preference: the first one the
 * workshop actually has is opened, so a starter without `src/App.vue` still
 * opens on something. `extraFiles` are added to the online copy only — a
 * `package.json` for a starter that runs without one, say.
 */
export async function playgroundProject({ dir, title, description, template, openFile = [], extraFiles = {} }) {
  const collected = await collectFiles(dir);
  const skipped = collected.skipped;
  // The workshop's own files win: `extraFiles` only fills in what it lacks.
  const files = Object.fromEntries(
    Object.entries({ ...extraFiles, ...collected.files }).toSorted(([a], [b]) => a.localeCompare(b)),
  );
  const open = openFile.filter((candidate) => candidate in files);
  return {
    project: { title, description, template, files },
    openFile: open.length ? open.join(',') : undefined,
    skipped,
  };
}
