import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. URL Verification Challenge (Required by Slack Event API)
        if (body.type === 'url_verification') {
            return NextResponse.json({ challenge: body.challenge });
        }

        // 2. Event processing
        if (body.event) {
            const { type, team_id, user, invited_user } = body.event;
            const workspaceIdStr = team_id || body.team_id;

            if (workspaceIdStr) {
                const { data: workspace } = await supabase
                    .from('workspaces')
                    .select('id')
                    .eq('slack_workspace_id', workspaceIdStr)
                    .single();

                if (workspace) {
                    // Log event to events table for traceability
                    await supabase.from('events').insert({
                        workspace_id: workspace.id,
                        type: `slack_event_${type}`,
                        payload: body.event
                    });

                    // Track sponsors if the event provides the invited user and the inviter
                    if (type === 'invite_requested' && invited_user && user) {
                        await supabase.from('guest_sponsors').upsert({
                            workspace_id: workspace.id,
                            guest_user_id: invited_user.id || invited_user,
                            sponsor_user_id: user.id || user,
                            captured_from_event: type
                        }, { onConflict: 'workspace_id, guest_user_id' });
                    }
                }
            }
        }

        // Always acknowledge Slack events quickly
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Slack Event Error:", error);
        // Don't return 500 for normal processing errors so Slack doesn't repeatedly retry unnecessarily
        // if the payload is just malformed for our specific use case, but 500 for massive crashes
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
