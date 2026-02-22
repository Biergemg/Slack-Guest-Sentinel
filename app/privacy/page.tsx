export default function PrivacyPolicy() {
    return (
        <main className="p-12 max-w-3xl mx-auto prose dark:prose-invert text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl font-bold mb-6">Privacy Policy for Slack Guest Sentinel</h1>
            <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

            <h2 className="text-xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
            <p className="mb-4">We access minimal information required to perform guest audits to save your workspace money:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Workspace basic info (Team ID, Name)</li>
                <li>User profile metadata (Presence status, Profile updated timestamp, Guest tier status)</li>
            </ul>
            <p className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg my-6">
                Important: We do NOT read or store the contents of your messages, channels, or files.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Data Retention & Deletion</h2>
            <p className="mb-4">All guest audit records are strictly retained for a maximum of 90 days. After 90 days, historical audit records are permanently purged to comply with data minimization principles.</p>
            <p className="mb-6">If you cancel your subscription or uninstall the app, you may request immediate and unconditional data deletion via our support email.</p>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Security Standards</h2>
            <p className="mb-4">All Slack integration tokens are encrypted at rest using AES-256 encryption. Our database is secured with strict Row Level Security (RLS) policies, preventing unauthorized cross-tenant data access.</p>
        </main>
    )
}
