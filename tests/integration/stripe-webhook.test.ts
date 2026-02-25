import { describe, it, expect } from 'vitest';
import { POST as webhookPost } from '@/app/api/stripe/webhook/route';
import { buildStripeSignature } from '../helpers/fixtures';
import { supabase } from '@/lib/db';
import { seedWorkspace } from '../helpers/db';
import { env } from '@/lib/env';
import { WORKSPACE_IDS } from '../helpers/ids';

describe('Stripe Webhook Integration', () => {

    const sendEvent = async (eventObj: any) => {
        const payload = JSON.stringify(eventObj);
        const signature = buildStripeSignature(payload);

        const req = new Request('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            headers: {
                'stripe-signature': signature,
                'content-type': 'application/json'
            },
            body: payload
        });

        return await webhookPost(req);
    };

    it('rejects missing or invalid signature', async () => {
        const req = new Request('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            body: '{}' // No signature header
        });

        const res = await webhookPost(req);
        expect(res.status).toBe(400);
    });

    it('checkout.session.completed inserts new subscription with correct plan', async () => {
        const workspaceId = WORKSPACE_IDS.WEBHOOK_SUB;
        await seedWorkspace(workspaceId, 'Webhook Tests WS');

        const eventId = 'evt_test_checkout_123';
        const event = {
            id: eventId,
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_123',
                    client_reference_id: workspaceId,
                    customer: 'cus_new_123',
                    // No 'subscription' field — avoids stripe.subscriptions.retrieve call
                    // with mock key (sk_test_mock). Plan is resolved from metadata.
                    metadata: { plan: 'growth' }
                }
            }
        };

        const res = await sendEvent(event);
        expect(res.status).toBe(200);

        // Verify database
        const { data: sub } = await supabase
            .from('subscriptions').select('*').eq('workspace_id', workspaceId).single();
        expect(sub).toBeDefined();
        expect(sub?.plan).toBe('growth');
        expect(sub?.stripe_customer_id).toBe('cus_new_123');

        // Idempotency row should be marked 'processed'
        const { data: log } = await supabase
            .from('stripe_events_history').select('*').eq('stripe_event_id', eventId).single();
        expect(log?.status).toBe('processed');
    });

    it('customer.subscription.updated handles plan downgrades', async () => {
        const workspaceId = WORKSPACE_IDS.WEBHOOK_UPDATE;
        await seedWorkspace(workspaceId, 'Update test');

        // Create the initial subscription via checkout event (no 'subscription' field)
        const initEvent = {
            id: 'evt_init',
            type: 'checkout.session.completed',
            data: {
                object: {
                    client_reference_id: workspaceId,
                    customer: 'cus_update',
                    metadata: { plan: 'growth' }
                }
            }
        };
        await sendEvent(initEvent);

        // Now update event reflecting starter plan
        const updateEvent = {
            id: 'evt_update_active',
            type: 'customer.subscription.updated',
            data: {
                object: {
                    id: 'sub_update',
                    customer: 'cus_update',
                    status: 'active',
                    items: { data: [{ price: { id: env.STRIPE_PRICE_STARTER } }] },
                }
            }
        };

        const res = await sendEvent(updateEvent);
        expect(res.status).toBe(200);

        const { data: sub } = await supabase
            .from('subscriptions').select('*').eq('workspace_id', workspaceId).single();
        expect(sub?.plan).toBe('starter'); // Successfully downgraded
    });

    it('prevents double-execution of identical events (Idempotency)', async () => {
        // Seed a real workspace so the first call succeeds end-to-end
        const workspaceId = WORKSPACE_IDS.WEBHOOK_IDEMPOTENCY;
        await seedWorkspace(workspaceId, 'Idempotency WS');

        const event = {
            id: 'evt_double_test',
            type: 'checkout.session.completed',
            data: {
                object: {
                    client_reference_id: workspaceId,
                    customer: 'cus_idempotent',
                    metadata: { plan: 'starter' }
                }
            }
        };

        const firstRes = await sendEvent(event);
        expect(firstRes.status).toBe(200); // First call succeeds

        const duplicateRes = await sendEvent(event); // Second call → already_processed
        expect(duplicateRes.status).toBe(200);

        // Exactly one history row, marked as processed
        const { data: logs } = await supabase
            .from('stripe_events_history').select('*').eq('stripe_event_id', 'evt_double_test');
        expect(logs?.length).toBe(1);
        expect(logs![0].status).toBe('processed');
    });
});
