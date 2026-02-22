import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getGuests, getUserPresence, sendDirectMessage } from '@/lib/slack';

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Phase 5: Fetch all ACTIVE subscriptions 
    const { data: activeSubs } = await supabase
        .from('subscriptions')
        .select('workspace_id')
        .in('status', ['active', 'trialing']);

    if (!activeSubs || activeSubs.length === 0) {
        return NextResponse.json({ message: 'No active workspaces to audit.' });
    }

    const workspaceIds = activeSubs.map(s => s.workspace_id);

    const { data: workspaces, error } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds);

    if (error || !workspaces) {
        return new Response('Database Error', { status: 500 });
    }

    let totalWorkspacesAudited = 0;
    let totalGuestsFlagged = 0;

    for (const workspace of workspaces) {
        try {
            const token = decrypt(workspace.access_token);
            const guests = await getGuests(token);

            let inactiveCount = 0;
            const costPerSeat = Number(workspace.estimated_seat_cost || 15);

            for (const guest of guests) {
                // Multi-signal Engine
                let activityScore = 0;

                // 1. Check Profile Updated timestamp
                // If updated in the last 30 days, we assume some level of activity
                const thirtyDaysAgo = Date.now() / 1000 - (30 * 24 * 60 * 60);
                if (guest.updated && guest.updated > thirtyDaysAgo) {
                    activityScore += 1;
                }

                // 2. Check current presence (only if score is 0 to save API calls)
                if (activityScore === 0) {
                    const presence = await getUserPresence(token, guest.id);
                    if (presence === 'active') {
                        activityScore += 2;
                    }
                }

                // Phase 6: Inactivity Logic
                const isInactive = activityScore === 0;

                if (isInactive) {
                    inactiveCount++;

                    // Upsert into guest_audits
                    await supabase.from('guest_audits').upsert({
                        workspace_id: workspace.id,
                        slack_user_id: guest.id,
                        last_seen_source: 'profile_and_presence_check',
                        estimated_cost_monthly: costPerSeat,
                        estimated_cost_yearly: costPerSeat * 12,
                        is_flagged: true,
                        action_taken: 'flagged'
                    }, { onConflict: 'workspace_id,slack_user_id' });

                    // Phase 7 & 8: Send DM with interactive blocks suggesting deactivation
                    const blocks = [
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": `*Inactive Guest Alert*\nGuest <@${guest.id}> appears to be completely inactive. You are paying approximately $${costPerSeat}/mo.`
                            }
                        },
                        {
                            "type": "actions",
                            "elements": [
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "Log Deactivation intent"
                                    },
                                    "style": "danger",
                                    "value": `deactivate_${guest.id}`,
                                    "action_id": "deactivate_guest_action"
                                },
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "Ignore"
                                    },
                                    "value": `ignore_${guest.id}`,
                                    "action_id": "ignore_guest_action"
                                }
                            ]
                        }
                    ];

                    try {
                        await sendDirectMessage(token, workspace.installed_by, blocks, `Inactive guest <@${guest.id}> detected`);
                        totalGuestsFlagged++;

                        await supabase.from('events').insert({
                            workspace_id: workspace.id,
                            type: 'dm_alert_sent',
                            payload: { guest_id: guest.id, admin_id: workspace.installed_by }
                        });
                    } catch (dmErr) {
                        console.error(`Failed to send DM for workspace ${workspace.id}`, dmErr);
                    }
                } else {
                    // Mark as active if previously flagged by removing their audit flag
                    await supabase.from('guest_audits')
                        .delete()
                        .eq('workspace_id', workspace.id)
                        .eq('slack_user_id', guest.id);
                }
            }

            // Save Snapshot historic data
            await supabase.from('audit_runs').insert({
                workspace_id: workspace.id,
                workspace_guest_count: guests.length,
                workspace_inactive_count: inactiveCount,
                workspace_estimated_waste: inactiveCount * costPerSeat
            });

            totalWorkspacesAudited++;
        } catch (workspaceError) {
            console.error(`Error auditing workspace ${workspace.id}:`, workspaceError);
        }
    }

    return NextResponse.json({
        ok: true,
        audited: totalWorkspacesAudited,
        flagged: totalGuestsFlagged
    });
}
