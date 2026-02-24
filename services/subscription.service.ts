/**
 * SubscriptionService — manages Stripe subscription state.
 *
 * Encapsulates all Stripe-to-database operations for subscriptions.
 * Called by /api/stripe/webhook and /api/stripe/checkout.
 */

import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { BILLING } from '@/config/constants';

export class SubscriptionService {
  /**
   * Creates a Stripe Checkout session for a workspace.
   * Returns the URL to redirect the user to.
   */
  async createCheckoutSession(workspaceId: string, workspaceName: string, plan: 'starter' | 'growth' | 'scale', origin: string): Promise<string> {
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
      payment_method_collection: 'if_required',
      subscription_data: {
        trial_period_days: BILLING.TRIAL_PERIOD_DAYS,
        metadata: { workspaceId, plan },
      },
      client_reference_id: workspaceId,
      // Use dynamic origin so preview deployments and custom domains work correctly.
      // Using env.APP_URL would redirect users to the wrong domain after checkout.
      success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/onboarding?workspaceId=${workspaceId}`,
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
