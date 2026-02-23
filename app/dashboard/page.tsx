import Image from 'next/image';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/db';
import { StatsRow } from '@/components/dashboard/stats-row';
import { FlaggedGuestsTable } from '@/components/dashboard/flagged-guests-table';
import { EmptyState } from '@/components/dashboard/empty-state';
import { SESSION } from '@/config/constants';
import type { AuditRun, GuestAudit } from '@/types/database.types';

export const dynamic = 'force-dynamic';

interface DashboardSearchParams {
  session_id?: string;
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(SESSION.COOKIE_NAME)?.value;

  if (!workspaceId) {
    redirect('/?error=unauthorized');
  }

  // Run both queries in parallel for faster page load
  const [workspaceResult, auditRunResult, flaggedGuestsResult] = await Promise.all([
    supabase
      .from('workspaces')
      .select('plan_type')
      .eq('id', workspaceId)
      .single(),
    supabase
      .from('audit_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('guest_audits')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_flagged', true)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const planType = workspaceResult.data?.plan_type || 'free';

  const auditRun = auditRunResult.data as AuditRun | null;
  const flaggedGuests = (flaggedGuestsResult.data ?? []) as GuestAudit[];

  return (
    <main className="p-8 max-w-5xl mx-auto bg-gray-50 min-h-screen dark:bg-gray-900">
      <header className="flex justify-between items-center mb-8 border-b border-gray-200 dark:border-gray-800 pb-6">
        <div className="flex items-center gap-4">
          <Image
            src="/logo.png"
            alt="Slack Guest Sentinel Logo"
            width={60}
            height={60}
            className="w-12 h-12 rounded-lg shadow-sm"
          />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Workspace Dashboard
          </h1>
        </div>
        {resolvedSearchParams.session_id && (
          <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-4 py-2 rounded-full text-sm font-medium">
            Subscription Active
          </span>
        )}
      </header>

      {planType === 'free' && (
        <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-1">Unlock Background Audits & Alerts</h3>
            <p className="text-blue-800 dark:text-blue-300 text-sm">Automated audits and administrative alerts are paused on the Free plan. Upgrade to fully automate your guest management and start saving effortlessly.</p>
          </div>
          <a href={`/onboarding?workspaceId=${workspaceId}`} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors shadow-sm">
            View Pricing Plans
          </a>
        </div>
      )}

      <StatsRow auditRun={auditRun} />

      {flaggedGuests.length > 0 ? (
        <FlaggedGuestsTable guests={flaggedGuests} />
      ) : (
        <EmptyState />
      )}

      {!auditRun && (
        <p className="text-center text-sm text-gray-400 mt-6">
          No audit data yet. The first audit runs daily at midnight UTC.
        </p>
      )}
    </main>
  );
}
