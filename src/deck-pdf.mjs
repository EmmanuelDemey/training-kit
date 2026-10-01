// Exports the deck to PDF, from the deck that was already built.
//
// Why not `slidev export` — it drives a Vite *dev* server, where every slide is
// a separate dynamic import and the print view pulls in the whole deck at once.
// On a deck of a few hundred slides Chromium gives up: either with
// net::ERR_INSUFFICIENT_RESOURCES (--per-slide) or "Printing failed" on one
// gigantic page (the default).
//
// The built deck has neither problem — it is bundled, so a slide is a couple of
// requests. So: serve the built deck ourselves, walk it one slide per navigation,
// and merge the one-page PDFs.

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { load } from '@slidev/parser/fs';
import { PDFDocument } from 'pdf-lib';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** Serves the built deck under `base`, falling back to index.html (SPA routes). */
function serve(distDir, base) {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, '');
    // normalize() first: a `..` in the URL must not escape the deck folder.
    const candidate = join(distDir, normalize(`/${relative}`));
    const file = await stat(candidate).then(
      (info) => (info.isFile() ? candidate : join(distDir, 'index.html')),
      () => join(distDir, 'index.html'),
    );
    response.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  return new Promise((ready) => {
    server.listen(0, '127.0.0.1', () => ready({ server, port: server.address().port }));
  });
}

/** The deck's own slide size, from the `@page` rule its print CSS ships. */
async function slideSize(page) {
  const size = await page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules];
        } catch {
          return [];
        }
      })
      .map((rule) => rule.cssText.match(/@page\s*{[^}]*size:\s*(\d+)px\s+(\d+)px/))
      .find(Boolean)
      ?.slice(1, 3)
      .map(Number),
  );
  return size ?? [980, 552];
}

/**
 * Prints the deck built into `distDir` (served under `base`) to `outFile`.
 * `deckFile` is the entry it was built from: it says how many slides to walk.
 */
export async function printDeck({ deckFile, distDir, base, outFile, executablePath, log = console.log }) {
  const { chromium } = await import('playwright-chromium');
  const { slides } = await load(dirname(deckFile), deckFile);
  const total = slides.length;

  await mkdir(dirname(outFile), { recursive: true });

  const { server, port } = await serve(distDir, base);
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 980, height: 552 } });
    const merged = await PDFDocument.create();
    let width = 980;
    let height = 552;

    for (let no = 1; no <= total; no++) {
      await page.goto(`http://127.0.0.1:${port}${base}${no}?print=true`, { waitUntil: 'load', timeout: 120000 });
      const slide = page.locator(`[data-slidev-no="${no}"]`);
      await slide.waitFor({ state: 'visible', timeout: 120000 });

      // A slide whose components failed to load renders this instead of itself.
      // Shipping a deck full of them is worse than shipping no PDF at all.
      if ((await slide.innerText()).includes('An error occurred on this slide')) {
        throw new Error(`slide ${no} failed to render`);
      }

      if (no === 1) {
        [width, height] = await slideSize(page);
        await page.setViewportSize({ width, height });
      }

      const part = await PDFDocument.load(
        await page.pdf({
          width: `${width}px`,
          height: `${height}px`,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
          pageRanges: '1',
          printBackground: true,
          preferCSSPageSize: true,
        }),
      );
      for (const copied of await merged.copyPages(part, part.getPageIndices())) {
        merged.addPage(copied);
      }

      if (no % 50 === 0 || no === total) log(`  slides: ${no}/${total}`);
    }

    await writeFile(outFile, await merged.save());
  } finally {
    await browser.close();
    server.close();
  }
}
