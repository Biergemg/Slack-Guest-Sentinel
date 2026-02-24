export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { subscriptionService } from '@/services/subscription.service';
import { logger } from '@/lib/logger';
import { SESSION } from '@/config/constants';

/**
 * Creates a Stripe Checkout session and redirects the user to it.
 *
 * Security:
 * - Requires a valid workspace_session cookie
 * - Ignores/treats as untrusted any workspaceId sent from the client
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const encryptedSession = cookieStore.get(SESSION.COOKIE_NAME)?.value;

    let sessionWorkspaceId: string | null = null;
    if (encryptedSession) {
      try {
        sessionWorkspaceId = decrypt(encryptedSession);
      } catch (e) {
        // tampered cookie
      }
    }

    if (!sessionWorkspaceId) {
      return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
    }

    const formData = await request.formData();
    const workspaceIdFromForm = formData.get('workspaceId');
    const plan = formData.get('plan');

    if (
      workspaceIdFromForm &&
      (typeof workspaceIdFromForm !== 'string' || workspaceIdFromForm !== sessionWorkspaceId)
    ) {
      logger.warn('Checkout workspace mismatch between form and session', {
        sessionWorkspaceId,
        workspaceIdFromForm,
      });
      return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
    }

    if (!plan || typeof plan !== 'string' || !['starter', 'growth', 'scale'].includes(plan)) {
      return NextResponse.redirect(new URL('/dashboard?error=invalid_plan', request.url));
    }

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, team_name')
      .eq('id', sessionWorkspaceId)
      .single();

    if (!workspace) {
      logger.warn('Checkout attempted for unknown workspace', { workspaceId: sessionWorkspaceId });
      return NextResponse.redirect(new URL('/?error=invalid_workspace', request.url));
    }

    const origin = new URL(request.url).origin;
    const checkoutUrl = await subscriptionService.createCheckoutSession(
      workspace.id,
      workspace.team_name,
      plan as 'starter' | 'growth' | 'scale',
      origin
    );

    return NextResponse.redirect(checkoutUrl, 303);
  } catch (err: unknown) {
    logger.error('Stripe checkout error', {}, err);
    const diagCode = encodeURIComponent(
      (err instanceof Error ? err.message : String(err)).slice(0, 100)
    );
    return NextResponse.redirect(new URL(`/?error=internal_error&detail=${diagCode}`, request.url));
  }
}
