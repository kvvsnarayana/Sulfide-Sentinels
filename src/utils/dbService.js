/**
 * Supabase Database Service Layer for SULFIDE SENTINELS
 * Source of Truth: Supabase PostgreSQL (workers & scan_records)
 */
import { supabase } from '../supabase';

const STORAGE_KEY = "sulfide_sentinels_audit_logs_v2";

/**
 * 1. WORKER MANAGEMENT
 */
export async function getWorkerByCode(workerCode) {
  if (!supabase || !workerCode) return null;
  const cleanCode = workerCode.trim().toUpperCase();

  try {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('worker_code', cleanCode)
      .maybeSingle();

    if (error) {
      console.warn('[SUPABASE] getWorkerByCode error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[SUPABASE] getWorkerByCode exception:', err);
    return null;
  }
}

export async function createWorker(workerCode) {
  if (!supabase || !workerCode) return null;
  const cleanCode = workerCode.trim().toUpperCase();

  try {
    const { data, error } = await supabase
      .from('workers')
      .insert([{ worker_code: cleanCode }])
      .select()
      .single();

    if (error) {
      console.warn('[SUPABASE] createWorker error:', error.message);
      return await getWorkerByCode(cleanCode);
    }
    return data;
  } catch (err) {
    console.error('[SUPABASE] createWorker exception:', err);
    return null;
  }
}

export async function getOrCreateWorker(workerCode) {
  if (!workerCode) return null;
  const existing = await getWorkerByCode(workerCode);
  if (existing) return existing;
  return await createWorker(workerCode);
}

/**
 * 2. IMAGE UPLOAD TO SUPABASE STORAGE (BUCKET: scan-images)
 */
export async function uploadScanImage(imageSrc, fileName) {
  if (!supabase || !imageSrc) return null;

  try {
    let blob = null;
    if (imageSrc.startsWith('data:image')) {
      const res = await fetch(imageSrc);
      blob = await res.blob();
    } else if (imageSrc.startsWith('blob:')) {
      const res = await fetch(imageSrc);
      blob = await res.blob();
    } else {
      return imageSrc; // Already a URL
    }

    const path = `scans/${fileName || 'scan_' + Date.now() + '.png'}`;
    const { data, error } = await supabase
      .storage
      .from('scan-images')
      .upload(path, blob, { contentType: 'image/png', upsert: true });

    if (error) {
      console.warn('[SUPABASE STORAGE] Bucket upload note (bucket may need creation):', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage.from('scan-images').getPublicUrl(path);
    return publicUrlData?.publicUrl || path;
  } catch (err) {
    console.warn('[SUPABASE STORAGE] Image upload skipped:', err);
    return null;
  }
}

/**
 * 3. SCAN RECORDS CRUD & PAIRING
 */
export async function saveScanRecordToDb(record) {
  const now = new Date();
  const workerCode = (record.workerId || 'UNKNOWN').trim().toUpperCase();

  // 1. Ensure worker exists in Supabase
  let worker = null;
  if (supabase) {
    worker = await getOrCreateWorker(workerCode);
  }

  // 2. Upload image if available
  let uploadedImagePath = record.imagePath || null;
  if (supabase && record.imageSrc && !uploadedImagePath) {
    uploadedImagePath = await uploadScanImage(record.imageSrc, `${workerCode}_${Date.now()}.png`);
  }

  const recordTimestamp = record.timestamp || now.toISOString();
  const dateFormatted = record.dateFormatted || now.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  const payload = {
    worker_id: worker?.id || null,
    worker_code: workerCode,
    shift: record.shift || 'General Shift',
    scan_stage: record.scanStage || 'PRE_SHIFT',
    scanned_at: recordTimestamp,
    detector_hex: record.detectorHex || '#000000',
    detector_percentage: record.detectorPercentage !== undefined ? record.detectorPercentage : 0.0,
    detector_ppm: record.detectorPpm !== undefined ? record.detectorPpm : 0.0,
    reference_match: record.referenceMatch || 'N/A',
    reference_lower_hex: record.referenceLowerHex || null,
    reference_lower_percentage: record.referenceLowerPercentage !== undefined ? record.referenceLowerPercentage : null,
    reference_upper_hex: record.referenceUpperHex || null,
    reference_upper_percentage: record.referenceUpperPercentage !== undefined ? record.referenceUpperPercentage : null,
    expiry_hex: record.expiryHex || '#000000',
    expiry_status: record.expiryStatus || 'VALID',
    expiry_confidence: record.expiryConfidence !== undefined ? record.expiryConfidence : 100,
    analysis_confidence: record.analysisConfidence !== undefined ? record.analysisConfidence : 90,
    detection_confidence: record.detectionConfidence !== undefined ? record.detectionConfidence : 90,
    bounding_box: record.boundingBox || null,
    region_rois: record.regionROIs || null,
    pre_shift_timestamp: record.preShiftTimestamp || null,
    post_shift_timestamp: record.scanStage === 'POST_SHIFT' ? recordTimestamp : null,
    exposure_duration_hours: record.exposureDurationHours !== undefined ? record.exposureDurationHours : null,
    net_ppm: record.netPpm !== undefined ? record.netPpm : null,
    dose_ppm_h: record.dosePpmH !== undefined ? record.dosePpmH : null,
    final_status: record.finalStatus || 'SAFE',
    notes: record.notes || '',
    image_path: uploadedImagePath
  };

  let insertedId = "scan_" + now.getTime();

  if (supabase) {
    const { data, error } = await supabase
      .from('scan_records')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[SUPABASE] Failed to save scan record to database:', error);
      throw new Error(`Database save error: ${error.message}`);
    }

    if (data?.id) insertedId = data.id;
  }

  // Also update local storage cache for offline responsiveness
  const formattedRecord = mapDbRecordToUiFormat({ id: insertedId, ...payload });
  const localHistory = getLocalLogs();
  const updated = [formattedRecord, ...localHistory.filter(r => r.id !== insertedId)];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}

  return formattedRecord;
}

export async function getScanRecordsFromDb() {
  if (!supabase) return getLocalLogs();

  try {
    const { data, error } = await supabase
      .from('scan_records')
      .select('*')
      .order('scanned_at', { ascending: false });

    if (error) {
      console.warn('[SUPABASE] getScanRecordsFromDb error, returning local cache:', error.message);
      return getLocalLogs();
    }

    const records = (data || []).map(mapDbRecordToUiFormat);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {}

    return records;
  } catch (err) {
    console.error('[SUPABASE] Exception loading records:', err);
    return getLocalLogs();
  }
}

export async function getLatestPreShiftRecord(workerCode, shift) {
  if (!workerCode) return null;
  const cleanCode = workerCode.trim().toUpperCase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('scan_records')
        .select('*')
        .eq('worker_code', cleanCode)
        .eq('shift', shift)
        .eq('scan_stage', 'PRE_SHIFT')
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return mapDbRecordToUiFormat(data);
      }
    } catch (err) {
      console.warn('[SUPABASE] getLatestPreShiftRecord query exception:', err);
    }
  }

  // Local fallback search
  const localLogs = getLocalLogs();
  return localLogs.find(l => l.workerId === cleanCode && l.shift === shift && l.scanStage === 'PRE_SHIFT') || null;
}

export async function clearScanRecordsFromDb() {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('scan_records')
        .delete()
        .neq('worker_code', '');

      if (error) console.warn('[SUPABASE] Clear DB error:', error.message);
    } catch (err) {
      console.error('[SUPABASE] Clear DB exception:', err);
    }
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}

  return [];
}

/**
 * 4. MIGRATION UTILITY FROM LOCALSTORAGE TO SUPABASE
 */
export async function migrateLocalLogsToSupabase() {
  if (!supabase) return;

  const localLogs = getLocalLogs();
  if (!localLogs || localLogs.length === 0) return;

  try {
    // Fetch existing records from Supabase to prevent duplicate inserts
    const existingDbRecords = await getScanRecordsFromDb();
    const existingTimestamps = new Set((existingDbRecords || []).map(r => r.timestamp));

    const recordsToMigrate = localLogs.filter(r => !existingTimestamps.has(r.timestamp));

    if (recordsToMigrate.length === 0) return;

    console.log(`[SUPABASE MIGRATION] Migrating ${recordsToMigrate.length} local records to Supabase...`);

    for (const record of recordsToMigrate) {
      try {
        await saveScanRecordToDb(record);
      } catch (err) {
        console.warn(`[SUPABASE MIGRATION] Could not migrate record ${record.id}:`, err);
      }
    }

    console.log('[SUPABASE MIGRATION] Migration complete.');
  } catch (err) {
    console.error('[SUPABASE MIGRATION] Migration failed:', err);
  }
}

/**
 * Helper to map snake_case DB columns to UI camelCase
 */
function mapDbRecordToUiFormat(row) {
  if (!row) return null;

  const scannedDate = row.scanned_at ? new Date(row.scanned_at) : new Date();
  const formattedTime = scannedDate.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  return {
    id: row.id,
    timestamp: row.scanned_at || row.timestamp,
    dateFormatted: row.date_formatted || formattedTime,
    workerId: row.worker_code || row.workerId || 'UNKNOWN',
    shift: row.shift || 'General Shift',
    scanStage: row.scan_stage || row.scanStage || 'PRE_SHIFT',
    detectorHex: row.detector_hex || row.detectorHex || '#000000',
    detectorPercentage: row.detector_percentage !== null && row.detector_percentage !== undefined ? Number(row.detector_percentage) : (row.detectorPercentage || 0),
    detectorPpm: row.detector_ppm !== null && row.detector_ppm !== undefined ? Number(row.detector_ppm) : (row.detectorPpm || 0),
    referenceMatch: row.reference_match || row.referenceMatch || 'N/A',
    referenceLowerHex: row.reference_lower_hex || row.referenceLowerHex || null,
    referenceLowerPercentage: row.reference_lower_percentage !== null && row.reference_lower_percentage !== undefined ? Number(row.reference_lower_percentage) : (row.referenceLowerPercentage || null),
    referenceUpperHex: row.reference_upper_hex || row.referenceUpperHex || null,
    referenceUpperPercentage: row.reference_upper_percentage !== null && row.reference_upper_percentage !== undefined ? Number(row.reference_upper_percentage) : (row.referenceUpperPercentage || null),
    expiryHex: row.expiry_hex || row.expiryHex || '#000000',
    expiryStatus: row.expiry_status || row.expiryStatus || 'VALID',
    expiryConfidence: row.expiry_confidence !== null && row.expiry_confidence !== undefined ? Number(row.expiry_confidence) : (row.expiryConfidence || 100),
    analysisConfidence: row.analysis_confidence !== null && row.analysis_confidence !== undefined ? Number(row.analysis_confidence) : (row.analysisConfidence || 90),
    detectionConfidence: row.detection_confidence !== null && row.detection_confidence !== undefined ? Number(row.detection_confidence) : (row.detectionConfidence || 90),
    boundingBox: row.bounding_box || row.boundingBox || null,
    regionROIs: row.region_rois || row.regionROIs || null,
    preShiftTimestamp: row.pre_shift_timestamp || row.preShiftTimestamp || null,
    exposureDurationHours: row.exposure_duration_hours !== null && row.exposure_duration_hours !== undefined ? Number(row.exposure_duration_hours) : (row.exposureDurationHours || null),
    netPpm: row.net_ppm !== null && row.net_ppm !== undefined ? Number(row.net_ppm) : (row.netPpm || null),
    dosePpmH: row.dose_ppm_h !== null && row.dose_ppm_h !== undefined ? Number(row.dose_ppm_h) : (row.dosePpmH || null),
    finalStatus: row.final_status || row.finalStatus || 'SAFE',
    notes: row.notes || '',
    imagePath: row.image_path || row.imagePath || null
  };
}

function getLocalLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}
