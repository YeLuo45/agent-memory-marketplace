#!/usr/bin/env node
// Wrapper: invoke pre-compiled bin/amm.mjs (rebuilt via `node bin/build-cli.mjs`).
// Falls back to running bin/amm.ts with node --experimental-strip-types if not built.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const mjsFile = join(here, 'amm.mjs');

if (existsSync(mjsFile)) {
  const child = spawn(process.execPath, [mjsFile, ...process.argv.slice(2)], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
} else {
  // Node 22+ supports --experimental-strip-types for plain TS without tsx
  const child = spawn(process.execPath, ['--experimental-strip-types', join(here, 'amm.ts'), ...process.argv.slice(2)], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}