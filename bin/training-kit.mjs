#!/usr/bin/env node
// training-kit <command> — run from the root of a training (where
// training.config.mjs lives).

import { parseArgs } from 'node:util';
import { relative } from 'node:path';
import { build } from '../src/build.mjs';
import { loadConfig } from '../src/config.mjs';
import { DECK_FILE, writeDeck } from '../src/deck.mjs';
import { devSite, devSlides } from '../src/dev.mjs';
import { renderList } from '../src/list.mjs';
import { listNumbered } from '../src/numbering.mjs';
import { readWorkshops } from '../src/workshops.mjs';

const HELP = `Usage: training-kit <command> [options]

Commands:
  list                     what the numbering picks up, in order, and what it leaves out
  slides [slidev args]     the deck, live (Slidev), regenerated as chapters come and go
  site [astro args]        the workshops site, live (Astro), regenerated as READMEs change
  deck                     only write the deck entry, for running Slidev by hand
  build [options]          everything that gets deployed, into build/
    --only <part>          slides | pdf | site
    --no-pdf               skip both PDF exports (the slow part)

Chapters are the numbered .md files of the slides folder, workshops the
numbered folders of the workshops folder: 1-intro.md, 2-…, 10-… (numeric
order). A name starting with _ is turned off. Both folders are set in
training.config.mjs.

PDF exports print with Chromium: set TRAINING_KIT_CHROME to one already on the
machine, or Playwright's is installed on first use.`;

const [command, ...rest] = process.argv.slice(2);

async function list(config) {
  const { entries: chapters, ignored: ignoredChapters } = await listNumbered(config.paths.slides, {
    type: 'file',
    extension: '.md',
    skip: [DECK_FILE],
  });
  const { workshops, ignored: ignoredWorkshops, withoutReadme } = await readWorkshops(config);
  console.log(
    renderList({
      slidesDir: relative(config.root, config.paths.slides),
      workshopsDir: relative(config.root, config.paths.workshops),
      chapters,
      ignoredChapters,
      workshops,
      ignoredWorkshops,
      withoutReadme,
    }),
  );
}

try {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    process.exit(command ? 0 : 1);
  }

  const config = await loadConfig(process.cwd());

  switch (command) {
    case 'list':
      await list(config);
      break;
    case 'deck': {
      const { file, chapters } = await writeDeck(config);
      console.log(`${relative(config.root, file)}: ${chapters.length} chapters`);
      break;
    }
    case 'slides':
      await devSlides(config, rest);
      break;
    case 'site':
      await devSite(config, rest);
      break;
    case 'build': {
      const { values } = parseArgs({
        args: rest,
        options: { only: { type: 'string' }, 'no-pdf': { type: 'boolean', default: false } },
      });
      if (values.only && !['slides', 'pdf', 'site'].includes(values.only)) {
        throw new Error(`--only takes slides, pdf or site, not "${values.only}"`);
      }
      await build(config, { only: values.only ?? null, pdf: !values['no-pdf'] });
      break;
    }
    default:
      console.error(`Unknown command "${command}".\n\n${HELP}`);
      process.exit(1);
  }
} catch (error) {
  console.error(`✖ ${error.message}`);
  process.exit(1);
}
