// The deck in the search of the workshops site. Slidev builds a single-page
// app: its HTML holds no slide text for Pagefind to crawl. So the index is
// built from the Markdown instead — one record per slide, linking its route —
// and the site merges it into its own (Starlight's `pagefind.mergeIndex`).

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { load } from '@slidev/parser/fs';
import { marked } from 'marked';
import { close, createIndex } from 'pagefind';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

// Inside a sentence: removed without leaving a space, or "**world**," would read "world ,".
const INLINE_TAG = /<\/?(a|abbr|b|code|del|em|i|kbd|mark|s|small|span|strong|sub|sup|u)\b[^>]*>/gi;

/** The words of a slide: its Markdown rendered, then stripped of every tag. */
function plainText(markdown) {
  return marked
    .parse(markdown)
    .replace(INLINE_TAG, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The search records of the deck `deckFile`, served under `base`. Hidden
 * slides are dropped by the parser, as Slidev drops them from the routes.
 */
/**
 * Writes the Pagefind bundle of the deck into `outDir` — `build/slides/pagefind/`,
 * where the site's `mergeIndex` expects it.
 */
export async function writeSlidesIndex({ deckFile, base, lang, outDir }) {
  const records = await slideRecords({ deckFile, base, lang });
  const { index, errors } = await createIndex({ forceLanguage: lang });
  try {
    if (errors.length) throw new Error(`pagefind: ${errors.join('; ')}`);
    for (const record of records) {
      const added = await index.addCustomRecord(record);
      if (added.errors.length) throw new Error(`pagefind: ${added.errors.join('; ')}`);
    }
    // Not `index.writeFiles`: it resolves before the backend has flushed every
    // file, and `close()` then kills it mid-write — an empty
    // `pagefind-entry.json` now and then. The files are taken in memory and
    // written here instead.
    const { files, errors: getErrors } = await index.getFiles();
    if (getErrors.length) throw new Error(`pagefind: ${getErrors.join('; ')}`);
    for (const { path, content } of files) {
      const target = join(outDir, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    return { pages: records.length };
  } finally {
    await close();
  }
}

export async function slideRecords({ deckFile, base, lang }) {
  const { slides } = await load(dirname(deckFile), deckFile);
  return slides.map((slide, index) => {
    const no = index + 1;
    return {
      url: `${base}${no}`,
      content: plainText(slide.content),
      language: lang,
      // Any meta besides the title shows as a tag under the result: "Source: Slides"
      // tells a slide from a page of the site, which carries none.
      meta: { title: slide.title ? `Slide ${no} — ${slide.title}` : `Slide ${no}`, source: 'Slides' },
    };
  });
}
