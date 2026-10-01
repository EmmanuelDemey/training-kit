// The workshops site: a Starlight project generated under .training-kit/site/
// from the workshop READMEs. Nothing in it is edited by hand — it is rewritten
// on every run, so it cannot drift from the folders the learners work in.
//
//   /                       the overview: every workshop, then workshops/README.md
//   /workshops/<n-name>/    one page per workshop, in folder order
//   /resources/             the deck, the PDFs and the ZIPs the build produced
//   /slides/                the deck itself — built next to the site by `build`

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadNames, workshopDownloadNames } from './downloads.mjs';
import { playgroundProject } from './playground.mjs';
import { readWorkshops } from './workshops.mjs';

const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'site-template');

const yaml = (value) => JSON.stringify(value); // a valid YAML double-quoted scalar

const escapeHtml = (text) =>
  String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** A path of the project, as a POSIX path from the project root. */
const projectPath = (config, absolute) => relative(config.root, absolute).split(sep).join('/');

/** `https://github.com/me/repo/<kind>/<branch>/<dir>/<path>` */
function repositoryLink(config, kind, path) {
  const { url, branch, dir } = config.repository;
  return `${url}/${kind}/${branch}/${[dir, path].filter(Boolean).join('/')}`;
}

/** What to call the host in a link: "on GitHub", or "in the repository". */
function hostName(config) {
  const host = new URL(config.repository.url).hostname;
  if (host.endsWith('github.com')) return 'GitHub';
  if (host.includes('gitlab')) return 'GitLab';
  return null;
}

function frontmatter(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (value && typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        lines.push(`  ${subKey}: ${typeof subValue === 'string' ? yaml(subValue) : subValue}`);
      }
    } else {
      lines.push(`${key}: ${typeof value === 'string' ? yaml(value) : value}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

const withFinalNewline = (text) => text.replace(/\n*$/, '\n');

/**
 * The "work online" block of a workshop page: two buttons and the slot the
 * editor is embedded into, driven by src/components/MarkdownContent.astro.
 * Raw HTML in Markdown, so no blank line inside — it would close the HTML block.
 */
export function renderPlayground({ src, openFile, limits }) {
  return [
    `<div class="playground" data-playground="${escapeHtml(src)}"${openFile ? ` data-open-file="${escapeHtml(openFile)}"` : ''}>`,
    '<p class="playground__intro"><strong>No setup?</strong> Work on this workshop in an editor that runs in your browser — your changes stay in that tab until you fork the project on StackBlitz.</p>',
    ...(limits
      ? [`<p class="playground__limits">${escapeHtml(limits).replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`]
      : []),
    '<p class="playground__actions">',
    '<button type="button" class="playground__button" data-action="embed">Open the online editor here</button>',
    '<button type="button" class="playground__button playground__button--secondary" data-action="open">Open it in a new tab</button>',
    '</p>',
    '<p class="playground__status" role="status" aria-live="polite"></p>',
    '<div class="playground__frame"></div>',
    '</div>',
  ].join('\n');
}

/** Its starter and solution ZIPs — the ones this build produced. Empty when there are none. */
function workshopDownloads(workshop, downloads) {
  const names = workshopDownloadNames(workshop.slug);
  const lines = [
    ...(downloads.has(names.starter)
      ? [`- **[The starter (ZIP)](/downloads/${names.starter})** — this workshop's folder, ready to unzip and work in.`]
      : []),
    ...(downloads.has(names.solution)
      ? [`- [The solution (ZIP)](/downloads/${names.solution}) — open it after you have tried, to compare.`]
      : []),
  ];
  return lines.length ? [':::tip[Download this workshop]', ...lines, ':::'].join('\n') : '';
}

/** One workshop: its README, under a note that says which folder to open and where to download it. */
export function renderWorkshopPage({ config, workshop, playground = '', downloads = new Set() }) {
  const folder = `${projectPath(config, config.paths.workshops)}/${workshop.name}`;
  const host = config.repository && hostName(config);

  const note = [
    ':::note[Where to work]',
    `Open \`${folder}/\`${config.repository ? ' —' : '.'}`,
    ...(config.repository
      ? [`[browse the folder ${host ? `on ${host}` : 'in the repository'}](${repositoryLink(config, 'tree', folder)}).`]
      : []),
    ':::',
  ].join('\n');
  const zips = workshopDownloads(workshop, downloads);

  return [
    frontmatter({
      title: workshop.title,
      description: workshop.description,
      sidebar: { order: workshop.order, label: workshop.label },
      editUrl: config.repository ? repositoryLink(config, 'edit', `${folder}/README.md`) : undefined,
    }),
    '',
    note,
    '',
    ...(zips ? [zips, ''] : []),
    ...(playground ? [playground, ''] : []),
    withFinalNewline(workshop.body),
  ].join('\n');
}

const tableCell = (text) => text.replaceAll('|', '\\|');

/** The home page: an index of the workshops, then what workshops/README.md says. */
export function renderOverviewPage({ config, workshops, overview }) {
  const title = overview?.title ?? config.title;
  const description =
    overview?.description || `The ${workshops.length} hands-on workshops of the ${config.title} training.`;
  const readme = `${projectPath(config, config.paths.workshops)}/README.md`;

  const index = [
    '## The workshops',
    '',
    '| # | Workshop | |',
    '|---|----------|---|',
    ...workshops.map((workshop) => {
      const name = workshop.label.replace(/^\d+\.\s*/, '');
      return `| ${workshop.order} | [${tableCell(name)}](/workshops/${workshop.slug}/) | ${tableCell(workshop.description)} |`;
    }),
    '',
    '[Resources — the deck, the workshop handbook and the solutions](/resources/)',
  ].join('\n');

  return [
    frontmatter({
      title,
      description,
      editUrl: config.repository && overview ? repositoryLink(config, 'edit', readme) : undefined,
    }),
    '',
    index,
    ...(overview ? ['', '## About these workshops', '', withFinalNewline(overview.body)] : ['']),
  ].join('\n');
}

/** One row per workshop with its starter and solution ZIPs; nothing when the build zipped none. */
function workshopTable(workshops, downloads) {
  const link = (file) => (downloads.has(file) ? `[ZIP](/downloads/${file})` : '—');
  const rows = workshops.map((workshop) => ({ workshop, names: workshopDownloadNames(workshop.slug) }));
  if (!rows.some(({ names }) => downloads.has(names.starter) || downloads.has(names.solution))) return [];

  return [
    '## Workshop by workshop',
    '',
    '| # | Workshop | Starter | Solution |',
    '|---|---|---|---|',
    ...rows.map(({ workshop, names }) => {
      const name = tableCell(workshop.label.replace(/^\d+\.\s*/, ''));
      return `| ${workshop.order} | [${name}](/workshops/${workshop.slug}/) | ${link(names.starter)} | ${link(names.solution)} |`;
    }),
    '',
  ];
}

/** Everything downloadable — and only what this build actually produced. */
export function renderResourcesPage({ config, workshops, downloads }) {
  const names = downloadNames(config.slug);
  const has = (file) => downloads.has(file);
  const count = workshops.length;
  const workshopsFolder = projectPath(config, config.paths.workshops);

  return [
    frontmatter({
      title: 'Resources',
      description:
        `The ${config.title} deck and the ${count} workshops as a printable handbook` +
        (config.paths.solutions ? ', plus the worked solutions.' : '.'),
    }),
    '',
    ...(has(names.kit)
      ? [
          '## Everything in one download',
          '',
          `- **[Download the participant kit (ZIP)](/downloads/${names.kit})** — the slides and the handbook as PDFs, plus the workshop folders to work in. No solutions inside.`,
          '',
        ]
      : []),
    '## Slides',
    '',
    '- **[Read the deck online](/slides/)** — press <kbd>f</kbd> for fullscreen, <kbd>o</kbd> for the slide overview.',
    has(names.slides)
      ? `- **[Download the slides (PDF)](/downloads/${names.slides})** — the same deck, printable, for taking notes offline.`
      : '- _No PDF export of the deck was produced by this build._',
    '',
    '## Workshops',
    '',
    '- **[Read them online](/)** — one page per workshop.',
    has(names.handbook)
      ? `- **[Download the handbook (PDF)](/downloads/${names.handbook})** — the ${count} workshops in one printable booklet: cover, contents, then one workshop per page.`
      : '- _The workshop handbook was not produced by this build._',
    '',
    ...workshopTable(workshops, downloads),
    '## Solutions',
    '',
    ...(config.paths.solutions
      ? [
          has(names.solutions)
            ? `- **[Download the solutions (ZIP)](/downloads/${names.solutions})** — a complete, runnable answer for each workshop.`
            : '- _The solutions archive was not produced by this build._',
          '',
          ':::caution[Not before you have tried]',
          'A learner who reads the answer first never sees the problem the answer is for.',
          'Open the archive **after** the correction, to compare it with what you wrote.',
          ':::',
        ]
      : [
          '- _This training has no solutions archive: ask your trainer for the state to start from if you fell behind._',
        ]),
    '',
    ...(config.repository
      ? [
          '## Elsewhere',
          '',
          `- [The whole repository](${config.repository.url})`,
          `- [The workshop folders](${repositoryLink(config, 'tree', workshopsFolder)})`,
          '',
        ]
      : []),
  ].join('\n');
}

/** The language name Starlight shows in its picker, in that language: `fr` -> `français`. */
function languageLabel(lang) {
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}

/** astro.config.mjs of the generated site. */
export function renderAstroConfig(config) {
  const host = config.repository && hostName(config);
  const social = host
    ? `\n      social: [{ icon: '${host.toLowerCase()}', label: '${host}', href: ${yaml(config.repository.url)} }],`
    : '';
  const editLink = config.repository
    ? `\n      // Each page carries its own editUrl, pointing at the README it comes from;\n      // this only turns the feature on.\n      editLink: { baseUrl: ${yaml(`${config.repository.url}/edit/${config.repository.branch}/`)} },`
    : '';
  const isolation = config.playground
    ? `
  // The online editor (StackBlitz WebContainers) runs Node.js on
  // SharedArrayBuffer, which the browser only grants to a cross-origin isolated
  // page. The build writes the same headers into build/_headers for the deploy.
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },`
    : '';
  const components = config.playground
    ? `
      // Adds the script of the "work online" block of the workshop pages.
      components: {
        MarkdownContent: './src/components/MarkdownContent.astro',
      },`
    : '';

  return `// Generated by training-kit from training.config.mjs — do not edit: it is
// rewritten on every run.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  // Netlify exposes the site's address at build time; locally it is absent, and
  // Starlight simply emits no canonical URL.
  site: process.env.URL || process.env.DEPLOY_PRIME_URL || undefined,${isolation}
  integrations: [
    starlight({
      title: ${yaml(config.title)},
      description: ${yaml(`The hands-on workshops of the ${config.title} training.`)},
      locales: { root: { label: ${yaml(languageLabel(config.lang))}, lang: ${yaml(config.lang)} } },${social}${editLink}
      lastUpdated: false,
      sidebar: [
        { label: 'Overview', link: '/' },
        { label: 'Workshops', items: [{ autogenerate: { directory: 'workshops' } }] },
        // Built next to the site by \`training-kit build\`: it 404s under \`training-kit site\`.
        { label: 'Slides', link: '/slides/' },
        { label: 'Resources', link: '/resources/' },
      ],
      customCss: ['./src/styles/custom.css'],${components}
    }),
  ],
});
`;
}

/** Every file under `dir`, as `{ relativePath: absolutePath }`. */
async function filesUnder(dir) {
  if (!existsSync(dir)) return {};
  const files = {};
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const absolute = join(entry.parentPath, entry.name);
    files[relative(dir, absolute)] = absolute;
  }
  return files;
}

/** Writes `content` unless the file already holds it — a dev server reloads on any write. */
async function writeIfChanged(file, content) {
  if (existsSync(file) && (await readFile(file, 'utf8')) === content) return;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

/**
 * Makes `dir` hold exactly `files` (`{ relativePath: content }`): changed files
 * are rewritten, the others left alone, and anything else is removed — a renamed
 * or removed workshop must not leave a page behind.
 */
async function syncDir(dir, files) {
  for (const [path, absolute] of Object.entries(await filesUnder(dir))) {
    if (!(path in files)) await rm(absolute);
  }
  for (const [path, content] of Object.entries(files)) {
    await writeIfChanged(join(dir, path), content);
  }
}

/**
 * Writes the Starlight project of `config` into .training-kit/site/: the fixed
 * files of site-template/, then everything derived from the workshops. Resources
 * link the files found in `downloadsDir`, so the build runs this after it has
 * produced them. Only what changed is written, so `astro dev` keeps running.
 */
export async function writeSite(config, { downloadsDir = join(config.paths.out, 'downloads') } = {}) {
  const siteDir = join(config.paths.cache, 'site');
  const { workshops, ignored, withoutReadme, overview } = await readWorkshops(config);

  for (const [path, absolute] of Object.entries(await filesUnder(TEMPLATE_DIR))) {
    await writeIfChanged(join(siteDir, path), await readFile(absolute, 'utf8'));
  }
  await writeIfChanged(join(siteDir, 'astro.config.mjs'), renderAstroConfig(config));

  // Recursive: the per-workshop ZIPs live under downloads/tp/. POSIX paths, as the links use them.
  const downloads = new Set(Object.keys(await filesUnder(downloadsDir)).map((path) => path.split(sep).join('/')));
  const pages = {};
  const playgrounds = {};
  const skippedFromEditor = [];
  for (const workshop of workshops) {
    let playground = '';
    if (config.playground) {
      const { project, openFile, skipped } = await playgroundProject({
        dir: workshop.path,
        title: `${config.title} — ${workshop.title}`,
        description: workshop.description,
        template: config.playground.template,
        openFile: config.playground.openFile,
        extraFiles: config.playground.extraFiles,
      });
      skippedFromEditor.push(...skipped.map((file) => `${workshop.name}/${file}`));
      playgrounds[`${workshop.slug}.json`] = JSON.stringify(project);
      playground = renderPlayground({
        src: `/playgrounds/${workshop.slug}.json`,
        openFile,
        limits: config.playground.limits,
      });
    }
    pages[join('workshops', `${workshop.slug}.md`)] = renderWorkshopPage({ config, workshop, playground, downloads });
  }

  pages['index.md'] = renderOverviewPage({ config, workshops, overview });
  pages['resources.md'] = renderResourcesPage({ config, workshops, downloads });

  await syncDir(join(siteDir, 'src/content/docs'), pages);
  await syncDir(join(siteDir, 'public/playgrounds'), playgrounds);

  return { siteDir, pages: Object.keys(pages).length, workshops, ignored, withoutReadme, skippedFromEditor };
}
