# GITAM Interview Portal — PROJECT_SPEC.md

## 1. System Overview
The **GITAM Interview Portal** is a student interview booking and administration portal for GITAM University.
It enables eligible students to book 10-minute interview slots across designated interview dates, and provides administrators with scheduling, review (Approve/Reject/Flag), and monitoring capabilities.

## 2. Technology Stack & Coding Languages
- **Frontend Framework**: React 19 (TypeScript)
- **Build System & Tooling**: Vite, npm
- **Language**: TypeScript (strict mode, ES2022 target, bundler module resolution)
- **Styling**: Standard CSS (responsive, mobile-first, custom properties, GITAM university theme)
- **Routing**: React Router DOM (v7)
- **Linter**: ESLint (v9 flat config, typescript-eslint, react-hooks, react-refresh)
- **Hosting & Edge**: Netlify (configured in `netlify.toml` with SPA redirects and functions proxy)
- **Authentication (Phase 3)**: Supabase Auth
- **Backend Services (Phase 4)**: Google Apps Script Web App (GAS)
- **Database (Phase 5)**: Google Sheets (Strict 3-tab architecture: `Student Database`, `Approved`, `Rejected`)

## 3. Development Phases
1. **Phase 1 — Project Foundation & Environment Setup**: React + Vite + TypeScript setup, clean folder hierarchy, configurations (`.env.example`, `netlify.toml`, `tsconfig`), basic shell and routes (`/student`, `/admin`).
2. **Phase 2 — Complete Student and Admin Frontend Using Mock Data**: Shared schedule generator, 36 slots/day, 6 dates (216 slots total), Student booking directory, Admin dashboard with summary metrics, pagination (10/25/50/all), expandable student profiles, review actions (Approve, Reject, Flag, Clear Flag), search & filtering, unbooked and flagged student sections.
3. **Phase 3 — Supabase Authentication & Access Control**: Student login, GITAM email registration validation, Admin allowlist authentication, session persistence, protected routes.
4. **Phase 4 — Google Apps Script Backend**: Central schedule generator, concurrency control via `LockService`, idempotency (`BookingRequestID`), slot booking, admin review APIs.
5. **Phase 5 — Google Sheets Database Integration**: 3-tab structure (`Student Database`, `Approved`, `Rejected`), 5–10s polling, tab focus refresh, zero duplicate records.
6. **Phase 6 — Complete QA, Security Audit and Deployment**: End-to-end tests, security audit (no exposed secrets, server-side auth validation), production build & deploy verification.

## 4. Schedule Rules (Shared Definition)
- **Dates (6 days)**:
  - 20 November 2026
  - 23 November 2026
  - 24 November 2026
  - 25 November 2026
  - 26 November 2026
  - 27 November 2026
- **Sessions per Day**:
  - Morning: 9:00 AM – 12:00 PM (18 slots)
  - Afternoon: 1:00 PM – 4:00 PM (18 slots)
  - Slot duration: 10 minutes
  - Total per day: 36 slots
  - Total event slots: 216 slots
  - Lunch break: 12:00 PM – 1:00 PM (never displayed in student directory)
  - No weekends.

## 5. Security & Architectural Constraints
- **One active booking per student**.
- **One student per slot**.
- Independent status tracking: `BookingStatus` (`Booked`, `Not Booked`, `Cancelled`), `ApprovalStatus` (`Pending`, `Approved`, `Rejected`), and `ReviewFlagStatus` (`Not Flagged`, `Flagged for Review`).
- React never communicates directly with Google Sheets; all operations route via the backend.
- No secrets or service-role keys exposed to the client.
