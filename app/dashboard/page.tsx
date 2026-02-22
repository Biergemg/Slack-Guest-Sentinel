import { supabase } from '@/lib/db';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

export default async function Dashboard({
    searchParams,
}: {
    searchParams: { session_id?: string; workspaceId?: string };
}) {
    // For MVP, we simply load the most recent snapshot for the dashboard view.
    // In production, we would extract the workspace ID from auth cookies or Stripe session.
    let query = supabase.from('audit_runs').select('*').order('created_at', { ascending: false }).limit(1);

    if (searchParams.workspaceId) {
        query = query.eq('workspace_id', searchParams.workspaceId);
    }

    const { data } = await query.single();

    // Also fetch currently flagged guests
    const { data: flaggedGuests } = await supabase
        .from('guest_audits')
        .select('*')
        .eq('is_flagged', true)
        .order('created_at', { ascending: false })
        .limit(10);

    return (
        <main className="p-8 max-w-5xl mx-auto bg-gray-50 min-h-screen dark:bg-gray-900">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Workspace Dashboard</h1>
                {searchParams.session_id && (
                    <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-medium">
                        Subscription Active ✨
                    </span>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-gray-500 font-medium mb-2">Total Guests Scanned</h3>
                    <p className="text-4xl font-bold text-gray-900 dark:text-white">{data?.workspace_guest_count || 0}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30">
                    <h3 className="text-red-500 font-medium mb-2">Inactive Guests</h3>
                    <p className="text-4xl font-bold text-red-600 dark:text-red-400">{data?.workspace_inactive_count || 0}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-xl shadow-sm border border-green-100 dark:border-green-900/30">
                    <h3 className="text-green-600 font-medium mb-2">Identified Waste</h3>
                    <p className="text-4xl font-bold text-green-700 dark:text-green-400">
                        ${data?.workspace_estimated_waste || 0}<span className="text-lg font-normal text-green-600/70">/mo</span>
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Flagged Guests (Action Required)</h2>
                    <button className="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-md font-medium transition-colors">
                        Force Rescan
                    </button>
                </div>

                {flaggedGuests && flaggedGuests.length > 0 ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {flaggedGuests.map((guest: any) => (
                            <div key={guest.id} className="p-6 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">{guest.slack_user_id}</p>
                                    <p className="text-sm text-gray-500">Last active source: {guest.last_seen_source || 'Unknown'}</p>
                                    <p className="text-xs mt-1 text-red-500 bg-red-50 inline-block px-2 py-0.5 rounded">Action: {guest.action_taken}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-900 dark:text-white">${guest.estimated_cost_monthly}/mo</p>
                                    <p className="text-xs text-gray-500">Waste</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Clean Directory</h3>
                        <p className="text-gray-500">We couldn't find any inactive guests currently. Detailed results will sync after the next scheduled audit.</p>
                    </div>
                )}
            </div>
        </main>
    );
}
