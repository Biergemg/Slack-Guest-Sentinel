import { StatCard } from '@/components/ui/stat-card';
import type { AuditRun } from '@/types/database.types';

interface StatsRowProps {
  auditRun: AuditRun | null;
}

export function StatsRow({ auditRun }: StatsRowProps) {
  const totalGuests = auditRun?.workspace_guest_count ?? 0;
  const inactiveGuests = auditRun?.workspace_inactive_count ?? 0;
  const estimatedWaste = auditRun?.workspace_estimated_waste ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <StatCard
        label="Total Guests Scanned"
        value={totalGuests}
        variant="default"
      />
      <StatCard
        label="Inactive Guests Detected"
        value={inactiveGuests}
        variant={inactiveGuests > 0 ? 'danger' : 'default'}
      />
      <StatCard
        label="Identified Monthly Waste"
        value={estimatedWaste.toFixed(0)}
        prefix="$"
        variant={estimatedWaste > 0 ? 'danger' : 'success'}
      />
    </div>
  );
}
