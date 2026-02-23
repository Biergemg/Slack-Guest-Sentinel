export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/db';
import { subscriptionService } from '@/services/subscription.service';
import { logger } from '@/lib/logger';
import { SESSION } from '@/config/constants';

/**
 * Creates a Stripe Customer Portal session and redirects the user to it.
 *
 * Auth: requires a valid workspace_session cookie.
 * The workspace must have a Stripe customer ID (i.e. have subscribed at least once).
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(SESSION.COOKIE_NAME)?.value;

  if (!workspaceId) {
    return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('workspace_id', workspaceId)
    .single();

  const customerId = subscription?.stripe_customer_id;

  if (!customerId) {
    logger.warn('Portal requested with no Stripe customer', { workspaceId });
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  try {
    const returnUrl = `${new URL(request.url).origin}/dashboard`;
    const portalUrl = await subscriptionService.createPortalSession(customerId, returnUrl);
    return NextResponse.redirect(portalUrl, 303);
  } catch (err: unknown) {
    logger.error('Stripe portal session error', { workspaceId }, err);
    const diagCode = encodeURIComponent(
      (err instanceof Error ? err.message : String(err)).slice(0, 100)
    );
    return NextResponse.redirect(
      new URL(`/dashboard?error=portal_error&detail=${diagCode}`, request.url)
    );
  }
}
