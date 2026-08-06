import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const helperPath = 'src/lib/data/live-attendance.ts';
assert.equal(existsSync(helperPath), true, '司仪名单需要独立的已确认记录筛选器。');

const outputDirectory = mkdtempSync(join(tmpdir(), 'apc-live-attendance-'));
try {
  const compiler = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', helperPath, '--module', 'commonjs', '--target', 'es2022', '--outDir', outputDirectory], { encoding: 'utf8' });
  assert.equal(compiler.status, 0, compiler.stderr || compiler.stdout);

  const require = createRequire(import.meta.url);
  const { getConfirmedRows } = require(join(outputDirectory, 'live-attendance.js'));
  const rows = getConfirmedRows([
    { participantId: 'a', bil: 1, counterNo: 1, name: 'Belum Hadir', organization: 'PPD', seatNo: 1, checked: true, confirmed: false, confirmedAt: null },
    { participantId: 'b', bil: 2, counterNo: 2, name: 'Awal', organization: 'SK A', seatNo: 2, checked: true, confirmed: true, confirmedAt: '2026-08-06T01:00:00.000Z' },
    { participantId: 'c', bil: 3, counterNo: 3, name: 'Terkini', organization: 'SK B', seatNo: 3, checked: true, confirmed: true, confirmedAt: '2026-08-06T01:02:00.000Z' },
  ]);

  assert.deepEqual(rows.map((row) => row.name), ['Awal', 'Terkini']);

  const livePage = readFileSync('src/app/live/[token]/page.tsx', 'utf8');
  assert.doesNotMatch(livePage, /LiveRefresh/);
  assert.match(livePage, /EmceeLiveList/);
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
