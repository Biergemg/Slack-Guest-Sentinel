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
  /** Inactivity lookback window */
  ACTIVITY_WINDOW_DAYS: 30,
  /** Same window in seconds — used for Unix timestamp comparisons */
  ACTIVITY_WINDOW_SECONDS: 30 * 24 * 60 * 60,
  /** Slack API page size for users.list */
  GUEST_LIST_PAGE_SIZE: 200,

  /**
   * Scoring weights (higher = stronger signal of activity).
   *
   * message  > profile > presence in reliability:
   *   - presence can be Slack keepalive, mobile background, or bot activity
   *   - profile update requires deliberate user action
   *   - a real message is the strongest proof of engagement
   */
  SCORE_LAST_MESSAGE: 3,      // Sent a message within the window — definitive
  SCORE_PROFILE_UPDATED: 1,   // Profile updated within the window — intentional action
  SCORE_PRESENCE_ACTIVE: 0.5, // Currently presence-active — weak (keepalive/mobile)

  /**
   * Classification threshold.
   * score >= MIN_ACTIVE_SCORE → active (cleared from audit)
   * score <  MIN_ACTIVE_SCORE → inactive (flagged for review)
   *
   * At 1.0: presence alone (0.5) does NOT save a guest — they need either a
   * real message or a profile update to avoid being flagged.
   */
  MIN_ACTIVE_SCORE: 1,

  /** Max channels to check per guest when fetching conversation history */
  HISTORY_CHANNELS_TO_CHECK: 3,
  /** Messages to fetch per channel (oldest-first via `oldest` param limits scope) */
  HISTORY_MESSAGES_LIMIT: 50,

  /** Max guests to score concurrently — prevents simultaneous API call explosion */
  GUEST_SCORING_CONCURRENCY: 10,
  /** Max workspaces to audit in parallel — avoids DB connection exhaustion */
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
  STARTER: 'starter',
  GROWTH: 'growth',
  SCALE: 'scale',
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
  REQUIRED_USER_SCOPES: ['users:read', 'chat:write', 'im:write', 'channels:read', 'channels:history'],
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
