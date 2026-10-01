// Builds everything that gets deployed into one folder (build/ by default):
//
//   build/
//     index.html                    the workshops site
//     workshops/<n-name>/           one page per workshop
//     slides/                       the Slidev deck
//     downloads/
//       <slug>-slides.pdf           the deck, exported
//       <slug>-workshops.pdf        the workshops, as one printable handbook
//       <slug>-solutions.zip        the worked answers
//       <slug>-participants.zip     both PDFs + the workshop folders, no solutions
//     _redirects                    the deck's SPA fallback
//     _headers                      cross-origin isolation for the online editor
//
// `only`: 'slides' (the deck alone), 'pdf' (the deck, both PDFs and the ZIPs),
// 'site' (the site alone, linking whatever build/downloads/ already holds).
// Both PDF exports are non-fatal: the Resources page drops the link of a file
// that was not produced, and the kit ships without it.

import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { participantsZip, solutionsZip, workshopZips } from './archives.mjs';
import { writeDeck } from './deck.mjs';
import { printDeck } from './deck-pdf.mjs';
import { downloadNames } from './downloads.mjs';
import { printHandbook, renderHandbook } from './handbook.mjs';
import { renderHeaders, renderRedirects } from './hosting.mjs';
import { writeSite } from './site.mjs';
import { binPath, chromiumPath, run } from './tools.mjs';
import { readWorkshops } from './workshops.mjs';

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function directorySize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += (await stat(join(entry.parentPath, entry.name))).size;
  }
  return total;
}

/** Runs `step`, reporting a failure as a warning instead of stopping the build. */
async function nonFatal(label, step, log) {
  try {
    await step();
    return true;
  } catch (error) {
    log(`⚠ non-fatal: ${label} failed — ${error.message}`);
    return false;
  }
}

export async function build(config, { only = null, pdf = true, log = console.log } = {}) {
  const { root, paths, slug, title, author } = config;
  const out = paths.out;
  const downloadsDir = join(out, 'downloads');
  const names = downloadNames(slug);
  const withSlides = only === null || only === 'slides' || only === 'pdf';
  const withPdf = pdf && (only === null || only === 'pdf');
  const withSite = only === null || only === 'site';

  // `--only site` relinks the downloads of a previous build: keep them.
  if (only !== 'site') await rm(out, { recursive: true, force: true });
  await mkdir(downloadsDir, { recursive: true });

  const executablePath = withPdf ? await chromiumPath(log) : undefined;

  // --- 1. The deck ----------------------------------------------------------
  // `--base` matters: without it the deck requests its assets from the domain
  // root and every chunk 404s once it is served from /slides/.
  if (withSlides) {
    const { file, chapters } = await writeDeck(config);
    log(`\nDeck: ${chapters.length} chapters`);
    await run(binPath(root, 'slidev'), ['build', file, '--base', '/slides/', '--out', join(out, 'slides')], {
      cwd: root,
    });

    if (withPdf) {
      await nonFatal(
        'the deck PDF',
        async () => {
          await printDeck({
            deckFile: file,
            distDir: join(out, 'slides'),
            base: '/slides/',
            outFile: join(downloadsDir, names.slides),
            executablePath,
            log,
          });
          log(`✔ ${names.slides}`);
        },
        log,
      );
    }
  }

  // --- 2. The handbook and the ZIPs ----------------------------------------
  if (withPdf) {
    const { workshops, overview } = await readWorkshops(config);
    await nonFatal(
      'the workshop handbook',
      async () => {
        await printHandbook({
          html: renderHandbook({ title, author, workshops, overview }),
          title,
          outFile: join(downloadsDir, names.handbook),
          executablePath,
        });
        log(`✔ ${names.handbook} (${workshops.length} workshops)`);
      },
      log,
    );
  }

  if (only === null || only === 'pdf') {
    if (paths.solutions && existsSync(paths.solutions)) {
      const bytes = await solutionsZip({ slug, solutionsDir: paths.solutions, downloadsDir });
      log(`✔ ${names.solutions}  ${megabytes(bytes)}`);
    }

    // One starter and one solution ZIP per workshop, paired by folder name, for
    // the workshop pages and the Resources table.
    const { workshops } = await readWorkshops(config);
    const { missingSolution, orphans } = await workshopZips({ workshops, solutionsDir: paths.solutions, downloadsDir });
    log(`✔ tp/  one starter ZIP per workshop (${workshops.length}), and a solution ZIP for each that has one`);
    for (const name of missingSolution) log(`⚠ workshops/${name} has no solutions/${name}/ — no solution ZIP`);
    for (const name of orphans) log(`⚠ solutions/${name}/ matches no workshop folder — check its name`);

    // Last: it packs the two PDFs above.
    const bytes = await participantsZip({ slug, workshopsDir: paths.workshops, downloadsDir });
    log(`✔ ${names.kit}  ${megabytes(bytes)}`);
  }

  // --- 3. The site ----------------------------------------------------------
  // Built last: its Resources page only links the files that are now in
  // build/downloads/.
  if (withSite) {
    const { siteDir, workshops, ignored, withoutReadme, skippedFromEditor } = await writeSite(config, { downloadsDir });
    for (const entry of ignored) log(`⚠ workshops/${entry.name}: ${entry.reason}`);
    for (const name of withoutReadme) log(`⚠ workshops/${name} has no README.md — no page for it`);
    for (const file of skippedFromEditor) log(`⚠ ${file}: not in the online editor (binary or too big)`);
    log(`\nSite: ${workshops.length} workshops`);
    await run(binPath(root, 'astro'), ['build', '--root', siteDir], { cwd: root });
    await cp(join(siteDir, 'dist'), out, { recursive: true });
  }

  // --- 4. Hosting -----------------------------------------------------------
  await writeFile(join(out, '_redirects'), renderRedirects());
  const headers = renderHeaders(config);
  if (headers) await writeFile(join(out, '_headers'), headers);

  log(`\n${out.replace(`${root}/`, '')}/  ${megabytes(await directorySize(out))}`);
  return { out };
}
