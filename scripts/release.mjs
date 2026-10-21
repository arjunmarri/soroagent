// Bumps the version and publishes versioned downloads in one step:
//   npm run release -- patch   (2.5.0 -> 2.5.1, fixes)
//   npm run release -- minor   (2.5.0 -> 2.6.0, features)
//   npm run release -- major   (2.5.0 -> 3.0.0)
//   npm run release -- 2.7.3   (explicit)
// Updates extension/manifest.json and package.json, rebuilds downloads/soroagent-<browser>-<version>.zip
// and the README's download links. Commit the result afterwards.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MANIFEST = join(ROOT, 'extension/manifest.json');
const PACKAGE = join(ROOT, 'package.json');

const bump = process.argv[2] || 'patch';
const current = JSON.parse(readFileSync(MANIFEST, 'utf8')).version;
const [major, minor, patch] = current.split('.').map(Number);
const next =
  bump === 'major' ? `${major + 1}.0.0`
  : bump === 'minor' ? `${major}.${minor + 1}.0`
  : bump === 'patch' ? `${major}.${minor}.${patch + 1}`
  : /^\d+\.\d+\.\d+$/.test(bump) ? bump
  : null;
if (!next) {
  console.error(`Use: npm run release -- patch | minor | major | x.y.z (got "${bump}")`);
  process.exit(1);
}

// Replace only the version field, keeping each file's formatting.
for (const file of [MANIFEST, PACKAGE]) {
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text.replace(/("version":\s*")[^"]+(")/, `$1${next}$2`));
}
console.log(`Version ${current} -> ${next}`);
execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs'), '--downloads'], { stdio: 'inherit' });
console.log(`\nDone. Commit and push to publish v${next}:\n  git add -A && git commit -m "release: v${next}" && git push`);
