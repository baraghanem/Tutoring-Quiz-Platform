'use client';

import { useRouter } from 'next/navigation';

interface NavbarProps {
  nameEn: string;
  nameAr: string;
  role: string;
}

export default function Navbar({ nameEn, nameAr, role }: NavbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const roleLabel = role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher · معلم' : 'Student · طالب';
  const dashPath = role === 'admin' ? '/admin/dashboard' : role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';

  return (
    <nav className="navbar">
      <a href={dashPath} className="navbar__brand">
        <span className="brand-dot" />
        <span>نور · Nour</span>
      </a>
      <div className="navbar__actions">
        <span className="navbar__user">
          <span style={{ direction: 'rtl', display: 'inline-block' }}>{nameAr}</span>
          <span style={{ color: 'var(--color-text-3)', margin: '0 4px' }}>·</span>
          <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{roleLabel}</span>
        </span>
        <button
          id="logout-btn"
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
        >
          خروج
        </button>
      </div>
    </nav>
  );
}
