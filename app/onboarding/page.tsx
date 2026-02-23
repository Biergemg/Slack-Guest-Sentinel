"use client";

import Image from 'next/image';
import { useEffect, useReducer } from 'react';
import { useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
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
  return (
    <div className="w-full text-left animate-in fade-in zoom-in duration-500">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6">
          Scan Complete. Here is your potential waste:
        </h2>
        <div className="flex flex-wrap justify-center gap-6 mb-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm min-w-[160px]">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Guests Detected</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{result.totalGuests}</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/50 shadow-sm min-w-[160px]">
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">Inactive Guests</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{result.inactiveGuests}</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/50 shadow-sm min-w-[160px]">
            <p className="text-green-700 dark:text-green-400 text-sm font-medium">Monthly Waste</p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400 mt-1">${result.monthlyWaste.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {/* Starter */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col bg-white dark:bg-gray-800 shadow-sm relative">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Starter</h3>
          <p className="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">$29<span className="text-lg text-gray-500 font-normal">/mo</span></p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 mb-8 flex-1 space-y-3">
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Up to 500 guest accounts monitored</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Daily background audits</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Admin DM alerts</li>
          </ul>
          <form action="/api/stripe/checkout" method="POST">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="plan" value="starter" />
            <button type="submit" className="w-full cursor-pointer bg-blue-600 hover:bg-blue-700 hover:brightness-95 text-white font-semibold py-3 rounded-lg transition-colors">Start 7-Day Trial</button>
          </form>
        </div>

        {/* Growth */}
        <div className="border-2 border-blue-500 rounded-xl p-6 flex flex-col bg-blue-50/50 dark:bg-blue-900/10 shadow-lg relative transform md:scale-105 z-10">
          <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] tracking-wider uppercase font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">POPULAR</div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Growth</h3>
          <p className="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">$79<span className="text-lg text-gray-500 font-normal">/mo</span></p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 mb-8 flex-1 space-y-3">
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Up to 5,000 guest accounts monitored</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Daily background audits</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Admin DM alerts</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Priority processing</li>
          </ul>
          <form action="/api/stripe/checkout" method="POST">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="plan" value="growth" />
            <button type="submit" className="w-full cursor-pointer bg-blue-600 hover:bg-blue-700 hover:brightness-95 text-white font-bold py-3 rounded-lg shadow-md transition-colors">Start 7-Day Trial</button>
          </form>
        </div>

        {/* Scale */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col bg-white dark:bg-gray-800 shadow-sm relative">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Scale</h3>
          <p className="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">$199<span className="text-lg text-gray-500 font-normal">/mo</span></p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 mb-8 flex-1 space-y-3">
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Unlimited guest accounts monitored</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Daily background audits</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Admin DM alerts</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Custom integrations support</li>
          </ul>
          <form action="/api/stripe/checkout" method="POST">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="plan" value="scale" />
            <button type="submit" className="w-full cursor-pointer bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 hover:brightness-95 text-white font-semibold py-3 rounded-lg transition-colors">Start 7-Day Trial</button>
          </form>
        </div>
      </div>

      <div className="text-center mt-6">
        <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white underline transition-colors">
          Skip trial and continue to Dashboard (Free Plan, manual scans only)
        </a>
      </div>
    </div>
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
        .then(async res => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(body.error ?? `Scan failed (HTTP ${res.status})`);
          }
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

  const isResults = state.phase === 'results';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="mb-6 flex justify-center">
        <Image
          src="/logo.png"
          alt="Slack Guest Sentinel Logo"
          width={240}
          height={80}
          priority
          className="w-auto h-20 object-contain drop-shadow-sm"
        />
      </div>
      <div
        className={`w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center transition-all duration-500 ${isResults ? 'max-w-5xl' : 'max-w-md'
          }`}
      >
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
