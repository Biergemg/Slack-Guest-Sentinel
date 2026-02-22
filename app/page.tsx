export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
            <h1 className="text-4xl font-bold mb-4">Slack Guest Sentinel</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
                Stop wasting money on inactive guests. Automatically detect and manage them.
            </p>
            <div className="mt-8">
                <a
                    href="/api/slack/install"
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                    Add to Slack
                </a>
            </div>
        </main>
    );
}
