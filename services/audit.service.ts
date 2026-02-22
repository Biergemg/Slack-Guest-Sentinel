/**
 * AuditService — core business logic for guest inactivity detection.
 *
 * Extracted from the original 157-line God function in /api/internal/audit.
 * Key improvements over the original:
 *
 *   - Workspaces processed in parallel batches (not sequentially)
 *   - Database upserts batched per workspace (not one per guest)
 *   - Presence checks only called for score=0 guests (same as before)
 *   - DM alerts sent in parallel per workspace
 *   - All DB ops use typed interfaces
 *   - All errors logged with structured context
 */

import { supabase } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getGuests, getUserPresence, sendDirectMessage, buildInactiveGuestBlocks } from '@/lib/slack';
import { logger } from '@/lib/logger';
import {
  AUDIT,
  BILLING,
  GUEST_ACTION,
  WORKSPACE_EVENT_TYPE,
} from '@/config/constants';
import type { Workspace, GuestAuditUpsert, AuditRunInsert } from '@/types/database.types';
import type { SlackUser } from '@/types/slack.types';
import type { AuditRunResult } from '@/types/api.types';

interface ScoredGuest {
  guest: SlackUser;
  score: number;
}

export class AuditService {
  /**
   * Audits all workspaces with an active or trialing subscription.
   * Returns a summary of workspaces audited and guests flagged.
   */
  async auditAllActiveWorkspaces(): Promise<AuditRunResult> {
    const workspaces = await this.fetchActiveWorkspaces();

    if (workspaces.length === 0) {
      logger.info('No active workspaces to audit');
      return { audited: 0, flagged: 0 };
    }

    logger.info('Starting audit', { workspaceCount: workspaces.length });

    let totalAudited = 0;
    let totalFlagged = 0;

    // Process in batches to limit concurrent DB connections and Slack API calls
    for (let i = 0; i < workspaces.length; i += AUDIT.WORKSPACE_BATCH_SIZE) {
      const batch = workspaces.slice(i, i + AUDIT.WORKSPACE_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(ws => this.auditWorkspace(ws))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalAudited++;
          totalFlagged += result.value.flagged;
        }
        // Individual workspace errors are logged inside auditWorkspace
      }
    }

    logger.info('Audit completed', { audited: totalAudited, flagged: totalFlagged });
    return { audited: totalAudited, flagged: totalFlagged };
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  private async fetchActiveWorkspaces(): Promise<Workspace[]> {
    // Single JOIN query — replaces the original two-query approach
    const { data, error } = await supabase
      .from('subscriptions')
      .select('workspace_id, workspaces!inner(*)')
      .in('status', ['active', 'trialing']);

    if (error) {
      throw new Error(`Failed to fetch active workspaces: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const record = row as unknown as { workspaces: Workspace };
      return record.workspaces;
    });
  }

  private async auditWorkspace(workspace: Workspace): Promise<{ flagged: number }> {
    const startedAt = Date.now();
    logger.info('Auditing workspace', { workspaceId: workspace.id, teamName: workspace.team_name });

    try {
      const token = decrypt(workspace.access_token);
      const guests = await getGuests(token);
      const costPerSeat = workspace.estimated_seat_cost ?? BILLING.DEFAULT_SEAT_COST_USD;

      // Score all guests concurrently
      const scoredGuests = await this.scoreGuests(token, guests);

      const inactiveGuests = scoredGuests
        .filter(sg => sg.score <= AUDIT.INACTIVE_SCORE_THRESHOLD)
        .map(sg => sg.guest);

      const activeGuests = scoredGuests
        .filter(sg => sg.score > AUDIT.INACTIVE_SCORE_THRESHOLD)
        .map(sg => sg.guest);

      // Batch DB operations
      await Promise.all([
        this.flagGuests(workspace.id, inactiveGuests, costPerSeat),
        this.clearActiveGuests(workspace.id, activeGuests.map(g => g.id)),
      ]);

      // Send DM alerts in parallel (failures are caught per alert)
      await Promise.allSettled(
        inactiveGuests.map(guest =>
          this.sendInactiveAlert(token, workspace, guest.id, costPerSeat)
        )
      );

      // Record audit snapshot
      const runData: AuditRunInsert = {
        workspace_id: workspace.id,
        workspace_guest_count: guests.length,
        workspace_inactive_count: inactiveGuests.length,
        workspace_estimated_waste: inactiveGuests.length * costPerSeat,
      };
      await supabase.from('audit_runs').insert(runData);

      const durationMs = Date.now() - startedAt;
      logger.info('Workspace audit complete', {
        workspaceId: workspace.id,
        guests: guests.length,
        inactive: inactiveGuests.length,
        durationMs,
      });

      return { flagged: inactiveGuests.length };
    } catch (err) {
      logger.error('Workspace audit failed', {
        workspaceId: workspace.id,
        teamName: workspace.team_name,
      }, err);
      throw err;
    }
  }

  private async scoreGuests(token: string, guests: SlackUser[]): Promise<ScoredGuest[]> {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - AUDIT.ACTIVITY_WINDOW_SECONDS;

    return Promise.all(
      guests.map(async (guest): Promise<ScoredGuest> => {
        let score = 0;

        // Signal 1: Recent profile update
        if (guest.updated && guest.updated > cutoff) {
          score += AUDIT.PROFILE_ACTIVITY_SCORE;
        }

        // Signal 2: Current presence — only checked if score is still 0 (saves API calls)
        if (score === 0) {
          const presence = await getUserPresence(token, guest.id);
          if (presence === 'active') {
            score += AUDIT.PRESENCE_ACTIVITY_SCORE;
          }
        }

        return { guest, score };
      })
    );
  }

  private async flagGuests(
    workspaceId: string,
    guests: SlackUser[],
    costPerSeat: number
  ): Promise<void> {
    if (guests.length === 0) return;

    const records: GuestAuditUpsert[] = guests.map(guest => ({
      workspace_id: workspaceId,
      slack_user_id: guest.id,
      last_seen_source: 'profile_and_presence_check',
      estimated_cost_monthly: costPerSeat,
      estimated_cost_yearly: costPerSeat * 12,
      is_flagged: true,
      action_taken: GUEST_ACTION.FLAGGED,
    }));

    const { error } = await supabase
      .from('guest_audits')
      .upsert(records, { onConflict: 'workspace_id,slack_user_id' });

    if (error) {
      logger.error('Failed to flag guests in batch', { workspaceId, count: guests.length }, error);
    }
  }

  private async clearActiveGuests(
    workspaceId: string,
    activeGuestIds: string[]
  ): Promise<void> {
    if (activeGuestIds.length === 0) return;

    const { error } = await supabase
      .from('guest_audits')
      .delete()
      .eq('workspace_id', workspaceId)
      .in('slack_user_id', activeGuestIds);

    if (error) {
      logger.error('Failed to clear active guests', { workspaceId }, error);
    }
  }

  private async sendInactiveAlert(
    token: string,
    workspace: Workspace,
    guestId: string,
    costPerSeat: number
  ): Promise<void> {
    try {
      const blocks = buildInactiveGuestBlocks(guestId, costPerSeat);
      await sendDirectMessage(
        token,
        workspace.installed_by,
        blocks,
        `Inactive guest <@${guestId}> detected`
      );

      await supabase.from('events').insert({
        workspace_id: workspace.id,
        type: WORKSPACE_EVENT_TYPE.DM_ALERT_SENT,
        payload: { guest_id: guestId, admin_id: workspace.installed_by },
      });
    } catch (err) {
      logger.error('Failed to send DM alert', { workspaceId: workspace.id, guestId }, err);
    }
  }
}

export const auditService = new AuditService();
