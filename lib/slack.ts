const SLACK_API_URL = 'https://slack.com/api';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function slackApiCall(endpoint: string, token: string, body?: any, retries = 3): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${SLACK_API_URL}/${endpoint}`;
    const options: any = {
        method: body ? 'POST' : 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(url, options);

        if (res.status === 429 && retries > 0) {
            const retryAfter = res.headers.get('Retry-After');
            // Default to 10 seconds if header is missing during rate limit
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
            console.warn(`Rate limited by Slack. Waiting ${waitTime}ms before retry...`);
            await delay(waitTime);
            return slackApiCall(endpoint, token, body, retries - 1);
        }

        const data = await res.json();
        return data;
    } catch (error) {
        if (retries > 0) {
            console.warn(`Network error making Slack API call. Retrying...`, error);
            await delay(2000);
            return slackApiCall(endpoint, token, body, retries - 1);
        }
        throw error;
    }
}

export async function getGuests(token: string) {
    const data = await slackApiCall('users.list?limit=1000', token);
    if (!data.ok) throw new Error(data.error);
    const members = data.members || [];
    // is_restricted = multi-channel guest, is_ultra_restricted = single-channel guest
    return members.filter((m: any) => !m.deleted && (m.is_restricted || m.is_ultra_restricted) && !m.is_bot);
}

export async function getUserPresence(token: string, userId: string): Promise<string> {
    const data = await slackApiCall(`users.getPresence?user=${userId}`, token);
    if (!data.ok) return 'away';
    return data.presence;
}

export async function sendDirectMessage(token: string, userId: string, blocks: any, fallbackText: string = "Alert") {
    // 1. Open an IM channel if one doesn't exist
    const imData = await slackApiCall('conversations.open', token, { users: userId });
    if (!imData.ok) {
        throw new Error(imData.error);
    }
    const channelId = imData.channel.id;

    // 2. Send message
    return await slackApiCall('chat.postMessage', token, {
        channel: channelId,
        blocks: blocks,
        text: fallbackText
    });
}
