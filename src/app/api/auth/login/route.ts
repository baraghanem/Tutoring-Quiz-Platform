import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { signToken, getCookieName } from '@/lib/auth';
import bcrypt from 'bcryptjs';

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: 'student' | 'teacher' | 'admin';
  name_en: string;
  name_ar: string;
  class_id: number | null;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const db = getDb();
    const user = db
      .prepare('SELECT id, email, password_hash, role, name_en, name_ar, class_id FROM users WHERE email = ?')
      .get(email.trim().toLowerCase()) as UserRow | undefined;

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await signToken({
      sub: String(user.id),
      email: user.email,
      role: user.role,
      name_en: user.name_en,
      name_ar: user.name_ar,
      class_id: user.class_id ?? undefined,
    });

    const response = NextResponse.json({
      ok: true,
      role: user.role,
      name_en: user.name_en,
      name_ar: user.name_ar,
    });

    response.cookies.set(getCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
