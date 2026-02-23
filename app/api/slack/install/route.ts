export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { CSRF, SLACK_API } from '@/config/constants';
import { env } from '@/lib/env';

/**
 * Initiates the Slack OAuth flow.
 *
 * Derives the redirect_uri from the current request's origin so that the
 * CSRF cookie domain and the redirect_uri domain are always the same —
 * regardless of which domain (production, preview, custom) the user accessed.
 * Using env.APP_URL here would break on Vercel preview URLs and custom domains.
 *
 * Sets a cryptographically random `state` cookie for CSRF protection
 * and redirects the user to Slack's authorization page.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const state = crypto.randomBytes(32).toString('hex');
  const redirectUri = `${origin}/api/slack/callback`;

  const slackOAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackOAuthUrl.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  slackOAuthUrl.searchParams.set('user_scope', SLACK_API.REQUIRED_USER_SCOPES.join(','));
  slackOAuthUrl.searchParams.set('redirect_uri', redirectUri);
  slackOAuthUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(slackOAuthUrl.toString());

  // Store state in HttpOnly cookie — validated in /api/slack/callback.
  // SameSite=Lax is correct here: Slack's redirect is a top-level GET navigation
  // so the browser will include Lax cookies. SameSite=None is not needed and
  // requires Secure=true which breaks local HTTP development.
  response.cookies.set(CSRF.STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: origin.startsWith('https'),
    sameSite: 'lax',
    maxAge: CSRF.STATE_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });

  return response;
}
