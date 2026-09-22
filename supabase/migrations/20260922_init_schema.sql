-- ========================================================
-- SULFIDE SENTINELS - SUPABASE POSTGRESQL MIGRATION SCHEMA
-- ========================================================

-- Enable UUID extension if required
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean up existing tables if present to avoid schema conflict errors
DROP TABLE IF EXISTS public.scan_records CASCADE;
DROP TABLE IF EXISTS public.workers CASCADE;

-- --------------------------------------------------------
-- TABLE 1: workers
-- Stores worker identities to enforce worker isolation
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- TABLE 2: scan_records
-- Stores Pre-Shift Baseline and Post-Shift Exposure Scans
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  worker_code TEXT NOT NULL,
  shift TEXT NOT NULL,
  scan_stage TEXT NOT NULL CHECK (scan_stage IN ('PRE_SHIFT', 'POST_SHIFT')),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detector_hex TEXT,
  detector_percentage NUMERIC,
  detector_ppm NUMERIC,
  reference_match TEXT,
  reference_lower_hex TEXT,
  reference_lower_percentage NUMERIC,
  reference_upper_hex TEXT,
  reference_upper_percentage NUMERIC,
  expiry_hex TEXT,
  expiry_status TEXT,
  expiry_confidence NUMERIC,
  analysis_confidence NUMERIC,
  detection_confidence NUMERIC,
  bounding_box JSONB,
  region_rois JSONB,
  pre_shift_timestamp TIMESTAMPTZ,
  post_shift_timestamp TIMESTAMPTZ,
  exposure_duration_hours NUMERIC,
  net_ppm NUMERIC,
  dose_ppm_h NUMERIC,
  final_status TEXT,
  notes TEXT,
  image_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- INDEXES FOR HIGH-PERFORMANCE QUERYING
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workers_worker_code ON public.workers(worker_code);
CREATE INDEX IF NOT EXISTS idx_scan_records_worker_code ON public.scan_records(worker_code);
CREATE INDEX IF NOT EXISTS idx_scan_records_worker_id ON public.scan_records(worker_id);
CREATE INDEX IF NOT EXISTS idx_scan_records_scanned_at ON public.scan_records(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_records_scan_stage ON public.scan_records(scan_stage);

-- --------------------------------------------------------
-- TABLE GRANTS (PostgreSQL Table Level Permissions)
-- Grant required table privileges to anon and authenticated roles
-- --------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.workers TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.scan_records TO anon, authenticated;

-- --------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_records ENABLE ROW LEVEL SECURITY;

-- Development RLS Policies (Allow application operations for anon & authenticated roles)
DROP POLICY IF EXISTS "Allow public read workers" ON public.workers;
CREATE POLICY "Allow public read workers" ON public.workers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert workers" ON public.workers;
CREATE POLICY "Allow public insert workers" ON public.workers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update workers" ON public.workers;
CREATE POLICY "Allow public update workers" ON public.workers FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public read scan_records" ON public.scan_records;
CREATE POLICY "Allow public read scan_records" ON public.scan_records FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert scan_records" ON public.scan_records;
CREATE POLICY "Allow public insert scan_records" ON public.scan_records FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete scan_records" ON public.scan_records;
CREATE POLICY "Allow public delete scan_records" ON public.scan_records FOR DELETE TO anon, authenticated USING (true);

