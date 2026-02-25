import { describe, it, expect } from 'vitest';
import { POST as runAudit } from '@/app/api/internal/audit/route';
import { httpState } from '../helpers/http-mock';
import { supabase } from '@/lib/db';
import { seedWorkspace, seedSubscription } from '../helpers/db';
import { createMockSlackUsers } from '../helpers/fixtures';
import { env } from '@/lib/env';
import { WORKSPACE_IDS } from '../helpers/ids';

describe('Audit Cron Integration', () => {

    const triggerCron = async () => {
        const req = new Request('http://localhost:3000/api/internal/audit', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.CRON_SECRET}` }
        });
        return await runAudit(req);
    };

    it('rejects unauthorized requests', async () => {
        const req = new Request('http://localhost:3000/api/internal/audit', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer bad-secret' }
        });
        const res = await runAudit(req);
        expect(res.status).toBe(401);
    });

    it('processes 0 guests correctly', async () => {
        await seedWorkspace(WORKSPACE_IDS.AUDIT_EMPTY, 'Audit Empty');
        await seedSubscription(WORKSPACE_IDS.AUDIT_EMPTY, 'starter');

        httpState.slackUsersListPages = [{ ok: true, members: [] }];

        const res = await triggerCron();
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.ok).toBe(true);
        expect(json.audited).toBe(1);
        expect(json.flagged).toBe(0);
    });

    it('flags 1 inactive guest and sends DM alert to admin', async () => {
        await seedWorkspace(WORKSPACE_IDS.AUDIT_SINGLE, 'Audit Single');
        await seedSubscription(WORKSPACE_IDS.AUDIT_SINGLE, 'starter');

        const guest = createMockSlackUsers(1, 0, { updated: 0 })[0]; // Never updated
        httpState.slackUsersListPages = [{ ok: true, members: [guest] }];
        httpState.slackPresenceResponses[guest.id] = 'away';
        httpState.slackHistoryHasMessages[guest.id] = false;

        const res = await triggerCron();
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.flagged).toBe(1);

        // DM is sent to the admin (installed_by = 'U12345678'), not the guest
        // conversations.open({ users: 'U12345678' }) → channel.id = 'DM_U12345678'
        expect(httpState.postMessageCalls.length).toBe(1);
        expect(httpState.postMessageCalls[0].channel).toBe('DM_U12345678');

        // Verify Database has the audit row
        const { data: dbAudit } = await supabase
            .from('guest_audits').select('*').eq('workspace_id', WORKSPACE_IDS.AUDIT_SINGLE);
        expect(dbAudit?.length).toBe(1);
        expect(dbAudit![0].is_flagged).toBe(true);
    });

    it('recovers from Slack rate limits (HTTP 429)', async () => {
        await seedWorkspace(WORKSPACE_IDS.RATE_LIMIT, 'Rate Limit WS');
        await seedSubscription(WORKSPACE_IDS.RATE_LIMIT, 'starter');

        const guest = createMockSlackUsers(1, 0, { updated: 0 })[0];
        httpState.slackUsersListPages = [{ ok: true, members: [guest] }];
        httpState.slackPresenceResponses[guest.id] = 'away';
        httpState.slackHistoryHasMessages[guest.id] = false;

        // Force a rate limit on the first call (could be users.list or presence)
        // delay() sleeps for 1s on 429 — acceptable within the 15s test timeout.
        httpState.slackRateLimitCount = 1;

        const start = Date.now();
        const res = await triggerCron();
        const json = await res.json();
        const duration = Date.now() - start;

        expect(res.status).toBe(200);
        expect(json.flagged).toBe(1);

        // Ensure backoff delay was actually hit (delay() sleeps for 1sec on 429)
        expect(duration).toBeGreaterThan(500);
    });

    it('handles large workspace (500 guests) with batching and pagination', async () => {
        await seedWorkspace(WORKSPACE_IDS.AUDIT_LARGE, 'Large Audit WS');
        await seedSubscription(WORKSPACE_IDS.AUDIT_LARGE, 'scale');

        const guests = createMockSlackUsers(500, 0, { updated: 0 }); // 500 inactive guests

        // Serve 5 pages of 100
        httpState.slackUsersListPages = [
            { ok: true, members: guests.slice(0, 100), response_metadata: { next_cursor: 'page1' } },
            { ok: true, members: guests.slice(100, 200), response_metadata: { next_cursor: 'page2' } },
            { ok: true, members: guests.slice(200, 300), response_metadata: { next_cursor: 'page3' } },
            { ok: true, members: guests.slice(300, 400), response_metadata: { next_cursor: 'page4' } },
            { ok: true, members: guests.slice(400, 500), response_metadata: { next_cursor: '' } }, // final
        ];

        for (const guest of guests) {
            httpState.slackPresenceResponses[guest.id] = 'away';
            httpState.slackHistoryHasMessages[guest.id] = false;
        }

        const res = await triggerCron();
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.audited).toBe(1);
        expect(json.flagged).toBe(500);

        // Verify Database
        const { count } = await supabase.from('guest_audits')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', WORKSPACE_IDS.AUDIT_LARGE);

        expect(count).toBe(500);

        // 500 DMs to the admin (one per inactive guest)
        expect(httpState.postMessageCalls.length).toBe(500);
    });
});
