/**
 * TypeScript types for the Slack API.
 *
 * This is a typed subset of the Slack Web API — only the shapes used
 * by this application. Not every Slack API field is represented here;
 * only those we actually read or write.
 *
 * Reference: https://api.slack.com/methods
 */

// ---------------------------------------------------------------------------
// Slack User (from users.list / users.info)
// ---------------------------------------------------------------------------

export interface SlackUserProfile {
  display_name: string;
  real_name: string;
  email?: string;
  image_72?: string;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  deleted: boolean;
  is_bot: boolean;
  /** Multi-channel guest */
  is_restricted: boolean;
  /** Single-channel guest */
  is_ultra_restricted: boolean;
  /** Unix timestamp of last profile update */
  updated: number;
  profile: SlackUserProfile;
}

// ---------------------------------------------------------------------------
// Slack API base response
// ---------------------------------------------------------------------------

export interface SlackBaseResponse {
  ok: boolean;
  error?: string;
  needed?: string;
  provided?: string;
}

// ---------------------------------------------------------------------------
// users.list
// ---------------------------------------------------------------------------

export interface UsersListResponse extends SlackBaseResponse {
  members: SlackUser[];
  response_metadata?: {
    next_cursor: string;
  };
}

// ---------------------------------------------------------------------------
// users.getPresence
// ---------------------------------------------------------------------------

export interface UserPresenceResponse extends SlackBaseResponse {
  presence: 'active' | 'away';
}

// ---------------------------------------------------------------------------
// conversations.open
// ---------------------------------------------------------------------------

export interface ConversationsOpenResponse extends SlackBaseResponse {
  channel: {
    id: string;
  };
}

// ---------------------------------------------------------------------------
// chat.postMessage
// ---------------------------------------------------------------------------

export interface ChatPostMessageResponse extends SlackBaseResponse {
  channel: string;
  ts: string;
}

// ---------------------------------------------------------------------------
// Slack Block Kit (subset)
// ---------------------------------------------------------------------------

export interface SlackTextObject {
  type: 'mrkdwn' | 'plain_text';
  text: string;
  emoji?: boolean;
}

export interface SlackButtonElement {
  type: 'button';
  text: SlackTextObject;
  value: string;
  action_id: string;
  style?: 'primary' | 'danger';
  url?: string;
}

export interface SlackSectionBlock {
  type: 'section';
  text: SlackTextObject;
  accessory?: SlackButtonElement;
}

export interface SlackActionsBlock {
  type: 'actions';
  elements: SlackButtonElement[];
}

export interface SlackDividerBlock {
  type: 'divider';
}

export interface SlackHeaderBlock {
  type: 'header';
  text: SlackTextObject;
}

export type SlackBlock =
  | SlackSectionBlock
  | SlackActionsBlock
  | SlackDividerBlock
  | SlackHeaderBlock;

// ---------------------------------------------------------------------------
// Slack Interactive Payload (block_actions)
// Received by /api/slack/action
// ---------------------------------------------------------------------------

export interface SlackBlockActionItem {
  action_id: string;
  block_id?: string;
  value: string;
  type: string;
}

export interface SlackBlockActionsPayload {
  type: 'block_actions';
  team: {
    id: string;
    domain: string;
  };
  user: {
    id: string;
    name: string;
    team_id?: string;
  };
  api_app_id?: string;
  token?: string;
  response_url: string;
  actions: SlackBlockActionItem[];
}

// ---------------------------------------------------------------------------
// Slack Event API Envelope
// Received by /api/slack/events
// ---------------------------------------------------------------------------

export interface SlackUrlVerificationPayload {
  type: 'url_verification';
  token: string;
  challenge: string;
}

export interface SlackEventPayload {
  type: string;
  user?: string;
  invited_user?: string | { id: string };
  team?: string;
  [key: string]: unknown;
}

export interface SlackEventCallbackEnvelope {
  type: 'event_callback';
  token: string;
  team_id: string;
  api_app_id?: string;
  event: SlackEventPayload;
  event_id?: string;
  event_time?: number;
}

export type SlackWebhookPayload =
  | SlackUrlVerificationPayload
  | SlackEventCallbackEnvelope;

// ---------------------------------------------------------------------------
// users.conversations
// Requires scopes: channels:read (public), groups:read (private)
// ---------------------------------------------------------------------------

export interface SlackChannel {
  id: string;
  name?: string;
}

export interface UserConversationsResponse extends SlackBaseResponse {
  channels: SlackChannel[];
  response_metadata?: {
    next_cursor: string;
  };
}

// ---------------------------------------------------------------------------
// conversations.history
// Requires scopes: channels:history (public), groups:history (private)
// ---------------------------------------------------------------------------

export interface SlackMessage {
  type: string;
  /** Slack user ID of the author. Absent for bots. */
  user?: string;
  bot_id?: string;
  text?: string;
  /** Unix timestamp as a decimal string, e.g. "1700000000.123456" */
  ts?: string;
}

export interface ConversationsHistoryResponse extends SlackBaseResponse {
  messages?: SlackMessage[];
  has_more?: boolean;
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export interface SlackOAuthV2Response {
  ok: boolean;
  error?: string;
  team: {
    id: string;
    name: string;
  };
  enterprise: {
    id: string;
    name: string;
  } | null;
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
  };
  scope?: string;
  token_type?: string;
  access_token?: string;
}
