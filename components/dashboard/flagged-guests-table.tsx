import { Badge } from '@/components/ui/badge';
import type { GuestAudit, GuestActionTaken } from '@/types/database.types';

interface FlaggedGuestsTableProps {
  guests: GuestAudit[];
}

function getActionBadge(action: GuestActionTaken | null) {
  switch (action) {
    case 'suggested_deactivation_accepted':
      return <Badge label="Deactivation Logged" variant="success" />;
    case 'ignored_by_admin':
      return <Badge label="Ignored" variant="neutral" />;
    case 'flagged':
    default:
      return <Badge label="Needs Action" variant="danger" />;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function FlaggedGuestsTable({ guests }: FlaggedGuestsTableProps) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          Flagged Guests
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {guests.length} inactive guest{guests.length !== 1 ? 's' : ''} requiring attention
        </p>
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {guests.map(guest => (
          <li
            key={guest.slack_user_id}
            className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {guest.slack_user_id.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
                  {guest.slack_user_id}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Flagged {formatDate(guest.created_at)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                ${guest.estimated_cost_monthly}/mo
              </span>
              {getActionBadge(guest.action_taken)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
