-- Hardening migration for billing reliability and security.
-- Adds required unique indexes for upserts, strengthens Stripe webhook idempotency state,
-- and closes an overly permissive RLS policy.

-- ---------------------------------------------------------------------------
-- 1) Ensure subscriptions upsert key is truly unique (workspace_id)
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM subscriptions
  WHERE workspace_id IS NOT NULL
)
DELETE FROM subscriptions s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_workspace_id_unique
  ON subscriptions (workspace_id)
  WHERE workspace_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Ensure guest_audits upsert key is truly unique (workspace_id, slack_user_id)
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, slack_user_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM guest_audits
)
DELETE FROM guest_audits g
USING ranked r
WHERE g.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_audits_workspace_user_unique
  ON guest_audits (workspace_id, slack_user_id);

-- ---------------------------------------------------------------------------
-- 3) Stripe event history: add explicit processing state for safe retries
-- ---------------------------------------------------------------------------
ALTER TABLE stripe_events_history
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

UPDATE stripe_events_history
SET
  status = COALESCE(status, 'processed'),
  attempts = COALESCE(attempts, 1),
  updated_at = COALESCE(updated_at, processed_at, NOW())
WHERE status IS NULL
   OR attempts IS NULL
   OR updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stripe_events_history_status_check'
  ) THEN
    ALTER TABLE stripe_events_history
      ADD CONSTRAINT stripe_events_history_status_check
      CHECK (status IN ('processing', 'processed', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stripe_events_history_status
  ON stripe_events_history (status);

-- ---------------------------------------------------------------------------
-- 4) Close permissive workspace_usage RLS policy
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'workspace_usage'
  ) THEN
    EXECUTE 'ALTER TABLE workspace_usage ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Service role can manage workspace_usage" ON workspace_usage';
    EXECUTE 'DROP POLICY IF EXISTS "Deny all to anon on workspace_usage" ON workspace_usage';
    EXECUTE 'CREATE POLICY "Deny all to anon on workspace_usage" ON workspace_usage FOR ALL USING (false) WITH CHECK (false)';
  END IF;
END $$;
