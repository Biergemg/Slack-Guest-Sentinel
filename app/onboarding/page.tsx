"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function Onboarding() {
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get('workspaceId');

    const [step, setStep] = useState(1);
    const [scanResult, setScanResult] = useState<{ totalGuests: number, inactiveGuests: number, monthlyWaste: number } | null>(null);

    useEffect(() => {
        if (step === 1 && workspaceId) {
            // Step 1: Connecting workspace... (simulate quick 1.5s delay)
            const t = setTimeout(() => setStep(2), 1500);
            return () => clearTimeout(t);
        }

        if (step === 2 && workspaceId) {
            // Step 2: Scanning guests
            fetch(`/api/slack/onboarding-scan?workspaceId=${workspaceId}`)
                .then(res => res.json())
                .then(data => {
                    setScanResult(data);
                    setStep(3);
                })
                .catch(err => {
                    console.error(err);
                    setStep(3);
                });
        }
    }, [step, workspaceId]);

    if (!workspaceId) {
        return <div className="text-center p-24">Error: Missing workspace ID. Please reinstall from Slack.</div>;
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden p-8 text-center transition-all duration-500">

                {step === 1 && (
                    <div className="animate-pulse">
                        <div className="mx-auto w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Connecting Workspace...</h2>
                        <p className="text-gray-500">Securing oauth tokens and setting up your environment.</p>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-pulse">
                        <div className="mx-auto w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Scanning Guests...</h2>
                        <p className="text-gray-500">Analyzing your directory for inactive guests.</p>
                    </div>
                )}

                {step === 3 && (
                    <div className="animate-fade-in-up">
                        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-6">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Workspace Scan Result</h2>

                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-8 text-left space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 dark:text-gray-300">Total guests detected:</span>
                                <span className="font-bold text-lg dark:text-white">{scanResult?.totalGuests || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-red-500 font-semibold">Inactive guests:</span>
                                <span className="font-bold text-lg text-red-500">{scanResult?.inactiveGuests || 0}</span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-600 my-4 pt-4"></div>
                            <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                                <span className="font-bold">Potential Monthly Waste:</span>
                                <span className="font-bold text-xl">${scanResult?.monthlyWaste?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                                <span className="font-bold">Potential Yearly Waste:</span>
                                <span className="font-bold text-xl">${((scanResult?.monthlyWaste || 0) * 12).toLocaleString()}</span>
                            </div>
                        </div>

                        <p className="text-sm text-gray-500 mb-6">
                            Start your 7-day free trial to automate this cleanup and save money immediately.
                        </p>

                        <form action="/api/stripe/checkout" method="POST">
                            <input type="hidden" name="workspaceId" value={workspaceId!} />
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
                            >
                                Start 7-Day Free Trial
                            </button>
                        </form>
                    </div>
                )}

            </div>
        </main>
    );
}
