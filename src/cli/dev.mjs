// The two dev servers. Each regenerates what it serves from the numbered
// folders while it runs: adding `7-forms.md` adds chapter 7 to the open deck,
// saving a workshop README updates its page. `dev` runs both at once.

import { watch } from 'node:fs';
import { sep } from 'node:path';
import { writeDeck } from '../deck/deck.mjs';
import { writeSite } from '../site/site.mjs';
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

/**
 * Starts the servers and resolves with the exit code of the first one to stop:
 * the others are stopped with it, and Ctrl-C stops them all.
 */
function serve(config, servers, options) {
  const children = servers.map(({ command, args }) => start(command, args, { cwd: config.root, ...options }));
  return new Promise((resolve) => {
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      servers.forEach(({ watcher }) => watcher.close());
      children.forEach((child) => child.exitCode === null && child.kill('SIGINT'));
    };
    let running = children.length;
    let first = null;
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    for (const child of children) {
      child.on('exit', (code) => {
        first ??= code ?? 0;
        stop();
        if (--running) return;
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        resolve(first);
      });
    }
  });
}

/** `slidev` on the generated deck, regenerated when a chapter is added, renamed or removed. */
async function slidesServer(config, args, log) {
  const { file, chapters } = await writeDeck(config);
  log(`Deck: ${chapters.length} chapters — ${file.replace(`${config.root}/`, '')}`);

  const refresh = debounced(async () => {
    const { chapters: now, changed } = await writeDeck(config);
    if (changed) log(`Deck regenerated: ${now.length} chapters`);
  }, log);
  // Only the folder itself: a chapter's own edits are Slidev's to reload.
  const watcher = watch(config.paths.slides, refresh);

  return { command: binPath(config.root, 'slidev'), args: [file, ...args], watcher };
}

/** `astro dev` on the generated site, regenerated when anything in a workshop changes. */
async function siteServer(config, args, log) {
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
  const command = binPath(config.root, 'astro');
  return { command, args: ['dev', '--root', siteDir, '--ignore-lock', ...args], watcher };
}

export async function devSlides(config, args = [], { log = console.log } = {}) {
  return serve(config, [await slidesServer(config, args, log)]);
}

export async function devSite(config, args = [], { log = console.log } = {}) {
  return serve(config, [await siteServer(config, args, log)]);
}

const portArgs = (port) => (port === undefined ? [] : ['--port', String(port)]);

/**
 * The deck and the site side by side, each on its own port (Slidev's 3030 and
 * Astro's 4321 unless told otherwise). Stdin goes to neither: two servers
 * reading the same keyboard would fight over it.
 */
export async function dev(config, { slidesPort, sitePort, log = console.log } = {}) {
  const servers = [await slidesServer(config, portArgs(slidesPort), log)];
  try {
    servers.push(await siteServer(config, portArgs(sitePort), log));
  } catch (error) {
    servers[0].watcher.close();
    throw error;
  }
  return serve(config, servers, { stdin: 'ignore' });
}
