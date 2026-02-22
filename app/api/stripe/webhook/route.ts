import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/db';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    try {
        // 1. Idempotency check to prevent duplicate processing
        const { data: existingEvent } = await supabase
            .from('stripe_events_history')
            .select('stripe_event_id')
            .eq('stripe_event_id', event.id)
            .single();

        if (existingEvent) {
            console.log(`Event ${event.id} already processed.`);
            return NextResponse.json({ received: true });
        }

        // 2. Process event
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const workspaceId = session.client_reference_id;
                const subscriptionId = session.subscription as string;
                const customerId = session.customer as string;

                if (workspaceId) {
                    await supabase.from('subscriptions').upsert({
                        workspace_id: workspaceId,
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        plan: 'pro',
                        status: 'active'
                    }, { onConflict: 'workspace_id' });
                }
                break;
            }
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                // Trialing or Active are both valid states for pro access
                const isActive = subscription.status === 'active' || subscription.status === 'trialing';

                // Fetch by subscription ID since metadata might not always reliably pass on updates
                await supabase.from('subscriptions').update({
                    status: subscription.status,
                    plan: isActive ? 'pro' : 'canceled'
                }).eq('stripe_subscription_id', subscription.id);

                break;
            }
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        // 3. Record idempotency
        await supabase.from('stripe_events_history').insert({
            stripe_event_id: event.id
        });

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("Webhook processing error:", error);
        return new Response("Webhook processing failed", { status: 500 });
    }
}
