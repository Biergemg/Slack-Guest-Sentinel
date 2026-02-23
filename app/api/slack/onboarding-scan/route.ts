export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import { SESSION, AUDIT } from '@/config/constants';

/**
 * Quick guest scan for the onboarding "AHA moment".
 *
 * Intentionally shallow — no scoring signals, no DB writes.
 * Estimates inactivity at 20% to avoid rate limiting during
 * the critical onboarding flow. The real scored audit runs
 * via the nightly cron.
 *
 * Auth: requires a valid workspace_session cookie (set by /api/slack/callback).
 */
export async function GET(request: Request) {
  // Validate session cookie — only the workspace that just installed should scan
  const cookieStore = await cookies();
  const sessionWorkspaceId = cookieStore.get(SESSION.COOKIE_NAME)?.value;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
  }

  if (!sessionWorkspaceId || sessionWorkspaceId !== workspaceId) {
    logger.warn('Onboarding scan: unauthorized — session/workspace mismatch', { workspaceId });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: workspace, error: dbError } = await supabase
    .from('workspaces')
    .select('access_token, estimated_seat_cost')
    .eq('id', workspaceId)
    .single();

  if (dbError || !workspace) {
    logger.warn('Onboarding scan: workspace not found', { workspaceId });
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  try {
    const token = decrypt(workspace.access_token);

    const response = await fetch(
      `https://slack.com/api/users.list?limit=${AUDIT.GUEST_LIST_PAGE_SIZE}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();

    if (!data.ok) {
      logger.warn('Onboarding scan: Slack users.list failed', { workspaceId, error: data.error });
      return NextResponse.json({ error: 'Slack API error', code: data.error }, { status: 502 });
    }

    const members: Array<{ deleted?: boolean; is_restricted?: boolean; is_ultra_restricted?: boolean }> =
      data.members ?? [];
    const guests = members.filter(m => !m.deleted && (m.is_restricted || m.is_ultra_restricted));
    const guestCount = guests.length;

    // Estimate inactivity at 20% — avoids scoring API calls during onboarding.
    // Real multi-signal audit runs via the nightly cron.
    const inactiveCount = guestCount > 0 ? Math.max(1, Math.floor(guestCount * 0.20)) : 0;
    const costPerSeat = Number(workspace.estimated_seat_cost || 15);
    const monthlyWaste = inactiveCount * costPerSeat;

    // Artificial delay so the "Scanning..." step is visible (UX — not a bug)
    await new Promise(r => setTimeout(r, 2000));

    return NextResponse.json({ totalGuests: guestCount, inactiveGuests: inactiveCount, monthlyWaste });
  } catch (err) {
    logger.error('Onboarding scan: unexpected error', { workspaceId }, err);
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }
}
