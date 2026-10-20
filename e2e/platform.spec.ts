import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import ExcelJS from "exceljs";
import { blankExam, blankQuestion } from "../src/lib/exam-defaults";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = "http://localhost:3000";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});
async function post(api: APIRequestContext, command: string, data: unknown) {
  return api.post(`/api/platform/${command}`, {
    data,
    headers: { Origin: origin },
  });
}
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(page.locator("#main-content h1").first()).toBeVisible();
}
test("real registration, approval, questions, cross-browser attempt, private result and audited publication", async ({
  browser,
  page,
}) => {
  const suffix = randomBytes(5).toString("hex"),
    email = `learner-${suffix}@isolated.test`,
    password = randomBytes(20).toString("base64url") + "Aa1!",
    name = `Learner ${suffix}`;
  await page.goto("/register");
  await page.getByLabel("Full name", { exact: true }).fill(name);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Mobile number", { exact: true }).fill("9000000011");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Great things start here." }),
  ).toBeVisible();
  console.info("Registration and approval workflow running.");
  await login(page, email, password);
  await expect(
    page.getByText("Your account is awaiting administrator approval.", {
      exact: false,
    }),
  ).toBeVisible();
  for (const command of [
    "save-exam",
    "duplicate-exam",
    "save-questions",
    "user-status",
    "assign",
    "release",
    "settings",
  ])
    expect((await post(page.request, command, {})).status()).toBe(403);
  expect((await page.request.get("/api/health")).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { Origin: origin },
        data: {
          name,
          email,
          password,
          confirmPassword: password,
          phone: "9000000011",
        },
      })
    ).status(),
  ).toBe(409);
  expect((await page.request.get("/api/reports")).status()).toBe(403);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(
    admin,
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!,
  );
  await admin.goto("/admin/users");
  await admin
    .getByRole("textbox", { name: "Search learners, email or mobile…" })
    .fill(name);
  await admin
    .getByRole("combobox", { name: `Change status for ${name}` })
    .selectOption("approved");
  await admin
    .getByRole("dialog")
    .getByRole("button", { name: "Update status" })
    .click();
  await expect(admin.getByRole("row").filter({ hasText: email })).toContainText(
    "approved",
  );
  await admin.goto("/admin/exams/new");
  await admin
    .getByLabel("Exam title *", { exact: true })
    .fill(`Persistent assessment ${suffix}`);
  await admin.getByLabel("Exam code *", { exact: true }).fill(`REAL-${suffix}`);
  await admin
    .getByLabel("Description *", { exact: true })
    .fill("An isolated persistent test.");
  await admin.getByLabel("Category *", { exact: true }).fill("Aptitude");
  await admin.getByLabel("Subject *", { exact: true }).fill("Math");
  await admin.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(admin).toHaveURL(/\/edit$/);
  const examId = new URL(admin.url()).pathname.split("/")[3];
  await admin
    .locator(".exam-admin-nav")
    .getByRole("link", { name: "Question bank", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "Add question", exact: true })
    .click();
  await admin
    .getByLabel("Question text *", { exact: true })
    .fill("What is 2 + 2?");
  for (const [i, value] of ["3", "4", "5", "6"].entries())
    await admin
      .getByRole("textbox", {
        name: `Option ${String.fromCharCode(65 + i)} text`,
        exact: true,
      })
      .fill(value);
  await admin
    .getByRole("radio", { name: "Option B is correct", exact: true })
    .check();
  await admin
    .getByLabel("Explanation", { exact: true })
    .fill("Two plus two equals four.");
  await admin
    .getByRole("button", { name: "Save question", exact: true })
    .click();
  await expect(
    admin.getByRole("button", { name: "What is 2 + 2?", exact: true }),
  ).toBeVisible();
  await admin.goto(`/admin/exams/${examId}/edit`);
  await admin
    .getByRole("button", { name: "Publish examination", exact: true })
    .click();
  await expect(
    admin.getByText("Examination published.", { exact: true }),
  ).toBeVisible();
  await admin.goto(`/admin/exams/${examId}/assignments`);
  await admin
    .getByRole("textbox", { name: "Search learners…", exact: true })
    .fill(name);
  await admin
    .getByRole("checkbox", { name: `Assign ${name}`, exact: true })
    .check();
  await admin.getByRole("button", { name: /Assign selected/ }).click();
  await expect(admin.getByRole("row").filter({ hasText: email })).toContainText(
    "Assigned",
  );
  await page.goto(`/student/exams/${examId}/instructions`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start examination" }).click();
  await expect(page).toHaveURL(/\/attempt$/);
  await expect(
    page.getByRole("heading", { name: "What is 2 + 2?" }),
  ).toBeVisible();
  const examAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  await mkdir("verification-artifacts", { recursive: true });
  await writeFile(
    "verification-artifacts/axe-examination.json",
    JSON.stringify(examAccessibility.violations, null, 2),
  );
  expect(examAccessibility.violations).toEqual([]);
  await page.getByRole("radio").nth(1).check();
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  await expect(
    page.getByText("Responses saved to the server", { exact: true }),
  ).toBeVisible();
  await page.context().setOffline(true);
  await page.getByRole("radio").nth(0).check();
  await expect(page.getByRole("radio").nth(0)).toBeChecked();
  await page.context().setOffline(false);
  await expect(
    page.getByText("Responses saved to the server", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio").nth(1).check();
  await expect(
    page.getByText("Responses saved to the server", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark for review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Marked for review", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Responses saved to the server", { exact: true }),
  ).toBeVisible();
  console.info("Exam response saved; verifying persistence.");
  const ws = await (await page.request.get("/api/platform/workspace")).json();
  const attempt = ws.data.attempts.find(
    (a: { examId: string }) => a.examId === examId,
  );
  expect(JSON.stringify(ws)).not.toMatch(
    /correctOptionId|explanation|password_hash/,
  );
  const starts = await Promise.all([
    post(page.request, "start", { examId }),
    post(page.request, "start", { examId }),
  ]);
  for (const response of starts) {
    expect(response.status()).toBe(200);
    expect((await response.json()).result.id).toBe(attempt.id);
  }
  await page.reload();
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  const deadline = (
    await (await page.request.get("/api/platform/workspace")).json()
  ).data.attempts.find((a: { id: string }) => a.id === attempt.id).deadline;
  expect(deadline).toBe(attempt.deadline);
  const second = await browser.newContext();
  const secondPage = await second.newPage();
  await login(secondPage, email, password);
  await secondPage.goto(`/student/exams/${examId}/attempt`);
  await expect(secondPage.getByRole("radio").nth(1)).toBeChecked();
  await page.getByRole("button", { name: "Submit exam", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit examination", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Test submitted successfully." }),
  ).toBeVisible();
  const duplicate = await Promise.all([
    post(page.request, "submit", { attemptId: attempt.id }),
    post(page.request, "submit", { attemptId: attempt.id }),
  ]);
  expect(duplicate.every((r) => r.status() === 200)).toBe(true);
  const submitted = (
    await (await page.request.get("/api/platform/workspace")).json()
  ).data.attempts.find((a: { id: string }) => a.id === attempt.id);
  expect(submitted.result).toBeUndefined();
  expect(submitted.publication.released).toBe(false);
  expect(
    (
      await post(page.request, "respond", {
        attemptId: attempt.id,
        questionId: attempt.questions[0].id,
        revision: submitted.revision,
        patch: { optionId: null },
      })
    ).status(),
  ).toBe(409);
  await page.getByRole("link", { name: "View result status" }).click();
  await expect(
    page.getByRole("heading", { name: "Results Awaiting Publication." }),
  ).toBeVisible();
  await admin.goto(`/admin/results/${examId}`);
  await admin
    .getByRole("button", { name: "Release results", exact: true })
    .click();
  await admin
    .getByRole("dialog")
    .getByRole("button", { name: "Release results", exact: true })
    .click();
  await expect(
    admin.getByText("Results published.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your answer sheet" }),
  ).toBeVisible();
  await expect(page.getByText("2 / 2 marks")).toBeVisible();
  const download = admin.waitForEvent("download");
  await admin.getByRole("button", { name: "Export Excel" }).click();
  const file = await download;
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile((await file.path())!);
  expect(book.worksheets[0].getCell("F2").value).toBe(2);
  // Assert persisted database records, independent of UI messages and browser state.
  const pool = new Pool({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55432/postgres",
    max: 1,
  });
  try {
    const stored = (
      await pool.query(
        "SELECT a.status,r.earned_marks,r.correct_count,r.publication_status FROM yas.exam_attempts a JOIN yas.exam_results r ON r.attempt_id=a.id WHERE a.id=$1",
        [attempt.id],
      )
    ).rows[0];
    expect(stored.status).toBe("submitted");
    expect(Number(stored.earned_marks)).toBe(2);
    expect(stored.correct_count).toBe(1);
    expect(stored.publication_status).toBe("published");
    expect(
      Number(
        (
          await pool.query(
            "SELECT count(*) AS n FROM yas.exam_attempts WHERE exam_id=$1",
            [examId],
          )
        ).rows[0].n,
      ),
    ).toBe(1);
    expect(
      Number(
        (
          await pool.query(
            "SELECT count(*) AS n FROM yas.audit_logs WHERE entity_id=$1 AND action='results.published'",
            [examId],
          )
        ).rows[0].n,
      ),
    ).toBe(1);
  } finally {
    await pool.end();
  }
  await admin
    .getByRole("button", { name: "Withhold results", exact: true })
    .click();
  await admin
    .getByRole("dialog")
    .getByRole("button", { name: "Withhold results", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Results Awaiting Publication." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/student/dashboard");
  await expect(page.locator("#main-content h1").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "verification-artifacts/phase3-student-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/student/profile");
  await page.getByLabel("Full name", { exact: true }).fill(`${name} Updated`);
  await page.getByLabel("Mobile number", { exact: true }).fill("9000000099");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Profile updated.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    `${name} Updated`,
  );
  await expect(page.getByLabel("Mobile number", { exact: true })).toHaveValue(
    "9000000099",
  );
  const profileDb = new Pool({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55432/postgres",
    max: 1,
  });
  try {
    expect(
      (
        await profileDb.query(
          "SELECT full_name,phone,role,approval_status FROM yas.users WHERE email=$1",
          [email],
        )
      ).rows[0],
    ).toEqual({
      full_name: `${name} Updated`,
      phone: "9000000099",
      role: "student",
      approval_status: "approved",
    });
  } finally {
    await profileDb.end();
  }
  const changed = randomBytes(24).toString("base64url");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByLabel("New password", { exact: true }).fill(changed);
  await page.getByLabel("Confirm new password", { exact: true }).fill(changed);
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(
    page.getByText("Password changed. Other sessions have been revoked.", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await second.request.get("/api/platform/workspace")).status()).toBe(
    401,
  );
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/platform/workspace")).status()).toBe(
    401,
  );
  await second.close();
  await adminContext.close();
});

test("responsive routes, security headers and WCAG automated checks", async ({
  page,
}) => {
  test.setTimeout(300000);
  const violations: unknown[] = [];
  for (const path of ["/", "/login", "/register", "/forgot-password"]) {
    const response = await page.goto(path);
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    for (const width of [375, 768, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(250); // Allow the responsive sidebar transition to settle.
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    violations.push(
      ...audit.violations.map((v) => ({
        path,
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    );
  }
  await login(
    page,
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!,
  );
  for (const path of [
    "/admin",
    "/admin/users",
    "/admin/exams",
    "/admin/exams/new",
    "/admin/questions",
    "/admin/assignments",
    "/admin/results",
    "/admin/reports",
    "/admin/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator("#main-content h1").first()).toBeVisible();
    for (const width of [375, 768, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => ({
        wide: document.documentElement.scrollWidth > innerWidth + 1,
        items: Array.from(document.querySelectorAll("body *"))
          .filter(
            (e) =>
              e.getBoundingClientRect().right > innerWidth + 1 &&
              e.getBoundingClientRect().width > 0,
          )
          .slice(0, 12)
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            right: e.getBoundingClientRect().right,
          })),
      }));
      if (overflow.wide) violations.push({ path, width, overflow });
    }
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    violations.push(
      ...audit.violations.map((v) => ({
        path,
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    );
  }
  await mkdir("verification-artifacts", { recursive: true });
  await writeFile(
    "verification-artifacts/axe-routes.json",
    JSON.stringify(violations, null, 2),
  );
  expect(violations).toEqual([]);
});
test("anonymous access, invalid credentials, CSRF and unconfigured reset email fail safely", async ({
  page,
}) => {
  expect((await page.request.get("/api/platform/workspace")).status()).toBe(
    401,
  );
  expect((await page.request.get("/api/reports")).status()).toBe(401);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  const invalid = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "missing@isolated.test", password: "unrecognized-password" },
    headers: { Origin: origin },
  });
  expect(invalid.status()).toBe(401);
  const csrf = await page.request.post("/api/platform/settings", {
    data: { organization: "Injected", supportEmail: "" },
    headers: { Origin: "https://attacker.invalid" },
  });
  expect(csrf.status()).toBe(403);
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("missing@isolated.test");
  await page.getByRole("button", { name: "Request reset link" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "not configured" }),
  ).toBeVisible();
});
test("database concurrency, ownership, deadlines, suspension and session expiry are enforced", async ({
  browser,
}) => {
  const adminContext = await browser.newContext(),
    admin = await adminContext.newPage();
  await login(
    admin,
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!,
  );
  const first = await browser.newContext(),
    second = await browser.newContext();
  const firstPage = await first.newPage(),
    secondPage = await second.newPage();
  const suffix = randomBytes(5).toString("hex");
  const password = randomBytes(24).toString("base64url");
  const users = [];
  for (const [i, context] of [first, second].entries()) {
    const email = `negative-${i}-${suffix}@isolated.test`;
    const registered = await context.request.post("/api/auth/sign-up/email", {
      headers: { Origin: origin },
      data: {
        name: `Negative learner ${i}`,
        email,
        password,
        confirmPassword: password,
        phone: "9000000012",
        role: "admin",
        approvalStatus: "approved",
      },
    });
    expect(registered.status()).toBe(200);
    const body = await registered.json();
    users.push({ id: body.user.id, email });
  }
  await login(firstPage, users[0].email, password);
  await login(secondPage, users[1].email, password);
  const own = (
    await (await first.request.get("/api/platform/workspace")).json()
  ).data.users[0];
  expect(own.role).toBe("student");
  expect(own.status).toBe("pending");
  const value = blankExam();
  value.title = `Concurrency ${suffix}`;
  value.code = `CON-${suffix}`;
  value.category = "Aptitude";
  value.subject = "Math";
  value.description = "Database concurrency fixture";
  value.showReview = false;
  const q = blankQuestion(value.sections[0].id);
  q.text = "Two plus two?";
  q.options = q.options.map((o, i) => ({ ...o, text: String(i + 3) }));
  q.correctOptionId = "b";
  q.explanation = "Private explanation.";
  value.questions = [q];
  value.status = "published";
  let savedResponse = await post(admin.request, "save-exam", value);
  expect(savedResponse.status()).toBe(200);
  let exam = (await savedResponse.json()).result;
  expect(
    (
      await post(admin.request, "assign", {
        examId: exam.id,
        userIds: [users[0].id],
      })
    ).status(),
  ).toBe(400);
  expect(
    (await post(first.request, "start", { examId: exam.id })).status(),
  ).toBe(403);
  expect(
    (
      await post(admin.request, "user-status", {
        ids: [users[0].id],
        status: "approved",
      })
    ).status(),
  ).toBe(200);
  expect(
    (await post(first.request, "start", { examId: exam.id })).status(),
  ).toBe(403);
  expect(
    (
      await post(admin.request, "assign", {
        examId: exam.id,
        userIds: [users[0].id],
      })
    ).status(),
  ).toBe(200);
  const future = {
    ...exam,
    schedule: {
      ...exam.schedule,
      start: new Date(Date.now() + 3600000).toISOString(),
      end: new Date(Date.now() + 7200000).toISOString(),
    },
  };
  savedResponse = await post(admin.request, "save-exam", future);
  expect(savedResponse.status()).toBe(200);
  exam = (await savedResponse.json()).result;
  expect(
    (await post(first.request, "start", { examId: exam.id })).status(),
  ).toBe(403);
  savedResponse = await post(admin.request, "save-exam", {
    ...exam,
    schedule: value.schedule,
  });
  expect(savedResponse.status()).toBe(200);
  exam = (await savedResponse.json()).result;
  const starts = await Promise.all(
    Array.from({ length: 3 }, () =>
      post(first.request, "start", { examId: exam.id }),
    ),
  );
  const attempts = [];
  for (const r of starts) {
    expect(r.status()).toBe(200);
    attempts.push((await r.json()).result);
  }
  expect(new Set(attempts.map((a) => a.id)).size).toBe(1);
  const a = attempts[0];
  expect(
    (
      await post(second.request, "respond", {
        attemptId: a.id,
        questionId: a.questions[0].id,
        revision: 0,
        patch: { optionId: a.questions[0].options[1].id },
      })
    ).status(),
  ).toBe(404);
  expect(
    (await post(second.request, "submit", { attemptId: a.id })).status(),
  ).toBe(404);
  expect(
    (await (await second.request.get("/api/platform/workspace")).json()).data
      .attempts,
  ).toEqual([]);
  expect(
    (
      await post(first.request, "submit", { attemptId: a.id, score: 100 })
    ).status(),
  ).toBe(400);
  const race = await Promise.all([
    post(first.request, "respond", {
      attemptId: a.id,
      questionId: a.questions[0].id,
      revision: 0,
      patch: { optionId: a.questions[0].options[1].id },
    }),
    post(first.request, "submit", { attemptId: a.id }),
    post(first.request, "submit", { attemptId: a.id }),
  ]);
  expect([200, 409]).toContain(race[0].status());
  expect(race[1].status()).toBe(200);
  expect(race[2].status()).toBe(200);
  expect(
    (await post(first.request, "start", { examId: exam.id })).status(),
  ).toBe(403);
  expect(
    (
      await post(admin.request, "release", {
        examId: exam.id,
        released: true,
        attemptId: a.id,
      })
    ).status(),
  ).toBe(200);
  const published = (
    await (await first.request.get("/api/platform/workspace")).json()
  ).data.attempts[0];
  expect(published.result).toBeDefined();
  expect(JSON.stringify(published)).not.toMatch(
    /correctOptionId|Private explanation/,
  );
  const copy = (
    await (
      await post(admin.request, "duplicate-exam", { examId: exam.id })
    ).json()
  ).result;
  const activeCopy = (
    await (
      await post(admin.request, "save-exam", { ...copy, status: "published" })
    ).json()
  ).result;
  expect(
    (
      await post(admin.request, "assign", {
        examId: activeCopy.id,
        userIds: [users[0].id],
      })
    ).status(),
  ).toBe(200);
  const expiring = (
    await (await post(first.request, "start", { examId: activeCopy.id })).json()
  ).result;
  const pool = new Pool({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55432/postgres",
    max: 1,
  });
  try {
    await pool.query(
      "UPDATE yas.exam_attempts SET started_at=now()-interval '3 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",
      [expiring.id],
    );
    await first.request.get("/api/platform/workspace");
    const expired = (
      await pool.query(
        "SELECT status,submission_reason FROM yas.exam_attempts WHERE id=$1",
        [expiring.id],
      )
    ).rows[0];
    expect(expired).toMatchObject({
      status: "submitted",
      submission_reason: "expired",
    });
    expect(
      Number(
        (
          await pool.query(
            "SELECT count(*) AS n FROM yas.exam_results WHERE attempt_id=$1",
            [a.id],
          )
        ).rows[0].n,
      ),
    ).toBe(1);
    const responseCount = Number(
      (
        await pool.query(
          "SELECT count(*) AS n FROM yas.student_responses WHERE attempt_id=$1",
          [a.id],
        )
      ).rows[0].n,
    );
    const score = Number(
      (
        await pool.query(
          "SELECT earned_marks FROM yas.exam_results WHERE attempt_id=$1",
          [a.id],
        )
      ).rows[0].earned_marks,
    );
    expect(score).toBe(responseCount ? 2 : 0);
    await pool.query(
      "UPDATE yas.auth_sessions SET expires_at=now()-interval '1 minute' WHERE user_id=$1",
      [users[1].id],
    );
    expect((await second.request.get("/api/platform/workspace")).status()).toBe(
      401,
    );
  } finally {
    await pool.end();
  }
  expect(
    (
      await post(admin.request, "user-status", {
        ids: [users[0].id],
        status: "suspended",
      })
    ).status(),
  ).toBe(200);
  expect((await first.request.get("/api/platform/workspace")).status()).toBe(
    401,
  );
  await first.close();
  await second.close();
  await adminContext.close();
});
