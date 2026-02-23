import Image from 'next/image';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: 'The authorization session expired or was interrupted. Please try again.',
  access_denied: 'You cancelled the Slack authorization. Click "Add to Slack" to try again.',
  missing_code: 'Slack did not return an authorization code. Please try again.',
  oauth_failed: 'Could not complete Slack authorization. Please try again or contact support.',
  no_token: 'Slack did not return an access token. Please try again.',
  db_error: 'A database error occurred. Please try again in a few moments.',
  internal_error: 'An unexpected error occurred. Please try again or check Vercel Logs.',
  unauthorized: 'Your session has expired. Please reinstall the app.',
  missing_workspace: 'Workspace information is missing. Please reinstall the app.',
  invalid_workspace: 'This workspace is not recognized. Please reinstall the app.',
};

function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'An unexpected error occurred. Please try again.';
}

function DashboardPreview() {
  const guests = [
    { id: 'U04K2MN', name: 'alex.morgan', flaggedDays: 34, cost: 15, action: 'Needs Action' },
    { id: 'U07R9PQ', name: 'sarah.chen', flaggedDays: 61, cost: 15, action: 'Needs Action' },
    { id: 'U02X1LW', name: 'david.kim', flaggedDays: 12, cost: 15, action: 'Ignored' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden bg-white dark:bg-gray-900 text-left">
      {/* Fake browser chrome */}
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white dark:bg-gray-700 rounded-md px-3 py-1 text-xs text-gray-400 font-mono ml-2">
          yourapp.com/dashboard
        </div>
      </div>

      {/* Dashboard content */}
      <div className="p-5">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Guests</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">14</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-100 dark:border-red-900/40">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">Inactive Guests</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-0.5">3</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-100 dark:border-green-900/40">
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">Monthly Waste</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-0.5">$45</p>
          </div>
        </div>

        {/* Guests table */}
        <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-800 dark:text-white">Flagged Guests</p>
            <p className="text-xs text-gray-400 mt-0.5">3 inactive guests requiring attention</p>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {guests.map(g => (
              <li key={g.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {g.id.slice(1, 3)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-gray-700 dark:text-gray-300">{g.id}</p>
                    <p className="text-[11px] text-gray-400">Flagged {g.flaggedDays} days ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">${g.cost}/mo</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    g.action === 'Ignored'
                      ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {g.action}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Alert preview */}
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/40 rounded-lg flex items-start gap-3">
          <div className="text-yellow-500 mt-0.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">Slack DM alert sent to you</p>
            <p className="text-[11px] text-yellow-700 dark:text-yellow-400 mt-0.5">
              <strong>@alex.morgan</strong> shows no activity in 34 days · $15/month · Deactivate or Ignore?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const errorCode = resolvedSearchParams.error as string | undefined;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center bg-white dark:bg-gray-950">

      <div className="mb-6 flex justify-center">
        <Image
          src="/logo.png"
          alt="Slack Guest Sentinel Logo"
          width={400}
          height={150}
          priority
          className="w-auto h-28 object-contain drop-shadow-md"
        />
      </div>

      {/* Headline */}
      <h1 className="text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 max-w-2xl leading-tight">
        Stop paying for Slack guests who aren&apos;t there
      </h1>
      <p className="text-xl text-gray-500 dark:text-gray-400 max-w-xl mb-8">
        Slack bills you for every guest seat — active or not. Guest Sentinel automatically finds who&apos;s inactive and alerts you before your next billing cycle.
      </p>

      {/* Differentiation bullets */}
      <div className="flex flex-wrap justify-center gap-4 mb-10">
        {[
          { icon: '🔍', text: 'Scans your workspace daily' },
          { icon: '📩', text: 'Sends you a Slack DM alert' },
          { icon: '⚡', text: 'Takes 2 minutes to set up' },
        ].map(({ icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <span>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {errorCode && (
        <div className="mb-8 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 max-w-lg rounded-r-lg text-left" role="alert">
          <p className="font-bold mb-1">Installation failed</p>
          <p className="text-sm">{getErrorMessage(errorCode)}</p>
        </div>
      )}

      {/* CTA */}
      <a
        href="/api/slack/install"
        className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-4 px-8 rounded-xl transition-colors inline-block text-lg shadow-lg shadow-green-200 dark:shadow-green-900/30 mb-4"
      >
        Add to Slack — Free
      </a>
      <p className="text-xs text-gray-400 mb-14">
        7-day free trial · No credit card required · Cancel anytime
      </p>

      {/* Dashboard preview */}
      <div className="w-full max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
          What you&apos;ll see in your dashboard
        </p>
        <DashboardPreview />
      </div>
    </main>
  );
}
