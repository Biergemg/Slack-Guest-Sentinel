import { describe, it, expect } from 'vitest';
import { GET as oauthCallbackGet } from '@/app/api/slack/callback/route';
import { supabase } from '@/lib/db';
import { httpState } from '../helpers/http-mock';
import { setMockCookie } from '../helpers/next-mock';
import { decrypt } from '@/lib/encryption';

describe('OAuth Callback Integration', () => {

    it('exchanges code for token, stores encrypted token, and provisions workspace', async () => {
        // Given mocked Slack OAuth response
        httpState.slackOauthResponse = {
            ok: true,
            team: { id: 'T_INTEGRATION', name: 'Integration Workspace' },
            authed_user: { id: 'U_ADMIN', access_token: 'xoxp-integration-test-token' },
        };

        const stateCookie = 'random-oauth-state';
        // Set the CSRF state cookie via the mock (route reads from next/headers cookies)
        setMockCookie('slack_oauth_state', stateCookie);

        const req = new Request(`http://localhost:3000/api/slack/callback?code=fake-code&state=${stateCookie}`);

        // Execute Callback
        const res = await oauthCallbackGet(req);

        // Expect Redirect to Onboarding
        expect(res.status).toBe(307);
        const location = res.headers.get('location');
        expect(location).toContain('/onboarding');

        // Extract the workspace ID from the redirect
        const url = new URL(location || '', 'http://localhost:3000');
        const workspaceId = url.searchParams.get('workspaceId');
        expect(workspaceId).toBeTruthy();

        // Expect Database to contain the workspace
        const { data: workspace } = await supabase
            .from('workspaces')
            .select('*')
            .eq('id', workspaceId)
            .single();

        expect(workspace).toBeDefined();
        expect(workspace?.team_name).toBe('Integration Workspace');

        // Expect token to be encrypted properly
        expect(workspace?.access_token).toBeDefined();
        expect(workspace?.access_token).not.toBe('xoxp-integration-test-token'); // Not stored in plaintext

        // Expect decryption to yield original token
        const decrypted = decrypt(workspace?.access_token!);
        expect(decrypted).toBe('xoxp-integration-test-token');
    });

    it('rejects missing or mismatched OAuth state (CSRF Protection)', async () => {
        // Set a different state in the cookie than what's in the URL query param
        setMockCookie('slack_oauth_state', 'real-state');

        const req = new Request('http://localhost:3000/api/slack/callback?code=fake-code&state=hacker-state');

        const res = await oauthCallbackGet(req);

        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('error=state_mismatch');
    });
});
