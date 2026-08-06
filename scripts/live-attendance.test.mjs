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
  const { getConfirmedRows, getCounterRows } = require(join(outputDirectory, 'live-attendance.js'));
  const rows = getConfirmedRows([
    { participantId: 'a', bil: 1, counterNo: 1, name: 'Belum Hadir', organization: 'PPD', seatNo: 1, checked: true, confirmed: false, confirmedAt: null },
    { participantId: 'b', bil: 2, counterNo: 2, name: 'Awal', organization: 'SK A', seatNo: 2, checked: true, confirmed: true, confirmedAt: '2026-08-06T01:00:00.000Z' },
    { participantId: 'c', bil: 3, counterNo: 3, name: 'Terkini', organization: 'SK B', seatNo: 3, checked: true, confirmed: true, confirmedAt: '2026-08-06T01:02:00.000Z' },
  ]);

  assert.deepEqual(rows.map((row) => row.name), ['Awal', 'Terkini']);

  const counterRows = getCounterRows([
    { participantId: 'a', bil: 3, counterNo: 1, name: 'Belum 3', organization: 'PPD', seatNo: 3, checked: false, confirmed: false, confirmedAt: null },
    { participantId: 'b', bil: 5, counterNo: 1, name: 'Hadir 5', organization: 'SK A', seatNo: 5, checked: true, confirmed: true, confirmedAt: '2026-08-06T01:00:00.000Z' },
    { participantId: 'c', bil: 2, counterNo: 1, name: 'Hadir 2', organization: 'SK B', seatNo: 2, checked: true, confirmed: true, confirmedAt: '2026-08-06T01:02:00.000Z' },
    { participantId: 'd', bil: 1, counterNo: 1, name: 'Belum 1', organization: 'SK C', seatNo: 1, checked: false, confirmed: false, confirmedAt: null },
    { participantId: 'e', bil: 4, counterNo: 2, name: 'Kaunter Lain', organization: 'SK D', seatNo: 4, checked: true, confirmed: true, confirmedAt: '2026-08-06T01:03:00.000Z' },
  ], 1);
  assert.deepEqual(counterRows.map((row) => row.name), ['Hadir 2', 'Hadir 5', 'Belum 1', 'Belum 3']);

  const livePage = readFileSync('src/app/live/[token]/page.tsx', 'utf8');
  assert.doesNotMatch(livePage, /LiveRefresh/);
  assert.match(livePage, /EmceeLiveList/);

  const publicEmceePage = 'src/app/pengacara/page.tsx';
  const publicEmceeApi = 'src/app/api/pengacara/attendance/route.ts';
  assert.equal(existsSync(publicEmceePage), true, '司仪需要无需令牌的 /pengacara 页面。');
  assert.equal(existsSync(publicEmceeApi), true, '公开司仪页需要自动更新接口。');
  const publicEmceeSource = readFileSync(publicEmceePage, 'utf8');
  assert.match(publicEmceeSource, /EmceeLiveList/);
  assert.match(publicEmceeSource, /dynamic = 'force-dynamic'/);
  assert.match(readFileSync(publicEmceeApi, 'utf8'), /getConfirmedRows/);
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
