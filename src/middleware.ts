import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths — always allowed
  const publicPaths = ['/', '/login', '/api/auth/login', '/api/auth/logout', '/_next', '/favicon.ico'];
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(req);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Role-based route guards
  if (pathname.startsWith('/student') || pathname.startsWith('/api/student')) {
    if (session.role !== 'student' && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  if (pathname.startsWith('/teacher') || pathname.startsWith('/api/teacher')) {
    if (session.role !== 'teacher' && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (session.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
