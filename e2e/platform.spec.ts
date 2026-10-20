import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});
async function login(page: Page, role: "Student" | "Admin") {
  await page.goto("/login");
  await page.getByRole("button", { name: `${role} demo` }).click();
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(page).toHaveURL(
    role === "Admin" ? /\/admin$/ : /\/student\/dashboard$/,
  );
  await expect(page.locator("#main-content h1").first()).toBeVisible();
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}
test("student attempt persists across refresh, submits once, and waits for released results", async ({
  page,
}) => {
  await login(page, "Student");
  await page.goto("/student/exams/exam-2/instructions");
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: "Start examination" }),
  ).toBeDisabled();
  await page.goto("/student/exams/exam-1/instructions");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start examination" }).click();
  await expect(page).toHaveURL(/\/attempt$/);
  await page.getByRole("radio").nth(2).check();
  await page.getByRole("radio").nth(1).check();
  await page
    .getByRole("button", { name: "Clear response", exact: true })
    .click();
  await expect(page.getByRole("radio").nth(1)).not.toBeChecked();
  await page.getByRole("radio").nth(2).check();
  await page
    .getByRole("button", { name: "Mark for review", exact: true })
    .click();
  const deadline = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("yas-demo-v1")!).state.data.attempts[0]
        .deadline,
  );
  await page.getByRole("button", { name: "Save & next", exact: true }).click();
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("radio").nth(2)).toBeChecked();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("yas-demo-v1")!).state.data.attempts[0]
          .deadline,
    ),
  ).toBe(deadline);
  await page.getByRole("button", { name: "Submit exam", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("2");
  await page
    .getByRole("button", { name: "Submit examination", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Test submitted successfully." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View result status" }).click();
  await expect(
    page.getByRole("heading", { name: "Results Awaiting Publication." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Results Awaiting Publication." }),
  ).toBeVisible();
  await logout(page);
  await login(page, "Admin");
  await page.goto("/admin/results/exam-1");
  await page
    .getByRole("button", { name: "Release results", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Release results", exact: true })
    .click();
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const csvFile = await csv;
  expect(csvFile.suggestedFilename()).toMatch(/\.csv$/);
  expect(await readFile((await csvFile.path())!, "utf8")).toContain(
    '"4","20","20","2","0","8"',
  );
  const excel = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  const xlsxFile = await excel;
  expect(xlsxFile.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await xlsxFile.path())!);
  expect(workbook.worksheets[0].getCell("F2").value).toBe(4);
  expect(workbook.worksheets[0].getCell("G2").value).toBe(20);
  expect(workbook.worksheets[0].getCell("I2").value).toBe(2);
  await logout(page);
  await login(page, "Student");
  await page.goto("/student/results");
  await page.getByRole("link").filter({ hasText: "SSC CGL Mock Test" }).click();
  await expect(
    page.getByRole("heading", { name: "Your answer sheet" }),
  ).toBeVisible();
  await expect(page.getByText("4 / 20 marks")).toBeVisible();
  await logout(page);
  await login(page, "Admin");
  await page.goto("/admin/results/exam-1");
  await page
    .getByRole("button", { name: "Withhold results", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Withhold results", exact: true })
    .click();
  await logout(page);
  await login(page, "Student");
  await page.goto("/student/results");
  await page.getByRole("link").filter({ hasText: "SSC CGL Mock Test" }).click();
  await expect(
    page.getByRole("heading", { name: "Results Awaiting Publication." }),
  ).toBeVisible();
});
test("registration, approval, exam creation, question editing, assignment and scheduling stay coherent", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Full name", { exact: true }).fill("New Demo Learner");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("newlearner@demo.test");
  await page.getByLabel("Mobile number", { exact: true }).fill("9000000099");
  await page.getByLabel("Password", { exact: true }).fill("Learner@12345");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Learner@12345");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Great things start here." }),
  ).toBeVisible();
  await login(page, "Admin");
  await page.goto("/admin/users");
  await page
    .getByRole("textbox", { name: "Search learners, email or mobile…" })
    .fill("New Demo Learner");
  await page
    .getByRole("combobox", { name: "Change status for New Demo Learner" })
    .selectOption("approved");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "New Demo Learner" }),
  ).toContainText("approved");
  await page.goto("/admin/exams/new");
  await page
    .getByLabel("Exam title *", { exact: true })
    .fill("Campus readiness assessment");
  await page.getByLabel("Exam code *", { exact: true }).fill("CAMPUS-01");
  await page
    .getByLabel("Description *", { exact: true })
    .fill("A short assessment for new learners.");
  await page.getByLabel("Category *", { exact: true }).fill("Campus");
  await page.getByLabel("Subject *", { exact: true }).fill("Aptitude");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/edit$/);
  const examPath = new URL(page.url()).pathname.replace("/edit", "");
  await page
    .locator(".exam-admin-nav")
    .getByRole("link", { name: "Question bank", exact: true })
    .click();
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await page
    .getByLabel("Question text *", { exact: true })
    .fill("What is 2 + 2?");
  for (const [i, value] of ["3", "4", "5", "6"].entries())
    await page
      .getByRole("textbox", {
        name: `Option ${String.fromCharCode(65 + i)} text`,
        exact: true,
      })
      .fill(value);
  await page
    .getByRole("radio", { name: "Option B is correct", exact: true })
    .check();
  await page
    .getByLabel("Explanation", { exact: true })
    .fill("Two plus two equals four.");
  await page
    .getByRole("button", { name: "Save question", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "What is 2 + 2?", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "What is 2 + 2?", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Option B is correct", exact: true }),
  ).toBeChecked();
  await page
    .getByLabel("Question text *", { exact: true })
    .fill("What is the sum of 2 and 2?");
  await page
    .getByRole("button", { name: "Save question", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Duplicate question 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete question 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete question", exact: true })
    .click();
  await page.goto(`${examPath}/edit`);
  await page
    .getByRole("button", { name: "Publish examination", exact: true })
    .click();
  await expect(
    page.getByText("Examination published.", { exact: true }),
  ).toBeVisible();
  await page.goto(`${examPath}/assignments`);
  await page
    .getByRole("textbox", { name: "Search learners…", exact: true })
    .fill("New Demo Learner");
  await page
    .getByRole("checkbox", { name: "Assign New Demo Learner", exact: true })
    .check();
  await page.getByRole("button", { name: /Assign selected/ }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "New Demo Learner" }),
  ).toContainText("Assigned");
  await page.goto(`${examPath}/schedule`);
  await page
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await expect(
    page.getByText("Schedule updated. Student eligibility is now in sync.", {
      exact: true,
    }),
  ).toBeVisible();
  await logout(page);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("newlearner@demo.test");
  await page.getByLabel("Password", { exact: true }).fill("Learner@12345");
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Campus readiness assessment" }),
  ).toBeVisible();
});
test("automatic deadline submission survives refresh and reset restores the demo", async ({
  page,
}) => {
  await login(page, "Student");
  await page.goto("/student/exams/exam-1/instructions");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start examination" }).click();
  await expect(page).toHaveURL(/\/attempt$/);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("yas-demo-v1")!);
    state.state.data.attempts[0].deadline = new Date(
      Date.now() - 5000,
    ).toISOString();
    localStorage.setItem("yas-demo-v1", JSON.stringify(state));
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Test submitted successfully." }),
  ).toBeVisible();
  await logout(page);
  await login(page, "Admin");
  await page.goto("/admin/settings");
  await page
    .getByRole("button", { name: "Reset Demo Data", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo data", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});
test("invalid login, restored session, profile edits and mobile layouts", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("student@demo.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "incorrect" }),
  ).toBeVisible();
  await login(page, "Student");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Let’s make progress/ }),
  ).toBeVisible();
  await page.goto("/student/profile");
  await page.getByLabel("Full name", { exact: true }).fill("Arjun Demo");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Arjun Demo", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Current demo password", { exact: true })
    .fill("Student@12345");
  await page
    .getByLabel("New demo password", { exact: true })
    .fill("Changed@12345");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("Changed@12345");
  await page.getByRole("button", { name: "Update demo password" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/student/dashboard");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "My examinations", exact: true })
    .click();
  await expect(page).toHaveURL(/\/student\/exams$/);
  await page.screenshot({
    path: "test-results/student-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/student/dashboard");
  await expect(page.locator(".workspace")).toHaveCSS("margin-left", "238px");
  await page.screenshot({
    path: "test-results/student-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("public, admin and exam views render at desktop, tablet and mobile widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little practice. A bigger future." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/login");
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await login(page, "Admin");
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const route of [
    "/admin/users",
    "/admin/exams",
    "/admin/questions",
    "/admin/assignments",
    "/admin/results",
    "/admin/reports",
    "/admin/settings",
    "/admin/exams/exam-1/edit",
    "/admin/exams/exam-1/schedule",
    "/admin/exams/exam-1/assignments",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("#main-content h1").first()).toBeVisible();
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/admin");
  await expect(page.locator(".workspace")).toHaveCSS("margin-left", "210px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/admin-tablet.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/users");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await logout(page);
  await login(page, "Student");
  await page.goto("/student/exams/exam-1/instructions");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start examination" }).click();
  await expect(page).toHaveURL(/\/attempt$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open question navigator" }).click();
  await expect(
    page.getByRole("button", { name: "Question 2: unvisited", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Question 2: unvisited", exact: true })
    .click();
  await expect(
    page.getByText("QUESTION 2", { exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/exam-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".workspace")).toHaveCSS("margin-left", "238px");
  await page.screenshot({
    path: "test-results/exam-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});
