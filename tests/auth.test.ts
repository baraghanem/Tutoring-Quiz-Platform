import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, JWTPayload } from '../src/lib/auth';

describe('auth: JWT token generation and verification', () => {
  it('signs and verifies a valid token successfully', async () => {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: '42',
      email: 'student@example.com',
      role: 'student',
      name_en: 'Yousef Haddad',
      name_ar: 'يوسف حداد',
      class_id: 1,
    };

    const token = await signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const verified = await verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe('42');
    expect(verified?.email).toBe('student@example.com');
    expect(verified?.role).toBe('student');
    expect(verified?.name_ar).toBe('يوسف حداد');
    expect(verified?.class_id).toBe(1);
  });

  it('rejects an invalid or tampered token', async () => {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: '1',
      email: 'teacher@example.com',
      role: 'teacher',
      name_en: 'Teacher',
      name_ar: 'معلم',
    };

    const token = await signToken(payload);
    const tampered = token.slice(0, -5) + 'xxxxx';

    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });

  it('rejects malformed token strings', async () => {
    expect(await verifyToken('')).toBeNull();
    expect(await verifyToken('not-a-token')).toBeNull();
  });
});
