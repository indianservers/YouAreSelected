# Phase 3 final audit

## Executive summary

**Release decision: NOT READY FOR PRODUCTION.** The local application release gates pass, and the supplied Neon database is now connected, migrated and bootstrapped. Production/preview deployment, real reset-email delivery, project-specific recovery settings and HTTP staging capacity have not been verified. Those are release blockers, not inferred successes.

Audit date: 20 October 2026. Environment: Windows, Node 24.13.1, npm 11.8.0, Next.js 16.4.2, Chromium/Playwright 1.64.1. No production data was reset. No test candidates, examinations or results were inserted into Neon. The existing provider-managed `neon_auth` schema was preserved.

### Improvements completed

- Fixed deadline evaluation after row-lock acquisition. Added a database trigger that independently rejects expired or finalized response writes, including time spent waiting for queries/locks.
- Replaced floating-point mark accumulation with four-decimal integer accumulation for examination and section totals. Pass/fail compares the unrounded score; the displayed percentage remains rounded to two decimals. Added pass-threshold precision validation.
- Replaced per-examination/per-attempt workspace queries with batched queries; bulk-inserted attempt snapshots. Retained immutable historical questions, keys, weights and navigation policies.
- Added result-owner foreign keys, submission-state/count constraints and ownership/report indexes through additive migrations. Invalid direct SQL response options are rejected.
- Corrected report date filtering, numeric section cells, pass/fail statistics and the pending-attempt label.
- Added security headers, production HTTPS-origin validation, bounded streamed JSON parsing, no-store error responses, request correlation IDs and sanitized structured request logs. Added administrator-only health diagnostics.
- Fixed contrast, password-toggle touch size, progress semantics and narrow-screen layout. Preserved the existing layout, palette and components. Applied snapshotted navigation rules consistently.
- Added a monotonic synchronized countdown display, sign-in/cache-refresh coordination and a recoverable workspace loading error state.
- Added deterministic isolated fixtures, controlled concurrency measurements, query-plan/integrity checks and a checksum-verified logical restore rehearsal.
- Made migration checksums portable across Windows/Linux line endings, retaining legacy checksum compatibility and rejecting actual SQL changes. SQL files are pinned to LF in Git.

## Audit checklist and feature coverage

“Passed” describes the stated evidence only. It does not imply every possible interaction or a production deployment was tested.

| Module / requirement                            | Implementation               | Verification and outcome                                                                                                                            |
| ----------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| App Router, strict TS, build                    | Implemented                  | Typecheck, lint and optimized build pass; protected pages/APIs dynamic                                                                              |
| Registration, approval, login/logout            | Implemented                  | Browser journey + SQL checks; duplicate registration, role injection, pending restrictions and revocation tested                                    |
| Student profile/password                        | Implemented                  | UI save/refresh plus SQL record check; password change revokes other browser session                                                                |
| Admin user search/filter/sort/pagination/status | Implemented                  | UI approval/search exercised; repository bulk rollback, approval/suspension and API denials tested; not every visual combination manually exercised |
| Exam creation/edit/publish/duplicate            | Implemented                  | Browser authoring/publication/assignment; database stale-write rejection and rollback; duplicate IDs verified                                       |
| Question/options editor                         | Implemented                  | UI creation/correct key; constraints, failed replacement rollback and historical/new-version scores tested                                          |
| Schedules and assignments                       | Implemented                  | Availability/ownership/approval checks; persisted assignment and schedule behavior; isolated 5/30/60/120 minute checks                              |
| Attempt/resume/answer/review                    | Implemented                  | Cross-browser/refresh persistence, offline retry, answer/review state and immutable snapshots                                                       |
| Expiry/submission                               | Implemented                  | Browser/API lifecycle, duplicate submissions, simultaneous starts, save/submit race, row-lock deadline regression and late writes                   |
| Grading                                         | Implemented                  | All-correct/incorrect/unattempted, mixed weights, negatives, sections, exact decimals, invalid maxima and raw pass boundary                         |
| Results/review/private keys                     | Implemented                  | Own-resource tests; hidden before release; individual/exam publication, withholding and score-only review policy                                    |
| Reports/CSV/XLSX                                | Implemented                  | Every report kind queried; browser XLSX score compared to SQL; escaping/formula tests; formatter stress through 10k rows                            |
| Dashboard/settings                              | Implemented                  | SQL metrics, persistent settings; responsive route/a11y audit; settings not exhaustively browser round-tripped                                      |
| Authentication/authorization/security           | Implemented                  | Student administrative mutations denied; ownership/CSRF/strict payload/session tests; static review and runtime dependency audit                    |
| UI/responsiveness/accessibility                 | Improved                     | 13 public/admin routes checked at 375/768/1280/1440/1920px for overflow; axe WCAG 2 A/AA and 2.2 AA tags on audited routes and examination screen   |
| Observability/health                            | Implemented locally          | Correlation IDs/status/duration in sanitized logs; admin health verified against Neon; external alerts not configured                               |
| Neon integration                                | Verified within stated scope | Direct inspection, pooled health, migrations, schema verification, administrator login/workspace/health/logout                                      |
| Recovery                                        | Local rehearsal passed       | Separate disposable database, 20 tables and 90,014 rows restored with matching checksums; no production recovery performed                          |
| Vercel deployment                               | Configuration guidance only  | No project link/preview URL available; GitHub deployments list empty; live deployment gate blocked                                                  |

Remaining manual coverage includes assistive-technology testing, full keyboard/modal interaction audit, text zoom at all screens, fine-grained contrast on every populated state, and every admin destructive/editor combination. Native radios, labelled controls, Radix dialog focus behavior, visible focus and reduced motion remain in place. Automated axe passing is not WCAG certification.

## Test results and evidence

| Check                  | Final result                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | Passed, including `.mts` verification scripts                                                                 |
| `npm run lint`         | Passed                                                                                                        |
| `npm test`             | 37 tests passed in 8 files, zero failed/skipped                                                               |
| `npm run build`        | Passed; public static routes and protected dynamic routes compiled                                            |
| `npm run test:e2e`     | 4 Chromium journeys passed in a clean isolated run                                                            |
| `npm run test:phase3`  | Passed; fixtures, five concurrency levels, timers, locked-deadline regression, integrity, exports and restore |
| `npm audit --omit=dev` | Zero runtime vulnerabilities                                                                                  |
| Full dependency audit  | Five high development-only transitive findings, unresolved upstream                                           |
| Neon smoke             | Administrator sign-in, workspace, protected health and revoked-cookie rejection passed                        |

Evidence sources: `src/tests/`, `e2e/platform.spec.ts`, `scripts/phase3-checks.mts`, `scripts/test-server.mts`, and ignored `verification-artifacts/`. The latter contains raw local measurements, axe results and provider smoke results, without passwords or session tokens. Sanitized measurements are also committed in docs/phase3-measurements.json. Unit database tests use PGlite; browser and load/recovery tests use fresh real local PostgreSQL. Tests explicitly override connection variables with a guarded loopback endpoint and never inherit the live database URL.

Earlier runs exposed and reproduced contrast/ARIA/overflow defects, a lossy timestamp conversion in the recovery helper and a sign-in refresh race. These were fixed and relevant checks rerun. One browser harness startup failed because a different owned test harness held its port; one overlapping build was rejected by Next's build lock. Final runs were performed after the conflicting processes ended. These infrastructure failures were not counted as application passes.

### Mandatory regression flows

1. Register → approve → login → assign → start → submit → release → view: browser and SQL verification.
2. Create → add MCQ → publish → assign → conduct: browser and SQL verification; schedule boundaries additionally verified at repository/API layers.
3. Edit key/marks after an attempt → old score/key unchanged → new attempt uses new version: database integration regression.
4. Save → refresh/cross-browser resume → expiry → one result: browser persistence plus database expiry regression. The expiry branch is not a separate complete UI recording.
5. Two students, independent resources/results: API ownership/race test and concurrent fixture workloads with score/response assertions.
6. Student administrative requests denied without mutation: API/repository tests.
7. Concurrent duplicate submit → one authoritative result: browser API and repository load workloads.
8. Published result → XLSX download → parsed score compared with persisted record: browser + SQL.

Flows 3–6 are not all independently recorded as complete UI-only journeys. Provider-wide student lifecycle tests were deliberately not run against the supplied live database.

## Performance

These are **local repository-layer measurements**, not HTTP/Vercel/Neon capacity claims. Each candidate starts/resumes, loads the exam, saves an answer and submits twice concurrently. Correctness assertions check its persisted result and selected option. The load exam has two questions; the fixture library separately has 1,502 questions. A 500-candidate test of long exams, authentication and serverless fan-out is still required on authorized staging.

| Concurrent candidates | Start p95 ms | Load p95 ms | Save p95 ms | Submit p95 ms | Errors |
| --------------------- | ------------ | ----------- | ----------- | ------------- | ------ |
| 10                    | 77           | 38          | 17          | 16            | 0      |
| 50                    | 63           | 68          | 60          | 111           | 0      |
| 100                   | 164          | 183         | 125         | 246           | 0      |
| 250                   | 444          | 487         | 266         | 548           | 0      |
| 500                   | 758          | 825         | 566         | 1240          | 0      |

Pool maximum and observed peak: 4 connections. Peak candidate-process RSS at 500: 242 MiB; maximum observed pool waiters: 991 because duplicate submissions also queue. The harness stops escalating on any error or a stage exceeding 30 seconds. CPU usage, durations and connection samples are in the committed measurement JSON; database-server/system-wide resource utilization was not separately measured.

A student workspace used 14 repository queries, 38 ms and 98,517 serialized bytes in the expanded dataset. This count excludes HTTP authentication queries. EXPLAIN (ANALYZE, BUFFERS) was captured for attempt ownership/history; do not extrapolate the small local plan to Neon under real load.

The report stress dataset includes 10,000 additional distinct attempts created, answered and graded through the server repository in bounded batches of 50 (40543 ms). CSV/XLSX cases use distinct persisted rows, with every parsed score, percentage, attempt reference and email compared to the report query. No repeated formatter rows or production records are used. The one-row browser export separately exercises the authenticated HTTP download. Full 10k HTTP export latency on Vercel remains unverified.

| Distinct persisted rows | CSV + XLSX write/reload ms | RSS delta MiB | XLSX bytes |
| ----------------------- | -------------------------- | ------------- | ---------- |
| 10                      | 54                         | 4             | 7680       |
| 100                     | 31                         | 6             | 15202      |
| 1000                    | 184                        | 28            | 90560      |
| 10000                   | 1242                       | 46            | 813784     |

The one cold local Next development request backed by Neon took 5,003 ms to sign in; the authenticated diagnostic's database query took 227 ms. Network distance and development compilation contribute; these are not production latency percentiles. No Core Web Vitals or Lighthouse measurements are claimed.

## Database and recovery

Migrations `0001_foundation.sql`, `0002_integrity_and_indexes.sql`, and `0003_response_deadline_guard.sql` were explicitly applied to Neon after inspection and planning. Schema verification found all 20 expected application tables. The migration-history table is additional bookkeeping. Migration/bootstrap reruns are idempotent. The administrator is the owner-specified email; the generated initial password is in ignored `.env.bootstrap`, never the report or Git. There is no extra superadmin role: the supported administrator role is used.

The isolated fixture set includes one bootstrapped administrator, three additional admin user rows, 500 approved candidates (200 baseline plus 300 for the upper load tier), 40 pending candidates, 10 rejected and 10 suspended, 26 exams across 10 categories, 1,502 MCQs, 6,008 options and multiple assignments. The report stress run also creates 10,000 additional isolated, server-graded submissions. Fixtures are marked TEST and use `isolated.test` emails. Keys use checked stable facts/arithmetic; templates repeat deterministically across practice items. Additional fixture admin/candidate rows do not have reusable credential accounts; login/session tests use real registrations and the random bootstrap account in browser tests.

Integrity checks found zero crossed responses, duplicate authoritative results, missing results for completed attempts, or incorrect result owners. Tests inject failures during exam replacement, bulk assignment and result insertion, verifying rollback and successful retry. Foreign keys, unique active-attempt/result/assignment rules, single correct options, option membership and submission states are covered. Existing attempt snapshots retain removed/changed source-question content intentionally; the source ID is historical metadata rather than a cascading foreign key.

See `docs/RECOVERY.md` for recovery and migration incident procedures. The local rehearsal is a logical copy/restore into a different disposable database, with PostgreSQL-native JSON preserving timestamp microseconds. It is not proof of Neon PITR. The configured project's plan, history window, branch privileges, backup coverage and recovery SLA cannot be established from its SQL connection alone. No control-plane credentials were supplied.

## Security review

Confirmed fixes: deadline race, four-decimal totals/raw pass boundary, database owner/option/state checks, JSON stream limits, error/cache behavior, HTTPS origin enforcement, security headers and sanitized request tracing. Server authorization guards every mutation/report/health endpoint; queries use parameterized values and whitelisted sorting. Student DTO tests verify private answer keys/explanations and withheld results are absent. Math rendering disables trusted HTML commands. Images use HTTPS references; there is no upload endpoint to bypass.

Passwords use Argon2id, database sessions use HttpOnly/SameSite cookies and Secure in production, account state is rechecked, and auth endpoints have atomic database rate limits. Production Secure-cookie behavior and reset-token delivery/reuse were not exercised on a real HTTPS deployment. Successful password-change revocation is tested.

A scan of tracked history found no Neon password tokens; client static bundles and working source are checked separately. Local credential files are ignored. The supplied database credential appeared in chat, so rotate it in Neon before release and update the ignored/deployment environment. Rotate any secret that is later exposed; revoke sessions as needed. No secret value belongs in a report, screenshot, CI artifact or support log.

Runtime audit is clean. The development-only `braces` advisory GHSA-vfj7-8cjw-p6xm propagates through micromatch/fast-glob and Next ESLint packages (five high findings). The proposed automated fix downgrades ESLint config across major Next versions; it was not forced. Track the upstream fix and restrict untrusted glob inputs in build tooling. The CSP adds frame/base/object/form restrictions, not a complete nonce-based script policy; deeper penetration testing remains outside the evidence claimed here.

Review references: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Deployment and observability

Vercel target configuration: Next.js preset, repository root, Node 24, `npm ci`, `npm run build`, default output. Configure pooled/direct database URLs, high-entropy AUTH_SECRET and canonical HTTPS APP_URL separately in Preview and Production. Use an isolated Neon preview branch, never production for load/recovery fixtures. Configure verified EMAIL_FROM/RESEND_API_KEY to enable actual reset delivery. Do not place any secret in NEXT_PUBLIC variables.

No Vercel deployment was performed or verified. GitHub API returned no deployment records and no repository homepage; this does not prove no deployment exists elsewhere. Supply/link the intended Vercel project, deploy a preview, inspect logs and test HTTPS cookies, reset-token lifecycle, both roles and all eight regression flows before promotion. Migration application remains an explicit controlled operation, not part of the build.

Logs expose request ID, event, status and elapsed time; database error details, credentials, bodies, answer keys and personal content are not serialized. Audit records cover administrative changes and attempt operations. `/api/health` requires an active administrator; it returns reachability/latency only. External log retention, alerts, availability checks and alert recipients are not configured.

## Outstanding issues and release gates

| Severity            | Issue                                                                            | Required resolution                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 release gate     | Preview/production HTTPS deployment unverified                                   | Link Vercel project, configure environments, run preview regressions and inspect runtime/deployment logs                                                                                  |
| P1 release gate     | Actual password-reset delivery/token lifecycle unverified                        | Configure verified mail sender; test expiry, single use and session revocation on preview                                                                                                 |
| P1 release gate     | Recovery capability/RPO/RTO unverified for Neon project                          | Verify plan/history window/privileges; rehearse recovery in an isolated Neon branch and obtain owner sign-off                                                                             |
| P1 operational gate | Chat-shared database credential requires rotation                                | Rotate in Neon and update local/Vercel environments without logging it                                                                                                                    |
| P2 capacity gate    | No HTTP auth/serverless staging load or Core Web Vitals                          | Run authorized staging tiers with long exams, login distribution, full payloads and connection monitoring                                                                                 |
| P2                  | Workspace library caps remain: 1k users, 500 exams, 10k assignments, 2k attempts | User/assignment selection is paginated; add separate paginated exam/result libraries and lazy attempt detail before growing beyond caps; large admin snapshot payloads remain possible    |
| P2                  | Five dev dependency findings                                                     | Apply compatible upstream braces/Next ESLint fix when available; rerun audit/lint                                                                                                         |
| P2                  | Accessibility/manual management combinations not exhaustive                      | Complete keyboard/screen-reader/zoom/mobile-state review and every editor/bulk/status combination                                                                                         |
| P2                  | No operational alerting/backup ownership configured                              | Configure retention, alert routes and recovery ownership; establish incident runbook and retention cleanup                                                                                |
| P2                  | Some filters apply only to relevant report kinds                                 | Assignment reports use exam/student/date; user reports use exam/student/date; attempt/publication filters apply to attempt/result reports. Make irrelevant controls explicit in future UX |
| P2                  | In-tab offline queue is not durable after closing the page                       | Current UI warns while responses are unsaved; use a durable encrypted recovery strategy only after a separate privacy/design review if required                                           |

There are no known unresolved P0/P1 application defects in the exercised flows. External critical release gates remain unverified, so the final decision remains **NOT READY FOR PRODUCTION**. Do not treat a Git push, local passing test or successful Neon health check as production sign-off.
