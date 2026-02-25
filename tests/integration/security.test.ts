import { describe, it, expect } from 'vitest';
import { encrypt } from '@/lib/encryption';
import { seedWorkspace } from '../helpers/db';
import { setMockCookie } from '../helpers/next-mock';
import { POST as checkoutPost } from '@/app/api/stripe/checkout/route';
import { WORKSPACE_IDS } from '../helpers/ids';

describe('Security & Auth Integration', () => {

    // Builds a POST request to /api/stripe/checkout.
    // Cookie is set via setMockCookie (read by next/headers mock) — not via headers.
    const makeRequest = (workspaceId: string) => {
        const formData = new FormData();
        formData.append('workspaceId', workspaceId);
        formData.append('plan', 'starter');

        return new Request('http://localhost:3000/api/stripe/checkout', {
            method: 'POST',
            body: formData,
        });
    };

    it('rejects missing cookie with 307 unauthorized redirect', async () => {
        // No setMockCookie call → cookie is absent
        const res = await checkoutPost(makeRequest(WORKSPACE_IDS.SECURITY_VALID));

        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('error=unauthorized');
    });

    it('rejects tampered or corrupt cookie', async () => {
        // This is not a valid AES-GCM format
        setMockCookie('workspace_session', 'corrupt:format:data');
        const res = await checkoutPost(makeRequest(WORKSPACE_IDS.SECURITY_VALID));

        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('error=unauthorized');
    });

    it('rejects valid crypto token but non-existent workspace in DB', async () => {
        // Crypto logic passes, but DB lookup fails — NONEXISTENT is a valid UUID with no DB row
        setMockCookie('workspace_session', encrypt(WORKSPACE_IDS.NONEXISTENT));
        const res = await checkoutPost(makeRequest(WORKSPACE_IDS.NONEXISTENT));

        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('error=invalid_workspace');
    });

    it('rejects mismatched form submission vs session cookie', async () => {
        await seedWorkspace(WORKSPACE_IDS.SECURITY_VALID, 'Test Workspace');

        // Cookie identifies workspaceId A, but form submits workspaceId B
        setMockCookie('workspace_session', encrypt(WORKSPACE_IDS.SECURITY_VALID));
        const res = await checkoutPost(makeRequest('some-other-workspace'));

        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('error=unauthorized');
    });
});
