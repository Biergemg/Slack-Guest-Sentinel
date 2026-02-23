export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { subscriptionService } from '@/services/subscription.service';
import { logger } from '@/lib/logger';

/**
 * Creates a Stripe Checkout session and redirects the user to it.
 *
 * Expects form data with a workspaceId field.
 * The workspaceId is set during Slack OAuth and stored in the session cookie.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const workspaceId = formData.get('workspaceId');
    const plan = formData.get('plan');

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.redirect(new URL('/?error=missing_workspace', request.url));
    }

    if (!plan || typeof plan !== 'string' || !['starter', 'growth', 'scale'].includes(plan)) {
      return NextResponse.redirect(new URL('/dashboard?error=invalid_plan', request.url));
    }

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, team_name')
      .eq('id', workspaceId)
      .single();

    if (!workspace) {
      logger.warn('Checkout attempted for unknown workspace', { workspaceId });
      return NextResponse.redirect(new URL('/?error=invalid_workspace', request.url));
    }

    const checkoutUrl = await subscriptionService.createCheckoutSession(
      workspace.id,
      workspace.team_name,
      plan as 'starter' | 'growth' | 'scale'
    );

    return NextResponse.redirect(checkoutUrl, 303);
  } catch (err: any) {
    logger.error('Stripe checkout error', {}, err);
    const diagCode = encodeURIComponent((err.message || String(err)).slice(0, 100));
    return NextResponse.redirect(new URL(`/?error=internal_error&detail=${diagCode}`, request.url));
  }
}
