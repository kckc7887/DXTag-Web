/** Bundles the parity harness and runs it in Node. */
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';

mkdirSync('.tmp', {recursive: true});
await build({
  entryPoints: ['src/verify-entry.ts'],
  outfile: '.tmp/verify.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'warning',
});
const result = spawnSync(process.execPath, ['.tmp/verify.mjs'], {stdio: 'inherit'});
process.exit(result.status ?? 1);
