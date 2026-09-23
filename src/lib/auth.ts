import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export interface JWTPayload {
  sub: string;       // user id
  email: string;
  role: 'student' | 'teacher' | 'admin';
  name_en: string;
  name_ar: string;
  class_id?: number;
  iat?: number;
  exp?: number;
}

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'nour-quiz-platform-secret-key-change-in-production'
);

const COOKIE_NAME = 'quiz_token';
const TOKEN_TTL = 60 * 60 * 24; // 24 hours

export async function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL}s`)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getSessionFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getCookieName() {
  return COOKIE_NAME;
}
