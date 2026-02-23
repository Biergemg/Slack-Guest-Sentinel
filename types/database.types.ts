/**
 * TypeScript types that mirror the Supabase database schema exactly.
 *
 * These are derived from supabase/migrations/20260222000000_initial_schema.sql.
 * When the schema changes, update these types to match.
 *
 * Convention:
 *   - Row types: exact shape returned by SELECT *
 *   - Insert types: fields required/optional for INSERT
 *   - Update types: all fields optional for UPDATE
 */

// ---------------------------------------------------------------------------
// Enum types (mirror CHECK constraints / domain types in the DB)
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'past_due'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export type SubscriptionPlan = 'free' | 'starter' | 'growth' | 'scale';

export type GuestActionTaken =
  | 'flagged'
  | 'suggested_deactivation_accepted'
  | 'ignored_by_admin';

export type WorkspacePlanType = 'free' | 'starter' | 'growth' | 'scale';

// ---------------------------------------------------------------------------
// workspaces
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  slack_workspace_id: string;
  team_name: string;
  enterprise_id: string | null;
  enterprise_name: string | null;
  /** AES-256-GCM encrypted Slack access token */
  access_token: string;
  /** AES-256-GCM encrypted Slack refresh token, if present */
  refresh_token: string | null;
  token_expires_at: string | null;
  /** Slack user ID of the person who installed the app */
  installed_by: string;
  plan_type: WorkspacePlanType;
  supports_user_deactivation: boolean;
  estimated_seat_cost: number;
  is_active: boolean;
  uninstalled_at: string | null;
  created_at: string;
}

export interface WorkspaceInsert {
  slack_workspace_id: string;
  team_name: string;
  enterprise_id?: string | null;
  enterprise_name?: string | null;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  installed_by: string;
  plan_type?: WorkspacePlanType;
  supports_user_deactivation: boolean;
  estimated_seat_cost?: number;
  is_active?: boolean;
  uninstalled_at?: string | null;
}

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------

export interface Subscription {
  id: string;
  workspace_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billing_cycle_anchor: string | null;
  created_at: string;
}

export interface SubscriptionUpsert {
  workspace_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billing_cycle_anchor?: string | null;
}

// ---------------------------------------------------------------------------
// guest_audits
// ---------------------------------------------------------------------------

export interface GuestAudit {
  id: string;
  workspace_id: string;
  slack_user_id: string;
  last_seen_at: string | null;
  last_seen_source: string | null;
  estimated_cost_monthly: number;
  estimated_cost_yearly: number;
  is_flagged: boolean;
  action_taken: GuestActionTaken | null;
  created_at: string;
}

export interface GuestAuditUpsert {
  workspace_id: string;
  slack_user_id: string;
  last_seen_at?: string | null;
  last_seen_source?: string | null;
  estimated_cost_monthly: number;
  estimated_cost_yearly: number;
  is_flagged: boolean;
  action_taken?: GuestActionTaken | null;
}

// ---------------------------------------------------------------------------
// guest_sponsors
// ---------------------------------------------------------------------------

export interface GuestSponsor {
  workspace_id: string;
  guest_user_id: string;
  sponsor_user_id: string;
  captured_from_event: string | null;
  created_at: string;
}

export interface GuestSponsorUpsert {
  workspace_id: string;
  guest_user_id: string;
  sponsor_user_id: string;
  captured_from_event?: string | null;
}

// ---------------------------------------------------------------------------
// audit_runs
// ---------------------------------------------------------------------------

export interface AuditRun {
  id: string;
  workspace_id: string;
  workspace_guest_count: number;
  workspace_inactive_count: number;
  workspace_estimated_waste: number;
  created_at: string;
}

export interface AuditRunInsert {
  workspace_id: string;
  workspace_guest_count: number;
  workspace_inactive_count: number;
  workspace_estimated_waste: number;
}

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------

export interface WorkspaceEvent {
  id: string;
  workspace_id: string;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface WorkspaceEventInsert {
  workspace_id: string;
  type: string;
  payload?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// stripe_events_history
// ---------------------------------------------------------------------------

export interface StripeEventHistory {
  stripe_event_id: string;
  processed_at: string;
}

// ---------------------------------------------------------------------------
// workspace_usage
// ---------------------------------------------------------------------------

export interface WorkspaceUsage {
  workspace_id: string;
  scans_this_week: number;
  last_scan_at: string | null;
  alerts_sent: number;
  audit_runtime_ms: number;
  updated_at: string;
}

export interface WorkspaceUsageUpsert {
  workspace_id: string;
  scans_this_week?: number;
  last_scan_at?: string | null;
  alerts_sent?: number;
  audit_runtime_ms?: number;
}
