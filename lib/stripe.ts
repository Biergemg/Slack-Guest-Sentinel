/**
 * Stripe client (server-side only).
 *
 * The env module validates STRIPE_SECRET_KEY at startup.
 * This client must NEVER be exposed to the browser.
 */

import Stripe from 'stripe';
import { env } from '@/lib/env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});
