> Phase 2 implementation reference. Neon connectivity, migrations and administrator bootstrap were subsequently verified in Phase 3; see [the current audit](../PHASE_3_FINAL_AUDIT.md).

# Phase 2 — database and server implementation

## Architecture and schema

Phase 1's routes, navigation and visual components are retained. The mock authentication/storage adapter is removed. Zustand now holds a temporary **server response cache**, with no localStorage database or credential persistence. Better Auth uses Drizzle's PostgreSQL adapter and Argon2id (19 MiB, two iterations, one lane). Sessions are database-backed, revocable, HttpOnly, SameSite=Lax, and Secure in production. Role and approval fields cannot be supplied by registration clients.

The `yas` PostgreSQL namespace contains users, user_profiles, auth_sessions, auth_accounts, auth_verifications, rate_limits, exams, exam_sections, questions, question_options, exam_assignments, exam_schedules, exam_attempts, attempt_questions, student_responses, exam_results, audit_logs, settings, bootstrap_state and migration_history. Password hashes live in Better Auth's credential account rows, not public user records. Native constraints enforce normalized unique email, foreign keys, unique assignments/responses/results, one active attempt per learner/exam and a deferred exactly-one-correct-answer rule. Questions and options are written in one transaction.

`migrations/0001_foundation.sql` is reviewed, versioned SQL. The explicit migration runner holds an advisory lock, checks the SHA-256 history, refuses an untracked conflicting `yas` schema, and commits the migration and history together. It never resets public schemas or existing production records. No migration or seed runs during a request, application startup or Vercel build.

Ordinary queries use pooled `DATABASE_URL`; migration/inspection/bootstrap commands use `DATABASE_URL_UNPOOLED`. PostgreSQL TLS is mandatory for remote hosts; there is no certificate-verification bypass. Pools are lazy, reused within a serverless instance, and limited to four connections per instance. All service queries are parameterized. DB/auth failures expose generic responses and sanitized error codes, not query parameters or secrets.

## Initial configuration and migrations

Put values in ignored `.env.local` locally and Vercel environment settings for deployed environments:

- `DATABASE_URL`: pooled Neon connection URL with SSL required.
- `DATABASE_URL_UNPOOLED`: direct Neon connection URL with SSL required, used only by controlled CLI operations.
- `AUTH_SECRET`: at least 32 high-entropy random characters.
- `APP_URL`: canonical application origin, e.g. the actual HTTPS deployment origin. Set it for production and each preview environment to make cookie/origin behavior explicit.

Use separate Neon branches/databases for Production, Preview and Development. Do not reuse production data for integration tests. Configure an isolated `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` for provider-side validation. The self-contained default tests use their own local PostgreSQL server and never read production database credentials.

Run these commands in order after reviewing the SQL:

```sh
npm ci
npm run db:inspect
npm run db:plan
npm run db:migrate
npm run db:verify
npm run db:health
```

`db:plan` rolls back its inspection transaction; it applies no migration. Stop and review any incompatible or untracked schema. Keep applied migration files immutable; add a new SQL migration for subsequent changes. A migration failure rolls back the transaction. Back up and verify production records before applying any later schema changes.

## One-time administrator bootstrap

Securely supply `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (unique, at least 16 characters) and optionally `BOOTSTRAP_ADMIN_NAME` via environment variables or ignored `.env.local`, then run:

```sh
npm run admin:bootstrap
```

The CLI hashes the supplied password, obtains a transaction lock, creates an approved administrator and credential account, records an audit event and permanently records completion. Rerunning after completion makes no changes. It refuses to promote a pre-existing registration. Remove bootstrap variables after success. There is no public bootstrap endpoint, fixed admin password, or first-registrant promotion.

Optional sample content is an explicit operation:

```sh
# Set CONFIRM_SAMPLE_SEED=yes in your environment first.
npm run db:seed
```

The seed imports only examinations, sections, questions, options and example schedules with deterministic exam IDs. Existing matching exam IDs/codes are left unchanged. It does not import Phase 1 passwords, users, assignments or fabricated attempts. There is no destructive browser reset.

## Authentication, permissions and private data

Better Auth handles `/api/auth/[...all]`: registration, password sign-in/sign-out, sessions, password changes and optional recovery. Registration defaults to pending approval and requires a phone number. Duplicate email is constrained in PostgreSQL. A suspended/rejected account cannot create a session; central authorization also rechecks account status and role from PostgreSQL for protected resources. Suspension/rejection revokes sessions. A pending learner may sign in to see the approval notice but cannot start an examination.

Protected admin/student layouts run server checks. Every platform/report endpoint independently authenticates the session and enforces role or ownership; client-side navigation is not authorization. POST endpoints verify the canonical Origin, reject cross-site requests and require JSON. Authentication rate limits are atomically stored in PostgreSQL and cover login, registration and recovery across serverless instances.

Password changes require the current password and revoke other sessions. To enable real reset delivery, set optional `RESEND_API_KEY` and a verified `EMAIL_FROM`; the library issues expiring, single-use tokens. Without these, the recovery endpoint returns an explicit unavailable response and no email is claimed. Durable file storage is not configured: question images use HTTPS URLs, and local file uploads are not offered. Safe bold/italic Markdown and LaTeX are rendered as text; arbitrary HTML is rejected by server validation.

## Server APIs

All endpoints use `Cache-Control: no-store`.

| Method / endpoint                   | Purpose / access                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GET /api/platform/workspace`       | Authorized workspace data; only self/assigned examinations and own attempts for students; private keys/results removed |
| `GET /api/platform/users`           | Administrator-only server search, status filter, sorting and pagination                                                |
| `POST /api/platform/save-exam`      | Admin create/edit/publish/draft/archive, validated transaction and optimistic exam version                             |
| `POST /api/platform/duplicate-exam` | Admin draft copy with new section/question/option identities                                                           |
| `POST /api/platform/save-questions` | Admin transaction for questions/options; existing attempt snapshots untouched                                          |
| `POST /api/platform/profile`        | Own permitted fields; admin may edit permitted learner fields                                                          |
| `POST /api/platform/user-status`    | Admin approval/rejection/suspension/reactivation and session revocation                                                |
| `POST /api/platform/assign`         | Admin assignment/revocation; approved active learners only                                                             |
| `POST /api/platform/start`          | Student eligibility check and transactional attempt creation/resume                                                    |
| `POST /api/platform/respond`        | Owned active attempt, revision, deadline, question/option membership and navigation validation                         |
| `POST /api/platform/submit`         | Owned attempt finalization and idempotent grading                                                                      |
| `POST /api/platform/release`        | Admin release/withhold whole-exam or optional individual attempt                                                       |
| `POST /api/platform/settings`       | Admin audited organization settings                                                                                    |
| `GET /api/reports`                  | Admin-only fresh database CSV/XLSX with filters and bounded output                                                     |

Reports include registered/approved learners, assignments, participation, attempts, scores, section performance and pass/fail statistics. They are bounded at 10,000 rows and neutralize spreadsheet formula injection. Result filters use UTC date boundaries. No report contains private passwords or answer keys.

## Attempt, schedule and concurrency policy

1. Start takes a transaction advisory lock for the learner/exam, checks approval, account, assignment, publication, UTC schedule and attempt limit, then stores server timestamps. A partial unique index prevents two active attempts. A second start resumes the active attempt.
2. The deadline is the earlier of `started_at + duration` and the overall schedule closing time. Attempts near the end receive the remaining window, which is explained on the instructions screen. Inputs/display use the explicitly configured IANA exam zone; UTC instants are authoritative.
3. Each attempt snapshots question content, options/correct key, marks, negative marks, sections, order, navigation rules, review policy and pass threshold. Later edits do not change historical attempts or scores.
4. Answer saves lock the attempt row. Revision checks prevent a stale tab from silently overwriting newer data. Membership, valid options, account state, status, navigation and database deadline are checked before a response upsert. The browser immediately reflects selection, serializes saves, retries temporary network failures in that tab and waits for pending saves before submission. Do not close the page while its unsaved-response warning is visible.
5. Submission locks the attempt, grades persisted responses with the existing pure engine and inserts at most one result. A submitted attempt is read-only. A concurrent late save cannot overwrite it. Duplicate submissions return the existing result.
6. Expired attempts are non-writable immediately. On access, attempted save, start, workspace/report retrieval or result publication, the server lazily finalizes them. Browser/serverless timers are not prerequisites. A bounded batch is processed per workspace/report request; no permanent background process is used.
7. Revocation/unpublication prevents new attempts. An already-started attempt may continue to its snapshotted deadline, subject to account suspension/rejection. Schedule edits affect new attempts, not existing deadlines.
8. Student responses never include a private key, explanation or unpublished score. After explicit publication, score analysis is available; correct answers/explanations are returned only when the attempt's snapshotted review policy allows them. Withholding removes them again. Direct URLs do not bypass these rules.

## Deployment and outstanding operational verification

Use Vercel's **Next.js** preset, repository root, Node 24, install `npm ci`, build `npm run build`, default output directory. Configure the server-only environment variables before deploying. Migrate the intended database explicitly before routing real users to the deployment. Never expose database/auth variables with `NEXT_PUBLIC_`.

For Preview and Development, use separate database branches and independent secrets/origins. Bootstrap each intended environment deliberately. Enable reset email only with a real provider/sender. Verify both account roles, approval, assignment, deadline persistence, cross-device answers, submission, withholding/publication and reports on the returned deployment URL.

The local environment did not initially contain configured Neon URLs or an authentication secret. The user was asked to configure ignored environment files. A build/test against isolated local PostgreSQL does **not** establish Neon connectivity, apply production migrations or verify Vercel deployment. See `docs/VERIFICATION.md` for actual executed checks and remaining requirements. Phase 3 is not started.
