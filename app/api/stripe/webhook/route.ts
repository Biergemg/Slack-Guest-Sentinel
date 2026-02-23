export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from '@/config/constants';
import type Stripe from 'stripe';

/**
 * Processes Stripe webhook events.
 *
 * Security: All events are verified via Stripe signature before processing.
 *
 * Idempotency: Uses INSERT-first pattern with unique constraint.
 * The event is claimed atomically before processing — a unique constraint
 * violation means another request already processed this event, so we skip.
 * This eliminates the race condition in the previous SELECT-then-INSERT pattern.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing Stripe signature', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', {}, err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Claim the event atomically BEFORE processing (INSERT-first idempotency)
  const { error: insertError } = await supabase
    .from('stripe_events_history')
    .insert({ stripe_event_id: event.id });

  if (insertError) {
    // Postgres unique constraint violation (code 23505) = already processed
    if (insertError.code === '23505') {
      logger.info('Stripe event already processed, skipping', { eventId: event.id });
      return NextResponse.json({ received: true });
    }
    logger.error('Failed to claim Stripe event', { eventId: event.id }, insertError);
    return new Response('Database error', { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.client_reference_id;
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : null;
        const customerId =
          typeof session.customer === 'string' ? session.customer : null;

        const plan = session.metadata?.plan || 'starter';

        if (!workspaceId) {
          logger.warn('checkout.session.completed missing client_reference_id', {
            sessionId: session.id,
          });
          break;
        }

        // 1. Update subscription mapping
        await supabase
          .from('subscriptions')
          .upsert(
            {
              workspace_id: workspaceId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: plan as any,
              status: SUBSCRIPTION_STATUS.ACTIVE,
            },
            { onConflict: 'workspace_id' }
          );

        // 2. Cascade plan_type to workspace
        await supabase
          .from('workspaces')
          .update({ plan_type: plan as any })
          .eq('id', workspaceId);

        logger.info('Subscription created', { workspaceId, subscriptionId, plan });
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const isActive =
          subscription.status === SUBSCRIPTION_STATUS.ACTIVE ||
          subscription.status === SUBSCRIPTION_STATUS.TRIALING;

        const priceId = subscription.items.data[0]?.price.id;
        let planName = 'free';

        if (isActive) {
          if (priceId === env.STRIPE_PRICE_STARTER) planName = 'starter';
          else if (priceId === env.STRIPE_PRICE_GROWTH) planName = 'growth';
          else if (priceId === env.STRIPE_PRICE_SCALE) planName = 'scale';
          else planName = 'starter'; // fallback
        }

        const workspaceId = subscription.metadata?.workspaceId;

        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            plan: planName as any,
          })
          .eq('stripe_subscription_id', subscription.id);

        if (workspaceId) {
          await supabase
            .from('workspaces')
            .update({ plan_type: planName as any })
            .eq('id', workspaceId);
        }

        logger.info('Subscription updated', {
          subscriptionId: subscription.id,
          status: subscription.status,
          plan: planName,
          workspaceId
        });
        break;
      }

      default:
        logger.debug('Unhandled Stripe event type', { type: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook processing error', { eventId: event.id, type: event.type }, err);
    // Return 500 so Stripe retries — the idempotency claim ensures
    // that a successful retry won't double-process the event.
    return new Response('Processing failed', { status: 500 });
  }
}
