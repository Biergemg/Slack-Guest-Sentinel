import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default async function Home({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedSearchParams = await searchParams;
    const errorParam = resolvedSearchParams.error as string | undefined;

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center">
            <div className="mb-6 flex justify-center">
                <Image
                    src="/logo.png"
                    alt="Slack Guest Sentinel Logo"
                    width={400}
                    height={150}
                    priority
                    className="w-auto h-32 object-contain drop-shadow-md"
                />
            </div>
            <h1 className="text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                Slack Guest Sentinel
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
                Stop wasting money on inactive guests. Automatically detect and manage them.
            </p>
            {errorParam && (
                <div className="mt-8 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 max-w-lg mb-4" role="alert">
                    <p className="font-bold">Error during installation</p>
                    <p>Code: {errorParam}</p>
                    <p className="text-sm mt-2">Please check Vercel Logs or your .env configuration.</p>
                </div>
            )}
            <div className="mt-8">
                <a
                    href="/api/slack/install"
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors inline-block"
                >
                    Add to Slack
                </a>
            </div>
        </main>
    );
}
