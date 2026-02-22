-- Supabase Migration: Initial Schema for Slack Guest Sentinel MVP

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Table: workspaces
-- ==========================================
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slack_workspace_id TEXT UNIQUE NOT NULL,
    team_name TEXT NOT NULL,
    enterprise_id TEXT,
    enterprise_name TEXT,
    access_token TEXT NOT NULL, -- encrypted
    refresh_token TEXT, -- encrypted
    token_expires_at TIMESTAMP WITH TIME ZONE,
    installed_by TEXT NOT NULL, -- slack user id of the installer
    plan_type TEXT NOT NULL, -- e.g., 'free', 'pro', 'enterprise'
    supports_user_deactivation BOOLEAN DEFAULT FALSE,
    estimated_seat_cost NUMERIC DEFAULT 15.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. Table: subscriptions
-- ==========================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan TEXT NOT NULL, -- 'free', 'trial', 'pro'
    status TEXT NOT NULL, -- 'active', 'canceled', 'past_due'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. Table: guest_audits
-- ==========================================
CREATE TABLE guest_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    slack_user_id TEXT NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    last_seen_source TEXT, -- 'presence', 'history', 'profile'
    estimated_cost_monthly NUMERIC DEFAULT 0.00,
    estimated_cost_yearly NUMERIC DEFAULT 0.00,
    is_flagged BOOLEAN DEFAULT FALSE, -- flagged as inactive
    action_taken TEXT, -- e.g., 'notified_admin', 'ignored', 'deactivated'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for fast analytics and deletion
CREATE INDEX idx_guest_audits_workspace_id ON guest_audits(workspace_id);
CREATE INDEX idx_guest_audits_slack_user_id ON guest_audits(slack_user_id);
CREATE INDEX idx_guest_audits_created_at ON guest_audits(created_at);

-- ==========================================
-- 4. Table: guest_sponsors
-- ==========================================
CREATE TABLE guest_sponsors (
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    guest_user_id TEXT NOT NULL,
    sponsor_user_id TEXT NOT NULL,
    captured_from_event TEXT, -- e.g., 'invite_requested'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (workspace_id, guest_user_id)
);

-- ==========================================
-- 5. Table: audit_runs (Snapshots Históricos)
-- ==========================================
CREATE TABLE audit_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    workspace_guest_count INTEGER DEFAULT 0,
    workspace_inactive_count INTEGER DEFAULT 0,
    workspace_estimated_waste NUMERIC DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_audit_runs_workspace_id ON audit_runs(workspace_id);

-- ==========================================
-- 6. Table: events (Logging)
-- ==========================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'audit_started', 'dm_sent'
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_events_workspace_id ON events(workspace_id);

-- ==========================================
-- 7. Table: stripe_events_history (Idempotencia)
-- ==========================================
CREATE TABLE stripe_events_history (
    stripe_event_id TEXT PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- Row Level Security (RLS) Configuration
-- ==========================================
-- Secure the schema, applications will use the Service Role key for all backend cron logic,
-- but if using the client components, anon key restrictions apply.

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events_history ENABLE ROW LEVEL SECURITY;

-- Deny all access to anon by default (everything is highly sensitive internal data handled by the backend)
CREATE POLICY "Deny all to anon" ON workspaces FOR ALL USING (false);
CREATE POLICY "Deny all to anon" ON subscriptions FOR ALL USING (false);
CREATE POLICY "Deny all to anon" ON guest_audits FOR ALL USING (false);
CREATE POLICY "Deny all to anon" ON guest_sponsors FOR ALL USING (false);
CREATE POLICY "Deny all to anon" ON audit_runs FOR ALL USING (false);
CREATE POLICY "Deny all to anon" ON events FOR ALL USING (false);
CREATE POLICY "Deny all to anon" ON stripe_events_history FOR ALL USING (false);
