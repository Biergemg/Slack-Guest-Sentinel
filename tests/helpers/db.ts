import { supabase } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import type { SubscriptionPlan } from '@/types/database.types';

export async function cleanDatabase() {
    // Bulk delete all rows safely. Tables are ordered to respect FK constraints.
    // Using `.neq('id', fakeId)` acts as a full table scan delete.
    const fakeUuid = '00000000-0000-0000-0000-000000000000';

    await supabase.from('stripe_events_history').delete().neq('stripe_event_id', '__placeholder__');
    await supabase.from('guest_audits').delete().neq('id', fakeUuid);
    await supabase.from('audit_runs').delete().neq('id', fakeUuid);
    await supabase.from('events').delete().neq('id', fakeUuid);
    await supabase.from('subscriptions').delete().neq('workspace_id', fakeUuid);
    await supabase.from('workspaces').delete().neq('id', fakeUuid);
}

export async function seedWorkspace(id: string, name: string, token: string = 'mock-slack-token'): Promise<string> {
    const { error } = await supabase.from('workspaces').insert({
        id,
        slack_workspace_id: `T${id.replace(/-/g, '').substring(0, 8).toUpperCase()}`,
        team_name: name,
        access_token: encrypt(token),
        installed_by: 'U12345678',
        plan_type: 'free',
        supports_user_deactivation: false,
    });
    if (error) throw new Error('Failed to seed workspace: ' + JSON.stringify(error));
    return id;
}

export async function seedSubscription(workspaceId: string, plan: SubscriptionPlan, status: string = 'active') {
    const { error } = await supabase.from('subscriptions').insert({
        workspace_id: workspaceId,
        stripe_customer_id: 'cus_mock',
        stripe_subscription_id: 'sub_mock',
        plan,
        status,
    });
    if (error) throw new Error('Failed to seed subscription: ' + error.message);

    // Trigger should have run, but just to be sure
    await supabase.from('workspaces').update({ plan_type: plan }).eq('id', workspaceId);
}
