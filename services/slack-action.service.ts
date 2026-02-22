/**
 * SlackActionService — handles Slack Block Kit button interactions.
 *
 * Called by /api/slack/action after signature verification.
 * Responsible for updating guest audit state and posting response messages.
 */

import { supabase } from '@/lib/db';
import { logger } from '@/lib/logger';
import { GUEST_ACTION, SLACK_ACTION_ID, WORKSPACE_EVENT_TYPE } from '@/config/constants';
import type { SlackBlockActionsPayload } from '@/types/slack.types';
import type { GuestActionTaken } from '@/types/database.types';

export class SlackActionService {
  /**
   * Dispatches a block_actions payload to the appropriate handler.
   */
  async handlePayload(payload: SlackBlockActionsPayload): Promise<void> {
    const workspace = await this.resolveWorkspace(payload.team.id);
    if (!workspace) {
      logger.warn('Received action from unknown workspace', { teamId: payload.team.id });
      return;
    }

    for (const action of payload.actions) {
      switch (action.action_id) {
        case SLACK_ACTION_ID.DEACTIVATE_GUEST:
          await this.handleDeactivate(workspace.id, action.value, payload);
          break;

        case SLACK_ACTION_ID.IGNORE_GUEST:
          await this.handleIgnore(workspace.id, action.value, payload);
          break;

        default:
          logger.warn('Unknown Slack action_id', { actionId: action.action_id });
      }
    }
  }

  private async handleDeactivate(
    workspaceId: string,
    actionValue: string,
    payload: SlackBlockActionsPayload
  ): Promise<void> {
    const guestId = actionValue.replace(/^deactivate_/, '');

    await Promise.all([
      this.updateGuestAction(workspaceId, guestId, GUEST_ACTION.DEACTIVATION_ACCEPTED),
      this.logEvent(workspaceId, WORKSPACE_EVENT_TYPE.DEACTIVATE_BUTTON_CLICKED, {
        guest_id: guestId,
        admin_id: payload.user.id,
      }),
    ]);

    await this.postResponseMessage(
      payload.response_url,
      `✅ Action logged. Please manually deactivate <@${guestId}> in the Slack Admin panel.`
    );

    logger.info('Deactivation intent logged', { workspaceId, guestId, adminId: payload.user.id });
  }

  private async handleIgnore(
    workspaceId: string,
    actionValue: string,
    payload: SlackBlockActionsPayload
  ): Promise<void> {
    const guestId = actionValue.replace(/^ignore_/, '');

    await Promise.all([
      this.updateGuestAction(workspaceId, guestId, GUEST_ACTION.IGNORED_BY_ADMIN),
      this.logEvent(workspaceId, WORKSPACE_EVENT_TYPE.IGNORE_BUTTON_CLICKED, {
        guest_id: guestId,
        admin_id: payload.user.id,
      }),
    ]);

    await this.postResponseMessage(
      payload.response_url,
      `Ignored alert for <@${guestId}>. No further alerts will be sent for this guest until the next audit.`
    );

    logger.info('Guest alert ignored', { workspaceId, guestId, adminId: payload.user.id });
  }

  private async updateGuestAction(
    workspaceId: string,
    guestId: string,
    action: GuestActionTaken
  ): Promise<void> {
    const { error } = await supabase
      .from('guest_audits')
      .update({ action_taken: action })
      .eq('workspace_id', workspaceId)
      .eq('slack_user_id', guestId);

    if (error) {
      logger.error('Failed to update guest action', { workspaceId, guestId, action }, error);
    }
  }

  private async logEvent(
    workspaceId: string,
    type: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const { error } = await supabase
      .from('events')
      .insert({ workspace_id: workspaceId, type, payload });

    if (error) {
      logger.error('Failed to log event', { workspaceId, type }, error);
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

  private async postResponseMessage(responseUrl: string, text: string): Promise<void> {
    try {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replace_original: true, text }),
      });
    } catch (err) {
      logger.error('Failed to post Slack response message', { responseUrl }, err);
    }
  }
}

export const slackActionService = new SlackActionService();
