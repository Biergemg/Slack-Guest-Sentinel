require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkspaces() {
    const { data, error } = await supabase.from('workspaces').select('team_name, slack_workspace_id, plan_type');
    console.log("Workspaces:", data);
    if (error) console.error("Error:", error);
}

checkWorkspaces();
