// Pre-compile bin/amm.ts → bin/amm.mjs via esbuild so `node bin/amm.js` works without tsx.
// This is run by `npm run build:cli` and during CI deploy.

import { build } from 'esbuild';
import { existsSync, chmodSync } from 'node:fs';

async function main() {
  await build({
    entryPoints: ['bin/amm.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: 'bin/amm.mjs',
    sourcemap: false,
    minify: false,
    banner: { js: '#!/usr/bin/env node' },
  });
  if (existsSync('bin/amm.mjs')) {
    chmodSync('bin/amm.mjs', 0o755);
    console.log('[build] wrote bin/amm.mjs');
  }
}

main().catch((err) => {
  console.error('[build] failed:', err);
  process.exit(1);
});