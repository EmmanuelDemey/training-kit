import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderVerify, verify } from '../../src/cli/verify.mjs';
import { resolveConfig } from '../../src/core/config.mjs';
import { tree } from '../helpers/tree.mjs';

const configOf = (root, raw = {}) => resolveConfig({ title: 'T', ...raw }, root);

/** A package.json whose scripts print a word, then exit with `code`. */
const pkg = (scripts) =>
  JSON.stringify({
    name: 'solution',
    private: true,
    scripts: Object.fromEntries(
      Object.entries(scripts).map(([name, { say, code }]) => [
        name,
        `node -e "console.log('${say}'); process.exit(${code})"`,
      ]),
    ),
  });

/** What `verify` found, folder by folder, without the outputs. */
const statuses = (results) => results.map(({ name, status }) => ({ name, status }));

test('runs npm test in every solution, in order, and tells which one broke', async () => {
  const root = await tree({
    'solutions/10-last/package.json': pkg({ test: { say: 'fine', code: 0 } }),
    'solutions/2-broken/package.json': pkg({ test: { say: 'expected 1 to be 2', code: 1 } }),
    'solutions/1-first/package.json': pkg({ test: { say: 'fine', code: 0 } }),
  });

  const results = await verify(configOf(root));

  assert.deepEqual(statuses(results), [
    { name: '1-first', status: 'passed' },
    { name: '2-broken', status: 'failed' },
    { name: '10-last', status: 'passed' },
  ]);
  assert.match(results[1].output, /expected 1 to be 2/);
});

test('skips a solution without package.json, or without the script', async () => {
  const root = await tree({
    'solutions/1-static/index.html': '',
    'solutions/2-untested/package.json': pkg({ build: { say: 'built', code: 0 } }),
  });

  assert.deepEqual(await verify(configOf(root)), [
    { name: '1-static', status: 'skipped', reason: 'no package.json' },
    { name: '2-untested', status: 'skipped', reason: 'no "test" script in package.json' },
  ]);
});

test('fails a solution whose package.json does not parse, and goes on with the next', async () => {
  const root = await tree({
    'solutions/1-broken/package.json': '{ "scripts": ',
    'solutions/2-fine/package.json': pkg({ test: { say: 'fine', code: 0 } }),
  });

  const results = await verify(configOf(root));

  assert.deepEqual(statuses(results), [
    { name: '1-broken', status: 'failed' },
    { name: '2-fine', status: 'passed' },
  ]);
  assert.match(results[0].output, /package\.json is not valid JSON/);
});

test('runs the script set in the config, or the one given to the command', async () => {
  const root = await tree({
    'solutions/1-first/package.json': pkg({ test: { say: 'unit', code: 1 }, e2e: { say: 'e2e', code: 0 } }),
  });
  const config = configOf(root, { verify: { script: 'e2e' } });

  assert.equal((await verify(config))[0].status, 'passed');
  assert.equal((await verify(config, { script: 'test' }))[0].status, 'failed');
});

test('installs the dependencies first when asked', async () => {
  const root = await tree({ 'solutions/1-first/package.json': pkg({ test: { say: 'fine', code: 0 } }) });

  const [result] = await verify(configOf(root), { install: true });

  assert.equal(result.status, 'passed');
  assert.equal(existsSync(join(root, 'solutions/1-first/package-lock.json')), true);
});

test('leaves out a turned-off solution', async () => {
  const root = await tree({ 'solutions/_1-off/package.json': pkg({ test: { say: 'no', code: 1 } }) });

  assert.deepEqual(await verify(configOf(root)), []);
});

test('refuses a training without solutions', async () => {
  const root = await tree({});

  await assert.rejects(verify(configOf(root, { solutions: false })), /no solutions folder/);
  await assert.rejects(verify(configOf(root)), /no solutions folder/);
});

test('shows the output of a broken solution, and counts', () => {
  assert.equal(
    renderVerify([
      { name: '1-first', status: 'passed' },
      { name: '2-broken', status: 'failed', output: 'expected 1 to be 2\n' },
      { name: '3-static', status: 'skipped', reason: 'no package.json' },
    ]),
    [
      '✔ 1-first',
      '✖ 2-broken',
      '    expected 1 to be 2',
      '- 3-static: no package.json',
      '',
      '1 passed, 1 failed, 1 skipped',
    ].join('\n'),
  );
  assert.equal(renderVerify([]), 'no solution to verify');
});
