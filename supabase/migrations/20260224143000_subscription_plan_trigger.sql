-- AUD-B fix: Atomic subscription state sync
--
-- Replaces dual-writes in the application layer (webhook) with a strict
-- database-level trigger. Guarantees that if a subscription is created or
-- updated, its parent workspace's plan_type perfectly reflects it, without
-- the risk of network interruption causing drift.

CREATE OR REPLACE FUNCTION sync_workspace_plan()
RETURNS TRIGGER AS $$
BEGIN
  -- We only push paid plans if the subscription is active or trialing
  IF NEW.status IN ('active', 'trialing') THEN
    UPDATE workspaces
      SET plan_type = NEW.plan
      WHERE id = NEW.workspace_id;
  ELSE
    -- If canceled, past_due, incomplete, etc., revert to free
    UPDATE workspaces
      SET plan_type = 'free'
      WHERE id = NEW.workspace_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_subscription_status_change ON subscriptions;

CREATE TRIGGER on_subscription_status_change
  AFTER INSERT OR UPDATE OF status, plan ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_workspace_plan();
