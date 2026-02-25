import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION } from '@/config/constants';

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

        // In Edge runtime, we only check for cookie presence. 
        // Real validation (AES-GCM decryption using Node crypto) happens in the 
        // Server Components handling /dashboard routes (e.g. app/dashboard/page.tsx).
        if (!session?.value) {
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
