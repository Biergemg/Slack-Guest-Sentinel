/**
 * Slack API client.
 *
 * Provides:
 *   - slackApiCall(): typed HTTP wrapper with retry and rate-limit handling
 *   - verifySlackSignature(): HMAC-SHA256 request authentication
 *   - getGuests(): paginated guest list (no 1000-user hard cap)
 *   - getUserPresence(): presence check with safe fallback
 *   - sendDirectMessage(): open IM channel and post Block Kit messages
 *   - buildInactiveGuestBlocks(): canonical DM alert block builder
 */

import crypto from 'crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { SLACK_API, AUDIT, SLACK_ACTION_ID } from '@/config/constants';
import type {
  SlackUser,
  SlackBlock,
  SlackChannel,
  UsersListResponse,
  UserPresenceResponse,
  UserConversationsResponse,
  ConversationsHistoryResponse,
  ConversationsOpenResponse,
  ChatPostMessageResponse,
  SlackBaseResponse,
} from '@/types/slack.types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Core API caller
// ---------------------------------------------------------------------------

interface SlackApiCallOptions {
  endpoint: string;
  token: string;
  body?: Record<string, unknown>;
  retries?: number;
}

async function slackApiCall<T extends SlackBaseResponse>(
  options: SlackApiCallOptions
): Promise<T> {
  const { endpoint, token, body, retries = SLACK_API.MAX_RETRIES } = options;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${SLACK_API.BASE_URL}/${endpoint}`;

  const fetchOptions: RequestInit = {
    method: body !== undefined ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };

  try {
    const res = await fetch(url, fetchOptions);

    if (res.status === 429 && retries > 0) {
      const retryAfter = res.headers.get('Retry-After');
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : SLACK_API.RATE_LIMIT_DEFAULT_WAIT_MS;

      logger.warn('Slack rate limit hit', { endpoint, waitMs, retriesLeft: retries });
      await delay(waitMs);
      return slackApiCall<T>({ ...options, retries: retries - 1 });
    }

    const data = (await res.json()) as T;
    return data;
  } catch (err) {
    if (retries > 0) {
      logger.warn('Slack API network error, retrying', { endpoint, retriesLeft: retries }, err);
      await delay(SLACK_API.RETRY_DELAY_MS);
      return slackApiCall<T>({ ...options, retries: retries - 1 });
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Slack request signature verification (HMAC-SHA256)
// ---------------------------------------------------------------------------

export interface SignatureVerificationResult {
  valid: boolean;
  /** Raw request body needed to parse the payload after verification */
  body: string;
  error?: string;
}

/**
 * Verifies the authenticity of an incoming Slack request.
 *
 * Slack signs every request with HMAC-SHA256. Verifying this signature
 * prevents forged events and replay attacks. Call this BEFORE processing
 * any data from /api/slack/events or /api/slack/action.
 *
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export async function verifySlackSignature(
  request: Request
): Promise<SignatureVerificationResult> {
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  if (!timestamp || !signature) {
    return { valid: false, body: '', error: 'Missing Slack signature headers' };
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (ageSeconds > SLACK_API.SIGNATURE_MAX_AGE_SECONDS) {
    return { valid: false, body: '', error: `Request timestamp too old (${ageSeconds}s)` };
  }

  const body = await request.text();
  const sigBase = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', env.SLACK_SIGNING_SECRET);
  const expected = `v0=${hmac.update(sigBase).digest('hex')}`;

  // Constant-time comparison prevents timing attacks
  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(signature, 'utf8');

  if (expectedBuf.length !== receivedBuf.length) {
    return { valid: false, body, error: 'Signature length mismatch' };
  }

  const isValid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
  return {
    valid: isValid,
    body,
    error: isValid ? undefined : 'Signature mismatch',
  };
}

// ---------------------------------------------------------------------------
// Guest list with full pagination
// ---------------------------------------------------------------------------

/**
 * Returns all guest users in the workspace.
 * Handles pagination automatically — no hard cap on workspace size.
 */
export async function getGuests(token: string): Promise<SlackUser[]> {
  const guests: SlackUser[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      limit: String(AUDIT.GUEST_LIST_PAGE_SIZE),
    });
    if (cursor) {
      params.set('cursor', cursor);
    }

    const data = await slackApiCall<UsersListResponse>({
      endpoint: `users.list?${params.toString()}`,
      token,
    });

    if (!data.ok) {
      throw new Error(`Slack users.list failed: ${data.error ?? 'unknown error'}`);
    }

    const pageGuests = (data.members ?? []).filter(
      m => !m.deleted && (m.is_restricted || m.is_ultra_restricted) && !m.is_bot
    );
    guests.push(...pageGuests);

    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return guests;
}

// ---------------------------------------------------------------------------
// User presence
// ---------------------------------------------------------------------------

/**
 * Returns the current presence of a Slack user.
 * Returns 'away' on API failure — presence is best-effort, not critical.
 */
export async function getUserPresence(
  token: string,
  userId: string
): Promise<'active' | 'away'> {
  const params = new URLSearchParams({ user: userId });
  const data = await slackApiCall<UserPresenceResponse>({
    endpoint: `users.getPresence?${params.toString()}`,
    token,
  });

  if (!data.ok) {
    logger.warn('users.getPresence failed, defaulting to away', { userId, error: data.error });
    return 'away';
  }

  return data.presence;
}

// ---------------------------------------------------------------------------
// Last message timestamp (last resort — requires channels:read + channels:history)
// ---------------------------------------------------------------------------

/**
 * Returns the Unix timestamp (seconds) of the guest's most recent message
 * within the activity window, or null if none found.
 *
 * Call this ONLY after profile and presence checks have failed to classify
 * the guest — it issues multiple API calls and can trigger rate limiting.
 *
 * Requires OAuth scopes: channels:read, channels:history
 */
export async function getLastMessageTs(
  token: string,
  userId: string
): Promise<number | null> {
  const cutoff = Math.floor(Date.now() / 1000) - AUDIT.ACTIVITY_WINDOW_SECONDS;

  // Step 1: Get the public channels this guest is in
  const params = new URLSearchParams({
    user: userId,
    types: 'public_channel',
    exclude_archived: 'true',
    limit: String(AUDIT.HISTORY_CHANNELS_TO_CHECK),
  });

  const channelsData = await slackApiCall<UserConversationsResponse>({
    endpoint: `users.conversations?${params.toString()}`,
    token,
  });

  if (!channelsData.ok || !channelsData.channels?.length) {
    logger.warn('users.conversations returned no channels', { userId, error: channelsData.error });
    return null;
  }

  // Step 2: Scan history in each channel for a recent message from this user.
  // Stop as soon as we find one — no need to exhaust all channels.
  for (const channel of channelsData.channels as SlackChannel[]) {
    const histParams = new URLSearchParams({
      channel: channel.id,
      oldest: String(cutoff),
      limit: String(AUDIT.HISTORY_MESSAGES_LIMIT),
    });

    const histData = await slackApiCall<ConversationsHistoryResponse>({
      endpoint: `conversations.history?${histParams.toString()}`,
      token,
    });

    if (!histData.ok || !histData.messages?.length) continue;

    const userMsg = histData.messages.find(m => m.user === userId && m.ts);
    if (userMsg?.ts) {
      return parseFloat(userMsg.ts); // Found — stop searching
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Direct messages
// ---------------------------------------------------------------------------

/**
 * Opens a DM channel with a user and posts a Block Kit message.
 * Throws if the IM channel cannot be opened.
 */
export async function sendDirectMessage(
  token: string,
  userId: string,
  blocks: SlackBlock[],
  fallbackText = 'Alert'
): Promise<ChatPostMessageResponse> {
  const imData = await slackApiCall<ConversationsOpenResponse>({
    endpoint: 'conversations.open',
    token,
    body: { users: userId },
  });

  if (!imData.ok) {
    throw new Error(`conversations.open failed for user ${userId}: ${imData.error}`);
  }

  const channelId = imData.channel.id;

  return slackApiCall<ChatPostMessageResponse>({
    endpoint: 'chat.postMessage',
    token,
    body: { channel: channelId, blocks, text: fallbackText },
  });
}

// ---------------------------------------------------------------------------
// Block builders (single source of truth for message shapes)
// ---------------------------------------------------------------------------

/**
 * Builds the Block Kit message for an inactive guest alert DM.
 *
 * The action_id values here MUST match SLACK_ACTION_ID constants —
 * the same constants used by the action route to identify button clicks.
 */
export function buildInactiveGuestBlocks(
  guestId: string,
  costPerSeatMonthly: number
): SlackBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*Inactive Guest Alert*\n` +
          `Guest <@${guestId}> appears to be completely inactive.\n` +
          `Estimated cost: *$${costPerSeatMonthly}/month* ($${costPerSeatMonthly * 12}/year).`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Log Deactivation Intent' },
          style: 'danger',
          value: `deactivate_${guestId}`,
          action_id: SLACK_ACTION_ID.DEACTIVATE_GUEST,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Ignore' },
          value: `ignore_${guestId}`,
          action_id: SLACK_ACTION_ID.IGNORE_GUEST,
        },
      ],
    },
  ];
}
