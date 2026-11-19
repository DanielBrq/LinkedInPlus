import { mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['background.js'],
  outfile: 'dist/background.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome112',
});
