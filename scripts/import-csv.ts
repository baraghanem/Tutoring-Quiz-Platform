/**
 * CSV Import script for Nour Tutoring Centre.
 * 
 * Imports classes, teachers, and students from spreadsheet/CSV exports.
 * Run with: npm run import:csv
 * Or:       npx tsx scripts/import-csv.ts
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getDb } from '../src/lib/db';

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? '';
    });
    return obj;
  });
}

async function run() {
  const db = getDb();
  const csvDir = path.join(process.cwd(), 'data', 'csv');

  console.log('📂 Importing CSV data into database...');

  // 1. Classes
  const classesFile = path.join(csvDir, 'classes.csv');
  if (fs.existsSync(classesFile)) {
    const records = parseCSV(fs.readFileSync(classesFile, 'utf8'));
    const stmt = db.prepare('INSERT OR IGNORE INTO classes (name) VALUES (?)');
    db.transaction(() => {
      for (const row of records) {
        if (row.name) stmt.run(row.name);
      }
    })();
    console.log(`✓ Classes processed from ${classesFile}`);
  }

  // 2. Teachers
  const teachersFile = path.join(csvDir, 'teachers.csv');
  if (fs.existsSync(teachersFile)) {
    const records = parseCSV(fs.readFileSync(teachersFile, 'utf8'));
    const stmt = db.prepare(`
      INSERT INTO users (name_ar, name_en, email, password_hash, role)
      VALUES (?, ?, ?, ?, 'teacher')
      ON CONFLICT(email) DO UPDATE SET name_ar = excluded.name_ar, name_en = excluded.name_en
    `);
    
    // Hash password
    for (const row of records) {
      if (!row.email) continue;
      const hash = await bcrypt.hash(row.password || 'teacher123', 10);
      stmt.run(row.name_ar, row.name_en, row.email.toLowerCase(), hash);
    }
    console.log(`✓ Teachers processed (${records.length} records) from ${teachersFile}`);
  }

  // 3. Students
  const studentsFile = path.join(csvDir, 'students.csv');
  if (fs.existsSync(studentsFile)) {
    const records = parseCSV(fs.readFileSync(studentsFile, 'utf8'));
    const classMap = new Map<string, number>();
    const classes = db.prepare('SELECT id, name FROM classes').all() as { id: number; name: string }[];
    classes.forEach(c => classMap.set(c.name, c.id));

    const insertUser = db.prepare(`
      INSERT INTO users (name_ar, name_en, email, password_hash, role, class_id)
      VALUES (?, ?, ?, ?, 'student', ?)
      ON CONFLICT(email) DO UPDATE SET
        name_ar = excluded.name_ar,
        name_en = excluded.name_en,
        class_id = excluded.class_id
    `);

    for (const row of records) {
      if (!row.email) continue;
      let classId = classMap.get(row.class_name);
      if (!classId && row.class_name) {
        const info = db.prepare('INSERT INTO classes (name) VALUES (?)').run(row.class_name);
        classId = Number(info.lastInsertRowid);
        classMap.set(row.class_name, classId);
      }

      const hash = await bcrypt.hash(row.password || 'student123', 10);
      insertUser.run(
        row.name_ar,
        row.name_en,
        row.email.toLowerCase(),
        hash,
        classId || null
      );
    }
    console.log(`✓ Students processed (${records.length} records) from ${studentsFile}`);
  }

  console.log('✅ CSV import complete!');
}

run().catch((err) => {
  console.error('CSV import failed:', err);
  process.exit(1);
});
