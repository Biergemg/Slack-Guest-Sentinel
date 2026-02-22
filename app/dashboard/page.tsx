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
  const [auditRunResult, flaggedGuestsResult] = await Promise.all([
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

  const auditRun = auditRunResult.data as AuditRun | null;
  const flaggedGuests = (flaggedGuestsResult.data ?? []) as GuestAudit[];

  return (
    <main className="p-8 max-w-5xl mx-auto bg-gray-50 min-h-screen dark:bg-gray-900">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Workspace Dashboard
        </h1>
        {resolvedSearchParams.session_id && (
          <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-4 py-2 rounded-full text-sm font-medium">
            Subscription Active
          </span>
        )}
      </header>

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
