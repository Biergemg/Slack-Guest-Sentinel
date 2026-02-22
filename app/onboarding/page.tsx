"use client";

import { useEffect, useReducer } from 'react';
import { useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { BILLING } from '@/config/constants';
import type { OnboardingScanResult } from '@/types/api.types';

// ---------------------------------------------------------------------------
// State machine — explicit states and transitions (replaces multiple useEffects)
// ---------------------------------------------------------------------------

type OnboardingState =
  | { phase: 'connecting' }
  | { phase: 'scanning' }
  | { phase: 'results'; result: OnboardingScanResult }
  | { phase: 'error'; message: string };

type OnboardingAction =
  | { type: 'START_SCAN' }
  | { type: 'SCAN_SUCCESS'; result: OnboardingScanResult }
  | { type: 'SCAN_ERROR'; message: string };

function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'START_SCAN':
      return { phase: 'scanning' };
    case 'SCAN_SUCCESS':
      return { phase: 'results', result: action.result };
    case 'SCAN_ERROR':
      return { phase: 'error', message: action.message };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Step sub-components
// ---------------------------------------------------------------------------

function ConnectingStep() {
  return (
    <>
      <div className="flex justify-center mb-6">
        <Spinner size="lg" color="blue" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        Connecting Workspace...
      </h2>
      <p className="text-gray-500">Securing OAuth tokens and setting up your environment.</p>
    </>
  );
}

function ScanningStep() {
  return (
    <>
      <div className="flex justify-center mb-6">
        <Spinner size="lg" color="yellow" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        Scanning Guests...
      </h2>
      <p className="text-gray-500">Analyzing your directory for inactive guests.</p>
    </>
  );
}

function ResultsStep({
  result,
  workspaceId,
}: {
  result: OnboardingScanResult;
  workspaceId: string;
}) {
  const yearlyWaste = result.monthlyWaste * 12;

  return (
    <>
      <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
        <svg
          className="w-8 h-8 text-green-600 dark:text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
        Workspace Scan Complete
      </h2>

      <dl className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-8 text-left space-y-4">
        <div className="flex justify-between items-center">
          <dt className="text-gray-600 dark:text-gray-300">Total guests detected</dt>
          <dd className="font-bold text-lg dark:text-white">{result.totalGuests}</dd>
        </div>
        <div className="flex justify-between items-center">
          <dt className="text-red-500 font-semibold">Inactive guests</dt>
          <dd className="font-bold text-lg text-red-500">{result.inactiveGuests}</dd>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-600 pt-4 space-y-2">
          <div className="flex justify-between items-center text-red-600 dark:text-red-400">
            <dt className="font-bold">Potential Monthly Waste</dt>
            <dd className="font-bold text-xl">${result.monthlyWaste.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between items-center text-red-600 dark:text-red-400">
            <dt className="font-bold">Potential Yearly Waste</dt>
            <dd className="font-bold text-xl">${yearlyWaste.toLocaleString()}</dd>
          </div>
        </div>
      </dl>

      <p className="text-sm text-gray-500 mb-6">
        Start your {BILLING.TRIAL_PERIOD_DAYS}-day free trial to automate this cleanup and save
        money immediately.
      </p>

      <form action="/api/stripe/checkout" method="POST">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
        >
          Start {BILLING.TRIAL_PERIOD_DAYS}-Day Free Trial
        </button>
      </form>
    </>
  );
}

function ErrorStep({ message }: { message: string }) {
  return (
    <>
      <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
        <svg
          className="w-8 h-8 text-red-600 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Scan Failed</h2>
      <p className="text-gray-500 mb-6">{message}</p>
      <a
        href="/api/slack/install"
        className="inline-block text-blue-600 hover:underline text-sm"
      >
        Reinstall from Slack
      </a>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CONNECT_DELAY_MS = 1500;

export default function Onboarding() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspaceId');
  const [state, dispatch] = useReducer(reducer, { phase: 'connecting' });

  useEffect(() => {
    if (!workspaceId) return;

    // Step 1: Show connecting animation for 1.5s, then start scan
    const connectTimer = setTimeout(() => {
      dispatch({ type: 'START_SCAN' });

      fetch(`/api/slack/onboarding-scan?workspaceId=${workspaceId}`)
        .then(res => {
          if (!res.ok) throw new Error(`Scan request failed: HTTP ${res.status}`);
          return res.json() as Promise<OnboardingScanResult>;
        })
        .then(result => dispatch({ type: 'SCAN_SUCCESS', result }))
        .catch((err: Error) =>
          dispatch({ type: 'SCAN_ERROR', message: err.message ?? 'An unexpected error occurred.' })
        );
    }, CONNECT_DELAY_MS);

    return () => clearTimeout(connectTimer);
  }, [workspaceId]);

  if (!workspaceId) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-gray-600 dark:text-gray-400">
          Error: Missing workspace ID. Please{' '}
          <a href="/api/slack/install" className="text-blue-600 hover:underline">
            reinstall from Slack
          </a>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 text-center">
        {state.phase === 'connecting' && <ConnectingStep />}
        {state.phase === 'scanning' && <ScanningStep />}
        {state.phase === 'results' && (
          <ResultsStep result={state.result} workspaceId={workspaceId} />
        )}
        {state.phase === 'error' && <ErrorStep message={state.message} />}
      </div>
    </main>
  );
}
