/**
 * Storage Helper - Bridges Supabase Database Service & LocalStorage Cache
 * Source of Truth: Supabase PostgreSQL (workers & scan_records)
 */
import {
  getScanRecordsFromDb,
  saveScanRecordToDb,
  clearScanRecordsFromDb,
  getLatestPreShiftRecord,
  getOrCreateWorker,
  migrateLocalLogsToSupabase
} from './dbService';

export async function getScanHistory() {
  return await getScanRecordsFromDb();
}

export async function saveScanRecord(record) {
  return await saveScanRecordToDb(record);
}

export async function clearScanHistory() {
  return await clearScanRecordsFromDb();
}

export {
  getLatestPreShiftRecord,
  getOrCreateWorker,
  migrateLocalLogsToSupabase
};