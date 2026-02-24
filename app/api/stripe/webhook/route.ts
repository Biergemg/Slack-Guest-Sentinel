export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { SUBSCRIPTION_STATUS } from '@/config/constants';
import type Stripe from 'stripe';
import type { SubscriptionPlan } from '@/types/database.types';

/**
 * Processes Stripe webhook events.
 *
 * Security: All events are verified via Stripe signature before processing.
 *
 * Idempotency:
 *   - Event is claimed with status=processing
 *   - On success: status=processed
 *   - On failure: status=failed (allows safe reprocessing on retry)
 */

type EventClaimResult = 'claimed' | 'already_processed' | 'in_flight';
type StripeEventStatus = 'processing' | 'processed' | 'failed';

interface StripeEventHistoryRow {
  status: StripeEventStatus;
  attempts: number | null;
  updated_at: string | null;
}

const PROCESSING_STALE_MS = 10 * 60 * 1000;

function mapPriceIdToPlan(priceId: string | null | undefined): SubscriptionPlan | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === env.STRIPE_PRICE_GROWTH) return 'growth';
  if (priceId === env.STRIPE_PRICE_SCALE) return 'scale';
  return null;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function claimStripeEvent(eventId: string): Promise<EventClaimResult> {
  const nowIso = new Date().toISOString();

  const { error: insertError } = await supabase
    .from('stripe_events_history')
    .insert({
      stripe_event_id: eventId,
      status: 'processing',
      attempts: 1,
      last_error: null,
      processed_at: null,
      updated_at: nowIso,
    });

  if (!insertError) {
    return 'claimed';
  }

  if (insertError.code !== '23505') {
    throw new Error(`Failed to claim Stripe event ${eventId}: ${insertError.message}`);
  }

  const { data, error: fetchError } = await supabase
    .from('stripe_events_history')
    .select('status, attempts, updated_at')
    .eq('stripe_event_id', eventId)
    .single();

  if (fetchError || !data) {
    throw new Error(
      `Failed to load existing Stripe event ${eventId}: ${fetchError?.message ?? 'not found'}`
    );
  }

  const existing = data as StripeEventHistoryRow;

  if (existing.status === 'processed') {
    return 'already_processed';
  }

  const updatedAtMs = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
  const staleProcessing =
    existing.status === 'processing' &&
    Number.isFinite(updatedAtMs) &&
    Date.now() - updatedAtMs > PROCESSING_STALE_MS;

  if (existing.status === 'failed' || staleProcessing) {
    const { error: reclaimError } = await supabase
      .from('stripe_events_history')
      .update({
        status: 'processing',
        attempts: (existing.attempts ?? 0) + 1,
        last_error: null,
        processed_at: null,
        updated_at: nowIso,
      })
      .eq('stripe_event_id', eventId);

    if (reclaimError) {
      throw new Error(`Failed to reclaim Stripe event ${eventId}: ${reclaimError.message}`);
    }

    logger.info('Reclaimed Stripe event for retry', {
      eventId,
      previousStatus: existing.status,
      previousUpdatedAt: existing.updated_at,
    });
    return 'claimed';
  }

  return 'in_flight';
}

async function markStripeEventProcessed(eventId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('stripe_events_history')
    .update({
      status: 'processed',
      last_error: null,
      processed_at: nowIso,
      updated_at: nowIso,
    })
    .eq('stripe_event_id', eventId);

  if (error) {
    throw new Error(`Failed to mark Stripe event as processed: ${error.message}`);
  }
}

async function markStripeEventFailed(eventId: string, err: unknown): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('stripe_events_history')
    .update({
      status: 'failed',
      last_error: toErrorMessage(err).slice(0, 500),
      updated_at: nowIso,
    })
    .eq('stripe_event_id', eventId);

  if (error) {
    logger.error('Failed to mark Stripe event as failed', { eventId }, error);
  }
}

async function resolveCheckoutPlan(
  session: Stripe.Checkout.Session,
  subscriptionId: string | null
): Promise<SubscriptionPlan> {
  const VALID_PAID_PLANS: SubscriptionPlan[] = ['starter', 'growth', 'scale'];
  const rawPlan = session.metadata?.plan ?? '';

  if (VALID_PAID_PLANS.includes(rawPlan as SubscriptionPlan)) {
    return rawPlan as SubscriptionPlan;
  }

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const planFromPrice = mapPriceIdToPlan(subscription.items.data[0]?.price.id);
    if (planFromPrice) {
      logger.warn('Checkout missing/invalid metadata plan, recovered from price ID', {
        sessionId: session.id,
        subscriptionId,
        rawPlan,
      });
      return planFromPrice;
    }
  }

  logger.warn('Checkout missing/invalid metadata plan, defaulting to starter', {
    sessionId: session.id,
    subscriptionId,
    rawPlan,
  });
  return 'starter';
}

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

  let claimResult: EventClaimResult;
  try {
    claimResult = await claimStripeEvent(event.id);
  } catch (err) {
    logger.error('Failed to claim Stripe event', { eventId: event.id }, err);
    return new Response('Database error', { status: 500 });
  }

  if (claimResult === 'already_processed') {
    logger.info('Stripe event already processed, skipping', { eventId: event.id });
    return NextResponse.json({ received: true });
  }

  if (claimResult === 'in_flight') {
    logger.info('Stripe event currently processing, skipping duplicate delivery', {
      eventId: event.id,
    });
    return new Response('Conflict - already processing', { status: 409 });
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

        if (!workspaceId) {
          logger.warn('checkout.session.completed missing client_reference_id', {
            sessionId: session.id,
          });
          break;
        }

        const plan = await resolveCheckoutPlan(session, subscriptionId);

        // Read the actual Stripe subscription status (may be 'trialing' when
        // trial_period_days is configured, not 'active'). Hardcoding 'active'
        // would misrepresent the subscription state in the DB.
        let actualStatus: string = SUBSCRIPTION_STATUS.ACTIVE;
        if (subscriptionId) {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          actualStatus = stripeSubscription.status;
        }

        // 1. Update subscription mapping
        const { error: upsertError } = await supabase
          .from('subscriptions')
          .upsert(
            {
              workspace_id: workspaceId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan,
              status: actualStatus,
            },
            { onConflict: 'workspace_id' }
          );

        if (upsertError) {
          throw new Error(`Failed to upsert subscription: ${upsertError.message}`);
        }

        logger.info('Subscription created', { workspaceId, subscriptionId, plan });
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const isActive =
          subscription.status === SUBSCRIPTION_STATUS.ACTIVE ||
          subscription.status === SUBSCRIPTION_STATUS.TRIALING;

        const priceId = subscription.items.data[0]?.price.id ?? null;
        const planFromPrice = mapPriceIdToPlan(priceId);

        if (isActive && !planFromPrice) {
          throw new Error(
            `Unknown Stripe price ID for active subscription ${subscription.id}: ${priceId ?? 'null'}`
          );
        }

        const planName: SubscriptionPlan = isActive ? (planFromPrice as SubscriptionPlan) : 'free';

        // Let's resolve workspaceId first
        let workspaceId: string | null = subscription.metadata?.workspaceId ?? null;

        if (!workspaceId && typeof subscription.customer === 'string') {
          const { data: customerLookup, error: customerLookupError } = await supabase
            .from('subscriptions')
            .select('workspace_id')
            .eq('stripe_customer_id', subscription.customer)
            .maybeSingle();

          if (customerLookupError) {
            throw new Error(`Failed to resolve workspace by customer ID: ${customerLookupError.message}`);
          }

          workspaceId = customerLookup?.workspace_id ?? null;
        }

        if (!workspaceId) {
          logger.warn('Subscription event could not resolve workspace ID', {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            eventType: event.type,
          });
          break;
        }

        // Upsert ensures we catch updates even if checkout.session.completed 
        // hasn't successfully stored the subscription map yet.
        const { error: upsertError } = await supabase
          .from('subscriptions')
          .upsert(
            {
              workspace_id: workspaceId,
              stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
              stripe_subscription_id: subscription.id,
              plan: planName,
              status: subscription.status,
            },
            { onConflict: 'workspace_id' }
          );

        if (upsertError) {
          throw new Error(`Failed to upsert subscription status: ${upsertError.message}`);
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

    await markStripeEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    await markStripeEventFailed(event.id, err);
    logger.error('Stripe webhook processing error', { eventId: event.id, type: event.type }, err);
    // Return 500 so Stripe retries delivery.
    return new Response('Processing failed', { status: 500 });
  }
}
