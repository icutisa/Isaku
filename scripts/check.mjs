import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['server.mjs', ...['lib', 'public', 'scripts', 'tests'].flatMap(dir =>
  readdirSync(join(root, dir)).filter(file => file.endsWith('.mjs')).map(file => join(dir, file)))];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Sintaks ${files.length} file JavaScript: OK.`);
