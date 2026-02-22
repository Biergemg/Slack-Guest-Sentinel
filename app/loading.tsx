import { Spinner } from '@/components/ui/spinner';

export default function GlobalLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Spinner size="lg" color="blue" />
    </main>
  );
}
