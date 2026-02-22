export default function PrivacyPolicy() {
    return (
        <main className="p-12 max-w-3xl mx-auto prose dark:prose-invert text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl font-bold mb-6">Privacy Policy for Slack Guest Sentinel</h1>
            <p className="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

            {/* ── Critical disclosure block (Slack App Review requirement) ── */}
            <div className="font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-5 rounded-lg my-6 space-y-2">
                <p className="text-lg">What we access — and what we do not:</p>
                <ul className="list-disc pl-6 space-y-1 font-normal">
                    <li><strong>We do NOT access, read, or store message content.</strong> We only check whether a message was sent within a time window — we never read what was written.</li>
                    <li><strong>We do NOT access channel content, files, or attachments.</strong></li>
                    <li><strong>We only analyze metadata:</strong> user profile timestamps, presence status, and message send timestamps (not the messages themselves).</li>
                    <li><strong>All analysis is limited to guest accounts</strong> (restricted and ultra-restricted users). We do not analyze full members or admins.</li>
                </ul>
            </div>

            <h2 className="text-xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
            <p className="mb-4">We access the minimum information required to identify inactive guest accounts:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Workspace identity:</strong> Team ID and team name (to associate audit records with the correct workspace).</li>
                <li><strong>Guest user metadata:</strong> User ID, display name, guest tier (single-channel or multi-channel), and the timestamp of the last profile update.</li>
                <li><strong>Presence status:</strong> Whether a guest is currently marked as &quot;active&quot; or &quot;away&quot; in Slack at the time of the daily audit.</li>
                <li><strong>Message send timestamps:</strong> We check whether a guest sent a message within the last 30 days. We read only the timestamp and sender ID — never the message text, attachments, or any other content.</li>
                <li><strong>Billing metadata:</strong> Stripe customer and subscription IDs for managing your subscription.</li>
            </ul>
            <p className="mb-6 text-sm text-gray-500">
                We do not collect: message content, file content, channel names or descriptions, email addresses, phone numbers, or any personally identifiable information beyond Slack user IDs and display names.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. How We Use This Information</h2>
            <p className="mb-4">All collected data is used exclusively to:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Determine which guest accounts have been inactive for 30+ days.</li>
                <li>Generate a monthly waste estimate (inactive guests × seat cost).</li>
                <li>Send DM alerts to the installing admin with a list of flagged guests.</li>
                <li>Display audit history in the dashboard.</li>
            </ul>
            <p className="mb-6">We do not sell, share, or use this data for advertising, profiling, or any purpose outside of the guest audit function described above.</p>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Data Retention</h2>
            <ul className="list-disc pl-6 mb-6 space-y-2">
                <li><strong>Guest audit records:</strong> Retained for a maximum of 90 days. Records older than 90 days are permanently purged automatically.</li>
                <li><strong>Audit run snapshots:</strong> Aggregate counts (total guests, inactive count, estimated waste) are retained for 12 months for trend analysis, then permanently deleted.</li>
                <li><strong>Slack OAuth tokens:</strong> Retained for as long as your workspace has an active subscription. Tokens are encrypted at rest with AES-256-GCM and are never logged.</li>
                <li><strong>Stripe billing data:</strong> Retained in accordance with Stripe&apos;s data retention policy and our legal obligations.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. Data Deletion</h2>
            <p className="mb-4">You can request deletion of your data at any time:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Uninstalling the app</strong> from Slack will immediately invalidate your OAuth tokens. We will permanently delete all associated workspace data within 30 days.</li>
                <li><strong>Canceling your subscription</strong> will stop all future audits. Your data will be retained for 30 days (to allow reactivation) and then permanently deleted.</li>
                <li><strong>Immediate deletion:</strong> Email us at support with &quot;Data Deletion Request&quot; and your Slack Team ID. We will confirm deletion within 5 business days.</li>
            </ul>
            <p className="mb-6">We do not retain backups of deleted data beyond our standard 7-day backup rotation.</p>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. OAuth Scopes and Why We Need Them</h2>
            <table className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded mb-6">
                <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                        <th className="text-left p-3 font-semibold">Scope</th>
                        <th className="text-left p-3 font-semibold">Why we need it</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr>
                        <td className="p-3 font-mono text-xs">users:read</td>
                        <td className="p-3">Fetch the list of guest users and their profile update timestamps.</td>
                    </tr>
                    <tr>
                        <td className="p-3 font-mono text-xs">channels:read</td>
                        <td className="p-3">Identify which public channels a guest belongs to (needed to check message activity).</td>
                    </tr>
                    <tr>
                        <td className="p-3 font-mono text-xs">channels:history</td>
                        <td className="p-3">Check whether a guest sent any message in the last 30 days. We read only sender ID and timestamp — never message content.</td>
                    </tr>
                    <tr>
                        <td className="p-3 font-mono text-xs">chat:write</td>
                        <td className="p-3">Send DM alerts to the workspace admin listing flagged guests.</td>
                    </tr>
                    <tr>
                        <td className="p-3 font-mono text-xs">im:write</td>
                        <td className="p-3">Open the DM channel with the admin before sending the alert.</td>
                    </tr>
                </tbody>
            </table>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Security</h2>
            <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Slack OAuth tokens are encrypted at rest using AES-256-GCM (authenticated encryption).</li>
                <li>All database tables are protected with Row Level Security (RLS) — no cross-tenant data access is possible.</li>
                <li>All Slack webhook requests are verified with HMAC-SHA256 signature validation before processing.</li>
                <li>This application is hosted on Vercel with SOC 2 Type II certified infrastructure.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Changes to This Policy</h2>
            <p className="mb-6">If we make material changes to this policy, we will notify the installing admin via Slack DM at least 14 days before the changes take effect.</p>
        </main>
    )
}
