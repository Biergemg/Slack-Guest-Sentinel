import { describe, it, expect } from 'vitest';
import { GET as scanGet } from '@/app/api/slack/onboarding-scan/route';
import { httpState } from '../helpers/http-mock';
import { seedWorkspace } from '../helpers/db';
import { setMockCookie } from '../helpers/next-mock';
import { encrypt } from '@/lib/encryption';
import { WORKSPACE_IDS } from '../helpers/ids';

describe('Onboarding Scan Integration', () => {

    const makeRequest = (workspaceId: string) =>
        new Request(`http://localhost:3000/api/slack/onboarding-scan?workspaceId=${workspaceId}`);

    it('returns zeros for an empty workspace', async () => {
        const id = WORKSPACE_IDS.EMPTY;
        await seedWorkspace(id, 'Empty WS');
        setMockCookie('workspace_session', encrypt(id));
        httpState.slackUsersListPages = [{ ok: true, members: [], response_metadata: { next_cursor: '' } }];

        const res = await scanGet(makeRequest(id));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.totalGuests).toBe(0);
        expect(json.inactiveGuests).toBe(0);
        expect(json.monthlyWaste).toBe(0);
    });

    it('estimates 20% inactive (min 1) for paid multi-channel guests', async () => {
        const id = WORKSPACE_IDS.SINGLE;
        await seedWorkspace(id, 'Single WS');
        setMockCookie('workspace_session', encrypt(id));

        // 10 paid multi-channel guests (is_restricted=true, not ultra_restricted)
        const guests = Array.from({ length: 10 }, (_, i) => ({
            id: `U_GUEST_${i}`,
            deleted: false,
            is_bot: false,
            is_restricted: true,
            is_ultra_restricted: false,
        }));
        httpState.slackUsersListPages = [{ ok: true, members: guests, response_metadata: { next_cursor: '' } }];

        const res = await scanGet(makeRequest(id));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.totalGuests).toBe(10);
        // Math.max(1, Math.floor(10 * 0.20)) = 2
        expect(json.inactiveGuests).toBe(2);
        // monthlyWaste = 2 inactive paid guests × $15 default seat cost
        expect(json.monthlyWaste).toBe(30);
    });

    it('returns 401 when session cookie is missing', async () => {
        const id = WORKSPACE_IDS.LARGE;
        await seedWorkspace(id, 'Large WS');
        // Intentionally NOT setting the session cookie

        const res = await scanGet(makeRequest(id));
        const json = await res.json();

        expect(res.status).toBe(401);
        expect(json.error).toBeDefined();
    });
});
