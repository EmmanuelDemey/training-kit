// Ported from scripts/playground.test.mjs of the trainings-v2 repository.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { collectFiles, playgroundProject } from '../src/playground.mjs';
// A throwaway workshop folder: `files` maps a path to its content.
import { tree as workshop } from './tree.mjs';

test('keeps the starter files, nested ones and dotfiles included', async () => {
  const dir = await workshop({
    'package.json': '{}',
    'src/App.vue': '<template />',
    '.nvmrc': '24',
  });

  const { files, skipped } = await collectFiles(dir);

  assert.deepEqual(Object.keys(files), ['.nvmrc', 'package.json', 'src/App.vue']);
  assert.equal(files['src/App.vue'], '<template />');
  assert.deepEqual(skipped, []);
});

test('leaves out what an install or a build produced', async () => {
  const dir = await workshop({
    'index.html': '<!doctype html>',
    'node_modules/vue/index.js': 'x',
    'dist/index.html': 'x',
    '.vitest/report.json': 'x',
  });

  const { files } = await collectFiles(dir);

  assert.deepEqual(Object.keys(files), ['index.html']);
});

test('reports binaries instead of shipping them as text', async () => {
  const dir = await workshop({
    'app.js': 'console.log(1)',
    'logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]),
  });

  const { files, skipped } = await collectFiles(dir);

  assert.deepEqual(Object.keys(files), ['app.js']);
  assert.deepEqual(skipped, ['logo.png']);
});

test('opens the first candidate files the workshop actually has', async () => {
  const dir = await workshop({ 'app.js': '', 'index.html': '' });

  const { project, openFile } = await playgroundProject({
    dir,
    title: 'TP 1',
    description: 'Intro',
    template: 'html',
    openFile: ['src/App.vue', 'app.js', 'index.html'],
  });

  assert.equal(openFile, 'app.js,index.html');
  assert.equal(project.template, 'html');
  assert.deepEqual(Object.keys(project.files), ['app.js', 'index.html']);
});

test('opens nothing in particular when no candidate exists', async () => {
  const dir = await workshop({ 'main.js': '' });

  const { openFile } = await playgroundProject({
    dir,
    title: 't',
    description: 'd',
    template: 'node',
    openFile: ['app.js'],
  });

  assert.equal(openFile, undefined);
});

test('adds the extra files the workshop lacks, never over its own', async () => {
  const dir = await workshop({ 'index.html': 'mine' });

  const { project } = await playgroundProject({
    dir,
    title: 't',
    description: 'd',
    template: 'node',
    extraFiles: { 'package.json': '{}', 'index.html': 'theirs' },
  });

  assert.deepEqual(project.files, { 'index.html': 'mine', 'package.json': '{}' });
});
