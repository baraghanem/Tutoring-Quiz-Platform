import { NextResponse } from 'next/server';
import { getCookieName } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getCookieName(), '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });
  return response;
}
