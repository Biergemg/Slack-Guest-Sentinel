'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
