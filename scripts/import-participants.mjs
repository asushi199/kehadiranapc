#!/usr/bin/env node

import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const EXPECTED_HEADERS = ['BIL', 'NAMA PEGAWAI', 'NO KP PEGAWAI', 'PPD/ SEKOLAH', 'NO KERUSI', 'KAUNTER'];
const DEFAULT_FILE = path.join('senarai peserta APC', 'PENERIMA APC 2025.xlsx');
const shouldApply = process.argv.includes('--apply');
const shouldVerifyDatabase = process.argv.includes('--verify-database');
const importConfirmed = process.argv.includes('--confirm-import');
const fileFlagIndex = process.argv.indexOf('--file');
const inputFile = fileFlagIndex >= 0 ? process.argv[fileFlagIndex + 1] : DEFAULT_FILE;

async function loadLocalEnvironment() {
  try {
    const content = await readFile('.env.local', 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(line)) continue;
      const separator = line.indexOf('=');
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1).replace(/^['"]|['"]$/g, '');
      process.env[key] ??= value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

await loadLocalEnvironment();

if (shouldApply && !importConfirmed) {
  throw new Error('Gunakan --confirm-import bersama --apply untuk menulis data ke Supabase.');
}
if (shouldApply && shouldVerifyDatabase) {
  throw new Error('Pilih sama ada --apply atau --verify-database, bukan kedua-duanya.');
}

function normalizeHeader(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLocaleUpperCase('ms-MY')
    .replace(/['’‘]/g, '')
    .replace(/@/g, ' A ')
    .replace(/\bA\s*\/\s*([LP])\b/g, 'A$1')
    .replace(/\s+/g, ' ');
}

function normalizeIc(value) {
  return String(value ?? '').replace(/[\s-]/g, '');
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function collectDuplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value);
}

function failIfInvalid(report) {
  if (report.errors.length > 0) {
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 1;
    return true;
  }

  return false;
}

const sourceBuffer = await readFile(inputFile);
const workbook = XLSX.read(sourceBuffer, { cellDates: false, raw: true });
if (workbook.SheetNames.length !== 1) {
  throw new Error('Fail Excel mesti mempunyai tepat satu lembaran kerja.');
}

const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
const headers = (rows[0] ?? []).map(normalizeHeader);
const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== null && String(cell).trim() !== ''));
const report = {
  sourceFile: inputFile,
  sheet: workbook.SheetNames[0],
  records: dataRows.length,
  errors: [],
  warnings: [],
  summary: {},
};

if (JSON.stringify(headers) !== JSON.stringify(EXPECTED_HEADERS)) {
  report.errors.push({ code: 'INVALID_HEADERS', message: 'Header Excel tidak sepadan dengan format APC 2025.' });
}

const prepared = [];
for (const [offset, row] of dataRows.entries()) {
  const excelRow = offset + 2;
  const [bil, name, ic, organization, seatNo, counterNo] = row;
  const normalizedIc = normalizeIc(ic);
  const normalizedName = normalizeName(name);

  if (![bil, name, ic, organization, seatNo, counterNo].every((value) => value !== null && String(value).trim() !== '')) {
    report.errors.push({ code: 'MISSING_REQUIRED_VALUE', row: excelRow });
    continue;
  }
  if (!isPositiveInteger(bil) || !isPositiveInteger(seatNo) || !isPositiveInteger(counterNo)) {
    report.errors.push({ code: 'INVALID_INTEGER', row: excelRow });
  }
  if (!/^\d{12}$/.test(normalizedIc)) {
    report.errors.push({ code: 'INVALID_IC', row: excelRow });
  }
  if (String(name) !== String(name).trim() || /\s{2,}/.test(String(name))) {
    report.warnings.push({ code: 'NAME_WHITESPACE_NORMALIZED', row: excelRow });
  }

  prepared.push({
    bil,
    name: String(name).trim().replace(/\s+/g, ' '),
    name_normalized: normalizedName,
    ic: normalizedIc,
    organization: String(organization).trim().replace(/\s+/g, ' '),
    seat_no: seatNo,
    counter_no: counterNo,
  });
}

for (const [field, values] of Object.entries({
  bil: prepared.map((item) => item.bil),
  name_normalized: prepared.map((item) => item.name_normalized),
  ic: prepared.map((item) => item.ic),
  seat_no: prepared.map((item) => item.seat_no),
})) {
  const duplicates = collectDuplicates(values);
  if (duplicates.length > 0) report.errors.push({ code: 'DUPLICATE_VALUE', field, count: duplicates.length });
}

const expectedCounter = (bil) => (bil <= 57 ? 1 : Math.floor((bil - 58) / 55) + 2);
for (const item of prepared) {
  if (item.bil < 1 || item.bil > 332 || item.seat_no !== item.bil || item.counter_no !== expectedCounter(item.bil)) {
    report.errors.push({ code: 'INVALID_APC_MAPPING', bil: item.bil });
  }
}

report.summary = {
  validRecords: prepared.length,
  counters: Object.fromEntries([...new Set(prepared.map((item) => item.counter_no))].sort().map((counter) => [counter, prepared.filter((item) => item.counter_no === counter).length])),
  numericIcSourceRows: dataRows.filter((row) => typeof row[2] === 'number').length,
  textIcSourceRows: dataRows.filter((row) => typeof row[2] === 'string').length,
};

if (failIfInvalid(report)) process.exit();

if (shouldVerifyDatabase) {
  const secret = process.env.IC_HMAC_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    throw new Error('IC_HMAC_SECRET, NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY diperlukan untuk semakan pangkalan data.');
  }

  const expected = prepared.map(({ ic, ...participant }) => ({
    ...participant,
    ic_hmac: createHmac('sha256', secret).update(ic).digest('hex'),
    ic_last4: ic.slice(-4),
    is_active: true,
  }));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: databaseRows, error } = await supabase
    .from('participants')
    .select('bil, name, name_normalized, ic_hmac, ic_last4, organization, seat_no, counter_no, is_active')
    .order('bil');
  if (error) throw new Error('Tidak dapat membaca penerima daripada Supabase.');

  const expectedByBil = new Map(expected.map((participant) => [participant.bil, participant]));
  const databaseByBil = new Map(databaseRows.map((participant) => [participant.bil, participant]));
  const comparedFields = ['name', 'name_normalized', 'ic_hmac', 'ic_last4', 'organization', 'seat_no', 'counter_no', 'is_active'];
  const missingBils = expected.filter((participant) => !databaseByBil.has(participant.bil)).map((participant) => participant.bil);
  const unexpectedActiveBils = databaseRows.filter((participant) => participant.is_active && !expectedByBil.has(participant.bil)).map((participant) => participant.bil);
  const mismatches = expected.flatMap((participant) => {
    const databaseParticipant = databaseByBil.get(participant.bil);
    if (!databaseParticipant) return [];
    const fields = comparedFields.filter((field) => databaseParticipant[field] !== participant[field]);
    return fields.length ? [{ bil: participant.bil, fields }] : [];
  });

  report.databaseVerification = {
    databaseRecords: databaseRows.length,
    activeRecords: databaseRows.filter((participant) => participant.is_active).length,
    matchedRecords: expected.length - missingBils.length - mismatches.length,
    missingBils,
    unexpectedActiveBils,
    mismatches,
  };
  if (missingBils.length || unexpectedActiveBils.length || mismatches.length) {
    report.errors.push({
      code: 'DATABASE_MISMATCH',
      missing: missingBils.length,
      unexpectedActive: unexpectedActiveBils.length,
      mismatched: mismatches.length,
    });
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.errors.length) process.exitCode = 1;
} else if (!shouldApply) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const secret = process.env.IC_HMAC_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    throw new Error('IC_HMAC_SECRET, NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY diperlukan untuk import.');
  }

  const payload = prepared.map(({ ic, ...participant }) => ({
    ...participant,
    ic_hmac: createHmac('sha256', secret).update(ic).digest('hex'),
    ic_last4: ic.slice(-4),
    is_active: true,
  }));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: existing, error: existingError } = await supabase
    .from('participants')
    .select('id, bil, name, name_normalized, ic_hmac, ic_last4, organization, seat_no, counter_no, is_active');

  if (existingError) throw new Error('Tidak dapat membaca rekod sedia ada sebelum import.');

  const existingByBil = new Map(existing.map((participant) => [participant.bil, participant]));
  const incomingBils = new Set(payload.map((participant) => participant.bil));
  const added = payload.filter((participant) => !existingByBil.has(participant.bil));
  const changed = payload.filter((participant) => {
    const current = existingByBil.get(participant.bil);
    return current && ['name', 'name_normalized', 'ic_hmac', 'ic_last4', 'organization', 'seat_no', 'counter_no', 'is_active'].some((field) => current[field] !== participant[field]);
  });
  const deactivated = existing.filter((participant) => participant.is_active && !incomingBils.has(participant.bil));
  report.importPlan = {
    added: added.length,
    changed: changed.length,
    deactivated: deactivated.length,
  };

  const { data: batch, error: batchError } = await supabase
    .from('participant_import_batches')
    .insert({
      file_name: path.basename(inputFile),
      source_checksum: createHash('sha256').update(sourceBuffer).digest('hex'),
      validation_report: report,
      status: 'validated',
    })
    .select('id')
    .single();

  if (batchError || !batch) throw new Error('Tidak dapat mencipta rekod batch import.');

  try {
    const records = payload.map((participant) => ({ ...participant, source_batch_id: batch.id }));
    const { error: upsertError } = await supabase.from('participants').upsert(records, { onConflict: 'bil' });
    if (upsertError) throw new Error('Tidak dapat menyimpan rekod penerima.');

    if (deactivated.length > 0) {
      const { error: deactivateError } = await supabase.from('participants').update({ is_active: false }).in('id', deactivated.map((participant) => participant.id));
      if (deactivateError) throw new Error('Tidak dapat menyahaktifkan rekod yang tiada dalam fail baharu.');
    }

    const { error: batchUpdateError } = await supabase
      .from('participant_import_batches')
      .update({
        status: 'applied',
        added_count: added.length,
        changed_count: changed.length,
        deactivated_count: deactivated.length,
        validation_report: report,
        applied_at: new Date().toISOString(),
      })
      .eq('id', batch.id);
    if (batchUpdateError) throw new Error('Import selesai tetapi status batch tidak dapat dikemas kini.');

    const { error: auditError } = await supabase.from('audit_logs').insert({
      action: 'participants_imported',
      target_type: 'participant_import_batch',
      target_id: batch.id,
      metadata: { added: added.length, changed: changed.length, deactivated: deactivated.length, source_file: path.basename(inputFile) },
    });
    if (auditError) throw new Error('Import selesai tetapi Audit Log tidak dapat direkodkan.');

    report.applied = true;
    report.batchId = batch.id;
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    await supabase
      .from('participant_import_batches')
      .update({ status: 'failed', validation_report: { ...report, failure: error instanceof Error ? error.message : 'Unknown import error' } })
      .eq('id', batch.id);
    throw error;
  }
}
