import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-8xl font-bold text-gray-200 dark:text-gray-700 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-2">
          Page not found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
