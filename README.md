# 🎓 Nour Tutoring Centre – Weekly Quiz Platform
> **مركز نور التعليمي – منصة الاختبارات الأسبوعية**

A modern, reliable, and bilingual timed quiz platform built for **Nour Tutoring Centre in Amman, Jordan** (300 students, 12 teachers). It replaces paper-based weekly quizzes with an automated system featuring time-window scheduling, countdown auto-submission, customizable negative marking, Arabic RTL support, and real-time class performance reporting.

---

## 🚀 Quick Start (One Command)

### Option A: Using Docker Compose (Recommended)

On any machine with Docker and Docker Compose installed:

```bash
docker compose up --build
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.  
The database is automatically initialized and seeded with sample data during the build.

To stop the container:
```bash
docker compose down
```

---

### Option B: Local Node.js Environment (No Docker)

Requirements: **Node.js 20+** and **npm**.

```bash
# 1. Install dependencies
npm install

# 2. Seed database with realistic teachers, students, and quizzes
npm run seed

# 3. Start development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

*(For production mode, run `npm run build && npm start`)*.

---

## 🔑 Demo Login Credentials

The seed script pre-populates realistic Jordanian student, teacher, and administrator accounts:

| Role | Email | Password | Details |
|---|---|---|---|
| **Admin (Nour)** | `nour@nour-centre.jo` | `admin123` | Full centre dashboard, missed quiz report, class averages |
| **Teacher (Math)** | `ahmad@nour-centre.jo` | `teacher123` | Ahmad Al-Khatib · Created Algebra quiz for Class 10A |
| **Teacher (English)** | `sara@nour-centre.jo` | `teacher123` | Sara Khoury · Created Lit quiz for Class 10B |
| **Teacher (Science)** | `mohammad@nour-centre.jo`| `teacher123` | Mohammad Al-Najjar · Created Chemistry quiz for 11A |
| **Teacher (Arabic)** | `lina@nour-centre.jo` | `teacher123` | Lina Al-Masri |
| **Student (Class 10A)**| `student001@nour-centre.jo`| `student123` | Tareq Abdullah · Has access to 10A quizzes |
| **Student (Class 10B)**| `student021@nour-centre.jo`| `student123` | Rima Al-Kurdi · Has access to 10B quizzes |
| **Student (Class 11A)**| `student041@nour-centre.jo`| `student123` | Kareem Al-Sayegh · Has access to 11A quizzes |

> 💡 **Tip:** Any student from `student001@nour-centre.jo` through `student060@nour-centre.jo` can be used (password: `student123`).

---

## ✨ Key Features & Requirements Addressed

### 1. Student Quiz Experience
- **Timed Countdown & Auto-Submit**: Visual countdown clock with warning colors (amber at 5 min, red at 1 min). The quiz automatically submits when the clock strikes zero or if the availability window closes.
- **Single Attempt Guarantee**: Enforced at the database constraint level (`UNIQUE(student_id, quiz_id)`). Students cannot retake quizzes or submit multiple attempts.
- **Negative Marking Transparency**: When enabled, the quiz header displays a clear warning showing the exact penalty fraction (e.g., `-0.25` pts per wrong answer) and advising students not to guess blindly. Unanswered questions receive 0 points.
- **Instant Detailed Feedback**: On submission, students see their final score, percentage, letter grade, and an answer review showing which questions they got right or wrong.

### 2. Teacher Quiz Management
- **Intuitive Quiz Builder**: Teachers can create quizzes with custom time limits (e.g. 20 min), opening/closing availability windows, and assign them to specific classes.
- **Negative Marking Toggle**: Option per quiz to enable or disable penalty marking, with configurable penalty fractions (¼, ⅓, ½, 1×).
- **Class Submission Analytics**: Teachers can view all student submissions, average scores, class participation rates, individual student grades, and late-submission flags.

### 3. Nour's Admin Overview & Missed Quiz Tracker
- **Weekly Centre Overview**: Total quizzes held, total attempts submitted, overall centre average score.
- **Class-by-Class Breakdown**: Average scores and participation rates across cohorts (10A, 10B, 11A).
- **Missed Quiz Tracker**: Real-time query identifying any student who did not submit an attempt for a quiz after the window has closed, allowing Nour to contact parents or schedule makeups.
- **Full Reports Roster**: Student performance table grouped by class with class averages and letter grades.

### 4. Arabic RTL & Bilingual Design
- Full support for Arabic names and right-to-left (RTL) quiz text using modern typography (*IBM Plex Sans Arabic* and *Outfit*).
- Form inputs automatically adjust text direction with `dir="auto"`.

---

## 📊 Spreadsheet / CSV Data Import

As noted in the brief, real student and teacher data often arrives as spreadsheets. A bulk CSV ingestion pipeline is provided:

```bash
# Import classes, teachers, and students from data/csv/
npm run import:csv
```

Template files are located in `data/csv/`:
- `data/csv/classes.csv`: List of classes/cohorts.
- `data/csv/teachers.csv`: Teacher names (Arabic + English) and emails.
- `data/csv/students.csv`: Student rosters with class assignments.

---

## 🧪 Running Automated Tests

A comprehensive suite of 35 automated tests across 5 test suites covers scoring formulas, timing logic, API security flows, database constraints, and authentication:

```bash
npm test
```

### Test Coverage Summary:
- **`tests/scoring.test.ts`**: Verifies regular scoring, negative marking penalties (0.25, 0.33, 0.5), unanswered questions (0 penalty), zero clamping, and edge cases.
- **`tests/timing.test.ts`**: Verifies `computeDeadline` duration calculations, availability window clamping (`closes_at`), and `isLateSubmission` with grace period buffer tolerance.
- **`tests/api-quiz-flow.test.ts`**: Integration test exercising API start/submit lifecycle, single attempt uniqueness, class authorization, deadline clamping, student ownership validation, and late submission flagging.
- **`tests/quiz-db.test.ts`**: Verifies attempt uniqueness constraints, window enforcement (`opens_at` / `closes_at`), cascade deletes, and class-based filtering.
- **`tests/auth.test.ts`**: Verifies JWT creation, cookie extraction, role payloads, and tampering rejection.

---

## 📁 Project Architecture

```
quiz-platform/
├── Dockerfile                  # Container build with build-time seed
├── docker-compose.yml          # One-command orchestration
├── DECISIONS.md                # Detailed rationale for open-ended requirements
├── AI_USAGE.md                 # Disclosure of AI tools and verification
├── data/
│   ├── quiz.db                 # SQLite database (generated on seed)
│   └── csv/                    # Spreadsheet import templates
├── scripts/
│   ├── seed.ts                 # Realistic database seed (60 students, 3 quizzes)
│   └── import-csv.ts           # Bulk CSV spreadsheet importer
├── src/
│   ├── app/
│   │   ├── page.tsx            # Landing & role-based redirect
│   │   ├── login/              # Bilingual login page
│   │   ├── student/            # Dashboard, quiz room, results view
│   │   ├── teacher/            # Teacher dashboard, quiz builder, analytics
│   │   ├── admin/              # Nour's centre overview & missed quiz report
│   │   └── api/                # REST endpoints with session authentication
│   ├── components/             # Reusable UI (Navbar, Timer, etc.)
│   ├── lib/
│   │   ├── auth.ts             # JWT token handling & httpOnly cookies
│   │   ├── db.ts               # better-sqlite3 singleton with schema
│   │   └── scoring.ts          # Score calculation engine with penalty logic
│   └── middleware.ts           # Route protection & role enforcement
└── tests/
    ├── scoring.test.ts         # Unit tests for scoring engine
    ├── quiz-db.test.ts         # Database integration tests
    └── auth.test.ts            # Authentication tests
```

---

## 📜 Documentation References
- [DECISIONS.md](DECISIONS.md): Architectural decisions and trade-offs made during development.
- [AI_USAGE.md](AI_USAGE.md): Methodology, tooling disclosure, and validation notes.
