// Minimal build script using esbuild — bundles TSX+TS into standalone JS.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(__dirname, 'dist');

if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

console.log('[build] bundling src/main.ts → dist/main.js');
await build({
  entryPoints: [resolve(__dirname, 'src/main.ts')],
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  outfile: resolve(outdir, 'main.js'),
  sourcemap: false,
  minify: true,
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.BASE_URL': '""',
  },
  loader: { '.ts': 'tsx' },
});

const htmlSrc = resolve(__dirname, 'index.html');
const htmlOut = resolve(outdir, 'index.html');
let html = readFileSync(htmlSrc, 'utf-8');
html = html.replace('src="/src/main.ts"', 'src="./main.js"');
writeFileSync(htmlOut, html);
console.log('[build] wrote dist/index.html');

copyFileSync(resolve(__dirname, 'public/favicon.svg'), resolve(outdir, 'favicon.svg'));
console.log('[build] copied public/favicon.svg');

console.log('[build] done ✓');
