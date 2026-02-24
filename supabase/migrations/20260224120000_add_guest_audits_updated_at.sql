-- BUG-03 fix: add updated_at to guest_audits so the retention purge
-- uses the last-modified timestamp instead of the insertion date.
--
-- Without this, a guest flagged >90 days ago and re-audited daily
-- would have created_at from the first flag and get purged even though
-- it is actively maintained. This fixes the data-loss bug.

-- 1. Add column (safe — non-destructive, default fills existing rows)
ALTER TABLE guest_audits
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Backfill existing rows with their created_at (best available approximation)
UPDATE guest_audits
  SET updated_at = created_at
  WHERE updated_at IS NULL;

-- 3. Lock column to NOT NULL now that all rows have a value
ALTER TABLE guest_audits
  ALTER COLUMN updated_at SET NOT NULL;

-- 4. Trigger: auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION public.handle_guest_audits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guest_audits_updated_at ON public.guest_audits;
CREATE TRIGGER guest_audits_updated_at
  BEFORE UPDATE ON public.guest_audits
  FOR EACH ROW EXECUTE FUNCTION public.handle_guest_audits_updated_at();

-- 5. Index for fast purge queries
CREATE INDEX IF NOT EXISTS idx_guest_audits_updated_at
  ON guest_audits (updated_at);

-- 6. Redefine purge_old_data() to use updated_at for guest_audits
--    (all other tables remain unchanged)
CREATE OR REPLACE FUNCTION purge_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Guest audit records not updated in 90 days
  -- (uses updated_at, not created_at, so active records are preserved)
  DELETE FROM guest_audits
    WHERE updated_at < NOW() - INTERVAL '90 days';

  -- Audit run snapshots older than 12 months
  DELETE FROM audit_runs
    WHERE created_at < NOW() - INTERVAL '12 months';

  -- Stripe webhook event history older than 90 days
  DELETE FROM stripe_events_history
    WHERE processed_at < NOW() - INTERVAL '90 days'
       OR (processed_at IS NULL AND updated_at < NOW() - INTERVAL '90 days');

  -- Workspace events log older than 6 months
  DELETE FROM events
    WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$;
