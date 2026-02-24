import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION } from '@/config/constants';
import { decrypt } from '@/lib/encryption';

/**
 * Protects authenticated routes at the Edge.
 *
 * The workspace_session cookie is set by /api/slack/callback after a
 * successful OAuth installation. Its value is the encrypted workspace UUID.
 * Without this cookie, dashboard access redirects to the home page.
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith('/dashboard')) {
        const session = request.cookies.get(SESSION.COOKIE_NAME);

        let valid = false;
        if (session?.value) {
            try {
                const workspaceId = decrypt(session.value);
                if (workspaceId) valid = true;
            } catch (e) {
                // Invalid or tampered cookie
            }
        }

        if (!valid) {
            const redirectUrl = new URL('/', request.url);
            redirectUrl.searchParams.set('error', 'unauthorized');
            return NextResponse.redirect(redirectUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*'],
};
