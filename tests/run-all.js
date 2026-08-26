import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const syntaxOnly = process.argv.includes('--syntax-only');
const sourceFiles = [
  'app.js',
  'analytics.js',
  ...['api', 'lib'].flatMap((directory) =>
    readdirSync(path.join(root, directory))
      .filter((name) => name.endsWith('.js'))
      .sort()
      .map((name) => path.join(directory, name))
  )
];

for (const source of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, source)], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!syntaxOnly) {
  const result = spawnSync(process.execPath, ['--test'], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
