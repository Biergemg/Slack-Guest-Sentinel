import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION } from '@/config/constants';

/**
 * Protects authenticated routes.
 *
 * The workspace_session cookie is set by /api/slack/callback after a
 * successful OAuth installation. Its value is the workspace UUID.
 * Without this cookie, dashboard access redirects to the home page.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    const session = request.cookies.get(SESSION.COOKIE_NAME);

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
