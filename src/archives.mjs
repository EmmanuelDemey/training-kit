// The two ZIPs of build/downloads/.
//
//   <slug>-participants.zip     the one download to hand out on day one
//     <slug>-participants/
//       <slug>-slides.pdf       the deck, when its export succeeded
//       <slug>-workshops.pdf    the handbook
//       tp/                     the workshop folders, as the learners work in them
//
//   <slug>-solutions.zip        the worked answers, never in the kit
//     <slug>-solutions/…

import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import archiver from 'archiver';
import { downloadNames, workshopDownloadNames } from './downloads.mjs';

/** Never zipped: what an install or a build regenerates, and local env overrides. */
const NOT_SHIPPED = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.astro/**',
  '**/coverage/**',
  '**/*.log',
  // The mode files are part of the workshops; only the local overrides may hold
  // real values.
  '**/.env.local',
  '**/.env.*.local',
];

/** Writes `file`, filling the archive through `fill(archive)`. Resolves to its size in bytes. */
async function zip(file, fill) {
  await mkdir(join(file, '..'), { recursive: true });
  return new Promise((resolve, reject) => {
    const output = createWriteStream(file);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(archive.pointer()));
    archive.on('warning', (error) => console.warn(`⚠ ${error.message}`));
    archive.on('error', reject);
    archive.pipe(output);
    fill(archive);
    archive.finalize();
  });
}

/**
 * Both PDFs and the workshop folders, without the solutions. It reads the PDFs
 * from `downloadsDir`, so it runs after both exports; one that failed is simply
 * not in the kit.
 */
export function participantsZip({ slug, workshopsDir, downloadsDir }) {
  const names = downloadNames(slug);
  const name = `${slug}-participants`;
  const pdfs = [names.slides, names.handbook].filter((pdf) => existsSync(join(downloadsDir, pdf)));

  return zip(join(downloadsDir, names.kit), (archive) => {
    for (const pdf of pdfs) {
      archive.file(join(downloadsDir, pdf), { name: `${name}/${pdf}` });
    }
    // `_*`: a workshop that is turned off — kept out of the kit as the site and
    // the handbook keep it out.
    archive.glob('**/*', { cwd: workshopsDir, dot: true, ignore: ['_*/**', ...NOT_SHIPPED] }, { prefix: `${name}/tp` });
  });
}

/** The worked answers, under one folder named after the training. */
export function solutionsZip({ slug, solutionsDir, downloadsDir }) {
  const name = `${slug}-solutions`;
  return zip(join(downloadsDir, downloadNames(slug).solutions), (archive) => {
    archive.glob('**/*', { cwd: solutionsDir, dot: true, ignore: ['_*/**', ...NOT_SHIPPED] }, { prefix: name });
  });
}

/**
 * One ZIP per workshop for its starter (the workshop folder: README and code),
 * and one for its solution: the folder of `solutionsDir` with the SAME name.
 *
 *   tp/<n-name>-starter.zip     <n-name>/…
 *   tp/<n-name>-solution.zip    <n-name>-solution/… — never unzipped over the starter
 *
 * Reports the workshops without a solution, and the solution folders that match
 * no workshop: a misspelt name would otherwise silently publish no solution.
 */
export async function workshopZips({ workshops, solutionsDir, downloadsDir }) {
  const missingSolution = [];
  const withSolution = solutionsDir && existsSync(solutionsDir);

  for (const workshop of workshops) {
    const names = workshopDownloadNames(workshop.slug);
    await zip(join(downloadsDir, names.starter), (archive) => {
      archive.glob('**/*', { cwd: workshop.path, dot: true, ignore: NOT_SHIPPED }, { prefix: workshop.name });
    });

    if (!withSolution) continue;
    const solutionDir = join(solutionsDir, workshop.name);
    if (!existsSync(solutionDir)) {
      missingSolution.push(workshop.name);
      continue;
    }
    await zip(join(downloadsDir, names.solution), (archive) => {
      archive.glob(
        '**/*',
        { cwd: solutionDir, dot: true, ignore: NOT_SHIPPED },
        { prefix: `${workshop.name}-solution` },
      );
    });
  }

  const known = new Set(workshops.map((workshop) => workshop.name));
  const orphans = withSolution
    ? (await readdir(solutionsDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .filter((name) => !known.has(name))
        .toSorted()
    : [];

  return { missingSolution, orphans };
}
