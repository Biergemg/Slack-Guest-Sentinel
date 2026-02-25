import { vi } from 'vitest';

export type MockFetchState = {
    slackRateLimitCount: number;
    slackUsersListPages: any[];
    slackPresenceResponses: Record<string, 'active' | 'away'>;
    slackHistoryHasMessages: Record<string, boolean>;
    slackOauthResponse: any;
    postMessageCalls: any[];
};

export const httpState: MockFetchState = {
    slackRateLimitCount: 0,
    slackUsersListPages: [],
    slackPresenceResponses: {},
    slackHistoryHasMessages: {},
    slackOauthResponse: null,
    postMessageCalls: [],
};

let originalFetch: typeof global.fetch;

export function enableHttpMock() {
    originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = input.toString();

        // Intercept Slack HTTP requests
        if (urlStr.startsWith('https://slack.com/api/')) {
            const route = urlStr.replace('https://slack.com/api/', '');

            // 1. Rate Limit Simulation (429 Too Many Requests)
            if (httpState.slackRateLimitCount > 0) {
                httpState.slackRateLimitCount--;
                return new Response('Rate limited', {
                    status: 429,
                    headers: { 'Retry-After': '1' }
                });
            }

            let bodyParsed: any = {};
            if (init?.body && typeof init.body === 'string') {
                try { bodyParsed = JSON.parse(init.body); } catch { }
            }

            // 2. Endpoint Routing
            // Strip query params so "users.list?limit=200" matches case "users.list"
            switch (route.split('?')[0]) {
                case 'oauth.v2.access':
                    return Response.json(httpState.slackOauthResponse || {
                        ok: true,
                        team: { id: 'T_TEST', name: 'Test Workspace' },
                        authed_user: { id: 'U_ADMIN', access_token: 'xoxp-mock' }
                    });

                case 'users.list': {
                    const page = httpState.slackUsersListPages.shift();
                    if (page) return Response.json(page);
                    return Response.json({ ok: true, members: [], response_metadata: { next_cursor: '' } });
                }

                case 'users.getPresence': {
                    const userId = bodyParsed.user || new URL(urlStr).searchParams.get('user') || '';
                    const presence = httpState.slackPresenceResponses[userId] || 'away';
                    return Response.json({ ok: true, presence });
                }

                case 'conversations.history':
                    return Response.json({
                        ok: true,
                        messages: httpState.slackHistoryHasMessages[bodyParsed.user] ? [{ text: 'mock' }] : []
                    });

                case 'conversations.open': {
                    const users = bodyParsed.users ?? '';
                    return Response.json({ ok: true, channel: { id: `DM_${users}` } });
                }

                case 'chat.postMessage':
                    httpState.postMessageCalls.push(bodyParsed);
                    return Response.json({ ok: true });

                case 'users.lookupByEmail':
                    return Response.json({ ok: true, user: { id: 'U_TEST_SPONSOR' } });

                default:
                    return Response.json({ ok: true });
            }
        }

        // Fall back to actual network for everything else (or throw error if strict)
        return originalFetch(input, init);
    });
}

export function resetHttpMock() {
    httpState.slackRateLimitCount = 0;
    httpState.slackUsersListPages = [];
    httpState.slackPresenceResponses = {};
    httpState.slackHistoryHasMessages = {};
    httpState.slackOauthResponse = null;
    httpState.postMessageCalls = [];
}

export function disableHttpMock() {
    global.fetch = originalFetch;
}
