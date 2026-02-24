-- Automatic data retention purge
-- Matches the commitments in the Privacy Policy:
--   - guest_audits: 90 days
--   - audit_runs: 12 months
--   - stripe_events_history: 90 days
--   - events (workspace events log): 6 months

-- 1. Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the purge function
CREATE OR REPLACE FUNCTION purge_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Guest audit records older than 90 days
  DELETE FROM guest_audits
    WHERE created_at < NOW() - INTERVAL '90 days';

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

-- 3. Schedule the purge to run daily at 03:00 UTC (off-peak)
SELECT cron.schedule(
  'purge-old-data',
  '0 3 * * *',
  'SELECT purge_old_data()'
);
