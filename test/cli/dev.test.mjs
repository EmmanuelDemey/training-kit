import { test } from 'vitest';
import assert from 'node:assert/strict';
import { chmod, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dev } from '../../src/cli/dev.mjs';
import { resolveConfig } from '../../src/core/config.mjs';
import { tree } from '../helpers/tree.mjs';

/** A stand-in for a dev server: logs how it was started, then runs `then`. */
const fakeServer = (name, then) => `#!/bin/sh\necho "${name} $*" >> "$(dirname "$0")/calls.log"\n${then}\n`;

async function training({ slidev, astro }) {
  const root = await tree({
    'slides/1-intro.md': '# Intro',
    'workshops/1-a/README.md': '# A',
    'node_modules/.bin/slidev': fakeServer('slidev', slidev),
    'node_modules/.bin/astro': fakeServer('astro', astro),
  });
  await chmod(join(root, 'node_modules/.bin/slidev'), 0o755);
  await chmod(join(root, 'node_modules/.bin/astro'), 0o755);
  const calls = async () => (await readFile(join(root, 'node_modules/.bin/calls.log'), 'utf8')).trim().split('\n');
  return { config: resolveConfig({ title: 'T' }, root), calls };
}

test('starts the deck and the site side by side, each on its own port', async () => {
  const { config, calls } = await training({ slidev: 'exec sleep 30', astro: 'sleep 0.5' });

  await dev(config, { slidesPort: 3031, sitePort: 4322, log: () => {} });

  const started = (await calls()).toSorted();
  assert.equal(started.length, 2);
  assert.match(started[0], /^astro dev --root \S+ --ignore-lock --port 4322$/);
  assert.match(started[1], /^slidev \S+deck\.generated\.md --port 3031$/);
});

test('stops the other server when one exits, and exits with its code', async () => {
  const { config } = await training({ slidev: 'exec sleep 30', astro: 'exit 3' });

  const started = Date.now();
  const code = await dev(config, { log: () => {} });

  assert.equal(code, 3);
  assert.ok(Date.now() - started < 10_000, 'the deck server was left running');
});
