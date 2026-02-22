import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(request: Request) {
    const formData = await request.formData();
    const payloadStr = formData.get('payload');

    if (!payloadStr) return new Response('No payload', { status: 400 });

    const payload = JSON.parse(payloadStr as string);

    if (payload.type === 'block_actions') {
        const action = payload.actions[0];
        const actionId = action.action_id;
        const workspaceIdStr = payload.team.id;

        const { data: workspace } = await supabase
            .from('workspaces')
            .select('id')
            .eq('slack_workspace_id', workspaceIdStr)
            .single();

        if (!workspace) return new Response('Workspace err', { status: 404 });

        if (actionId === 'deactivate_guest_action') {
            const guestId = action.value.replace('deactivate_', '');

            await supabase.from('guest_audits').update({ action_taken: 'suggested_deactivation_accepted' })
                .eq('workspace_id', workspace.id)
                .eq('slack_user_id', guestId);

            await supabase.from('events').insert({
                workspace_id: workspace.id,
                type: 'deactivate_button_clicked',
                payload: { guest_id: guestId, admin: payload.user.id }
            });

            if (payload.response_url) {
                await fetch(payload.response_url, {
                    method: 'POST',
                    body: JSON.stringify({
                        replace_original: true,
                        text: `✅ Action logged! You indicated you will manually deactivate <@${guestId}> in the Slack Admin panel.`
                    })
                });
            }
        } else if (actionId === 'ignore_guest_action') {
            const guestId = action.value.replace('ignore_', '');

            await supabase.from('guest_audits').update({ action_taken: 'ignored_by_admin' })
                .eq('workspace_id', workspace.id)
                .eq('slack_user_id', guestId);

            if (payload.response_url) {
                await fetch(payload.response_url, {
                    method: 'POST',
                    body: JSON.stringify({
                        replace_original: true,
                        text: `🙈 Ignored alert for <@${guestId}>.`
                    })
                });
            }
        }
    }

    return new Response('', { status: 200 });
}
