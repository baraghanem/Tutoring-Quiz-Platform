# AI Usage & Collaboration Disclosure

This document discloses how AI tools were utilized during the design, implementation, and verification of the Nour Tutoring Centre Quiz Platform.

---

## 1. Overview of AI Assistance

AI was utilized as an accelerated pair-programmer across multiple phases of the project lifecycle:

| Project Phase | Primary AI Contribution | Human/Engineering Review & Control |
|---|---|---|
| **Architecture & Schema** | Drafted SQLite schema with foreign keys, cascading deletes, and unique constraints. | Audited schema against brief requirements (negative marking, attempt uniqueness, quiz availability window). |
| **Realistic Bilingual Data** | Generated realistic Jordanian Arabic names, teacher rosters, classes, and domain-accurate quiz questions (Arabic Algebra, English Literature, Arabic Chemistry). | Validated pedagogical accuracy, question correctness, and RTL formatting behavior. |
| **Scoring Engine** | Outlined negative marking formulas and edge cases (unanswered questions, clamping at zero, penalty fraction options). | Wrote isolated unit tests in Vitest covering all fraction variants (0.25, 0.33, 0.5) and clamped boundary tests. |
| **Frontend UI & Components** | Generated responsive Next.js pages with CSS variables, clean typography (IBM Plex Sans Arabic), and accessible form controls. | Refactored form handlers to strictly comply with TypeScript 5 strict type checking. |
| **Testing & Debugging** | Authored test suites for database operations, scoring calculations, and JWT authentication. | Diagnosed SQLite `PRAGMA foreign_keys = ON` nuance during cascade delete verification and corrected test fixtures. |

---

## 2. Key Areas of AI Acceleration

### A. Realistic Domain Data Generation
- Created a realistic demographic model for an Amman tutoring centre:
  - 12 realistic teacher profiles with Arabic and English transliterated names.
  - 60 students distributed across Grade 10 and Grade 11 cohorts (10A, 10B, 11A).
  - 3 complete 15-question quizzes covering math, literature, and science, complete with varied point distributions and negative marking settings.
  - 57 simulated historical student attempts with realistic score distributions for Nour's reporting dashboard.

### B. Anti-Cheating & Clock Synchronization
- Identified the vulnerability of relying solely on client-side JavaScript timers for auto-submission.
- Designed a dual-validation model:
  1. Client-side UX timer with auto-submit on countdown expiry.
  2. Server-side start timestamp verification with a 30-second network latency buffer to prevent tampered payloads.

### C. Spreadsheet Ingestion Pipeline
- Generated the CSV parser and bulk importer in `scripts/import-csv.ts` and sample CSV files in `data/csv/` so that when the tutoring centre exports spreadsheets, Nour can import them in one command.

---

## 3. Human Engineering Oversight & Fixes

During the development process, engineering oversight resolved several specific implementation details:
1. **TypeScript Strict Type Incompatibility**:
   - The interactive quiz builder had a generic `updateOption` signature where `value: string | boolean` caused TypeScript union narrowing errors with Next.js 16 / Turbopack build. This was refactored into a type-safe discriminated mapping.
2. **SQLite Foreign Key Enforcement**:
   - In SQLite, foreign key constraints must be explicitly enabled per connection. Test fixtures were updated to ensure cascade deletes clean up questions and options automatically.
3. **Dependency Optimization**:
   - Verified that native bindings for `better-sqlite3` compile seamlessly inside Debian slim containers with `python3 make g++`, and ensured `tsx` was added directly to devDependencies to eliminate npx download latency.
