/**
 * Seed script: populates the database with realistic sample data
 * for Nour Tutoring Centre.
 *
 * Run with: npx tsx scripts/seed.ts
 * Or:       npm run seed
 *
 * Safe to run multiple times — checks for existing data first.
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'quiz.db');
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ─────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS classes (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ar       TEXT NOT NULL,
    name_en       TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
    class_id      INTEGER REFERENCES classes(id),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS quizzes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT NOT NULL,
    description         TEXT,
    teacher_id          INTEGER NOT NULL REFERENCES users(id),
    class_id            INTEGER NOT NULL REFERENCES classes(id),
    time_limit_minutes  INTEGER NOT NULL DEFAULT 20,
    opens_at            DATETIME NOT NULL,
    closes_at           DATETIME NOT NULL,
    negative_marking    INTEGER NOT NULL DEFAULT 0,
    penalty_fraction    REAL NOT NULL DEFAULT 0.25,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id     INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    points      REAL NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS options (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    is_correct  INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id   INTEGER NOT NULL REFERENCES users(id),
    quiz_id      INTEGER NOT NULL REFERENCES quizzes(id),
    started_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME,
    score        REAL,
    max_score    REAL,
    is_submitted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(student_id, quiz_id)
  );
  CREATE TABLE IF NOT EXISTS answers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id  INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    option_id   INTEGER REFERENCES options(id),
    UNIQUE(attempt_id, question_id)
  );
`);

// ─── Check if already seeded ─────────────────────────────────────────────────
const existingClasses = (db.prepare('SELECT COUNT(*) as n FROM classes').get() as { n: number }).n;
if (existingClasses > 0) {
  console.log('✓ Database already seeded. Delete data/quiz.db to re-seed.');
  process.exit(0);
}

const HASH_ROUNDS = 10;

async function hash(pw: string) {
  return bcrypt.hash(pw, HASH_ROUNDS);
}

async function seed() {
  console.log('🌱 Seeding Nour Tutoring Centre database...\n');

  // ─── Classes ─────────────────────────────────────────────────────────────
  const insertClass = db.prepare('INSERT INTO classes (name) VALUES (?)');
  const class10A = insertClass.run('10A').lastInsertRowid as number;
  const class10B = insertClass.run('10B').lastInsertRowid as number;
  const class11A = insertClass.run('11A').lastInsertRowid as number;

  // ─── Admin (Nour) ────────────────────────────────────────────────────────
  const insertUser = db.prepare(`
    INSERT INTO users (name_ar, name_en, email, password_hash, role, class_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const adminHash = await hash('admin123');
  insertUser.run('نور الحسن', 'Nour Al-Hassan', 'nour@nour-centre.jo', adminHash, 'admin', null);
  console.log('✓ Admin: nour@nour-centre.jo / admin123');

  // ─── Teachers ────────────────────────────────────────────────────────────
  const teacherPw = await hash('teacher123');
  const teachers = [
    { ar: 'أحمد الرشيد',    en: 'Ahmad Al-Rashid',   email: 'ahmad@nour-centre.jo'   },
    { ar: 'سارة خليل',      en: 'Sara Khalil',        email: 'sara@nour-centre.jo'    },
    { ar: 'محمد النابلسي',  en: 'Mohammad Nabulsi',   email: 'mohammad@nour-centre.jo' },
    { ar: 'لينا حداد',      en: 'Lina Haddad',        email: 'lina@nour-centre.jo'    },
  ];
  const teacherIds: number[] = [];
  for (const t of teachers) {
    const r = insertUser.run(t.ar, t.en, t.email, teacherPw, 'teacher', null);
    teacherIds.push(r.lastInsertRowid as number);
    console.log(`✓ Teacher: ${t.email} / teacher123`);
  }

  // ─── Students — 20 per class ─────────────────────────────────────────────
  const studentPw = await hash('student123');

  const students10A = [
    { ar: 'ياسمين النجار',    en: 'Yasmine Al-Najjar'  },
    { ar: 'عمر الزيادات',     en: 'Omar Al-Zyadat'     },
    { ar: 'رنا العبيدي',      en: 'Rana Al-Ubaidi'     },
    { ar: 'خالد مصطفى',       en: 'Khaled Mustafa'     },
    { ar: 'دانا الحمد',       en: 'Dana Al-Hamad'      },
    { ar: 'محمود الجمل',      en: 'Mahmoud Al-Jamal'   },
    { ar: 'سلمى شاهين',       en: 'Salma Shaheen'      },
    { ar: 'فارس العواملة',    en: 'Faris Al-Awamla'    },
    { ar: 'نور الدين',        en: 'Nour Al-Din'        },
    { ar: 'ليلى عبدالله',     en: 'Layla Abdullah'     },
    { ar: 'باسم الخوري',      en: 'Bassem Al-Khouri'   },
    { ar: 'هدى الزبيدي',      en: 'Huda Al-Zubaidi'   },
    { ar: 'تامر النعيمي',     en: 'Tamer Al-Nuaymi'    },
    { ar: 'إيمان سلامة',      en: 'Iman Salameh'       },
    { ar: 'ربيع الحسن',       en: 'Rabi Al-Hassan'     },
    { ar: 'آية المصري',       en: 'Aya Al-Masri'       },
    { ar: 'يوسف الرفاعي',     en: 'Yousef Al-Rifa\'i'  },
    { ar: 'زهراء الطاهر',     en: 'Zahraa Al-Taher'    },
    { ar: 'كريم البطوش',      en: 'Karim Al-Battoush'  },
    { ar: 'سجى الوهيبي',      en: 'Saja Al-Wahaibi'    },
  ];

  const students10B = [
    { ar: 'أمل درويش',        en: 'Amal Darwish'       },
    { ar: 'ساري الحمدان',     en: 'Sari Al-Hamdan'     },
    { ar: 'نادية الأحمد',     en: 'Nadia Al-Ahmad'     },
    { ar: 'وليد مرعي',        en: 'Walid Mar\'i'       },
    { ar: 'شيرين الحربي',     en: 'Shirin Al-Harbi'    },
    { ar: 'عبدالله الشمري',   en: 'Abdullah Al-Shamari'},
    { ar: 'منى العتيبي',      en: 'Mona Al-Otaibi'     },
    { ar: 'راشد الغامدي',     en: 'Rashed Al-Ghamdi'   },
    { ar: 'سلوى البقمي',      en: 'Salwa Al-Baqmi'     },
    { ar: 'أيمن الزهراني',    en: 'Ayman Al-Zahrani'   },
    { ar: 'ريم الدوسري',      en: 'Reem Al-Dosari'     },
    { ar: 'نوف المطيري',      en: 'Nouf Al-Mutairi'    },
    { ar: 'سعد الحارثي',      en: 'Saad Al-Harithi'    },
    { ar: 'ألاء القحطاني',    en: 'Alaa Al-Qahtani'    },
    { ar: 'فهد الجهني',       en: 'Fahad Al-Juhani'    },
    { ar: 'غادة الشهري',      en: 'Ghada Al-Shahri'    },
    { ar: 'بسام العنزي',      en: 'Bassam Al-Anzi'     },
    { ar: 'لمياء الرشيد',     en: 'Lamia Al-Rashid'    },
    { ar: 'عصام الربيعي',     en: 'Essam Al-Rubaie'    },
    { ar: 'وسام الصالح',      en: 'Wessam Al-Saleh'    },
  ];

  const students11A = [
    { ar: 'تالة إبراهيم',     en: 'Tala Ibrahim'       },
    { ar: 'مازن الحمد',       en: 'Mazen Al-Hamad'     },
    { ar: 'سمر الجابري',      en: 'Samar Al-Jabri'     },
    { ar: 'جاد الله عيسى',   en: 'Jadallah Issa'      },
    { ar: 'هبة العمري',       en: 'Heba Al-Omari'      },
    { ar: 'علي المنصور',      en: 'Ali Al-Mansour'     },
    { ar: 'رشا العجارمة',     en: 'Rasha Al-Ajarma'    },
    { ar: 'بلال شديد',        en: 'Bilal Shadid'       },
    { ar: 'أسيل المعاني',     en: 'Aseel Al-Maani'     },
    { ar: 'حمزة الغول',       en: 'Hamza Al-Ghoul'     },
    { ar: 'ديما الطراونة',    en: 'Dima Al-Tarawneh'   },
    { ar: 'صالح الدعجة',      en: 'Saleh Al-Da\'ajah'  },
    { ar: 'أريج الصيفي',      en: 'Areej Al-Saifi'     },
    { ar: 'مصطفى البطاينة',   en: 'Mustafa Al-Bataineh'},
    { ar: 'لمى الكلالدة',     en: 'Lama Al-Kalalda'    },
    { ar: 'زياد السرايرة',    en: 'Ziad Al-Saraireh'   },
    { ar: 'ملك الشوبكي',      en: 'Malak Al-Shobaki'   },
    { ar: 'حسام القطاونة',    en: 'Hossam Al-Qatawneh' },
    { ar: 'نهاية الخالدي',    en: 'Nihaya Al-Khalidi'  },
    { ar: 'قيس عبيدات',       en: 'Qais Ubaidat'       },
  ];

  const allStudents: Array<{ ar: string; en: string; classId: number; id?: number }> = [
    ...students10A.map((s) => ({ ...s, classId: class10A })),
    ...students10B.map((s) => ({ ...s, classId: class10B })),
    ...students11A.map((s) => ({ ...s, classId: class11A })),
  ];

  const studentIds: number[] = [];
  for (let i = 0; i < allStudents.length; i++) {
    const s = allStudents[i];
    const classLetter = s.classId === class10A ? '10a' : s.classId === class10B ? '10b' : '11a';
    const email = `student${(i + 1).toString().padStart(3, '0')}@nour-centre.jo`;
    const r = insertUser.run(s.ar, s.en, email, studentPw, 'student', s.classId);
    studentIds.push(r.lastInsertRowid as number);
    allStudents[i].id = r.lastInsertRowid as number;
  }
  console.log(`✓ ${allStudents.length} students created (password: student123)`);
  console.log(`  Sample student login: student001@nour-centre.jo / student123`);
  console.log(`  (10A students: 001-020, 10B: 021-040, 11A: 041-060)`);

  // ─── Quizzes ─────────────────────────────────────────────────────────────
  const insertQuiz = db.prepare(`
    INSERT INTO quizzes (title, description, teacher_id, class_id, time_limit_minutes,
                         opens_at, closes_at, negative_marking, penalty_fraction)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertQuestion = db.prepare(`
    INSERT INTO questions (quiz_id, body, points, order_index) VALUES (?, ?, ?, ?)
  `);
  const insertOption = db.prepare(`
    INSERT INTO options (question_id, body, is_correct) VALUES (?, ?, ?)
  `);

  // Helper to insert a full quiz
  function createQuiz(
    title: string, description: string, teacherId: number, classId: number,
    timeLimitMinutes: number, opensAt: string, closesAt: string,
    negativeMarking: boolean, penaltyFraction: number,
    questions: Array<{ body: string; points: number; options: Array<{ body: string; is_correct: boolean }> }>
  ) {
    const qr = insertQuiz.run(title, description, teacherId, classId, timeLimitMinutes,
      opensAt, closesAt, negativeMarking ? 1 : 0, penaltyFraction);
    const quizId = qr.lastInsertRowid as number;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qqr = insertQuestion.run(quizId, q.body, q.points, i);
      const questionId = qqr.lastInsertRowid as number;
      for (const opt of q.options) {
        insertOption.run(questionId, opt.body, opt.is_correct ? 1 : 0);
      }
    }
    return quizId;
  }

  const now = new Date();
  const past3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const future3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const future7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Quiz 1: Math Algebra (10A, negative marking, Ahmad)
  const quiz1Id = createQuiz(
    'اختبار الرياضيات – الجبر',
    'اختبار في وحدة الجبر: المعادلات والمتباينات الخطية',
    teacherIds[0], class10A, 20, past7, future3, true, 0.25,
    [
      { body: 'ما قيمة x في المعادلة: 2x + 6 = 14؟', points: 2, options: [
        { body: '4', is_correct: true },
        { body: '3', is_correct: false },
        { body: '5', is_correct: false },
        { body: '7', is_correct: false },
      ]},
      { body: 'ما حاصل ضرب (x + 3)(x − 3)؟', points: 2, options: [
        { body: 'x² − 9', is_correct: true },
        { body: 'x² + 9', is_correct: false },
        { body: 'x² − 6x + 9', is_correct: false },
        { body: 'x² + 6x − 9', is_correct: false },
      ]},
      { body: 'إذا كانت 3y − 5 = 10، فإن y يساوي:', points: 2, options: [
        { body: '5', is_correct: true },
        { body: '4', is_correct: false },
        { body: '6', is_correct: false },
        { body: '3', is_correct: false },
      ]},
      { body: 'أبسّط: 4x + 3x − 2x', points: 1, options: [
        { body: '5x', is_correct: true },
        { body: '9x', is_correct: false },
        { body: '4x', is_correct: false },
        { body: '7x', is_correct: false },
      ]},
      { body: 'ما قيمة التعبير 3(a + 2) − a عندما a = 4؟', points: 2, options: [
        { body: '14', is_correct: true },
        { body: '10', is_correct: false },
        { body: '16', is_correct: false },
        { body: '12', is_correct: false },
      ]},
      { body: 'حل المتباينة: 2x − 3 > 7', points: 2, options: [
        { body: 'x > 5', is_correct: true },
        { body: 'x < 5', is_correct: false },
        { body: 'x > 2', is_correct: false },
        { body: 'x < 2', is_correct: false },
      ]},
      { body: 'ما مقلوب الجمع لـ (−7)؟', points: 1, options: [
        { body: '7', is_correct: true },
        { body: '−7', is_correct: false },
        { body: '1/7', is_correct: false },
        { body: '−1/7', is_correct: false },
      ]},
      { body: 'إذا كانت x² = 49، فإن x يمكن أن يساوي:', points: 2, options: [
        { body: '±7', is_correct: true },
        { body: '7 فقط', is_correct: false },
        { body: '−7 فقط', is_correct: false },
        { body: '49', is_correct: false },
      ]},
      { body: 'ما عامل مشترك أكبر لـ 12x² و 8x؟', points: 2, options: [
        { body: '4x', is_correct: true },
        { body: '2x', is_correct: false },
        { body: '8x', is_correct: false },
        { body: '12x', is_correct: false },
      ]},
      { body: 'أي من التالي يمثل نظام معادلتين بحل وحيد؟', points: 2, options: [
        { body: 'خطان يتقاطعان في نقطة واحدة', is_correct: true },
        { body: 'خطان متوازيان', is_correct: false },
        { body: 'خطان متطابقان', is_correct: false },
        { body: 'خطان عموديان بلا تقاطع', is_correct: false },
      ]},
      { body: 'بسّط: (2x³)²', points: 2, options: [
        { body: '4x⁶', is_correct: true },
        { body: '2x⁶', is_correct: false },
        { body: '4x⁵', is_correct: false },
        { body: '2x⁵', is_correct: false },
      ]},
      { body: 'ما ميل الخط المار بالنقطتين (1, 2) و (3, 8)؟', points: 2, options: [
        { body: '3', is_correct: true },
        { body: '2', is_correct: false },
        { body: '4', is_correct: false },
        { body: '6', is_correct: false },
      ]},
      { body: 'حل جملة المعادلات: x + y = 5، x − y = 1', points: 3, options: [
        { body: 'x = 3, y = 2', is_correct: true },
        { body: 'x = 2, y = 3', is_correct: false },
        { body: 'x = 4, y = 1', is_correct: false },
        { body: 'x = 1, y = 4', is_correct: false },
      ]},
      { body: 'ما نسبة التغير في الدالة f(x) = 4x − 1 من x = 1 إلى x = 3؟', points: 2, options: [
        { body: '8', is_correct: true },
        { body: '4', is_correct: false },
        { body: '6', is_correct: false },
        { body: '2', is_correct: false },
      ]},
      { body: 'إذا كانت f(x) = x² − 3x + 2، فما f(2)؟', points: 2, options: [
        { body: '0', is_correct: true },
        { body: '2', is_correct: false },
        { body: '4', is_correct: false },
        { body: '−2', is_correct: false },
      ]},
    ]
  );
  console.log(`✓ Quiz 1 created: اختبار الرياضيات – الجبر (10A, negative marking)`);

  // Quiz 2: English Literature (10B, no negative marking, Sara)
  const quiz2Id = createQuiz(
    'English Literature Quiz – Short Stories',
    'A quiz on the elements of fiction and the short stories covered in Unit 2',
    teacherIds[1], class10B, 20, past7, future7, false, 0.25,
    [
      { body: 'Which element of fiction refers to the time and place of the story?', points: 1, options: [
        { body: 'Setting', is_correct: true },
        { body: 'Theme', is_correct: false },
        { body: 'Plot', is_correct: false },
        { body: 'Character', is_correct: false },
      ]},
      { body: 'What is the climax of a story?', points: 1, options: [
        { body: 'The turning point of highest tension', is_correct: true },
        { body: 'The beginning that introduces characters', is_correct: false },
        { body: 'The final resolution', is_correct: false },
        { body: 'The falling action after the peak', is_correct: false },
      ]},
      { body: 'A protagonist is best described as:', points: 1, options: [
        { body: 'The main character of the story', is_correct: true },
        { body: 'The character who opposes the hero', is_correct: false },
        { body: 'A minor supporting character', is_correct: false },
        { body: 'The narrator of the story', is_correct: false },
      ]},
      { body: 'Which point of view uses "I" to tell the story?', points: 1, options: [
        { body: 'First person', is_correct: true },
        { body: 'Second person', is_correct: false },
        { body: 'Third person limited', is_correct: false },
        { body: 'Third person omniscient', is_correct: false },
      ]},
      { body: 'The theme of a story is:', points: 1, options: [
        { body: 'The central message or insight about life', is_correct: true },
        { body: 'A summary of events in sequence', is_correct: false },
        { body: 'The place where the story happens', is_correct: false },
        { body: 'The mood created by descriptive language', is_correct: false },
      ]},
      { body: 'What is foreshadowing?', points: 2, options: [
        { body: 'Hints or clues about events that will happen later', is_correct: true },
        { body: 'A reference back to an earlier event', is_correct: false },
        { body: 'The use of symbolic language', is_correct: false },
        { body: 'Describing a character\'s thoughts directly', is_correct: false },
      ]},
      { body: 'An antagonist is:', points: 1, options: [
        { body: 'The force or character who opposes the protagonist', is_correct: true },
        { body: 'The character who helps the hero', is_correct: false },
        { body: 'A character who changes greatly', is_correct: false },
        { body: 'The narrator of the story', is_correct: false },
      ]},
      { body: 'In a story with a third-person omniscient narrator, the narrator:', points: 2, options: [
        { body: 'Knows the thoughts of all characters', is_correct: true },
        { body: 'Knows only the thoughts of one character', is_correct: false },
        { body: 'Is a character inside the story', is_correct: false },
        { body: 'Never reveals any character\'s inner thoughts', is_correct: false },
      ]},
      { body: 'Which of the following is an example of irony?', points: 2, options: [
        { body: 'A fire station burns down', is_correct: true },
        { body: 'A dog barks at night', is_correct: false },
        { body: 'A child learns to walk', is_correct: false },
        { body: 'A hero wins the battle', is_correct: false },
      ]},
      { body: 'Rising action in a plot means:', points: 1, options: [
        { body: 'Events that build tension towards the climax', is_correct: true },
        { body: 'The final outcome of the conflict', is_correct: false },
        { body: 'The introduction of the main characters', is_correct: false },
        { body: 'Events that occur after the climax', is_correct: false },
      ]},
      { body: 'A "flat" character is one who:', points: 2, options: [
        { body: 'Does not change or develop during the story', is_correct: true },
        { body: 'Has many complex traits', is_correct: false },
        { body: 'Is described in great physical detail', is_correct: false },
        { body: 'Always tells the truth', is_correct: false },
      ]},
      { body: 'What is the difference between a simile and a metaphor?', points: 2, options: [
        { body: 'A simile uses "like" or "as"; a metaphor does not', is_correct: true },
        { body: 'A metaphor uses "like" or "as"; a simile does not', is_correct: false },
        { body: 'They are the same literary device', is_correct: false },
        { body: 'A simile compares; a metaphor describes sounds', is_correct: false },
      ]},
      { body: 'The resolution of a story:', points: 1, options: [
        { body: 'Shows how the conflict is settled', is_correct: true },
        { body: 'Introduces the main conflict', is_correct: false },
        { body: 'Builds tension before the climax', is_correct: false },
        { body: 'Ends with a cliffhanger', is_correct: false },
      ]},
      { body: 'Personification is when:', points: 2, options: [
        { body: 'Human qualities are given to non-human things', is_correct: true },
        { body: 'A comparison is made using "like" or "as"', is_correct: false },
        { body: 'A word imitates a natural sound', is_correct: false },
        { body: 'An exaggeration is used for effect', is_correct: false },
      ]},
      { body: 'What does "conflict" mean in a story?', points: 1, options: [
        { body: 'A struggle between opposing forces', is_correct: true },
        { body: 'The happy ending of a story', is_correct: false },
        { body: 'The narrator\'s point of view', is_correct: false },
        { body: 'A description of the setting', is_correct: false },
      ]},
    ]
  );
  console.log(`✓ Quiz 2 created: English Literature – Short Stories (10B, no negative marking)`);

  // Quiz 3: Chemistry (11A, negative marking, Mohammad)
  const quiz3Id = createQuiz(
    'اختبار العلوم – أساسيات الكيمياء',
    'اختبار في الكيمياء: الجدول الدوري، الروابط الكيميائية، والتفاعلات',
    teacherIds[2], class11A, 25, past3, future7, true, 0.33,
    [
      { body: 'ما العدد الذري للأكسجين في الجدول الدوري؟', points: 1, options: [
        { body: '8', is_correct: true },
        { body: '6', is_correct: false },
        { body: '16', is_correct: false },
        { body: '12', is_correct: false },
      ]},
      { body: 'ما نوع الرابطة التي تتشكل بين ذرتَي H في جزيء H₂؟', points: 2, options: [
        { body: 'رابطة تساهمية', is_correct: true },
        { body: 'رابطة أيونية', is_correct: false },
        { body: 'رابطة هيدروجينية', is_correct: false },
        { body: 'رابطة فلزية', is_correct: false },
      ]},
      { body: 'ما الصيغة الكيميائية للماء؟', points: 1, options: [
        { body: 'H₂O', is_correct: true },
        { body: 'HO₂', is_correct: false },
        { body: 'H₂O₂', is_correct: false },
        { body: 'OH', is_correct: false },
      ]},
      { body: 'يُصنّف الملح الصخري (NaCl) على أنه:', points: 2, options: [
        { body: 'مركب أيوني', is_correct: true },
        { body: 'مركب تساهمي', is_correct: false },
        { body: 'عنصر', is_correct: false },
        { body: 'خليط', is_correct: false },
      ]},
      { body: 'في التفاعل: 2H₂ + O₂ → 2H₂O، ما الناتج؟', points: 1, options: [
        { body: 'الماء', is_correct: true },
        { body: 'الهيدروجين', is_correct: false },
        { body: 'الأكسجين', is_correct: false },
        { body: 'بيروكسيد الهيدروجين', is_correct: false },
      ]},
      { body: 'أي من العناصر التالية فلز قلوي؟', points: 2, options: [
        { body: 'الصوديوم (Na)', is_correct: true },
        { body: 'الكلور (Cl)', is_correct: false },
        { body: 'الأكسجين (O)', is_correct: false },
        { body: 'الكربون (C)', is_correct: false },
      ]},
      { body: 'ما الوحدة الأساسية لقياس كمية المادة في الكيمياء؟', points: 1, options: [
        { body: 'المول', is_correct: true },
        { body: 'الجرام', is_correct: false },
        { body: 'الذرة', is_correct: false },
        { body: 'الجزيء', is_correct: false },
      ]},
      { body: 'التفاعل الذي تُمتصّ فيه الحرارة يُسمى:', points: 2, options: [
        { body: 'تفاعل ماصّ للحرارة', is_correct: true },
        { body: 'تفاعل طارد للحرارة', is_correct: false },
        { body: 'تفاعل اتحاد', is_correct: false },
        { body: 'تفاعل انحلال', is_correct: false },
      ]},
      { body: 'ما عدد البروتونات في نواة ذرة الكربون؟', points: 1, options: [
        { body: '6', is_correct: true },
        { body: '4', is_correct: false },
        { body: '8', is_correct: false },
        { body: '12', is_correct: false },
      ]},
      { body: 'أيّة مادة تعتبر موصلاً جيداً للكهرباء؟', points: 2, options: [
        { body: 'النحاس (Cu)', is_correct: true },
        { body: 'الزجاج', is_correct: false },
        { body: 'الخشب', is_correct: false },
        { body: 'الهواء', is_correct: false },
      ]},
      { body: 'أيّ من التالي يُعدّ حمضاً وفق نظرية برونستد-لوري؟', points: 3, options: [
        { body: 'مادة تتبرع ببروتون (H⁺)', is_correct: true },
        { body: 'مادة تقبل بروتوناً', is_correct: false },
        { body: 'مادة تتبرع بإلكترون', is_correct: false },
        { body: 'مادة تقبل إلكتروناً', is_correct: false },
      ]},
      { body: 'الرقم الهيدروجيني (pH) للحمض القوي يكون:', points: 2, options: [
        { body: 'أقل من 7', is_correct: true },
        { body: 'أكبر من 7', is_correct: false },
        { body: 'يساوي 7', is_correct: false },
        { body: 'يساوي 14', is_correct: false },
      ]},
      { body: 'ما التفاعل الذي ينتج فيه مركب واحد من مركبين أو أكثر؟', points: 2, options: [
        { body: 'تفاعل الاتحاد', is_correct: true },
        { body: 'تفاعل الانحلال', is_correct: false },
        { body: 'تفاعل الإزاحة', is_correct: false },
        { body: 'تفاعل الاحتراق', is_correct: false },
      ]},
      { body: 'أيّ قانون يقول "الكتلة لا تُفنى ولا تُستحدث من عدم"؟', points: 2, options: [
        { body: 'قانون حفظ الكتلة', is_correct: true },
        { body: 'قانون هيس', is_correct: false },
        { body: 'قانون التوافق الغازي', is_correct: false },
        { body: 'قانون نيوتن الثالث', is_correct: false },
      ]},
      { body: 'الأيزوتوبات هي ذرات للعنصر نفسه ولكن تختلف في:', points: 2, options: [
        { body: 'عدد النيوترونات', is_correct: true },
        { body: 'عدد البروتونات', is_correct: false },
        { body: 'عدد الإلكترونات', is_correct: false },
        { body: 'العدد الذري', is_correct: false },
      ]},
    ]
  );
  console.log(`✓ Quiz 3 created: اختبار العلوم – أساسيات الكيمياء (11A, negative marking 1/3)`);

  // ─── Generate sample attempts ──────────────────────────────────────────────
  // Simulate that last week's quizzes have been taken by most students

  const submitAttemptTx = db.transaction((
    studentId: number,
    quizId: number,
    quizQuestions: Array<{ id: number; points: number; correctOptionId: number; allOptionIds: number[] }>,
    negativeMarking: boolean,
    penaltyFraction: number,
    correctRate: number  // 0.0 – 1.0, simulated ability
  ) => {
    const now = new Date();
    const startedAt = new Date(now.getTime() - Math.random() * 18 * 60 * 1000); // started 0-18 min ago

    const answers: Record<number, number | null> = {};
    let score = 0;
    let maxScore = 0;

    for (const q of quizQuestions) {
      maxScore += q.points;
      const r = Math.random();
      if (r < 0.05) {
        // 5% chance of skipping
        answers[q.id] = null;
      } else if (r < correctRate + 0.05) {
        // Correct
        answers[q.id] = q.correctOptionId;
        score += q.points;
      } else {
        // Wrong — pick a wrong option
        const wrongOptions = q.allOptionIds.filter((id) => id !== q.correctOptionId);
        answers[q.id] = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
        if (negativeMarking) {
          score -= q.points * penaltyFraction;
        }
      }
    }
    score = Math.max(0, Math.round(score * 100) / 100);
    maxScore = Math.round(maxScore * 100) / 100;

    const attemptResult = db.prepare(`
      INSERT INTO attempts (student_id, quiz_id, started_at, submitted_at, score, max_score, is_submitted)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(studentId, quizId, startedAt.toISOString(), now.toISOString(), score, maxScore);

    const attemptId = attemptResult.lastInsertRowid as number;

    for (const q of quizQuestions) {
      if (answers[q.id] !== undefined) {
        db.prepare(`
          INSERT INTO answers (attempt_id, question_id, option_id) VALUES (?, ?, ?)
        `).run(attemptId, q.id, answers[q.id]);
      }
    }
  });

  // Helper to get quiz questions with options
  function getQuizData(quizId: number) {
    const qs = db.prepare('SELECT id, points FROM questions WHERE quiz_id = ? ORDER BY order_index').all(quizId) as Array<{ id: number; points: number }>;
    return qs.map((q) => {
      const opts = db.prepare('SELECT id, is_correct FROM options WHERE question_id = ?').all(q.id) as Array<{ id: number; is_correct: number }>;
      const correctOpt = opts.find((o) => o.is_correct);
      return {
        id: q.id,
        points: q.points,
        correctOptionId: correctOpt!.id,
        allOptionIds: opts.map((o) => o.id),
      };
    });
  }

  const quiz1Questions = getQuizData(quiz1Id);
  const quiz2Questions = getQuizData(quiz2Id);
  const quiz3Questions = getQuizData(quiz3Id);

  // 10A students — take quiz 1 (algebra), varied abilities
  const students10AWithIds = allStudents.filter((s) => s.classId === class10A);
  let attemptCount = 0;
  for (let i = 0; i < students10AWithIds.length; i++) {
    if (Math.random() > 0.15) { // 85% participation rate
      const ability = 0.4 + Math.random() * 0.55; // 40-95% correct rate
      submitAttemptTx(
        students10AWithIds[i].id!,
        quiz1Id,
        quiz1Questions,
        true, 0.25, ability
      );
      attemptCount++;
    }
  }

  // 10B students — take quiz 2 (English lit)
  const students10BWithIds = allStudents.filter((s) => s.classId === class10B);
  for (let i = 0; i < students10BWithIds.length; i++) {
    if (Math.random() > 0.10) { // 90% participation
      const ability = 0.45 + Math.random() * 0.5;
      submitAttemptTx(
        students10BWithIds[i].id!,
        quiz2Id,
        quiz2Questions,
        false, 0.25, ability
      );
      attemptCount++;
    }
  }

  // 11A students — take quiz 3 (chemistry)
  const students11AWithIds = allStudents.filter((s) => s.classId === class11A);
  for (let i = 0; i < students11AWithIds.length; i++) {
    if (Math.random() > 0.20) { // 80% participation
      const ability = 0.35 + Math.random() * 0.55;
      submitAttemptTx(
        students11AWithIds[i].id!,
        quiz3Id,
        quiz3Questions,
        true, 0.33, ability
      );
      attemptCount++;
    }
  }

  console.log(`✓ ${attemptCount} sample quiz attempts generated`);

  console.log('\n✅ Seeding complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Login credentials:');
  console.log('  Admin:   nour@nour-centre.jo        / admin123');
  console.log('  Teacher: ahmad@nour-centre.jo       / teacher123');
  console.log('  Teacher: sara@nour-centre.jo        / teacher123');
  console.log('  Teacher: mohammad@nour-centre.jo    / teacher123');
  console.log('  Student: student001@nour-centre.jo  / student123  (class 10A)');
  console.log('  Student: student021@nour-centre.jo  / student123  (class 10B)');
  console.log('  Student: student041@nour-centre.jo  / student123  (class 11A)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
