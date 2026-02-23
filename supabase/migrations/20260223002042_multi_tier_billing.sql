-- Up Migration for Multi-Tier Billing
-- 1. Alter workspaces table
ALTER TABLE workspaces
  ALTER COLUMN plan_type SET DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS uninstalled_at TIMESTAMP WITH TIME ZONE;

-- Normalize existing workspaces to 'free' if null
UPDATE workspaces SET plan_type = 'free' WHERE plan_type IS NULL;

-- 2. Alter subscriptions table
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMP WITH TIME ZONE;

-- 3. Create workspace_usage table
CREATE TABLE IF NOT EXISTS workspace_usage (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  scans_this_week INTEGER NOT NULL DEFAULT 0,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  alerts_sent INTEGER NOT NULL DEFAULT 0,
  audit_runtime_ms INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS setup for workspace_usage
ALTER TABLE workspace_usage ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role can manage workspace_usage"
  ON workspace_usage USING (true) WITH CHECK (true);

-- Create a trigger to automatically create a workspace_usage row when a workspace is created
CREATE OR REPLACE FUNCTION public.handle_new_workspace_usage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_usage (workspace_id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_workspace_created_usage
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace_usage();

-- Backfill workspace_usage for existing workspaces
INSERT INTO public.workspace_usage (workspace_id)
SELECT id FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;
