/**
 * Application-wide constants.
 *
 * All magic numbers and string literals live here.
 * Never hardcode these values elsewhere — import from this file instead.
 *
 * Usage: import { BILLING, AUDIT, SLACK_ACTION_ID } from '@/config/constants';
 */

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
export const BILLING = {
  /** Default monthly cost per Slack guest seat in USD */
  DEFAULT_SEAT_COST_USD: 15,
  /** Free trial period in days for new pro subscriptions */
  TRIAL_PERIOD_DAYS: 7,
} as const;

// ---------------------------------------------------------------------------
// Audit / Inactivity Detection
// ---------------------------------------------------------------------------
export const AUDIT = {
  /** Number of days in the activity lookback window */
  ACTIVITY_WINDOW_DAYS: 30,
  /** Same window expressed in seconds (for Slack's Unix timestamp comparisons) */
  ACTIVITY_WINDOW_SECONDS: 30 * 24 * 60 * 60,
  /** Slack API users.list page size */
  GUEST_LIST_PAGE_SIZE: 200,
  /** Points added when user presence is 'active' */
  PRESENCE_ACTIVITY_SCORE: 2,
  /** Points added when profile was updated within the activity window */
  PROFILE_ACTIVITY_SCORE: 1,
  /** Score at or below which a guest is considered inactive */
  INACTIVE_SCORE_THRESHOLD: 0,
  /** Max workspaces to audit in parallel (avoids DB connection exhaustion) */
  WORKSPACE_BATCH_SIZE: 5,
} as const;

// ---------------------------------------------------------------------------
// Database Enum Values
// Keeps DB magic strings in sync across services — TypeScript enforces correctness
// ---------------------------------------------------------------------------
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  PAUSED: 'paused',
} as const;

export const SUBSCRIPTION_PLAN = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export const GUEST_ACTION = {
  FLAGGED: 'flagged',
  DEACTIVATION_ACCEPTED: 'suggested_deactivation_accepted',
  IGNORED_BY_ADMIN: 'ignored_by_admin',
} as const;

export const WORKSPACE_PLAN = {
  STANDARD: 'standard',
  ENTERPRISE: 'enterprise',
} as const;

export const WORKSPACE_EVENT_TYPE = {
  DM_ALERT_SENT: 'dm_alert_sent',
  DEACTIVATE_BUTTON_CLICKED: 'deactivate_button_clicked',
  IGNORE_BUTTON_CLICKED: 'ignore_button_clicked',
  AUDIT_STARTED: 'audit_started',
  AUDIT_COMPLETED: 'audit_completed',
} as const;

// ---------------------------------------------------------------------------
// Slack Block Kit Action IDs
// Must match the action_id values sent in DM blocks by audit.service.ts
// ---------------------------------------------------------------------------
export const SLACK_ACTION_ID = {
  DEACTIVATE_GUEST: 'deactivate_guest_action',
  IGNORE_GUEST: 'ignore_guest_action',
} as const;

// ---------------------------------------------------------------------------
// Slack API Configuration
// ---------------------------------------------------------------------------
export const SLACK_API = {
  BASE_URL: 'https://slack.com/api',
  /** Default wait time when Slack returns 429 with no Retry-After header */
  RATE_LIMIT_DEFAULT_WAIT_MS: 10_000,
  /** Wait before retrying on network errors */
  RETRY_DELAY_MS: 2_000,
  /** Maximum number of retries for Slack API calls */
  MAX_RETRIES: 3,
  /** Slack OAuth required user scopes */
  REQUIRED_USER_SCOPES: ['users:read', 'chat:write', 'im:write'],
  /** Maximum age (seconds) for Slack request signatures (prevents replay attacks) */
  SIGNATURE_MAX_AGE_SECONDS: 300,
} as const;

// ---------------------------------------------------------------------------
// CSRF / OAuth State
// ---------------------------------------------------------------------------
export const CSRF = {
  /** Cookie name that stores the OAuth state parameter */
  STATE_COOKIE_NAME: 'slack_oauth_state',
  /** Cookie max age in seconds — 10 minutes is enough to complete OAuth */
  STATE_COOKIE_MAX_AGE_SECONDS: 10 * 60,
} as const;

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
export const SESSION = {
  /** Cookie name set after successful workspace installation */
  COOKIE_NAME: 'workspace_session',
  /** Session cookie max age in seconds — 30 days */
  MAX_AGE_SECONDS: 30 * 24 * 60 * 60,
} as const;
