// The workshops of a training: one numbered folder each, with a README.md the
// learner works from. That README is the single source of the instructions —
// the site pages and the printed handbook are both derived from it.
//
//   workshops/
//     README.md              optional: the overview, before the first workshop
//     1-devtools/README.md
//     2-composables/README.md

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listNumbered } from './numbering.mjs';

/** Cuts on a word boundary — a description sliced mid-word reads as a bug. */
function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/**
 * Splits a README into what the site and the handbook need:
 * - the leading `# Heading` becomes the title, and leaves the body — both the
 *   site and the handbook render their own;
 * - the blockquote right below it (else the first paragraph) becomes the
 *   description, flattened to one line. It stays in the body.
 */
export function parseReadme(markdown, fallbackTitle) {
  const lines = markdown.split('\n');
  let title = fallbackTitle;
  let start = 0;

  const headingIndex = lines.findIndex((line) => line.startsWith('# '));
  if (headingIndex !== -1 && headingIndex < 5) {
    title = lines[headingIndex].slice(2).trim();
    start = headingIndex + 1;
  }

  const body = lines.slice(start).join('\n').replace(/^\n+/, '');

  const description = (body.match(/^>[^\n]*(?:\n>[^\n]*)*/m)?.[0] ?? body.split('\n\n')[0] ?? '')
    .replaceAll(/^>\s?/gm, '')
    .replaceAll(/[*`_]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

  return { title, description: truncate(description, 155), body };
}

/**
 * `TP 3 — Functions and arrays` -> `3. Functions and arrays`. The number comes
 * from the folder name, so a heading that says otherwise cannot reorder the menu.
 */
export function labelOf(title, order) {
  const words = title.replace(/^(?:TP|Workshop|Lab|Atelier|Exercise)\s*\d+\s*[—–:.-]\s*/i, '');
  return `${order}. ${words}`;
}

/** Every numbered workshop of `config`, in order, with its README parsed. */
export async function readWorkshops(config) {
  const dir = config.paths.workshops;
  if (!existsSync(dir)) {
    throw new Error(
      `workshops folder not found: ${dir} — create it, or point \`workshops\` in training.config.mjs at yours`,
    );
  }

  const { entries, ignored } = await listNumbered(dir, { type: 'directory' });
  const workshops = [];
  const withoutReadme = [];

  for (const entry of entries) {
    const readme = join(entry.path, 'README.md');
    if (!existsSync(readme)) {
      withoutReadme.push(entry.name);
      continue;
    }
    const { title, description, body } = parseReadme(await readFile(readme, 'utf8'), entry.name);
    workshops.push({ ...entry, readme, title, label: labelOf(title, entry.order), description, body });
  }

  const overviewFile = join(dir, 'README.md');
  const overview = existsSync(overviewFile)
    ? parseReadme(await readFile(overviewFile, 'utf8'), `${config.title} — workshops`)
    : null;

  return { workshops, ignored, withoutReadme, overview };
}
