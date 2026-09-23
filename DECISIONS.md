# Architectural & Product Decisions: Nour Tutoring Centre Quiz Platform

As stated in the project brief: *"The client is not available for questions. When something is unclear, decide, and write the decision down. That is part of the work."*

This document outlines the key product, architectural, security, and pedagogical decisions made during the design and implementation of this platform.

---

## 1. Single Attempt Enforcement & Anti-Cheating

### Context
The brief specifies: *"Once a student starts, the clock ticks down. If time runs out, it auto-submits. One attempt per student."*

### Decisions
1. **Atomic Attempt Creation**:
   - When a student clicks "Start Quiz", an attempt record is created in SQLite with `started_at = CURRENT_TIMESTAMP`.
   - The `attempts` table contains a hard database-level unique constraint: `UNIQUE(student_id, quiz_id)`.
   - Any duplicate POST request to `/api/student/quiz/[id]/start` is rejected with `409 Conflict` or returns the ongoing attempt.
2. **Server-Side Time Limit Enforcement**:
   - Client-side JavaScript provides an interactive countdown timer with visual urgency alerts (turning amber at 5m, red at 1m) and triggers auto-submission at `0:00`.
   - To prevent cheating via clock manipulation or pausing JavaScript, the server verifies `submitted_at <= started_at + (time_limit_minutes * 60) + 30 seconds` (a 30-second network latency buffer). Late submissions are capped or flagged.
3. **No Retakes**:
   - Once submitted (`is_submitted = 1`), answers cannot be altered and the quiz cannot be re-taken.

---

## 2. Negative Marking Mechanics

### Context
The brief specifies: *"We have some teachers who want negative marking (lose 0.25 points for a wrong answer to discourage guessing) and some who hate it. Make that an option per quiz."*

### Decisions
1. **Configurable Per Quiz**:
   - `negative_marking` boolean flag (`0` or `1`) on each quiz.
   - `penalty_fraction` configurable per quiz (defaults to `0.25` / ¼ point, with choices of ¼, ⅓, ½, or 1× in the quiz builder).
2. **Pedagogical Fairness**:
   - **Correct Answer**: Award full question points (e.g. `+1.0` or custom points).
   - **Unanswered / Skipped Question**: `0.0` points (no penalty). Students who recognize they do not know an answer are not penalized, which aligns with standard SAT/Tawjihi testing practices.
   - **Incorrect Answer**: Deduct `points * penalty_fraction` (e.g. `-0.25`).
   - **Clamping at Zero**: A student's total score cannot drop below `0.0` on any quiz.
3. **Clear Student Notification**:
   - The quiz instructions and top banner explicitly warn students if negative marking is enabled, explaining the exact penalty fraction so students can make informed decisions about guessing.

---

## 3. Bilingualism & Arabic RTL Support

### Context
The brief specifies: *"Our students speak Arabic and English. The interface can be in either language (or both), but Arabic names and quiz content must display correctly (RTL for Arabic text)."*

### Decisions
1. **Bilingual Schema**:
   - Users have both `name_ar` and `name_en` fields (e.g. `أحمد الخطيب` / `Ahmad Al-Khatib`).
   - The UI defaults to showing Arabic names with English transliteration where helpful.
2. **Directional Typography & Layout**:
   - All text inputs and textareas use `dir="auto"`, allowing the browser to automatically format Arabic input right-to-left (RTL) and English input left-to-right (LTR).
   - High-readability fonts loaded: Google Font *IBM Plex Sans Arabic* and *Outfit* for modern numerals and typography.
   - Badges, status pills, and scorecards use bidirectional styling that preserves numerical readability (e.g., scores like `8.5 / 10` remain formatted correctly without mirrored punctuation).

---

## 4. Class-Based Segmentation

### Context
Nour's centre has approximately 300 students and 12 teachers across multiple grade cohorts (e.g., Class 10A, Class 10B, Class 11A).

### Decisions
1. **Targeted Quizzes**:
   - Each quiz is created for a designated `class_id`.
   - Students only see and take quizzes assigned to their class, preventing student clutter and accidental cross-grade access.
2. **Teacher Class Scoping**:
   - Teachers select which class a quiz is assigned to upon creation.
   - Results, student lists, and missed quiz tracking are organized cleanly by class.

---

## 5. Quiz Availability Windows

### Context
The brief specifies: *"a window when it is open (e.g. Friday 2pm to Sunday 8pm)."*

### Decisions
1. **Timestamp Format**:
   - All `opens_at` and `closes_at` timestamps are stored as standard ISO-8601 strings in UTC.
2. **Student Access Rules**:
   - **Before `opens_at`**: Quiz displays as "Upcoming" with opening date/time; cannot be started.
   - **Between `opens_at` and `closes_at`**: Quiz displays as "Active"; student can start their attempt.
   - **After `closes_at`**: Quiz displays as "Closed"; unattempted quizzes are marked as "Missed".
3. **In-Progress at Close Time**:
   - If a student starts 5 minutes before the quiz window closes, the time limit is constrained by `min(remaining_quiz_duration, time_until_window_close)`.

---

## 6. Nour's (Admin) Dashboard & Missed Quiz Reporting

### Context
The brief specifies: *"Nour (the admin) wants a simple overview: how many students took quizzes this week, average scores per class, and any students who missed their quiz."*

### Decisions
1. **Central KPI Cards**:
   - Total students, total quizzes, total completed attempts this week, overall centre average score.
2. **Class Breakdown**:
   - Cards for each class displaying participation rate and average score.
3. **Missed Quiz Detection**:
   - Calculated by querying students enrolled in a class who have **no submitted attempt** for any quiz whose `closes_at < CURRENT_TIMESTAMP`.
   - Displays student name, email, class, and the missed quiz title so Nour can follow up with parents or schedule makeup sessions.
4. **Question Analytics for Teachers**:
   - Item difficulty analysis shows % of students who answered each question correctly vs incorrectly, highlighting the most missed questions.

---

## 7. Data Ingestion & Spreadsheet Loading

### Context
The brief specifies: *"There are no files attached to this brief. Create your own sample data that matches what the client describes. Make it realistic, and make it loadable, because the real data will arrive as spreadsheets."*

### Decisions
1. **Bilingual Seed Dataset (`npm run seed`)**:
   - Automatically populates 1 admin (Nour), 4 teachers, 60 students across 3 classes (10A, 10B, 11A), 3 complete quizzes (Arabic Algebra, English Literature, Arabic Chemistry), and 57 realistic past attempts.
2. **Spreadsheet CSV Importer (`npm run import:csv`)**:
   - Provides ready-to-use CSV template files in `data/csv/`:
     * `classes.csv`
     * `teachers.csv` (all 12 teachers in Amman)
     * `students.csv`
   - When real school rosters arrive as CSV/Excel exports, Nour can drop the files into `data/csv/` and run `npm run import:csv`.

---

## 8. Technology Stack & Database Selection

### Context
The brief specifies: *"Use any language, framework or database you like. We will run your project from your README, so it must start with one command on a clean machine. Docker Compose is the easiest way to guarantee that. A no-Docker path with SQLite is fine too..."*

### Decisions
1. **Next.js 16 + React 19 + TypeScript**:
   - Unified stack for frontend UI, API routes, and backend business logic.
   - Zero client-side bundle bloat via React Server Components.
2. **SQLite via `better-sqlite3`**:
   - Synchronous, zero-network-latency embedded database.
   - Runs everywhere without needing external database servers (Postgres/MySQL) to be running or configured.
   - WAL (Write-Ahead Logging) enabled for high concurrent read performance.
   - Persistent disk volume mapped in Docker Compose to ensure data survives container restarts.
3. **Stateless JWT Auth**:
   - Signed using `jose` with `HS256`, stored in secure `httpOnly` cookies.
   - Works seamlessly across server-side rendering, API handlers, and route middleware.
