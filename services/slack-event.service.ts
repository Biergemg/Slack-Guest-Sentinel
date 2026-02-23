/**
 * SlackEventService — processes incoming Slack Event API callbacks.
 *
 * Called by /api/slack/events after signature verification.
 * Responsible for event logging and sponsor relationship tracking.
 */

import { supabase } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  SlackEventCallbackEnvelope,
  SlackWebhookPayload,
} from '@/types/slack.types';
import type { GuestSponsorUpsert, WorkspaceEventInsert } from '@/types/database.types';

export class SlackEventService {
  /**
   * Processes a Slack event envelope.
   * Returns immediately after dispatching — Slack requires a <3s response.
   */
  async handleEnvelope(envelope: SlackWebhookPayload): Promise<void> {
    if (envelope.type !== 'event_callback') {
      return;
    }

    const callback = envelope as SlackEventCallbackEnvelope;
    const workspace = await this.resolveWorkspace(callback.team_id);

    if (!workspace) {
      logger.warn('Received event from unregistered workspace', { teamId: callback.team_id });
      return;
    }

    const workspaceId = workspace.id;
    const { event } = callback;

    // Log the raw event for traceability
    await this.logEvent(workspaceId, `slack_event_${event.type}`, event as Record<string, unknown>);

    // Handle specific event types
    if (event.type === 'invite_requested') {
      await this.handleInviteRequested(workspaceId, callback);
    } else if (event.type === 'app_uninstalled') {
      await this.handleAppUninstalled(workspaceId);
    }
  }

  private async handleAppUninstalled(workspaceId: string): Promise<void> {
    // Note: access_token is NOT NULL so we cannot clear it; marking is_active=false
    // prevents the workspace from being picked up by the audit cron.
    // The refresh_token can be nulled out immediately.
    const { error } = await supabase
      .from('workspaces')
      .update({
        refresh_token: null,
        is_active: false,
        uninstalled_at: new Date().toISOString(),
      })
      .eq('id', workspaceId);

    if (error) {
      logger.error('Failed to handle app_uninstalled', { workspaceId }, error);
    } else {
      logger.info('App uninstalled, workspace marked inactive', { workspaceId });
    }
  }

  private async handleInviteRequested(
    workspaceId: string,
    callback: SlackEventCallbackEnvelope
  ): Promise<void> {
    const { event } = callback;

    // Normalize invited_user — can be a string ID or an object with an id field
    const invitedUserId =
      typeof event.invited_user === 'string'
        ? event.invited_user
        : typeof event.invited_user === 'object' && event.invited_user !== null
          ? (event.invited_user as { id: string }).id
          : null;

    // user is the sponsor (the person sending the invite)
    const sponsorUserId = typeof event.user === 'string' ? event.user : null;

    if (!invitedUserId || !sponsorUserId) {
      logger.warn('invite_requested event missing user IDs', {
        workspaceId,
        event,
      });
      return;
    }

    const sponsorData: GuestSponsorUpsert = {
      workspace_id: workspaceId,
      guest_user_id: invitedUserId,
      sponsor_user_id: sponsorUserId,
      captured_from_event: 'invite_requested',
    };

    const { error } = await supabase
      .from('guest_sponsors')
      .upsert(sponsorData, { onConflict: 'workspace_id,guest_user_id' });

    if (error) {
      logger.error('Failed to upsert guest sponsor', { workspaceId, invitedUserId }, error);
    } else {
      logger.info('Guest sponsor captured', { workspaceId, invitedUserId, sponsorUserId });
    }
  }

  private async resolveWorkspace(slackTeamId: string): Promise<{ id: string } | null> {
    const { data } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slack_workspace_id', slackTeamId)
      .single();

    return data;
  }

  private async logEvent(
    workspaceId: string,
    type: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const eventData: WorkspaceEventInsert = { workspace_id: workspaceId, type, payload };
    const { error } = await supabase.from('events').insert(eventData);

    if (error) {
      logger.error('Failed to log Slack event', { workspaceId, type }, error);
    }
  }
}

export const slackEventService = new SlackEventService();
