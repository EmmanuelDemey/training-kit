// The external tools training-kit drives: Slidev and Astro, installed in the
// training project itself (they are peer dependencies, so the project pins their
// versions), and the Chromium both PDF exports print with.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/** A binary of the project's own node_modules — `slidev`, `astro`. */
export function binPath(root, name) {
  const file = join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
  if (!existsSync(file)) {
    throw new Error(`\`${name}\` is not installed in ${root} — run your package manager's install first`);
  }
  return file;
}

/** Runs a command with inherited output. Resolves when it exits 0, rejects otherwise. */
export function run(command, args, { cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      // .cmd shims only start through a shell on Windows.
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`)),
    );
  });
}

/** Starts a long-running command (a dev server) and hands the child back. */
export function start(command, args, { cwd } = {}) {
  return spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
}

/**
 * The Chromium to print with. TRAINING_KIT_CHROME (or SLIDEV_CHROME) points at
 * one already on the machine and skips the download; otherwise Playwright's own
 * is installed once, into its usual cache.
 */
export async function chromiumPath(log = console.log) {
  const local = process.env.TRAINING_KIT_CHROME || process.env.SLIDEV_CHROME;
  if (local) return local;

  const require = createRequire(import.meta.url);
  const cli = join(require.resolve('playwright-chromium/package.json'), '..', 'cli.js');
  log('\nInstalling the Chromium the PDF exports print with (once, then cached)…');
  await run(process.execPath, [cli, 'install', 'chromium']);
  return undefined;
}
