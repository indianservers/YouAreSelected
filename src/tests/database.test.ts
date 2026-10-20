// PGlite runs the PostgreSQL engine in an isolated process-local database.
// These tests never connect to the application's DATABASE_URL.
// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PlatformRepository } from "@/server/platform";
import type { Database, Queryable } from "@/server/db";
import type { User, Exam } from "@/types/domain";
import { blankExam, blankQuestion } from "@/lib/exam-defaults";
import { safeAttempt } from "@/server/dto";
import { reportFilters, reportRows } from "@/server/reports";
let pg: PGlite;
let repo: PlatformRepository;
let db: Database;
let admin: User;
let student: User;
let exam: Exam;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("migrations/0001_foundation.sql", "utf8"));
  await pg.exec(
    await readFile("migrations/0002_integrity_and_indexes.sql", "utf8"),
  );
  await pg.exec(
    await readFile("migrations/0003_response_deadline_guard.sql", "utf8"),
  );
  const adapt = (
    client: PGlite | Parameters<Parameters<PGlite["transaction"]>[0]>[0],
  ): Queryable => ({
    query: async <T>(sql: string, values?: unknown[]) => {
      const r = await client.query<T>(sql, values);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
  });
  db = {
    ...adapt(pg),
    transaction: (fn) => pg.transaction((tx) => fn(adapt(tx))),
  };
  repo = new PlatformRepository(db);
  admin = {
    id: randomUUID(),
    name: "Test Admin",
    email: "admin@example.test",
    mobile: "9000000000",
    institution: "Test",
    role: "admin",
    status: "approved",
    registeredAt: new Date().toISOString(),
  };
  student = {
    ...admin,
    id: randomUUID(),
    name: "Test Student",
    email: "student@example.test",
    role: "student",
  };
  for (const u of [admin, student])
    await db.query(
      "INSERT INTO yas.users(id,full_name,email,phone,role,approval_status) VALUES($1,$2,$3,$4,$5,$6)",
      [u.id, u.name, u.email, u.mobile, u.role, u.status],
    );
  exam = blankExam();
  exam.title = "Database assessment";
  exam.code = "DB-001";
  exam.category = "Aptitude";
  exam.subject = "Mathematics";
  exam.description = "An isolated assessment.";
  const q = blankQuestion(exam.sections[0].id);
  q.text = "What is 2 + 2?";
  q.options = q.options.map((o, i) => ({ ...o, text: String(i + 3) }));
  q.correctOptionId = "b";
  q.explanation = "2 + 2 = 4";
  exam.questions = [q];
  exam.status = "published";
  exam = await repo.saveExam(admin, exam);
  await repo.assign(admin, exam.id, [student.id]);
}, 30000);
afterAll(() => pg?.close());
describe("persistent exam lifecycle and private DTOs", () => {
  it("does not report success when a profile or result selection does not exist", async () => {
    await expect(
      repo.profile(
        admin,
        { name: "Valid name", mobile: "9000000000", institution: "" },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(repo.release(admin, randomUUID(), true)).rejects.toMatchObject(
      { status: 404 },
    );
  });
  it("keeps old keys and marks immutable while a new attempt uses the new version", async () => {
    const copy = await repo.duplicateExam(admin, exam.id);
    let ready = await repo.saveExam(admin, {
      ...copy,
      status: "published",
      maxAttempts: 2,
    });
    await repo.assign(admin, ready.id, [student.id]);
    const old = await repo.start(student, ready.id);
    const oldKey = (await repo.attempt(db, old.id)).questions[0]
      .correctOptionId!;
    await repo.saveResponse(
      student,
      old.id,
      old.questions[0].id,
      { optionId: oldKey },
      0,
    );
    const newKey = ready.questions[0].options.find((o) => o.id !== oldKey)!.id;
    ready.questions[0] = {
      ...ready.questions[0],
      correctOptionId: newKey,
      marks: 3,
    };
    ready = await repo.saveExam(admin, ready);
    await repo.submit(student, old.id);
    expect((await repo.attempt(db, old.id)).result?.score).toBe(2);
    const fresh = await repo.start(student, ready.id);
    await repo.saveResponse(
      student,
      fresh.id,
      fresh.questions[0].id,
      { optionId: newKey },
      0,
    );
    await repo.submit(student, fresh.id);
    expect((await repo.attempt(db, fresh.id)).result?.score).toBe(3);
    expect((await repo.attempt(db, old.id)).questions[0].correctOptionId).toBe(
      oldKey,
    );
  });
  it("rolls back failed exam replacement, bulk assignment and result insertion", async () => {
    const initial = await repo.exam(db, exam.id);
    const failing = (pattern: string) =>
      new PlatformRepository({
        ...db,
        transaction: (fn) =>
          db.transaction((tx) =>
            fn({
              query: async (sql, values) => {
                if (sql.includes(pattern))
                  throw new Error("Injected transactional failure");
                return tx.query(sql, values);
              },
            }),
          ),
      });
    await expect(
      failing("INSERT INTO yas.questions").saveExam(admin, {
        ...initial,
        title: "Must roll back",
      }),
    ).rejects.toThrow(/Injected/);
    expect(await repo.exam(db, exam.id)).toEqual(initial);
    const other = {
      ...student,
      id: randomUUID(),
      email: "rollback@example.test",
    };
    await db.query(
      "INSERT INTO yas.users(id,full_name,email,role,approval_status) VALUES($1,'Rollback',$2,'student','approved')",
      [other.id, other.email],
    );
    await expect(
      repo.assign(admin, exam.id, [other.id, randomUUID()]),
    ).rejects.toThrow(/Learner/);
    expect(
      (
        await db.query("SELECT id FROM yas.exam_assignments WHERE user_id=$1", [
          other.id,
        ])
      ).rows,
    ).toHaveLength(0);
    await repo.assign(admin, exam.id, [other.id]);
    const a = await repo.start(other, exam.id);
    await expect(
      failing("INSERT INTO yas.exam_results").submit(other, a.id),
    ).rejects.toThrow(/Injected/);
    expect((await repo.attempt(db, a.id)).status).toBe("in-progress");
    expect(
      (
        await db.query("SELECT id FROM yas.exam_results WHERE attempt_id=$1", [
          a.id,
        ])
      ).rows,
    ).toHaveLength(0);
    await repo.submit(other, a.id);
  });
  it("rejects unrelated response options and result owners at the database boundary", async () => {
    const copy = await repo.duplicateExam(admin, exam.id);
    const ready = await repo.saveExam(admin, { ...copy, status: "published" });
    await repo.assign(admin, ready.id, [student.id]);
    const a = await repo.start(student, ready.id);
    await expect(
      db.query(
        "INSERT INTO yas.student_responses(attempt_id,question_id,selected_option_id) VALUES($1,$2,$3)",
        [a.id, a.questions[0].id, randomUUID()],
      ),
    ).rejects.toThrow();
    await repo.submit(student, a.id);
    await expect(
      db.query("UPDATE yas.exam_results SET user_id=$2 WHERE attempt_id=$1", [
        a.id,
        admin.id,
      ]),
    ).rejects.toThrow();
  });
  it("enforces unique normalized email and foreign keys", async () => {
    await expect(
      db.query(
        "INSERT INTO yas.users(full_name,email) VALUES('Duplicate',$1)",
        [student.email],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("INSERT INTO yas.user_profiles(user_id) VALUES($1)", [
        randomUUID(),
      ]),
    ).rejects.toThrow();
  });
  it("enforces a single correct answer and rolls back invalid edits", async () => {
    const original = await repo.exam(db, exam.id);
    await expect(
      db.transaction(async (tx) => {
        await tx.query(
          "UPDATE yas.question_options SET is_correct=false WHERE question_id=$1",
          [original.questions[0].id],
        );
      }),
    ).rejects.toThrow();
    expect((await repo.exam(db, exam.id)).questions[0].correctOptionId).toBe(
      original.questions[0].correctOptionId,
    );
  });
  it("checks unapproved and unassigned access on the server", async () => {
    await repo.status(admin, [student.id], "pending");
    await expect(repo.start(student, exam.id)).rejects.toThrow(/approved/);
    await expect(repo.assign(admin, exam.id, [student.id])).rejects.toThrow(
      /approved/,
    );
    await repo.status(admin, [student.id], "approved");
    await repo.assign(admin, exam.id, [student.id], true);
    await expect(repo.start(student, exam.id)).rejects.toThrow(/assigned/);
    await repo.assign(admin, exam.id, [student.id]);
  });
  it("creates one resumable attempt, saves revisioned answers, snapshots grading and publishes privately", async () => {
    const attempt = await repo.start(student, exam.id);
    expect((await repo.start(student, exam.id)).id).toBe(attempt.id);
    expect(JSON.stringify(attempt)).not.toMatch(
      /correctOptionId|explanation|earned_marks/,
    );
    const q = attempt.questions[0];
    const key = (await repo.attempt(db, attempt.id)).questions[0]
      .correctOptionId!;
    const saved = await repo.saveResponse(
      student,
      attempt.id,
      q.id,
      { optionId: key, review: true },
      0,
    );
    expect(saved.attempt.responses[0].optionId).toBe(key);
    await expect(
      repo.saveResponse(student, attempt.id, q.id, { review: false }, 0),
    ).rejects.toThrow(/another tab/);
    const edited = await repo.exam(db, exam.id);
    edited.questions[0].marks = 10;
    await repo.saveExam(admin, edited);
    const submitted = await repo.submit(student, attempt.id);
    expect(submitted.result).toBeUndefined();
    expect((await repo.attempt(db, attempt.id)).result?.score).toBe(2);
    await repo.submit(student, attempt.id);
    expect(
      Number(
        (
          await db.query(
            "SELECT count(*) AS n FROM yas.exam_results WHERE attempt_id=$1",
            [attempt.id],
          )
        ).rows[0].n,
      ),
    ).toBe(1);
    await expect(
      repo.saveResponse(student, attempt.id, q.id, { optionId: null }, 1),
    ).rejects.toThrow(/read-only/);
    const outsider = { ...student, id: admin.id };
    await expect(repo.submit(outsider, attempt.id)).rejects.toThrow(
      /not found/,
    );
    await repo.release(admin, exam.id, true, attempt.id);
    const published = safeAttempt(await repo.attempt(db, attempt.id), false);
    expect(published.result?.score).toBe(2);
    expect(published.questions[0].correctOptionId).toBe(key);
    await repo.release(admin, exam.id, false);
    expect(
      safeAttempt(await repo.attempt(db, attempt.id), false).result,
    ).toBeUndefined();
    await expect(repo.start(student, exam.id)).rejects.toThrow(/limit/);
  });
  it("finalizes expiration without a browser and refuses late answers", async () => {
    const copy = await repo.duplicateExam(admin, exam.id);
    const ready = await repo.saveExam(admin, { ...copy, status: "published" });
    await repo.assign(admin, ready.id, [student.id]);
    const a = await repo.start(student, ready.id);
    await db.query(
      "UPDATE yas.exam_attempts SET started_at=now()-interval '3 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",
      [a.id],
    );
    const r = await repo.saveResponse(
      student,
      a.id,
      a.questions[0].id,
      { optionId: a.questions[0].options[0].id },
      0,
    );
    expect(r.expired).toBe(true);
    expect((await repo.attempt(db, a.id)).result?.unattempted).toBe(1);
    expect(
      (
        await db.query(
          "SELECT status,submission_reason FROM yas.exam_attempts WHERE id=$1",
          [a.id],
        )
      ).rows[0],
    ).toMatchObject({ status: "submitted", submission_reason: "expired" });
  });
  it("blocks student administrative changes and stale exam writes", async () => {
    await expect(repo.saveExam(student, exam)).rejects.toThrow(/Administrator/);
    await expect(
      repo.status(student, [student.id], "approved"),
    ).rejects.toThrow(/Administrator/);
    await expect(repo.release(student, exam.id, true)).rejects.toThrow(
      /Administrator/,
    );
    await expect(repo.saveExam(admin, exam)).rejects.toThrow(
      /changed elsewhere/,
    );
  });
  it("does not expose keys or unpublished results in a student workspace", async () => {
    const state = await repo.workspace(student);
    expect(state.users).toHaveLength(1);
    expect(state.users[0].id).toBe(student.id);
    expect(JSON.stringify(state)).not.toMatch(
      /correctOptionId|password_hash|demoPassword|explanation/,
    );
    expect(state.attempts.every((a) => !a.result)).toBe(true);
  });
  it("generates every bounded report from persisted rows and enforces report authorization", async () => {
    for (const kind of [
      "scores",
      "users",
      "approved",
      "assignments",
      "participation",
      "attempts",
      "sections",
      "statistics",
    ]) {
      const rows = await reportRows(
        db,
        admin,
        reportFilters.parse({ kind, status: "all" }),
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toMatch(/correctOptionId|password_hash/);
    }
    await expect(
      reportRows(db, student, reportFilters.parse({})),
    ).rejects.toThrow(/Administrator/);
  });
});
