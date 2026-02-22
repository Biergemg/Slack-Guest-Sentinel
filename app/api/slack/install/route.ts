import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/slack/callback`;

    // Scopes requested (as per Phase 12 list + core setup)
    // users:read -> identify guest accounts, read profile activity/timestamps
    // chat:write -> notify workspace admins about inactive users
    // im:write -> send direct messages with suggested actions
    const scopes = [
        'users:read',
        'chat:write',
        'im:write'
    ].join(',');

    const slackOAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
    slackOAuthUrl.searchParams.append('client_id', clientId || '');
    slackOAuthUrl.searchParams.append('user_scope', scopes);
    slackOAuthUrl.searchParams.append('redirect_uri', redirectUri);

    // Optionally, state parameter could be added for CSRF protection

    return NextResponse.redirect(slackOAuthUrl.toString());
}
