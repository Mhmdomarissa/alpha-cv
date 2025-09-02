import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only protect admin routes via middleware
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Check for auth token in cookies
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      // No token, redirect to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
