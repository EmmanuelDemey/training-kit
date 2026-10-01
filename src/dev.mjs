// The two dev servers. Each regenerates what it serves from the numbered
// folders while it runs: adding `7-forms.md` adds chapter 7 to the open deck,
// saving a workshop README updates its page.

import { watch } from 'node:fs';
import { sep } from 'node:path';
import { writeDeck } from './deck.mjs';
import { writeSite } from './site.mjs';
import { binPath, start } from './tools.mjs';

/** Folders a workshop fills on its own — an `npm install` there is not an edit. */
const NOISE = new Set(['node_modules', 'dist', 'coverage', '.vitest', '.astro', '.git']);

/** Calls `task` once things settle, never twice at the same time. */
function debounced(task, log, delay = 150) {
  let timer;
  let running = Promise.resolve();
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      running = running.then(task).catch((error) => log(`⚠ ${error.message}`));
    }, delay);
  };
}

/** Exits with the dev server, and stops it on Ctrl-C. */
function attach(child, watchers) {
  const stop = () => {
    watchers.forEach((watcher) => watcher.close());
    child.kill('SIGINT');
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (code) => {
    watchers.forEach((watcher) => watcher.close());
    process.exit(code ?? 0);
  });
}

/** `slidev` on the generated deck, regenerated when a chapter is added, renamed or removed. */
export async function devSlides(config, args = [], { log = console.log } = {}) {
  const { file, chapters } = await writeDeck(config);
  log(`Deck: ${chapters.length} chapters — ${file.replace(`${config.root}/`, '')}`);

  const refresh = debounced(async () => {
    const { chapters: now, changed } = await writeDeck(config);
    if (changed) log(`Deck regenerated: ${now.length} chapters`);
  }, log);
  // Only the folder itself: a chapter's own edits are Slidev's to reload.
  const watcher = watch(config.paths.slides, refresh);

  attach(start(binPath(config.root, 'slidev'), [file, ...args], { cwd: config.root }), [watcher]);
}

/** `astro dev` on the generated site, regenerated when anything in a workshop changes. */
export async function devSite(config, args = [], { log = console.log } = {}) {
  const { siteDir, workshops } = await writeSite(config);
  log(`Site: ${workshops.length} workshops`);

  const refresh = debounced(() => writeSite(config), log);
  const watcher = watch(config.paths.workshops, { recursive: true }, (_event, filename) => {
    if (filename && filename.split(sep).some((part) => NOISE.has(part))) return;
    refresh();
  });

  // --ignore-lock keeps the server in the foreground: Astro 7 detaches `astro dev`
  // when it detects a coding agent, and the watcher above lives only as long as
  // the server it feeds. The lock file it skips guards against a second server on
  // the same project, which this generated site never has.
  const astroArgs = ['dev', '--root', siteDir, '--ignore-lock', ...args];
  attach(start(binPath(config.root, 'astro'), astroArgs, { cwd: config.root }), [watcher]);
}
