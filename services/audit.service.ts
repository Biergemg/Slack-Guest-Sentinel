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
import {
  getGuests,
  getLastMessageTs,
  getUserPresence,
  sendDirectMessage,
  buildInactiveGuestBlocks,
} from '@/lib/slack';
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
  /** Which signals were checked — recorded in guest_audits.last_seen_source */
  source: string;
}

/** Run an array of async tasks with bounded concurrency. */
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit).map(fn => fn());
    results.push(...(await Promise.all(batch)));
  }
  return results;
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

      const inactiveGuests = scoredGuests.filter(sg => sg.score < AUDIT.MIN_ACTIVE_SCORE);
      const activeGuests = scoredGuests.filter(sg => sg.score >= AUDIT.MIN_ACTIVE_SCORE);

      // Batch DB operations
      await Promise.all([
        this.flagGuests(workspace.id, inactiveGuests, costPerSeat),
        this.clearActiveGuests(workspace.id, activeGuests.map(sg => sg.guest.id)),
      ]);

      // Send DM alerts in parallel (failures are caught per alert)
      await Promise.allSettled(
        inactiveGuests.map(sg =>
          this.sendInactiveAlert(token, workspace, sg.guest.id, costPerSeat)
        )
      );

      // Record audit snapshot
      const runData: AuditRunInsert = {
        workspace_id: workspace.id,
        workspace_guest_count: scoredGuests.length,
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

  /**
   * Scores each guest for inactivity using a 3-signal lazy evaluation strategy.
   *
   * Signals (in order of cost, cheapest first):
   *   1. Profile update  (+1.0) — free, already in users.list response
   *   2. Presence active (+0.5) — cheap, 1 API call per guest
   *   3. Last message    (+3.0) — expensive, 1-3 API calls per guest; last resort
   *
   * Short-circuits as soon as score >= MIN_ACTIVE_SCORE to avoid unnecessary
   * API calls. Processes guests in batches of GUEST_SCORING_CONCURRENCY to
   * prevent request floods on large workspaces.
   */
  private async scoreGuests(token: string, guests: SlackUser[]): Promise<ScoredGuest[]> {
    const cutoff = Math.floor(Date.now() / 1000) - AUDIT.ACTIVITY_WINDOW_SECONDS;

    const tasks = guests.map(guest => async (): Promise<ScoredGuest> => {
      let score = 0;

      // ── Signal 1: Profile update (FREE — already in users.list) ──────────
      if (guest.updated && guest.updated > cutoff) {
        score += AUDIT.SCORE_PROFILE_UPDATED;
      }

      // Short-circuit: profile alone crosses the threshold
      if (score >= AUDIT.MIN_ACTIVE_SCORE) {
        return { guest, score, source: 'profile_check' };
      }

      // ── Signal 2: Current presence (CHEAP — 1 API call) ──────────────────
      // Presence is unreliable alone (Slack keepalive, mobile background,
      // bots) — it only contributes 0.5, so it cannot classify a guest as
      // active by itself. Presence + profile is the only combo that reaches
      // the threshold without a message check.
      const presence = await getUserPresence(token, guest.id);
      if (presence === 'active') {
        score += AUDIT.SCORE_PRESENCE_ACTIVE;
      }

      if (score >= AUDIT.MIN_ACTIVE_SCORE) {
        return { guest, score, source: 'profile_presence_check' };
      }

      // ── Signal 3: Last message timestamp (EXPENSIVE — last resort) ────────
      // Only reached for guests who haven't updated their profile AND aren't
      // presence-active above the threshold. This is the most reliable signal
      // but requires extra scopes (channels:read, channels:history).
      const lastMsgTs = await getLastMessageTs(token, guest.id);
      if (lastMsgTs !== null && lastMsgTs > cutoff) {
        score += AUDIT.SCORE_LAST_MESSAGE;
      }

      return { guest, score, source: 'profile_presence_message_check' };
    });

    return withConcurrency(tasks, AUDIT.GUEST_SCORING_CONCURRENCY);
  }

  private async flagGuests(
    workspaceId: string,
    guests: ScoredGuest[],
    costPerSeat: number
  ): Promise<void> {
    if (guests.length === 0) return;

    const records: GuestAuditUpsert[] = guests.map(sg => ({
      workspace_id: workspaceId,
      slack_user_id: sg.guest.id,
      last_seen_source: sg.source,
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
