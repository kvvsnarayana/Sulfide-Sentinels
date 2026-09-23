-- ========================================================
-- SULFIDE SENTINELS - NON-DESTRUCTIVE SECURITY HARDENING MIGRATION
-- ========================================================
-- Note: This migration contains NO DROP TABLE statements.
-- Existing production records are safely preserved.

-- 1. Ensure Table Grants for API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.workers TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.scan_records TO anon, authenticated;

-- 2. Ensure RLS is Enabled
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_records ENABLE ROW LEVEL SECURITY;

-- 3. Worker RLS Policies
DROP POLICY IF EXISTS "Allow public read workers" ON public.workers;
CREATE POLICY "Allow public read workers" ON public.workers
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert workers" ON public.workers;
CREATE POLICY "Allow public insert workers" ON public.workers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update workers" ON public.workers;
CREATE POLICY "Allow public update workers" ON public.workers
  FOR UPDATE TO anon, authenticated USING (true);

-- 4. Scan Records RLS Policies (Restrict DELETE to prevent cloud data deletion from UI)
DROP POLICY IF EXISTS "Allow public read scan_records" ON public.scan_records;
CREATE POLICY "Allow public read scan_records" ON public.scan_records
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert scan_records" ON public.scan_records;
CREATE POLICY "Allow public insert scan_records" ON public.scan_records
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete scan_records" ON public.scan_records;
-- Note: DELETE policy intentionally removed for anon/authenticated roles to protect cloud audit log integrity.
