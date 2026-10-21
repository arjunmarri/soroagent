// Shared by the build and the tests.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Expands "dir/*.js" entries in a script list to the matching files (sorted), skipping files
 * whose names start with "_" and files already listed explicitly.
 */
export function expandScripts(list, extensionDir) {
  const explicit = new Set(list.filter((entry) => !entry.includes('*')));
  return list.flatMap((entry) => {
    const glob = entry.match(/^(.*)\/\*\.js$/);
    if (!glob) return [entry];
    return readdirSync(join(extensionDir, glob[1]))
      .filter((name) => name.endsWith('.js') && !name.startsWith('_'))
      .sort()
      .map((name) => `${glob[1]}/${name}`)
      .filter((file) => !explicit.has(file));
  });
}
