# YouAreSelected

A Next.js MCQ examination platform with student and administrator portals, PostgreSQL persistence, secure account sessions, timed attempts, grading, result publication and reporting. Phase 1's visual design and routes are preserved; production runtime mock authentication and browser storage are removed.

## Setup

Use Node.js 24 and npm. Copy `.env.example` to ignored `.env.local` and replace the placeholders with valid server-only configuration:

- `DATABASE_URL` — pooled Neon PostgreSQL URL with SSL.
- `DATABASE_URL_UNPOOLED` — direct Neon PostgreSQL URL for controlled database operations.
- `AUTH_SECRET` — at least 32 high-entropy random characters.
- `APP_URL` — canonical application origin; use the real HTTPS origin on Vercel.

Do not commit secrets or expose them through `NEXT_PUBLIC_` variables. There are no public demo credentials or default administrator passwords.

```sh
npm ci
npm run db:inspect
npm run db:plan
# Review migrations/0001_foundation.sql and existing schema before continuing.
npm run db:migrate
npm run db:verify
npm run db:health
```

Supply `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 16 characters securely, optionally `BOOTSTRAP_ADMIN_NAME`, then run `npm run admin:bootstrap`. Remove bootstrap variables after success. This one-time CLI refuses automatic first-user promotion and becomes a no-op after setup.

```sh
npm run dev
# http://localhost:3000
```

To load optional sample examination content, explicitly set `CONFIRM_SAMPLE_SEED=yes` and run `npm run db:seed`. It is idempotent, preserves existing matching records and imports no demo passwords, user accounts or fake submissions.

## Architecture and workflows

- **UI:** App Router, React, strict TypeScript, Tailwind, Radix/shadcn-style primitives, Lucide, Motion, Recharts, TanStack Table, Sonner, React Hook Form and Zod.
- **Backend:** Better Auth + Drizzle/PostgreSQL driver, Argon2id, database sessions and atomic database rate limiting. Central server-side authorization, input validation, resource ownership checks, parameterized queries and audit logging.
- **Data:** normalized schema and checksum-verified explicit SQL migrations. Client Zustand is a temporary response cache; PostgreSQL is authoritative.
- **Student:** real registration and pending approval, secure login/logout, profile/password changes, assigned examinations, instructions, server-timed/resumable examination, persisted answers/review, submission receipt, private results and permitted answer review.
- **Admin:** live metrics, server-paginated learner management, approvals/suspensions, exam CRUD/duplication/publication, persistent question/options editor, assignments, explicit time-zone schedules, answer sheets, result release/withholding, reports and organization settings.
- **Integrity:** transactional start/save/submit, row/advisory locks, response revisions, idempotent finalization, immutable attempt/grading snapshots, database deadlines and private answer keys. Network interruption shows unsaved state and queued in-tab retries; submission flushes saves.
- **Exports:** administrator-authorized CSV/XLSX from fresh database records, including users, assignments, participation, scores, sections and pass/fail. Output is bounded to 10,000 rows with spreadsheet formula-injection protection.

All original public, `/student/*` and `/admin/*` screen routes remain. No real database migration, seed or bootstrap runs automatically during builds or requests.

See [Phase 2 operations](docs/PHASE_2.md) for the table inventory, API list, migration history, bootstrap, authentication details, concurrency/expiry policies, provider configuration and remaining dependencies. See [verification](docs/VERIFICATION.md) for actual test outcomes and limitations.

## Tests and build

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests run the PostgreSQL engine in isolated PGlite. Browser tests start a disposable local PostgreSQL cluster and the real Next.js application, use random administrator credentials, inspect persisted rows, and shut down without contacting production. They require local port 3000 and PostgreSQL test port 55432. Test database files stay within ignored `.test-databases/`; no system database service or user is installed. For provider-specific integration, use a separate Neon branch with `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED`, never the production database.

```sh
npm run build
npm start
```

## Vercel

Import the GitHub repository with **Next.js**, root `./`, Node 24, install command `npm ci`, build command `npm run build`, and default output settings. Configure all server environment variables separately for Production, Preview and Development, with separate Neon branches and secrets. Review/apply migrations and bootstrap the intended database explicitly before real users access it. The build does not need to contact the database and does not provision infrastructure.

Optional reset email needs `RESEND_API_KEY` and verified `EMAIL_FROM`. Without them, the form clearly reports unavailable delivery and sends nothing. Images use HTTPS URLs; uploads require future durable object-storage configuration. Vercel's ephemeral filesystem is never used for runtime application records.

A successful local build or Git push is not proof of deployment or Neon connectivity. Verify the returned Vercel URL and real provider connection separately. Phase 3 audits, load testing, backup/recovery and operational sign-off remain a separate phase.

## Phase 3 hardening and release status

Read [PHASE_3_FINAL_AUDIT.md](PHASE_3_FINAL_AUDIT.md) for the release decision, coverage, measured local load results and outstanding production gates. The release is currently **NOT READY FOR PRODUCTION** until preview/HTTPS, reset email, project-specific recovery and staging capacity checks are completed.

```sh
npm run test:phase3
```

This command creates a disposable loopback PostgreSQL cluster, deterministic test fixtures, controlled 10/50/100/250/500-candidate repository workloads and a second disposable recovery database. It never seeds the configured Neon database. Run it separately from browser tests because both harnesses use port 55432. Raw sanitized measurements are saved in ignored `verification-artifacts/`.

The owner-supplied Neon database was inspected and migrated through `0003_response_deadline_guard.sql`. Initial administrator bootstrap and actual provider sign-in/diagnostics/logout checks passed. Local `.env.local` contains server configuration and `.env.bootstrap` contains the generated initial administrator credentials; both are ignored. Transfer the initial password securely, change it and remove the bootstrap credential file after setup. Do not copy either file into documentation or Git. Provider verification does not establish Vercel deployment readiness.

See [RECOVERY.md](docs/RECOVERY.md) before database recovery or migration incident work. Administrator-only `/api/health` returns reachability/latency; it exposes no connection settings.
