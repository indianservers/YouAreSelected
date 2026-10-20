# Phase 1 verification

Executed locally on **20 October 2026 (Asia/Kolkata)** with Node.js 24.13.1, npm 11.8.0, Next.js 16.4.2 and Chromium through Playwright 1.64.1.

| Check                  | Outcome                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | Passed, strict TypeScript, no errors                                                                                              |
| `npm run lint`         | Passed, no errors or warnings                                                                                                     |
| `npm test`             | Passed: 18 tests in 6 files                                                                                                       |
| `npm run build`        | Passed; all public, student and admin route groups compiled                                                                       |
| `npm run test:e2e`     | Passed: 5 Chromium journeys against the local development server                                                                  |
| Production server      | Built and started successfully with `npm start -- --port 3001`                                                                    |
| `npm audit --omit=dev` | 0 runtime vulnerabilities                                                                                                         |
| Visual inspection      | Student dashboard, login, admin overview and mobile examination screenshots reviewed; desktop, tablet and phone layouts exercised |

The same **5 browser journeys also passed against the production build** on port 3001 (22.2 seconds). Set `PLAYWRIGHT_BASE_URL=http://localhost:3001` to run the suite against an already-running production server. Type checking generates Next.js route types first so it also works in a fresh checkout.

## Automated coverage

**Unit/component tests:** all correct, all incorrect, all unattempted, mixed responses, negative marking, unequal marks, inclusive pass thresholds, invalid/missing responses, empty exam, section totals, approval/assignment/publication/window eligibility, invalid exam/question configuration, login/logout, duplicate registration, unapproved assignment rejection, deadline stability, immutable question snapshots, duplicate submission, read-only responses, release/withhold, expired attempts, reset, randomized option identity and sequential sections, CSV escaping and formula-injection neutralization, invalid persisted-data fallback schema, accessible tabs and confirmation dialogs.

**Browser journeys:**

1. Student login, unavailable exam rejection, instructions, start, answer selection/change/clear, review flag, next/previous, refreshed answers and deadline, confirmation and submission, pending results, admin release, CSV and XLSX downloads, reading both downloaded files and checking their scores/counts against the displayed result, student answer review, withholding and hidden results again.
2. Registration, admin approval, examination draft creation, MCQ creation, correct-answer persistence, question editing/duplication/deletion, publication, learner assignment, schedule save and the new examination appearing in the newly approved student's workspace.
3. Refreshing an expired attempt automatically submits it; confirmed admin demo reset restores the seed and logs out.
4. Invalid credentials, session restoration, profile editing, demo password change, mobile navigation and horizontal-overflow assertions.
5. Public landing/login, all admin navigation destinations, desktop/tablet/mobile widths, mobile navigator drawer, section/question navigation and exam rendering. Uncaught browser page errors fail the suite.

Viewport coverage includes **1440×1000**, **768×1024**, and **390×844**. Browser screenshots/traces/downloads live in ignored `test-results/`, not in Git. Tests use an isolated browser context for each journey.

## Issues found and fixed during verification

- Pinned TanStack Table to v8 because the current v9 major has a different API.
- Fixed native number input step validation that silently prevented valid question marks from saving.
- Corrected test locators for paginated learners, duplicate navigation labels and the Next.js route announcer.
- Preserved the active question and absolute deadline across refreshes.
- Validated stored snapshot shape before hydration and retained section order when section switching is restricted.
- Kept admin creation controls available on small screens; added a sticky mobile attempt header/timer.

## Limitations and dependency audit

These are local checks, not a Vercel deployment verification, full accessibility audit, security audit or cross-browser certification. Firefox and WebKit were not run. Client-side timing/authentication/data release is inherently bypassable and intentionally remains a demo.

`npm audit` reports **5 high-severity development-tooling findings**, traced through `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` (GHSA-vfj7-8cjw-p6xm). The installed current braces release does not provide a fixed version; the suggested automatic fix would downgrade the Next.js lint configuration across major versions. No unsafe forced downgrade was applied. This dependency chain is absent from the production runtime audit. ExcelJS's transitive uuid dependency is overridden to 11.1.1; actual browser XLSX generation and reading were verified.

Vercel remains an owner-side deployment step. No Vercel CLI or authenticated Vercel integration was available in this workspace, and no deployment URL is claimed. README contains the exact import/build/environment settings and post-deployment checklist. Phase 2 and Phase 3 remain deferred.
