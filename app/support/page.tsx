export default function Support() {
    return (
        <main className="p-12 max-w-3xl mx-auto prose dark:prose-invert text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl font-bold mb-6">Support</h1>
            <p className="text-lg mb-6">If you are experiencing issues with Slack Guest Sentinel, have questions about your billing, or need to request complete data deletion, please contact our dedicated support team:</p>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg mb-8 border border-blue-100 dark:border-blue-800">
                <p className="font-medium text-blue-800 dark:text-blue-300">Email us at:</p>
                <a href="mailto:support@slackguestsentinel.com" className="text-2xl font-bold text-blue-600 dark:text-blue-400 hover:underline">
                    support@slackguestsentinel.com
                </a>
            </div>

            <p className="text-gray-600 dark:text-gray-400">We typically respond to all inquiries within 24 business hours.</p>
        </main>
    )
}
