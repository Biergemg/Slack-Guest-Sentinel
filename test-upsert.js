require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpsert() {
    console.log("Testing workspace upsert...");
    const workspaceData = {
        slack_workspace_id: 'T_TEST_123',
        team_name: 'Test Team',
        enterprise_id: null,
        enterprise_name: null,
        access_token: 'fake_encrypted_token',
        refresh_token: null,
        token_expires_at: null,
        installed_by: 'U_TEST_123',
        plan_type: 'free',
        supports_user_deactivation: false,
        estimated_seat_cost: 8,
    };

    const { data, error } = await supabase
        .from('workspaces')
        .upsert(workspaceData, { onConflict: 'slack_workspace_id' })
        .select('id')
        .single();

    if (error) {
        console.error("❌ SUPABASE ERROR DETAILS:");
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log("✅ SUCCESS:", data);
        // Clean up
        await supabase.from('workspaces').delete().eq('slack_workspace_id', 'T_TEST_123');
    }
}

testUpsert();
