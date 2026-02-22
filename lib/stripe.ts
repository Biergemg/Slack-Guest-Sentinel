/**
 * Stripe client (server-side only).
 *
 * The env module validates STRIPE_SECRET_KEY at startup.
 * This client must NEVER be exposed to the browser.
 */

import Stripe from 'stripe';
import { env } from '@/lib/env';

let _stripe: Stripe;
function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get: (_, prop: string | symbol) => {
    const client = getStripe();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
