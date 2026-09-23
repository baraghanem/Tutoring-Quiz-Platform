import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Public endpoint — classes list needed for quiz creation form
export async function GET(_req: NextRequest) {
  const db = getDb();
  const classes = db.prepare('SELECT id, name FROM classes ORDER BY name').all();
  return NextResponse.json({ classes });
}
