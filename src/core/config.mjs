// training.config.mjs — the one file a training-kit project has to write.
//
//   import { defineConfig } from '@emmanueldemey/training-kit';
//
//   export default defineConfig({
//     title: 'Advanced Vue.js',
//     slides: 'slides',          // 1-intro.md, 2-reactivity.md, …
//     workshops: 'workshops',    // 1-devtools/README.md, 2-composables/README.md, …
//   });
//
// Everything else has a default; resolveConfig() spells them out.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CONFIG_FILE = 'training.config.mjs';

/** Hands the config back as is. It only exists so that editors can offer completion. */
export function defineConfig(config) {
  return config;
}

const kebab = (text) =>
  text
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

const PLAYGROUND_DEFAULTS = { template: 'node', openFile: ['README.md'], extraFiles: {}, limits: '' };

/**
 * The raw config, checked and completed: absolute paths under `paths`, the
 * defaults filled in. Every mistake is reported in one error rather than one
 * per run.
 */
export function resolveConfig(raw, root) {
  const errors = [];
  const folder = (key, fallback) => {
    const value = raw[key] ?? fallback;
    if (typeof value !== 'string' || value === '') {
      errors.push(`\`${key}\` must be a folder path, relative to the project`);
      return null;
    }
    return resolve(root, value);
  };

  if (typeof raw.title !== 'string' || raw.title.trim() === '') {
    errors.push('`title` is required: the name of the training, as the deck and the site show it');
  }

  const paths = {
    slides: folder('slides', 'slides'),
    workshops: folder('workshops', 'workshops'),
    solutions: raw.solutions === false ? null : folder('solutions', 'solutions'),
    out: folder('outDir', 'build'),
    cache: join(root, '.training-kit'),
  };

  let playground = false;
  if (raw.playground === true) {
    playground = { ...PLAYGROUND_DEFAULTS };
  } else if (raw.playground && typeof raw.playground === 'object') {
    playground = { ...PLAYGROUND_DEFAULTS, ...raw.playground };
  } else if (raw.playground !== undefined && raw.playground !== false) {
    errors.push('`playground` must be true, false or an object ({ template, openFile, extraFiles, limits })');
  }

  // `dir`: where the project sits in its repository, for the edit and browse links.
  const repositoryRaw = typeof raw.repository === 'string' ? { url: raw.repository } : raw.repository;
  const repository = repositoryRaw
    ? {
        url: repositoryRaw.url.replace(/\/+$/, ''),
        branch: repositoryRaw.branch ?? 'main',
        dir: (repositoryRaw.dir ?? '').replaceAll(/^\/+|\/+$/g, ''),
      }
    : null;

  if (errors.length) {
    throw new Error(`Invalid ${CONFIG_FILE}:\n  - ${errors.join('\n  - ')}`);
  }

  return {
    root,
    title: raw.title,
    slug: raw.slug ?? kebab(raw.title),
    author: raw.author ?? '',
    lang: raw.lang ?? 'en',
    repository,
    deck: { theme: 'default', headmatter: {}, ...raw.deck },
    playground,
    paths,
  };
}

/** Reads `training.config.mjs` at `root` and resolves it. */
export async function loadConfig(root) {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) {
    throw new Error(`no ${CONFIG_FILE} in ${root} — run the command from the root of the training`);
  }
  // The query string defeats the module cache, so the dev watchers can reload it.
  const { default: raw } = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  return resolveConfig(raw ?? {}, root);
}
