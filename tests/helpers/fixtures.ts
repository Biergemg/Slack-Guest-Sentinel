import crypto from 'crypto';
import { env } from '@/lib/env';

/** Generates a valid Stripe-Signature header matching the secret in .env.test.example */
export function buildStripeSignature(payload: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
        .createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');

    return `t=${timestamp},v1=${signature}`;
}

export function createMockSlackUser(id: string, overrides: Partial<any> = {}) {
    return {
        id,
        name: `mock_user_${id}`,
        deleted: false,
        is_bot: false,
        is_guest: true,
        is_restricted: true,
        is_ultra_restricted: false,
        updated: Math.floor(Date.now() / 1000), // active profile update by default
        profile: {
            email: `${id}@example.com`,
            real_name: `Mock User ${id}`,
        },
        ...overrides,
    };
}

export function createMockSlackUsers(count: number, startIndex: number = 0, overrides: Partial<any> = {}) {
    const users = [];
    for (let i = 0; i < count; i++) {
        users.push(createMockSlackUser(`U_MOCK_${startIndex + i}`, overrides));
    }
    return users;
}
