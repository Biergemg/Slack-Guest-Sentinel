/**
 * Stripe client (server-side only).
 *
 * The env module validates STRIPE_SECRET_KEY at startup.
 * This client must NEVER be exposed to the browser.
 */

import Stripe from 'stripe';
import { env } from '@/lib/env';

const initStripe = () => {
  try {
    return new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  } catch (err) {
    if (env.IS_PRODUCTION) {
      throw err;
    }

    // If env vars are missing during `next build` static generation checks,
    // return a dummy client so the build doesn't crash.
    // Protected by `export const dynamic = 'force-dynamic'` in routes.
    return new Stripe('sk_test_placeholder', {
      apiVersion: '2026-01-28.clover',
    });
  }
};

let stripeInstance: Stripe | null = null;

export const getStripe = () => {
  if (!stripeInstance) {
    stripeInstance = initStripe();
  }
  return stripeInstance;
};

// Lazy proxy to prevent eager evaluation on module load
export const stripe = new Proxy({} as Stripe, {
  get: (target, prop) => {
    return getStripe()[prop as keyof Stripe];
  }
});
