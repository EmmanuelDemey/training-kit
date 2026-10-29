// `training-kit check`: what would break the build, or break a page once
// built, found without building — fast enough for a pre-commit hook.
//
//   - two chapters, or two workshops, sharing a number;
//   - a workshop without a README, or without a solution, and a solution folder
//     that matches no workshop;
//   - a relative link or image of a README, or of a chapter, that leads nowhere;
//   - a slide asset (`/logo.png`, `image:`, `background:`) missing from the
//     public folder of the slides, and a `src:` import that does not exist.
//
// Code blocks and code spans are left alone: they show Markdown, they do not
// link anything.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { parseSync } from '@slidev/parser';
import { marked } from 'marked';
import { listNumbered } from '../core/numbering.mjs';
import { readWorkshops } from '../core/workshops.mjs';
import { DECK_FILE } from '../deck/deck.mjs';
import { pairSolutions } from '../downloads/archives.mjs';

/** The slide frontmatter keys that name a file. */
const ASSET_KEYS = ['image', 'background'];

const IMG_SRC = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;

/** `https:`, `mailto:`, `//cdn…`, `#anchor`: not a file of the project. */
const isExternal = (target) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target) || target === '';

/** The file part of a link: no anchor, no query, decoded. */
function fileOf(target) {
  const path = target.replace(/[#?].*$/, '');
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** Every link and image of `markdown`, in order: `{ kind: 'link' | 'image', target }`. */
function referencesOf(markdown) {
  const references = [];
  marked.walkTokens(marked.lexer(markdown), (token) => {
    if (token.type === 'link') references.push({ kind: 'link', target: token.href });
    if (token.type === 'image') references.push({ kind: 'image', target: token.href });
    if (token.type === 'html') {
      for (const [, target] of token.text.matchAll(IMG_SRC)) references.push({ kind: 'image', target });
    }
  });
  return references;
}

/**
 * The checker of one project: `problems` collects `{ file, message }`, `file`
 * relative to the root, with forward slashes on every platform.
 */
function checker(config) {
  const problems = [];
  const path = (absolute) => relative(config.root, absolute).split(sep).join('/');
  const report = (absolute, message) => problems.push({ file: path(absolute), message });

  /**
   * The links and images of a Markdown file. `publicDir`: where a target that
   * starts with `/` is served from — the slides' public folder; without it, such
   * a target is left alone (a README cannot know the URL its site lives at).
   */
  const references = (file, markdown, { publicDir } = {}) => {
    for (const { kind, target } of referencesOf(markdown)) asset(file, kind, target, { publicDir });
  };

  const asset = (file, kind, target, { publicDir } = {}) => {
    if (typeof target !== 'string' || isExternal(target)) return;
    const name = fileOf(target);
    if (name.startsWith('/')) {
      if (!publicDir) return;
      const served = join(publicDir, name);
      if (!existsSync(served)) report(file, `missing asset: ${target} (${path(served)})`);
    } else if (!existsSync(join(dirname(file), name))) {
      report(file, `broken ${kind}: ${target}`);
    }
  };

  /** Runs `step`; an error it throws (a duplicate number, a missing folder) is a problem of `dir`. */
  const attempt = async (dir, step) => {
    try {
      return await step();
    } catch (error) {
      report(dir, error.message.replace(`${dir}: `, ''));
      return null;
    }
  };

  return { problems, path, report, references, asset, attempt };
}

async function checkSlides(config, { report, references, asset, attempt }) {
  const dir = config.paths.slides;
  const listed = await attempt(dir, () => {
    if (!existsSync(dir)) throw new Error('slides folder not found');
    return listNumbered(dir, { type: 'file', extension: '.md', skip: [DECK_FILE] });
  });
  if (!listed) return;

  const publicDir = join(dir, 'public');
  for (const chapter of listed.entries) {
    const markdown = await readFile(chapter.path, 'utf8');
    for (const slide of parseSync(markdown, chapter.path).slides) {
      const { src } = slide.frontmatter;
      if (typeof src === 'string') {
        const imported = src.startsWith('/') ? join(dir, src) : join(dirname(chapter.path), src);
        if (!existsSync(imported)) report(chapter.path, `broken import: ${src}`);
      }
      for (const key of ASSET_KEYS) asset(chapter.path, 'image', slide.frontmatter[key], { publicDir });
      references(chapter.path, slide.content, { publicDir });
    }
  }
}

async function checkWorkshops(config, { path, report, references, attempt }) {
  const dir = config.paths.workshops;
  const read = await attempt(dir, () => readWorkshops(config));
  if (!read) return;

  const { workshops, withoutReadme } = read;
  for (const name of withoutReadme) {
    report(join(dir, name), 'no README.md, so no page and no handbook chapter');
  }

  const solutionsDir = config.paths.solutions;
  // A workshop without a README is still a workshop: its solution is no orphan.
  const folders = [...workshops, ...withoutReadme.map((name) => ({ name }))];
  const { missingSolution, orphans } = await pairSolutions({ workshops: folders, solutionsDir });
  for (const name of missingSolution) {
    report(join(dir, name), `no solution: ${path(join(solutionsDir, name))}/ does not exist`);
  }
  for (const name of orphans) report(join(solutionsDir, name), 'matches no workshop folder — check its name');

  for (const workshop of workshops) {
    references(workshop.readme, await readFile(workshop.readme, 'utf8'));
  }
  const overview = join(dir, 'README.md');
  if (existsSync(overview)) references(overview, await readFile(overview, 'utf8'));
}

/** Every problem of the training of `config`, slides first. Empty when there is nothing to fix. */
export async function check(config) {
  const context = checker(config);
  await checkSlides(config, context);
  await checkWorkshops(config, context);
  return context.problems;
}

export function renderCheck(problems) {
  if (!problems.length) return '✔ nothing to fix';
  const count = `${problems.length} ${problems.length === 1 ? 'problem' : 'problems'}`;
  return [...problems.map(({ file, message }) => `✖ ${file}: ${message}`), '', count].join('\n');
}
