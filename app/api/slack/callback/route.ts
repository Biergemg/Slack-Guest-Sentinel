import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(new URL('/?error=access_denied', request.url));
    }

    if (!code) {
        return new Response('No code provided', { status: 400 });
    }

    const clientId = process.env.SLACK_CLIENT_ID!;
    const clientSecret = process.env.SLACK_CLIENT_SECRET!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/slack/callback`;

    try {
        const formData = new URLSearchParams();
        formData.append('client_id', clientId);
        formData.append('client_secret', clientSecret);
        formData.append('code', code);
        formData.append('redirect_uri', redirectUri);

        const slackResponse = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });

        const data = await slackResponse.json();

        if (!data.ok) {
            console.error("Slack OAuth Error:", data.error);
            return new Response(`Slack OAuth Error: ${data.error}`, { status: 400 });
        }

        // When requesting user_scopes, the token is inside authed_user
        const {
            team,
            enterprise,
            authed_user
        } = data;

        const finalAccessToken = authed_user?.access_token || data.access_token;
        const finalRefreshToken = authed_user?.refresh_token || data.refresh_token;
        const expiresIn = authed_user?.expires_in || data.expires_in;

        if (!finalAccessToken) {
            return new Response("No access token received", { status: 400 });
        }

        // Encrypt tokens
        const encryptedAccessToken = encrypt(finalAccessToken);
        const encryptedRefreshToken = finalRefreshToken ? encrypt(finalRefreshToken) : null;

        // Calculate expiration timestamp
        const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

        // Infer plan type (basic implementation)
        // Real inference might require calling other endpoints, but standard vs enterprise is often determined by presence of enterprise object or feature flags
        const planType = enterprise ? 'enterprise' : 'standard';
        const supportsDeactivation = !!enterprise; // Only Enterprise Grid officially supports admin.users:write for normal apps

        // Upsert workspace in Supabase
        const { data: workspace, error: dbError } = await supabase
            .from('workspaces')
            .upsert({
                slack_workspace_id: team.id,
                team_name: team.name,
                enterprise_id: enterprise?.id || null,
                enterprise_name: enterprise?.name || null,
                access_token: encryptedAccessToken,
                refresh_token: encryptedRefreshToken,
                token_expires_at: tokenExpiresAt,
                installed_by: authed_user.id,
                plan_type: planType,
                supports_user_deactivation: supportsDeactivation,
                estimated_seat_cost: 15.00
            }, { onConflict: 'slack_workspace_id' })
            .select()
            .single();

        if (dbError) {
            console.error("Database Error:", dbError);
            return new Response("Database Error: " + dbError.message, { status: 500 });
        }

        // Redirect to onboarding with workspace ID
        const onboardingUrl = new URL(`/onboarding?workspaceId=${workspace.id}`, request.url);
        return NextResponse.redirect(onboardingUrl);

    } catch (err) {
        console.error("Internal Error:", err);
        return new Response("Internal Server Error", { status: 500 });
    }
}
