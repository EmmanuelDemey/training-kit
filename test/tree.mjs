import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** A throwaway folder: `files` maps a relative path to its content. */
export async function tree(files) {
  const root = await mkdtemp(join(tmpdir(), 'training-kit-'));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), content);
  }
  return root;
}
