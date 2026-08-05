#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const BASE_URL = process.env.ACCEPTANCE_BASE_URL ?? 'http://127.0.0.1:3000';
const TEST_SESSION_NAME = 'LATIHAN UJIAN CODEX';
const ISOLATION_SESSION_NAME = 'LATIHAN UJIAN ISOLASI CODEX';
const FORMAL_SESSION_NAME = 'SESI UJIAN RASMI CODEX';
const isPreflight = process.argv.includes('--preflight');
const isVisualSetup = process.argv.includes('--visual-setup');
const isVisualCleanup = process.argv.includes('--visual-cleanup');
const results = [];

async function loadLocalEnvironment() {
  const content = await readFile('.env.local', 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(line)) continue;
    const separator = line.indexOf('=');
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1).replace(/^['"]|['"]$/g, '');
    process.env[key] ??= value;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum ditetapkan.`);
  return value;
}

function pass(name, detail) {
  results.push({ name, status: 'PASS', ...(detail ? { detail } : {}) });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonRequest(urlPath, init = {}, cookie) {
  const response = await fetch(`${BASE_URL}${urlPath}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function getCookie(response) {
  const value = response.headers.get('set-cookie');
  if (!value) throw new Error('Cookie petugas tidak diterima.');
  return value.split(';', 1)[0];
}

function containsForbiddenPublicData(value) {
  if (!value || typeof value !== 'object') return false;
  for (const [key, nested] of Object.entries(value)) {
    if (['ic', 'ic_hmac', 'name_normalized'].includes(key)) return true;
    if (key !== 'selectionToken' && key !== 'lookupToken' && typeof nested === 'string' && /\b\d{12}\b/.test(nested)) return true;
    if (containsForbiddenPublicData(nested)) return true;
  }
  return false;
}

await loadLocalEnvironment();
const supabase = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: activeSession, error: activeError } = await supabase
  .from('event_sessions')
  .select('id, name, mode, is_active')
  .eq('is_active', true)
  .maybeSingle();
if (activeError) throw new Error('Session aktif tidak dapat disemak.');

if (isVisualSetup) {
  if (activeSession && activeSession.name !== TEST_SESSION_NAME) {
    throw new Error('Session lain sedang aktif. Persediaan visual dihentikan.');
  }
  const { data: visualSession, error: visualSessionError } = await supabase
    .from('event_sessions')
    .select('id, name, mode')
    .eq('name', TEST_SESSION_NAME)
    .single();
  if (visualSessionError || visualSession.mode !== 'rehearsal') throw new Error('Session visual ujian tidak tersedia.');
  const visualLogin = await jsonRequest('/api/admin/access/login', {
    method: 'POST', body: JSON.stringify({ password: required('STAFF_ACCESS_PASSWORD') }),
  });
  const visualCookie = getCookie(visualLogin.response);
  const visualActivation = await jsonRequest('/api/admin/sessions', {
    method: 'POST',
    body: JSON.stringify({ action: 'activate', sessionId: visualSession.id, masterPassword: required('MASTER_ACTION_PASSWORD') }),
  }, visualCookie);
  assert(visualActivation.response.ok, 'Session visual ujian tidak dapat diaktifkan.');
  process.stdout.write(`${JSON.stringify({ status: 'READY', session: TEST_SESSION_NAME }, null, 2)}\n`);
} else if (isVisualCleanup) {
  if (activeSession?.name === TEST_SESSION_NAME) {
    const visualLogin = await jsonRequest('/api/admin/access/login', {
      method: 'POST', body: JSON.stringify({ password: required('STAFF_ACCESS_PASSWORD') }),
    });
    const visualCookie = getCookie(visualLogin.response);
    const resetPreview = await jsonRequest(`/api/admin/rehearsal-reset?sessionId=${activeSession.id}`, {}, visualCookie);
    if (resetPreview.response.ok && resetPreview.payload.recordCount > 0) {
      const visualReset = await jsonRequest('/api/admin/rehearsal-reset', {
        method: 'POST',
        body: JSON.stringify({ sessionId: activeSession.id, masterPassword: required('MASTER_ACTION_PASSWORD'), confirmation: 'RESET APC 2025' }),
      }, visualCookie);
      assert(visualReset.response.ok, 'Rekod ujian visual tidak dapat dibersihkan.');
    }
    const { error: deactivateError } = await supabase.from('event_sessions').update({ is_active: false }).eq('id', activeSession.id);
    if (deactivateError) throw new Error('Session visual ujian tidak dapat dinyahaktifkan.');
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'session_deactivated_after_visual_test',
      target_type: 'event_session',
      target_id: activeSession.id,
      metadata: { actor: 'acceptance_test', name: TEST_SESSION_NAME },
    });
  }
  process.stdout.write(`${JSON.stringify({ status: 'CLEAN', activeSession: null }, null, 2)}\n`);
} else if (isPreflight) {
  process.stdout.write(`${JSON.stringify({
    safeToRun: activeSession?.mode !== 'live',
    activeSession: activeSession ? { name: activeSession.name, mode: activeSession.mode } : null,
    testSession: TEST_SESSION_NAME,
  }, null, 2)}\n`);
} else {
if (activeSession?.mode === 'live') {
  throw new Error('Session rasmi sedang aktif. Ujian automatik dihentikan untuk mengelakkan gangguan.');
}

const workbookPath = path.join('senarai peserta APC', 'PENERIMA APC 2025.xlsx');
const workbook = XLSX.read(await readFile(workbookPath), { cellDates: false, raw: true });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: true, defval: null });
const sample = rows.slice(1).find((row) => row[0] && row[1] && row[2]);
if (!sample) throw new Error('Rekod sampel Excel tidak ditemui.');
const sampleBil = Number(sample[0]);
const sampleName = String(sample[1]).trim();
const sampleIc = String(sample[2]).replace(/[\s-]/g, '');

const { data: participant, error: participantError } = await supabase
  .from('participants')
  .select('id, bil, seat_no, counter_no')
  .eq('bil', sampleBil)
  .single();
if (participantError || !participant) throw new Error('Penerima sampel tidak ditemui dalam pangkalan data.');

let cookie;
let testSession;
let isolationSession;
let isolationCountBefore;
let formalSession;
let restored = false;

async function restoreSession() {
  if (restored || !testSession) return;
  restored = true;
  if (activeSession && activeSession.id !== testSession.id && cookie) {
    const restoredResponse = await jsonRequest('/api/admin/sessions', {
      method: 'POST',
      body: JSON.stringify({ action: 'activate', sessionId: activeSession.id, masterPassword: required('MASTER_ACTION_PASSWORD') }),
    }, cookie);
    if (!restoredResponse.response.ok) throw new Error('Session asal tidak dapat dipulihkan melalui API.');
  } else if (!activeSession) {
    const { error } = await supabase.from('event_sessions').update({ is_active: false }).eq('id', testSession.id);
    if (error) throw new Error('Session ujian tidak dapat dinyahaktifkan.');
  }
}

try {
  const unauthenticatedExport = await jsonRequest('/api/admin/export');
  assert(unauthenticatedExport.response.status === 401, 'Eksport tanpa akses tidak ditolak.');
  const unauthenticatedAttendance = await jsonRequest('/api/admin/attendance', {
    method: 'POST', body: JSON.stringify({ action: 'confirm', participantId: participant.id }),
  });
  assert(unauthenticatedAttendance.response.status === 401, 'Tindakan kehadiran tanpa akses tidak ditolak.');
  pass('Laluan pentadbir menolak pengguna tanpa Cookie');

  const login = await jsonRequest('/api/admin/access/login', {
    method: 'POST', body: JSON.stringify({ password: required('STAFF_ACCESS_PASSWORD') }),
  });
  assert(login.response.ok, 'Log masuk kata laluan bersama gagal.');
  cookie = getCookie(login.response);
  pass('Log masuk petugas dan Cookie HttpOnly');

  const { data: existingTestSession, error: testSessionError } = await supabase
    .from('event_sessions')
    .select('id, name, mode, is_active')
    .eq('name', TEST_SESSION_NAME)
    .maybeSingle();
  if (testSessionError) throw new Error('Session ujian tidak dapat disemak.');
  if (existingTestSession) {
    assert(existingTestSession.mode === 'rehearsal', 'Session ujian sedia ada bukan mod latihan.');
    testSession = existingTestSession;
  } else {
    const created = await jsonRequest('/api/admin/sessions', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', name: TEST_SESSION_NAME, mode: 'rehearsal', masterPassword: required('MASTER_ACTION_PASSWORD') }),
    }, cookie);
    assert(created.response.ok, `Session ujian tidak dapat dicipta: ${created.payload.message ?? created.response.status}`);
    testSession = created.payload.session;
  }

  const { data: existingIsolationSession } = await supabase
    .from('event_sessions')
    .select('id, name, mode, is_active')
    .eq('name', ISOLATION_SESSION_NAME)
    .maybeSingle();
  if (existingIsolationSession) {
    isolationSession = existingIsolationSession;
  } else {
    const created = await jsonRequest('/api/admin/sessions', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', name: ISOLATION_SESSION_NAME, mode: 'rehearsal', masterPassword: required('MASTER_ACTION_PASSWORD') }),
    }, cookie);
    assert(created.response.ok, 'Session pengasingan tidak dapat dicipta.');
    isolationSession = created.payload.session;
  }

  const { data: existingFormalSession } = await supabase
    .from('event_sessions')
    .select('id, name, mode, is_active')
    .eq('name', FORMAL_SESSION_NAME)
    .maybeSingle();
  if (existingFormalSession) {
    formalSession = existingFormalSession;
  } else {
    const created = await jsonRequest('/api/admin/sessions', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', name: FORMAL_SESSION_NAME, mode: 'live', masterPassword: required('MASTER_ACTION_PASSWORD') }),
    }, cookie);
    assert(created.response.ok, 'Session rasmi ujian tidak dapat dicipta.');
    formalSession = created.payload.session;
  }
  assert(isolationSession.mode === 'rehearsal' && formalSession.mode === 'live', 'Mod Session ujian tidak sah.');

  const activated = await jsonRequest('/api/admin/sessions', {
    method: 'POST',
    body: JSON.stringify({ action: 'activate', sessionId: testSession.id, masterPassword: required('MASTER_ACTION_PASSWORD') }),
  }, cookie);
  assert(activated.response.ok, `Session ujian tidak dapat diaktifkan: ${activated.payload.message ?? activated.response.status}`);
  pass('Session latihan dicipta dan diaktifkan');

  const sentinelTime = new Date().toISOString();
  const { error: isolationRecordError } = await supabase.from('participant_activity').upsert({
    participant_id: participant.id,
    session_id: isolationSession.id,
    first_lookup_at: sentinelTime,
    last_lookup_at: sentinelTime,
    lookup_count: 1,
    attendance_status: 'not_confirmed',
    attendance_confirmed_at: null,
    confirmation_source: null,
    confirmed_by: null,
  }, { onConflict: 'participant_id,session_id' });
  if (isolationRecordError) throw new Error('Rekod kawalan pengasingan tidak dapat dicipta.');
  isolationCountBefore = (await supabase.from('participant_activity').select('id', { count: 'exact', head: true }).eq('session_id', isolationSession.id)).count ?? 0;

  const shortName = await jsonRequest('/api/public/search/name', {
    method: 'POST', body: JSON.stringify({ query: 'AB' }),
  });
  assert(shortName.response.status === 400, 'Carian nama kurang 3 aksara tidak ditolak.');
  const nameSearch = await jsonRequest('/api/public/search/name', {
    method: 'POST', body: JSON.stringify({ query: sampleName.slice(0, Math.max(3, Math.min(8, sampleName.length))) }),
  });
  assert(nameSearch.response.ok, 'Carian nama sah gagal.');
  assert(Array.isArray(nameSearch.payload.results) && nameSearch.payload.results.length <= 8, 'Carian nama melebihi 8 hasil.');
  assert(!containsForbiddenPublicData(nameSearch.payload), 'Carian nama mendedahkan data terlarang.');
  pass('Combobox API: minimum 3 aksara, maksimum 8 hasil, tiada IC penuh');

  const partialIc = await jsonRequest('/api/public/lookup', {
    method: 'POST', body: JSON.stringify({ ic: sampleIc.slice(0, 8) }),
  });
  assert(partialIc.response.status === 400, 'Carian IC separa tidak ditolak.');
  const firstLookup = await jsonRequest('/api/public/lookup', {
    method: 'POST', body: JSON.stringify({ ic: sampleIc }),
  });
  assert(firstLookup.response.ok, 'Carian IC lengkap gagal.');
  assert(firstLookup.payload.result.bil === participant.bil, 'Bil carian tidak sepadan.');
  assert(firstLookup.payload.result.seatNo === participant.seat_no, 'Kerusi carian tidak sepadan.');
  assert(firstLookup.payload.result.counterNo === participant.counter_no, 'Kaunter carian tidak sepadan.');
  assert(!containsForbiddenPublicData(firstLookup.payload), 'Hasil carian mendedahkan IC penuh atau HMAC.');
  const secondLookup = await jsonRequest('/api/public/lookup', {
    method: 'POST', body: JSON.stringify({ ic: sampleIc }),
  });
  assert(secondLookup.response.ok, 'Carian IC berulang gagal.');
  const { data: activityAfterLookup } = await supabase
    .from('participant_activity')
    .select('id, lookup_count, attendance_status')
    .eq('participant_id', participant.id)
    .eq('session_id', testSession.id);
  assert(activityAfterLookup?.length === 1 && activityAfterLookup[0].lookup_count >= 2, 'Carian berulang menghasilkan rekod pendua.');
  pass('Carian IC tepat dan carian berulang kekal satu rekod');

  const firstConfirmation = await jsonRequest('/api/public/attendance/confirm', {
    method: 'POST', body: JSON.stringify({ lookupToken: firstLookup.payload.result.lookupToken }),
  });
  const secondConfirmation = await jsonRequest('/api/public/attendance/confirm', {
    method: 'POST', body: JSON.stringify({ lookupToken: firstLookup.payload.result.lookupToken }),
  });
  assert(firstConfirmation.response.ok && secondConfirmation.response.ok, 'Pengesahan peserta gagal.');
  assert(firstConfirmation.payload.result.confirmedAt === secondConfirmation.payload.result.confirmedAt, 'Pengesahan berulang mengubah masa pengesahan.');
  pass('Pengesahan peserta idempoten');

  const revoked = await jsonRequest('/api/admin/attendance', {
    method: 'POST', body: JSON.stringify({ action: 'revoke', participantId: participant.id, reason: 'Ujian penerimaan sistem' }),
  }, cookie);
  assert(revoked.response.ok, 'Pembatalan kehadiran petugas gagal.');
  const staffConfirmed = await jsonRequest('/api/admin/attendance', {
    method: 'POST', body: JSON.stringify({ action: 'confirm', participantId: participant.id }),
  }, cookie);
  const staffConfirmedAgain = await jsonRequest('/api/admin/attendance', {
    method: 'POST', body: JSON.stringify({ action: 'confirm', participantId: participant.id }),
  }, cookie);
  assert(staffConfirmed.response.ok && staffConfirmedAgain.response.ok, 'Pengesahan petugas gagal.');
  const { data: activityAfterStaff } = await supabase
    .from('participant_activity')
    .select('id, attendance_status, confirmation_source')
    .eq('participant_id', participant.id)
    .eq('session_id', testSession.id);
  assert(activityAfterStaff?.length === 1 && activityAfterStaff[0].attendance_status === 'confirmed', 'Pengesahan petugas menghasilkan status tidak sah.');
  pass('Petugas boleh batal/sahkan tanpa rekod pendua');

  const exportResponse = await fetch(`${BASE_URL}/api/admin/export?counter=${participant.counter_no}&status=confirmed`, { headers: { Cookie: cookie } });
  const csvBytes = new Uint8Array(await exportResponse.arrayBuffer());
  const csv = new TextDecoder('utf-8').decode(csvBytes);
  assert(exportResponse.ok && csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf, 'Eksport CSV UTF-8 gagal.');
  assert(!csv.includes(sampleIc), 'CSV mendedahkan IC penuh.');
  pass('CSV mengikut akses petugas dan tidak mengandungi IC');

  const preview = await jsonRequest(`/api/admin/rehearsal-reset?sessionId=${testSession.id}`, {}, cookie);
  assert(preview.response.ok && preview.payload.recordCount >= 1, 'Kiraan reset latihan tidak sah.');
  const invalidConfirmation = await jsonRequest('/api/admin/rehearsal-reset', {
    method: 'POST', body: JSON.stringify({ sessionId: testSession.id, masterPassword: required('MASTER_ACTION_PASSWORD'), confirmation: 'RESET' }),
  }, cookie);
  assert(invalidConfirmation.response.status === 400, 'Teks pengesahan reset yang salah tidak ditolak.');
  const reset = await jsonRequest('/api/admin/rehearsal-reset', {
    method: 'POST', body: JSON.stringify({ sessionId: testSession.id, masterPassword: required('MASTER_ACTION_PASSWORD'), confirmation: 'RESET APC 2025' }),
  }, cookie);
  assert(reset.response.ok && reset.payload.recordCount >= 1, 'Reset latihan gagal.');
  const { count: remainingActivity } = await supabase.from('participant_activity').select('id', { count: 'exact', head: true }).eq('session_id', testSession.id);
  const { count: backupItems } = await supabase.from('rehearsal_reset_backup_items').select('activity_id', { count: 'exact', head: true }).eq('backup_id', reset.payload.backupId);
  const { count: resetAudit } = await supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'rehearsal_records_reset').eq('target_id', testSession.id);
  assert(remainingActivity === 0, 'Rekod latihan masih berada dalam statistik selepas reset.');
  assert(backupItems === reset.payload.recordCount, 'Bilangan item arkib tidak sepadan.');
  assert((resetAudit ?? 0) >= 1, 'Audit Log reset tidak ditemui.');
  pass('Reset latihan: semakan, frasa, arkib transaksi dan Audit Log');

  const { count: isolationCountAfter } = await supabase.from('participant_activity').select('id', { count: 'exact', head: true }).eq('session_id', isolationSession.id);
  assert(isolationCountAfter === isolationCountBefore, 'Reset latihan mengubah rekod Session lain.');
  const formalReset = await jsonRequest(`/api/admin/rehearsal-reset?sessionId=${formalSession.id}`, {}, cookie);
  assert(formalReset.response.status === 400, 'Session rasmi dibenarkan masuk ke aliran reset.');
  pass('Pengasingan Session dan perlindungan Session rasmi');

  const isolationCleanup = await jsonRequest('/api/admin/rehearsal-reset', {
    method: 'POST', body: JSON.stringify({ sessionId: isolationSession.id, masterPassword: required('MASTER_ACTION_PASSWORD'), confirmation: 'RESET APC 2025' }),
  }, cookie);
  assert(isolationCleanup.response.ok, 'Rekod kawalan pengasingan tidak dapat dibersihkan.');

  const { count: attendanceAudit } = await supabase.from('audit_logs').select('id', { count: 'exact', head: true }).in('action', ['attendance_confirmed', 'attendance_revoked']).eq('target_id', participant.id);
  assert((attendanceAudit ?? 0) >= 2, 'Audit Log tindakan petugas tidak lengkap.');
  pass('Audit Log tindakan kritikal direkodkan');
} finally {
  await restoreSession();
}

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  tests: results.length,
  restoredSession: activeSession?.name ?? null,
  results,
}, null, 2)}\n`);
}
