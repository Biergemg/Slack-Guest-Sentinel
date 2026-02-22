/**
 * API request and response types.
 *
 * Defines the contracts for all route handlers — what they accept and what
 * they return. Import these in both the route handler and any client code
 * that consumes the endpoint to keep them in sync.
 */

// ---------------------------------------------------------------------------
// Generic API response envelope
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  /** Machine-readable error code for client handling */
  code?: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

// ---------------------------------------------------------------------------
// /api/slack/onboarding-scan
// ---------------------------------------------------------------------------

export interface OnboardingScanResult {
  totalGuests: number;
  inactiveGuests: number;
  /** Estimated monthly cost of inactive guests in USD */
  monthlyWaste: number;
}

// ---------------------------------------------------------------------------
// /api/internal/audit
// ---------------------------------------------------------------------------

export interface AuditRunResult {
  /** Number of workspaces that were audited */
  audited: number;
  /** Total inactive guests flagged across all workspaces */
  flagged: number;
}

// ---------------------------------------------------------------------------
// /api/stripe/webhook
// ---------------------------------------------------------------------------

export interface WebhookAcknowledgement {
  received: boolean;
}

// ---------------------------------------------------------------------------
// /api/stripe/checkout
// Responds with a redirect — no JSON body
// ---------------------------------------------------------------------------

// No response type needed; handler always redirects.

// ---------------------------------------------------------------------------
// Dashboard page data
// ---------------------------------------------------------------------------

export interface DashboardData {
  workspaceId: string;
  teamName: string;
  latestRun: {
    totalGuests: number;
    inactiveGuests: number;
    estimatedMonthlyWaste: number;
    runAt: string;
  } | null;
  flaggedGuests: Array<{
    slackUserId: string;
    estimatedCostMonthly: number;
    actionTaken: string | null;
    flaggedAt: string;
  }>;
}
