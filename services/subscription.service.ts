/**
 * SubscriptionService — manages Stripe subscription state.
 *
 * Encapsulates all Stripe-to-database operations for subscriptions.
 * Called by /api/stripe/webhook and /api/stripe/checkout.
 */

import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { BILLING } from '@/config/constants';

export class SubscriptionService {
  /**
   * Creates a Stripe Checkout session for a workspace.
   * Returns the URL to redirect the user to.
   */
  async createCheckoutSession(workspaceId: string, workspaceName: string, plan: 'starter' | 'growth' | 'scale'): Promise<string> {
    const priceId =
      plan === 'starter' ? env.STRIPE_PRICE_STARTER :
        plan === 'growth' ? env.STRIPE_PRICE_GROWTH :
          env.STRIPE_PRICE_SCALE;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: BILLING.TRIAL_PERIOD_DAYS,
        metadata: { workspaceId, plan },
      },
      client_reference_id: workspaceId,
      success_url: `${env.APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/onboarding?workspaceId=${workspaceId}`,
      metadata: { workspaceId, workspaceName, plan },
    });

    if (!session.url) {
      throw new Error(`Stripe checkout session created without URL for workspace ${workspaceId}`);
    }

    logger.info('Stripe checkout session created', { workspaceId, sessionId: session.id, plan });
    return session.url;
  }

  /**
   * Creates a Stripe Customer Portal session for an existing subscriber.
   * Returns the URL to redirect the user to.
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    logger.info('Stripe portal session created', { customerId });
    return session.url;
  }
}

export const subscriptionService = new SubscriptionService();
