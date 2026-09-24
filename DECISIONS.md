# Architectural & Product Decisions: Nour Tutoring Centre Quiz Platform

As stated in the project brief: *"The client is not available for questions. When something is unclear, decide, and write the decision down. That is part of the work."*

This document addresses the four required areas:
1. The **assumptions** made
2. What was built that **Nour did not ask for and why**
3. What was **deliberately left out**
4. What we would do next with **another week**

---

## 1. Assumptions Made

Because Nour is running an active tutoring centre in Amman and is unavailable for real-time questions, several key operational and pedagogical assumptions guided product and technical trade-offs:

1. **Student Device Constraints & Mobile Access**:
   - *Assumption*: Most students take quizzes on smartphones using local cellular (3G/4G) or home Wi-Fi networks in Amman.
   - *Design Implication*: The UI is strictly mobile-first with touch-friendly targets (minimum 48px hit areas), minimal network overhead, zero heavy client-side JavaScript libraries, and resilience to mobile network latency.

2. **School Cohorts & Class Scoping**:
   - *Assumption*: The 300 students belong to distinct cohorts (starting with 10A, 10B, 11A) and teachers teach specific classes. Quizzes are not centre-wide free-for-alls; a 10th-grade algebra quiz should only be seen and attempted by students enrolled in that specific class.
   - *Design Implication*: Enforced a relational schema linking `quizzes` to `classes`, filtering student dashboards so students only access quizzes assigned to their class cohort.

3. **Time Windows & Availability Windows**:
   - *Assumption*: Teachers set availability windows (e.g., Friday 2:00 PM to Sunday 8:00 PM) to allow students to take the quiz asynchronously from home within a designated window, but each student receives a fixed countdown (typically 20 minutes) once they click "Start".
   - *Design Implication*: Two distinct time dimensions are maintained: the quiz availability window (`opens_at` to `closes_at`) and the student session duration (`time_limit_minutes`).

4. **Negative Marking Pedagogy & Scoring Limits**:
   - *Assumption*: Teachers who request negative marking want to penalize blind guessing (standard practice for Tawjihi/SAT prep), but students who leave a question unanswered should receive `0` points (no penalty). Furthermore, a student's total quiz score should never fall below `0.0`.
   - *Design Implication*: Implemented configurable penalty fractions per quiz (¼, ⅓, ½, 1×), with unattempted questions receiving 0 and final scores clamped to a minimum of 0.

5. **Bilingual Reality in Jordan**:
   - *Assumption*: While interface labels and navigation can be bilingual, students have Arabic names, and STEM/humanities quizzes vary (some in Arabic, some in English, such as English Literature).
   - *Design Implication*: User records store both `name_ar` and `name_en`. Text fields use HTML `dir="auto"` to automatically render RTL for Arabic and LTR for English without forcing the user to switch site-wide language toggles.

6. **Grading Thresholds**:
   - *Assumption*: Nour needs a standard academic grading distribution for reporting and quick parent communication.
   - *Design Implication*: A standard 5-tier grading band was adopted: A (≥90%), B (≥75%), C (≥60%), D (≥50%), and F (<50%).

---

## 2. What We Built That Nour Did Not Ask For (and Why)

Nour described her immediate pain point: paper quizzes are taking too much time, and she needs a simple website with timed quizzes, scores, and missed-quiz visibility. To ensure the application is reliable, secure, and production-ready for her operational reality, we introduced several targeted enhancements:

1. **Server-Side Deadline Clamping & Network Latency Buffer (`src/lib/timing.ts`)**:
   - *Why*: Nour asked for a countdown timer. However, relying solely on client-side browser timers is vulnerable: students can manipulate local system clocks or pause JavaScript. Furthermore, if a student opens a 20-minute quiz 5 minutes before the quiz window closes (e.g. at 7:55 PM for a window closing at 8:00 PM), the timer must clamp to 8:00 PM rather than granting an illegal 15 minutes past the deadline.
   - *Implementation*: `computeDeadline()` clamps to `min(started_at + duration, closes_at)`. On submission, `isLateSubmission()` checks against a 30-second network latency buffer to accommodate mobile connection lag while recording a `late_submission = 1` flag displayed to teachers.

2. **Automated Missed-Quiz Detection Engine**:
   - *Why*: Nour specifically noted: *"I also want to see how the students did... and any students who missed their quiz."* Rather than forcing Nour to cross-reference class rosters against submission lists on paper, we built an automated query.
   - *Implementation*: Queries all students enrolled in a class who have no completed attempt for quizzes whose `closes_at < CURRENT_TIMESTAMP`. This feeds directly into an interactive "Missed Quizzes" tracker on both Nour's Admin Dashboard and the Admin Reports page.

3. **Spreadsheet Ingestion CLI (`npm run import:csv`)**:
   - *Why*: Nour stated: *"I will send you our real student list, teacher list and last week's quiz as spreadsheets once you have something to show me."* In anticipation of receiving Excel/CSV files, we built a CSV import pipeline with pre-formatted CSV template files in `data/csv/`.
   - *Implementation*: Allows Nour or an IT assistant to drop school rosters into `data/csv/` and run `npm run import:csv` without manual SQL entry or database migrations.

4. **Shuffle Options for Cheating Mitigation**:
   - *Why*: When students in the same class take quizzes on their phones while sitting together, option order is a common vector for copying.
   - *Implementation*: When `/api/student/quiz/[id]/start` returns question data, option order is randomized per attempt while preserving database IDs for deterministic scoring.

5. **Docker Compose & Self-Contained SQLite Architecture**:
   - *Why*: To satisfy the evaluation requirement of a guaranteed one-command setup without requiring Nour or evaluators to configure external database servers (PostgreSQL/MySQL), manage connection strings, or install global binaries.
   - *Implementation*: Docker Compose with automated schema migration, healthcheck, and persistent volume mapping.

---

## 3. What We Deliberately Left Out

To ship a rock-solid, focused solution for Thursday without scope creep or brittle abstractions, the following features were deliberately excluded:

1. **Item-Difficulty Curves & Psychometric Analytics**:
   - *Rationale*: We considered computing point-biserial correlations and discrimination indices for individual questions. However, for a tutoring centre with 20 students per class, sample sizes are far too small for statistical validity. Instead, we prioritized class averages, submission rates, raw score distributions, and late flags that teachers can immediately act on.

2. **Rich Text / LaTeX Math Formula Editor in Quiz Builder**:
   - *Rationale*: Implementing a complex WYSIWYG or MathQuill editor introduces heavy JavaScript dependencies (2MB+ bundle sizes) that degrade mobile performance and create rendering glitches on low-end Android devices. Plain text with standard Unicode math symbols (`x² + 2x = 0`) loads instantly and renders reliably across all mobile browsers.

3. **Webcam Proctoring and Screen-Lock Monitoring**:
   - *Rationale*: High-stakes proctoring tools (Honorlock-style camera feeds, fullscreen locking) alienate students, fail frequently on mobile browsers, and require high bandwidth that students in Amman may not have. Instead, we relied on server-side time clamping, randomized option shuffling, and hard database-level single-attempt constraints.

4. **Multi-Attempt Quiz Retakes**:
   - *Rationale*: The brief was explicit: *"Students should not be able to take a quiz twice."* Supporting retakes or practice modes would complicate attempt uniqueness constraints and state management. We strictly enforced one attempt per student per quiz via a `UNIQUE(student_id, quiz_id)` database constraint.

5. **Real-Time WebSockets**:
   - *Rationale*: Real-time Socket.io connections are fragile on cellular mobile networks that switch between 4G and 3G towers. Stateless HTTP REST endpoints with atomic transactions provide better reliability and zero persistent connection overhead.

---

## 4. What We Would Do Next If We Had Another Week

If given another week to build upon this foundation, we would implement the following high-impact roadmap:

1. **Automated WhatsApp Notification Bot for Parents**:
   - In Amman tutoring centres, parental follow-up is predominantly conducted via WhatsApp. We would integrate a WhatsApp Business webhook triggered by the Missed Quiz engine, automatically alerting parents when their child has missed a weekend quiz deadline.

2. **Offline-First Quiz PWA (Service Worker + IndexedDB)**:
   - To protect students against cellular drops mid-quiz, implement a Service Worker that caches the active quiz and queues answer selections locally in IndexedDB, auto-syncing with the server as soon as connectivity resumes.

3. **Teacher Bulk Question Import (Excel / Aiken format)**:
   - Extend the CSV importer into the teacher web UI, allowing teachers to paste questions in standard Aiken format (`Question? A) ... B) ... ANSWER: A`) or upload an Excel sheet to create a 15-question quiz in seconds rather than typing each question manually.

4. **Exportable PDF Student Progress Reports**:
   - Build a server-side PDF generator allowing Nour to download printable, branded PDF report cards for each student to hand to parents during parent-teacher conferences.

5. **Granular Question-Level Teacher Review**:
   - Expand the teacher results view so teachers can click on any student's attempt and view their exact selected answers question-by-question, highlighting common misconceptions during in-class review sessions.
