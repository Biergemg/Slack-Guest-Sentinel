export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { BILLING, CSRF, SESSION } from '@/config/constants';
import type { SlackOAuthV2Response } from '@/types/slack.types';
import type { WorkspaceInsert } from '@/types/database.types';

/**
 * Handles the Slack OAuth callback.
 *
 * 1. Validates the CSRF state parameter
 * 2. Exchanges the authorization code for an access token
 * 3. Encrypts and stores tokens in the database
 * 4. Sets a session cookie for dashboard authentication
 * 5. Redirects to onboarding
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');

  // User denied access or other OAuth error
  if (oauthError) {
    logger.warn('Slack OAuth denied by user', { error: oauthError });
    return NextResponse.redirect(new URL('/?error=access_denied', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=missing_code', request.url));
  }

  // Validate CSRF state parameter
  const cookieHeader = request.headers.get('cookie') ?? '';
  const stateCookieMatch = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${CSRF.STATE_COOKIE_NAME}=`));
  const expectedState = stateCookieMatch?.split('=')[1];

  if (!state || !expectedState || state !== expectedState) {
    logger.warn('Slack OAuth state mismatch — possible CSRF attempt');
    return NextResponse.redirect(new URL('/?error=state_mismatch', request.url));
  }

  const redirectUri = `${env.APP_URL}/api/slack/callback`;

  try {
    // Exchange code for access token
    const formData = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    });

    const slackResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const data = (await slackResponse.json()) as SlackOAuthV2Response;

    if (!data.ok) {
      logger.error('Slack OAuth token exchange failed', { error: data.error });
      return NextResponse.redirect(new URL('/?error=oauth_failed', request.url));
    }

    const { team, enterprise, authed_user } = data;

    // With user_scope requests, the token lives in authed_user
    const accessToken = authed_user.access_token;
    const refreshToken = authed_user.refresh_token ?? null;
    const expiresIn = authed_user.expires_in ?? null;

    if (!accessToken) {
      logger.error('No access token in Slack OAuth response');
      return NextResponse.redirect(new URL('/?error=no_token', request.url));
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    const workspaceData: WorkspaceInsert = {
      slack_workspace_id: team.id,
      team_name: team.name,
      enterprise_id: enterprise?.id ?? null,
      enterprise_name: enterprise?.name ?? null,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: tokenExpiresAt,
      installed_by: authed_user.id,
      plan_type: 'free',
      supports_user_deactivation: !!enterprise,
      estimated_seat_cost: BILLING.DEFAULT_SEAT_COST_USD,
    };

    const { data: workspace, error: dbError } = await supabase
      .from('workspaces')
      .upsert(workspaceData, { onConflict: 'slack_workspace_id' })
      .select('id')
      .single();

    if (dbError || !workspace) {
      logger.error('Failed to upsert workspace', { teamId: team.id }, dbError);
      return NextResponse.redirect(new URL('/?error=db_error', request.url));
    }

    logger.info('Workspace installed', { workspaceId: workspace.id, teamId: team.id });

    // Set session cookie and redirect to onboarding
    const onboardingUrl = new URL(`/onboarding?workspaceId=${workspace.id}`, request.url);
    const response = NextResponse.redirect(onboardingUrl);

    response.cookies.set(SESSION.COOKIE_NAME, workspace.id, {
      httpOnly: true,
      secure: env.IS_PRODUCTION,
      sameSite: 'lax',
      maxAge: SESSION.MAX_AGE_SECONDS,
      path: '/',
    });

    // Clear the CSRF state cookie
    response.cookies.set(CSRF.STATE_COOKIE_NAME, '', { maxAge: 0, path: '/' });

    return response;
  } catch (err) {
    logger.error('Slack OAuth callback unexpected error', {}, err);
    return NextResponse.redirect(new URL('/?error=internal_error', request.url));
  }
}
