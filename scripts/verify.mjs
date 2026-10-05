/** Bundles the parity harness and runs it in Node. */
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const realCharts = [];
if (process.env.DXTAG_CHARTS_DIR) {
  for (const relative of ['22. BUDDiES/系ぎて', '27. CiRCLE PLUS/TECHNOPOLIS 2085']) {
    const file = resolve(process.env.DXTAG_CHARTS_DIR, relative, 'maidata.txt');
    if (existsSync(file)) realCharts.push({id: relative, text: readFileSync(file, 'utf8')});
  }
}

mkdirSync('.tmp', {recursive: true});
await build({
  entryPoints: ['src/verify-entry.ts'],
  outfile: '.tmp/verify.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  define: {REAL_CHART_FIXTURES: JSON.stringify(realCharts)},
  logLevel: 'warning',
});
const result = spawnSync(process.execPath, ['.tmp/verify.mjs'], {stdio: 'inherit'});
process.exit(result.status ?? 1);
