# @emmanueldemey/training-kit

Turns a folder of numbered slides and a folder of numbered workshops into a
complete training:

- a **slide deck** ([Slidev](https://sli.dev));
- a **workshops site** ([Starlight](https://starlight.astro.build)) — one page per
  workshop, with an optional **online editor** (StackBlitz) loaded with the
  workshop folder;
- the deck and the workshops as **PDFs**;
- **ZIPs**: a starter and a solution per workshop, all the solutions, and a
  participant kit.

You write Markdown and code. There is no list of chapters to maintain: the
number at the start of a file name is its place.

The quickest start is the generator, which writes a working training to build on:

```bash
npm create training-kit my-training
```

## Install

In an existing project:

```bash
npm install -D @emmanueldemey/training-kit @slidev/cli @slidev/theme-default astro @astrojs/starlight sharp
# only with the online editor:
npm install -D @stackblitz/sdk
```

Slidev, Astro and Starlight are **peer dependencies**: your training pins their
versions, and can move to a newer Slidev without waiting for a training-kit
release. Requires Node.js 22.12 or later.

With **pnpm**, add `shamefullyHoist: true` to `pnpm-workspace.yaml`: Astro
resolves some of its own dependencies from the folder it builds, which pnpm's
strict layout hides.

## The layout

```
my-training/
  training.config.mjs
  slides/
    1-introduction.md         chapter 1
    2-reactivity.md           chapter 2
    10-testing.md             chapter 10 — after 9: the order is numeric
    _11-draft.md              turned off: kept on disk, left out of everything
    components/  public/      anything Slidev reads next to its entry
  workshops/
    README.md                 optional: the introduction of the workshops
    1-devtools/
      README.md               the instructions — the page, and the handbook chapter
      package.json  src/ …    the starter code
    2-composables/
  solutions/
    1-devtools/               the solution of workshops/1-devtools — same name
    2-composables/
```

### The numbering rule

| Name                                      | Read as                                                       |
| ----------------------------------------- | ------------------------------------------------------------- |
| `1-intro.md`, `01_intro.md`, `1 intro.md` | number 1 — any separator, any padding                         |
| `10-testing.md`                           | number 10, **after** 9                                        |
| `_3-optional.md`                          | turned off — out of the deck, the site, the PDFs and the ZIPs |
| `notes.md`                                | no number — left out, and reported by `training-kit list`     |
| `3-a.md` next to `03-b.md`                | an error: two entries cannot share a number                   |

The same rule applies to the chapter files of `slides/` and to the workshop
folders of `workshops/`. A workshop folder without a `README.md` gets no page
and is reported.

A **solution** is the folder of `solutions/` with **exactly the same name** as
its workshop folder. The build reports a workshop without a solution, and a
solution folder that matches no workshop (a typo would otherwise silently publish
nothing).

### Workshop READMEs

The README is the single source of a workshop's instructions. From it:

- the **leading `# heading`** becomes the page title. `TP 3 — Routing`,
  `Workshop 3: Routing` and `Routing` all appear as `3. Routing` in the menu: the
  number always comes from the folder name;
- the **blockquote right under the heading** (otherwise the first paragraph)
  becomes the page description.

```markdown
# TP 3 — Routing

> Add a detail page, and keep the back button working.

## Steps

…
```

## Configuration

`training.config.mjs`, at the root of the project. Only `title` is required.

```js
import { defineConfig } from '@emmanueldemey/training-kit';

export default defineConfig({
  title: 'Advanced Vue.js',
  author: 'Jane Doe',
  slides: 'slides',
  workshops: 'workshops',
  solutions: 'solutions',
  playground: true,
  repository: 'https://github.com/me/advanced-vue',
  deck: { theme: 'seriph', headmatter: { lineNumbers: true } },
});
```

| Option            | Default                |                                                                                                                                                                |
| ----------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`           | — (required)           | the name of the training: deck cover, site title, handbook cover                                                                                               |
| `slug`            | the title, kebab-cased | prefixes the downloads: `<slug>-slides.pdf`                                                                                                                    |
| `author`          | `''`                   | on the deck cover and the handbook cover                                                                                                                       |
| `slides`          | `'slides'`             | the folder of numbered chapters                                                                                                                                |
| `workshops`       | `'workshops'`          | the folder of numbered workshop folders                                                                                                                        |
| `solutions`       | `'solutions'`          | the folder of solutions, one per workshop, same names. `false` if there are none                                                                               |
| `outDir`          | `'build'`              | where `training-kit build` writes                                                                                                                              |
| `lang`            | `'en'`                 | the language of the site                                                                                                                                       |
| `deck.theme`      | `'default'`            | the Slidev theme — install its package                                                                                                                         |
| `deck.headmatter` | `{}`                   | any [Slidev headmatter](https://sli.dev/custom/#headmatter); it wins over `theme` and `title`                                                                  |
| `playground`      | `false`                | the online editor on the workshop pages: `true`, or an object (below)                                                                                          |
| `repository`      | none                   | a URL, or `{ url, branch = 'main', dir = '' }` — `dir` when the project is a sub-folder of the repository. Adds "edit this page" and "browse the folder" links |

`playground` as an object:

| Key          | Default         |                                                                                                                                            |
| ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `template`   | `'node'`        | the StackBlitz project template: `node` boots a WebContainer, with a terminal                                                              |
| `openFile`   | `['README.md']` | files to open, in order of preference — the ones the workshop has                                                                          |
| `extraFiles` | `{}`            | `{ path: content }` added to the online copy only, never over the workshop's own files — a `package.json` for a starter that has none, say |
| `limits`     | `''`            | a sentence shown above the buttons: what does not run online                                                                               |

## Commands

```bash
training-kit list            # what the numbering picks up, in order, and what it leaves out
training-kit slides          # the deck, live — Slidev's own options after it: --port 3031
training-kit site            # the workshops site, live — Astro's own options after it
training-kit build           # everything, into build/
training-kit build --no-pdf  # without the two PDF exports (the slow part)
training-kit build --only slides|pdf|site
training-kit deck            # only write the deck entry, to run Slidev by hand
```

While `slides` runs, adding, renaming or removing a chapter updates the open
deck. While `site` runs, saving a workshop README updates its page.

`--only site` rebuilds the site alone and links the downloads of a previous
build; `--only pdf` builds the deck, both PDFs and the ZIPs, without the site.

### What the build produces

```
build/
  index.html                      the workshops site: the overview
  workshops/<n-name>/             one page per workshop
  resources/                      every download, and a table of the workshop ZIPs
  slides/                         the deck
  downloads/
    <slug>-slides.pdf             the deck, printed slide by slide
    <slug>-workshops.pdf          the handbook: cover, contents, one workshop per page
    <slug>-solutions.zip          all the solutions
    <slug>-participants.zip       both PDFs + the workshop folders, no solutions
    tp/<n-name>-starter.zip       one workshop, ready to unzip and work in
    tp/<n-name>-solution.zip      its solution
  playgrounds/<n-name>.json       the online editor's copy of each workshop
  _redirects                      the deck's SPA fallback
  _headers                        cross-origin isolation for the online editor
```

Every workshop page links its starter and solution ZIPs. A link only appears
when its file was produced: both PDF exports are **non-fatal**, and a failed
export simply drops its link and its place in the participant kit.

`node_modules`, `dist`, `coverage`, logs and `.env.local` files are never
zipped.

### PDFs and Chromium

Both PDFs are printed with Chromium. On the first build, Playwright's Chromium
is downloaded into its usual cache. To use one already on the machine instead:

```bash
TRAINING_KIT_CHROME=/path/to/chrome training-kit build
```

The deck is printed from the **built** deck, one slide per page, rather than
with `slidev export`: Slidev's export drives a dev server, which a deck of a few
hundred slides defeats.

## Deploying

`build/` is a static site. `_redirects` and `_headers` use Netlify's format;
on another host, translate them:

- `/slides/*` must fall back to `/slides/index.html` — a reload on slide 12
  would 404 otherwise;
- with the online editor, `/workshops/*` must be served with
  `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`. Without them the editor still
  opens in a new tab, but cannot be embedded in the page.

## Generated files

| File                       |                                                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slides/deck.generated.md` | the Slidev entry: a cover, then one `src:` import per chapter. Written into the slides folder because Slidev takes the entry's folder as the deck's root — `components/`, `public/`, `styles/`, `layouts/` next to the chapters work as Slidev documents them |
| `.training-kit/site/`      | the Starlight project the site is built from                                                                                                                                                                                                                  |

Both are rewritten on every run: add them to `.gitignore`, never edit them.

## JavaScript API

The CLI is built on these, exported from the package:

```js
import {
  defineConfig, // identity, for editor completion in training.config.mjs
  loadConfig, // (root) => the resolved config of the project at `root`
  resolveConfig, // (raw, root) => defaults filled in, paths made absolute
  listNumbered, // (dir, { type: 'file' | 'directory', extension?, skip? }) => { entries, ignored }
  orderOf, // ('10-testing.md') => 10, ('_3-off.md') => null
  slugOf, // ('03_First Steps.md', '.md') => '3-first-steps'
  readWorkshops, // (config) => { workshops, ignored, withoutReadme, overview }
  parseReadme, // (markdown, fallbackTitle) => { title, description, body }
  labelOf, // ('TP 3 — Routing', 3) => '3. Routing'
  renderDeck, // the deck entry as a string
  writeDeck, // (config) => writes it, only when it changed
  writeSite, // (config) => writes the Starlight project
  renderHandbook, // the handbook as an HTML string
  build, // (config, { only, pdf }) => what `training-kit build` does
} from '@emmanueldemey/training-kit';
```

## Contributing

```bash
pnpm install       # also installs the pre-commit hook (husky)
pnpm test          # Vitest
pnpm run check     # oxfmt, oxlint, knip, jscpd and Vitest — what the CI and the hook run
```

The CI also scaffolds a training with
[create-training-kit](https://github.com/EmmanuelDemey/create-training-kit),
points it at the training-kit of the commit, and builds it.

## License

MIT
