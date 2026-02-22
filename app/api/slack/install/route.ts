export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { CSRF, SLACK_API } from '@/config/constants';

/**
 * Initiates the Slack OAuth flow.
 *
 * Sets a cryptographically random `state` cookie for CSRF protection
 * and redirects the user to Slack's authorization page.
 */
export async function GET() {
  const state = crypto.randomBytes(32).toString('hex');
  const redirectUri = `${env.APP_URL}/api/slack/callback`;

  const slackOAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackOAuthUrl.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  slackOAuthUrl.searchParams.set('user_scope', SLACK_API.REQUIRED_USER_SCOPES.join(','));
  slackOAuthUrl.searchParams.set('redirect_uri', redirectUri);
  slackOAuthUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(slackOAuthUrl.toString());

  // Store state in HttpOnly cookie — validated in /api/slack/callback
  response.cookies.set(CSRF.STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: env.IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: CSRF.STATE_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });

  return response;
}
