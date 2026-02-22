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
import { BILLING, SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from '@/config/constants';
import type { SubscriptionUpsert } from '@/types/database.types';

export class SubscriptionService {
  /**
   * Creates a Stripe Checkout session for a workspace.
   * Returns the URL to redirect the user to.
   */
  async createCheckoutSession(workspaceId: string, workspaceName: string): Promise<string> {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: BILLING.TRIAL_PERIOD_DAYS,
        metadata: { workspaceId },
      },
      client_reference_id: workspaceId,
      customer_creation: 'always',
      success_url: `${env.APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/onboarding?workspaceId=${workspaceId}`,
      metadata: { workspaceId, workspaceName },
    });

    if (!session.url) {
      throw new Error(`Stripe checkout session created without URL for workspace ${workspaceId}`);
    }

    logger.info('Stripe checkout session created', { workspaceId, sessionId: session.id });
    return session.url;
  }

  /**
   * Handles a successful checkout completion.
   * Creates or updates the subscription record for the workspace.
   */
  async handleCheckoutCompleted(workspaceId: string, customerId: string, subscriptionId: string): Promise<void> {
    const data: SubscriptionUpsert = {
      workspace_id: workspaceId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan: SUBSCRIPTION_PLAN.PRO,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    };

    const { error } = await supabase
      .from('subscriptions')
      .upsert(data, { onConflict: 'workspace_id' });

    if (error) {
      logger.error('Failed to upsert subscription on checkout', { workspaceId }, error);
      throw error;
    }

    logger.info('Subscription created from checkout', { workspaceId, subscriptionId });
  }

  /**
   * Syncs subscription state from a Stripe subscription object.
   * Used for both subscription.updated and subscription.deleted events.
   */
  async syncSubscriptionStatus(stripeSubscriptionId: string, status: string): Promise<void> {
    const isActive =
      status === SUBSCRIPTION_STATUS.ACTIVE || status === SUBSCRIPTION_STATUS.TRIALING;

    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: status as typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS],
        plan: isActive ? SUBSCRIPTION_PLAN.PRO : SUBSCRIPTION_PLAN.FREE,
      })
      .eq('stripe_subscription_id', stripeSubscriptionId);

    if (error) {
      logger.error('Failed to sync subscription status', { stripeSubscriptionId, status }, error);
      throw error;
    }

    logger.info('Subscription status synced', { stripeSubscriptionId, status });
  }
}

export const subscriptionService = new SubscriptionService();
