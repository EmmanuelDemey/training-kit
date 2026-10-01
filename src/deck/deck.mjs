// The Slidev entry point, generated from the slides folder: a cover, then one
// `src:` import per numbered chapter. Nobody edits it — adding `7-forms.md` to
// the folder is what adds chapter 7 to the deck.
//
// It is written INTO the slides folder on purpose. Slidev resolves `src:` from
// the entry file, and takes the entry's folder as the deck's root: that is where
// it looks for `components/`, `public/`, `styles/`, `setup/` and `layouts/`. So
// the slides folder is a complete Slidev project, minus the file listing it.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { listNumbered } from '../core/numbering.mjs';

export const DECK_FILE = 'deck.generated.md';

/** The deck as Markdown: headmatter + cover, then the chapters in the given order. */
export function renderDeck({ title, author = '', theme, headmatter, chapters }) {
  const head = stringify({ theme, title, ...headmatter }, { lineWidth: 0 }).trimEnd();
  // The headmatter could set `title` too: the cover follows whatever won.
  const coverTitle = headmatter.title ?? title;
  const cover = [`# ${coverTitle}`, ...(author ? ['', author] : [])];
  const imports = chapters.flatMap((chapter) => ['', '---', `src: ./${chapter}`, '---']);

  return ['---', head, '---', '', ...cover, ...imports, ''].join('\n');
}

/**
 * Regenerates the deck of `config` from its slides folder. The file is only
 * rewritten when its content changes: a running `slidev` watches it, and an
 * identical write would still reload every open browser.
 */
export async function writeDeck(config) {
  const dir = config.paths.slides;
  if (!existsSync(dir)) {
    throw new Error(`slides folder not found: ${dir} — create it, or point \`slides\` in training.config.mjs at yours`);
  }

  const { entries: chapters, ignored } = await listNumbered(dir, {
    type: 'file',
    extension: '.md',
    skip: [DECK_FILE],
  });

  const content = renderDeck({
    title: config.title,
    author: config.author,
    theme: config.deck.theme,
    headmatter: config.deck.headmatter,
    chapters: chapters.map((chapter) => chapter.name),
  });

  const file = join(dir, DECK_FILE);
  const previous = existsSync(file) ? await readFile(file, 'utf8') : null;
  const changed = previous !== content;
  if (changed) await writeFile(file, content);

  return { file, chapters, ignored, changed };
}
