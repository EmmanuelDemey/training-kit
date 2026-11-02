// `training-kit verify`: runs the tests of every solution, one after the other,
// so that a dependency upgrade that breaks one of them is found before the
// training, not in front of the learners.
//
//   solutions/1-first/      npm run test   ✔
//   solutions/2-routing/    npm run test   ✖  its output is shown
//   solutions/3-static/     no package.json, skipped
//
// The script is `test` unless `verify.script` in the config, or `--script` on
// the command line, names another. `--install` runs `npm install` first.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listNumbered } from '../core/numbering.mjs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** Runs `npm <args>` in `cwd`, output captured. Resolves `{ ok, output }`, never rejects on a failure. */
function npmIn(cwd, args) {
  return new Promise((resolve) => {
    const child = spawn(npm, args, { cwd, shell: process.platform === 'win32' });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', (error) => resolve({ ok: false, output: `${output}${error.message}\n` }));
    child.on('exit', (code) => resolve({ ok: code === 0, output }));
  });
}

async function verifyOne({ name, path }, { script, install }) {
  const manifest = join(path, 'package.json');
  if (!existsSync(manifest)) return { name, status: 'skipped', reason: 'no package.json' };
  let scripts;
  try {
    ({ scripts = {} } = JSON.parse(await readFile(manifest, 'utf8')));
  } catch (error) {
    return { name, status: 'failed', output: `package.json is not valid JSON: ${error.message}` };
  }
  if (!scripts[script]) return { name, status: 'skipped', reason: `no "${script}" script in package.json` };

  if (install) {
    const installed = await npmIn(path, ['install', '--no-audit', '--no-fund']);
    if (!installed.ok) return { name, status: 'failed', output: installed.output };
  }
  const { ok, output } = await npmIn(path, ['run', script]);
  return ok ? { name, status: 'passed' } : { name, status: 'failed', output };
}

/**
 * Runs `script` in every numbered solution folder of `config`, in order.
 * Returns one `{ name, status: 'passed' | 'failed' | 'skipped', output?, reason? }` per folder.
 */
export async function verify(config, { script = config.verify.script, install = false, log = () => {} } = {}) {
  const dir = config.paths.solutions;
  if (!dir || !existsSync(dir)) throw new Error('no solutions folder: nothing to verify');

  const { entries } = await listNumbered(dir, { type: 'directory' });
  const results = [];
  for (const solution of entries) {
    log(`… ${solution.name}`);
    results.push(await verifyOne(solution, { script, install }));
  }
  return results;
}

const indent = (text) =>
  text
    .trimEnd()
    .split('\n')
    .map((line) => `    ${line}`);

export function renderVerify(results) {
  if (!results.length) return 'no solution to verify';
  const lines = results.flatMap(({ name, status, output, reason }) => {
    if (status === 'passed') return [`✔ ${name}`];
    if (status === 'skipped') return [`- ${name}: ${reason}`];
    return [`✖ ${name}`, ...indent(output)];
  });
  const count = (status) => results.filter((result) => result.status === status).length;
  return [...lines, '', `${count('passed')} passed, ${count('failed')} failed, ${count('skipped')} skipped`].join('\n');
}
