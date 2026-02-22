import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Simple MVP middleware to protect dashboard paths.
    // In a robust implementation, this would verify a session token in cookies or headers,
    // query Supabase natively via SSR helpers, and assert subscription active status.
    // For this scaffold, we block unauthenticated attempts without a mock auth token.

    const hasAuthToken = request.cookies.has('sb-access-token') || request.cookies.has('workspace_id');

    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        if (!hasAuthToken && process.env.NODE_ENV === 'production') {
            // return NextResponse.redirect(new URL('/', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*'],
};
