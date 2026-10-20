# YouAreSelected

A responsive MCQ examination workspace with separate student and administrator experiences. **Phase 1 is a functional browser demo, not a production examination or authentication service.** No database, paid service, secret, or environment variable is needed.

## Run locally

Use Node.js 22 LTS or newer (validated here with Node 24) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. To run the production build:

```sh
npm run build
npm start
```

| Role          | Demo email          | Demo password   |
| ------------- | ------------------- | --------------- |
| Administrator | `admin@demo.test`   | `Admin@12345`   |
| Student       | `student@demo.test` | `Student@12345` |

Login buttons fill the credentials; click Sign in afterwards. These credentials must never be used for real accounts. Registration creates a **pending** learner in the same browser workspace. Log out, sign in as admin, approve the learner, and assign an exam before attempting it.

## Architecture

- Next.js App Router, React, strict TypeScript, Tailwind CSS 4, Inter typography with system fallback.
- Reusable shadcn-style primitives using Radix Dialog/Slot, CVA, `cn`, and a checked-in `components.json`. Lucide icons, Sonner notifications, Motion transitions, Recharts analytics.
- React Hook Form + Zod for authentication, Zod persisted-data shape validation, domain validation for exams and questions.
- TanStack Table v8 provides sorting, searching and pagination. ExcelJS is lazy-loaded only when exporting XLSX.
- `src/types/domain.ts`: users, profiles, exams, sections, questions, choices, assignments, schedules, attempts, responses, grading and publication models.
- `src/lib/repositories/contracts.ts`: auth, user, exam, question, assignment, attempt and result repository interfaces.
- `src/lib/mock/store.ts`: isolated browser mock adapter implementing those interfaces through Zustand. Screens consume typed domain data and commands; no database calls or mutable server data stores.
- `src/lib/grading.ts`: pure deterministic single-correct scoring with negative marks, mixed question weights, percentages, pass thresholds and section results.
- `src/lib/rules.ts`: publication validation, eligibility and derived examination status.
- `src/features/`: focused auth, student, admin, exam, question, attempt and result screens.
- `src/components/`: shared shell, navigation, forms, dialogs, tables, chart, math renderer and UI primitives.
- `src/tests/` and `e2e/`: Vitest/Testing Library and Playwright coverage.

## Screens

**Public:** `/`, `/login`, `/register`, `/forgot-password`.

**Student:** `/student/dashboard`, `/student/exams`, `/student/exams/[examId]`, `/student/exams/[examId]/instructions`, `/student/exams/[examId]/attempt`, `/student/exams/[examId]/submitted`, `/student/results`, `/student/results/[attemptId]`, `/student/profile`.

**Administrator:** `/admin`, `/admin/users`, `/admin/exams`, `/admin/exams/new`, `/admin/exams/[examId]/edit`, `/admin/exams/[examId]/questions`, `/admin/exams/[examId]/assignments`, `/admin/exams/[examId]/schedule`, `/admin/results`, `/admin/results/[examId]`, `/admin/settings`.

Additional functioning sidebar destinations: `/admin/questions`, `/admin/assignments`, `/admin/reports`. Loading, error, empty and unknown-route states are included; unknown examination IDs display contextual empty states.

## Working workflows

- Login/logout, role-specific navigation, remembered or tab-scoped sessions, registration, duplicate email detection, pending approval, profile edits and demo password changes. Password recovery is explicitly informational; no fake reset emails are sent.
- Learner search, status filters, sorting, pagination, checkbox selection, confirmed bulk approvals, rejection, suspension, reactivation, profile details and assignment management.
- Create/edit/draft/publish/archive/duplicate exams, preview, named sections, default marks, passing percentage, duration, attempt limits, randomization and navigation/review settings. Publishing validates required fields and question sets. Question count and total marks derive from the actual question bank.
- Single-correct MCQ editor: text, safe bold/italic Markdown, LaTeX between `$` delimiters, optional HTTPS images, two or more choices, persistent correct-answer radio selection, scoring, explanation, difficulty, topic, tags, search, filtering, live student preview, duplication, reordering and confirmed deletion.
- Assign only approved learners, select eligible users individually or in bulk, inspect assigned candidates and remove assignments. Existing submission snapshots remain available.
- Schedule through native date/time pickers. Inputs explicitly use the browser's local IANA time zone, saved alongside UTC instants. End must be later than start. Seed schedules use `Asia/Kolkata`. Cards display local time. Use a browser configured for the desired zone to schedule in that zone.
- Student start checks approval, assignment, publication, availability window and attempt limit. Instructions must be acknowledged.
- Timed attempts support selection/change/clear, review flags, section navigation, question navigator with five states, live counts, refresh persistence and manual confirmation. The deadline is absolute and capped at the scheduled end. Focus/visibility restoration recalculates remaining time, and expiry submits automatically. Submission is idempotent and makes answers read-only.
- Each attempt snapshots its questions, sections and pass threshold. Later question edits cannot retroactively change grading. New attempts use the latest exam data.
- Submission receipt with answered/unanswered/review counts, elapsed time, timestamp and reference. Correct choices are not displayed on submission.
- Results remain hidden in the student UI until admin release. Published results show scores, counts, pass state, section analysis and, where enabled, answer review with explanations. Withholding hides them again.
- Admin results filters, metrics, answer sheets, confirmed release/withhold and actual CSV/XLSX downloads from filtered submitted records. Exports use the same grading result as the UI and neutralize spreadsheet formula injection in text cells.
- Shared state updates across routes, notices, notifications derived from state, responsive navigation, mobile question drawer, focus indicators, labeled controls, confirmation dialogs, reload unsaved-change warnings and reduced-motion support.
- Admin Settings supports organization details and a confirmed complete **Reset Demo Data**.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the dev server automatically if port 3000 is free. Set `CI=1` to require its own server. Browser artifacts are written to ignored `test-results/`; traces are retained for failures. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the actual run outcomes.

For a quick manual demonstration:

1. Sign in as student, open SSC CGL instructions, acknowledge and start.
2. Answer, clear, change and flag responses. Reload to verify persistence and the absolute timer.
3. Submit; verify the receipt and pending result.
4. Log out, sign in as admin, open Results, choose SSC CGL, inspect the answer sheet and release results.
5. Export CSV and Excel. Return as student and view the released score and explanation.
6. In admin, register/approve a new learner, create a draft, add a question, publish, assign and schedule it. Sign in as the new learner in the **same browser** to observe the change.

## Push to GitHub

This repository targets https://github.com/indianservers/YouAreSelected.

```sh
git add .
git commit -m "Build Phase 1 examination platform demo"
git push -u origin main
```

Never force-push over remote changes. If another contributor has pushed, fetch and reconcile first.

## Deploy to Vercel

The app uses standard Next.js without a custom server, runtime filesystem writes or database credentials. A deployment is **not** performed merely by building or pushing this repository.

1. Push the tested project to the GitHub `main` branch.
2. In your Vercel account choose **Add New → Project**, import `indianservers/YouAreSelected`, and allow Vercel access to the repository.
3. Select **Next.js** as the framework preset. Root directory: repository root (`./`). Node.js: 24.x, or a supported Node 22 LTS version.
4. Install command: `npm ci`. Build command: `npm run build`. Leave the output directory at the Next.js default. There is no custom output directory or start command to configure.
5. **Environment variables: none for Phase 1.** `.env.example` deliberately contains no credentials.
6. Click **Deploy**. Vercel will provide the actual deployment URL. Future pushes to the production branch can deploy automatically through Vercel’s Git integration.
7. On that URL test both demo logins, registration/approval in one browser, assignment and scheduling, a timed attempt, submission, release/withhold, and both downloads. Check mobile navigation and refresh persistence.

If a deployment fails, check the first actionable error in Vercel’s build log; confirm the Node version, committed lockfile, framework preset and root directory. Run `npm ci`, typecheck and build locally. No `DATABASE_URL` should be necessary. A browser-only issue can be diagnosed in DevTools and reproduced after **Reset Demo Data**. Each origin has separate storage, so localhost data does not migrate to Vercel. Network access to Google Fonts improves typography; system fonts remain usable when it is unavailable.

## Demo boundaries

**Do not enter confidential information or reuse real passwords.** All demo account records, passwords, questions, answer keys, attempts and results are shipped to or stored in the browser. Hiding the key in the student UI is not secure answer-key protection. A user can inspect or modify client storage and the clock. Role guards, eligibility, grading and publication checks are demonstration behavior only.

State persists per browser origin under `yas-demo-v1`; it does not synchronize across different users’ browsers, devices, tabs already holding independent state, or serverless instances. Invalid/unsupported snapshots fall back to seed data. Clearing browser storage deletes the demo. Reset reanchors sample schedules to the current date. Current question and deadline persist across refreshes. A closed/sleeping browser cannot execute JavaScript; expiry is applied when the attempt page runs again. A submitted attempt cannot be edited through the UI.

Single-correct MCQs are the only implemented grading type. Formatting supports bold, italic and LaTeX, not arbitrary HTML or a complete word processor. Image support uses HTTPS URLs rather than uploaded files. Scheduling uses the browser’s configured time zone. Active attempt deadlines remain fixed if the admin later edits a schedule; new eligibility uses the latest schedule. Auto-submit is mandatory in this demo; immediate result display is always subject to explicit release.

There is no real email delivery, database, server authentication, payment, proctoring or production authorization. Support opens the configured `mailto:` address and is not a ticketing service. Phase 2 and Phase 3 are intentionally not implemented.

## Phase 2 configuration (not required now)

Finalize variable names with the chosen auth/database adapter. Expected inputs are:

- `DATABASE_URL`: private Neon pooled PostgreSQL connection string.
- `DIRECT_DATABASE_URL` (if required by the migration tool): private unpooled migration connection string.
- `AUTH_SECRET`: high-entropy session/signing secret generated for the real authentication implementation.
- `APP_URL` or the auth provider’s canonical origin variable: production HTTPS origin.
- Transactional email provider API key or SMTP credentials and verified sender, **only when real email workflows are implemented**.
- OAuth client IDs/secrets or storage credentials only if those optional capabilities are selected.

Do not prefix private credentials with `NEXT_PUBLIC_`. Phase 2 must add migrations, password hashing, server-enforced RBAC, durable assignments, authoritative timing, transactional submission, private answer keys, server scoring and release permissions. Phase 3 covers security, concurrency, accessibility, performance and operational audits.

## Remaining operational work

Import the GitHub repository into the owner’s Vercel account and verify its returned deployment URL. Production use requires the separately authorized Phase 2 and Phase 3 work. See verification notes for any dependency-tooling limitations.
