// Only invoked by the disposable harness; never reads .env.local.
import { Pool } from "pg";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { PlatformRepository, stableId } from "../src/server/platform";
import { userDto } from "../src/server/dto";
import { blankExam, blankQuestion } from "../src/lib/exam-defaults";
import { reportFilters, reportRows } from "../src/server/reports";
import { csvString, safeCell } from "../src/lib/exports";
import ExcelJS from "exceljs";
const { Workbook } = ExcelJS;
import type { Database } from "../src/server/db";
import type { Exam } from "../src/types/domain";
import assert from "node:assert/strict";
const url = new URL(process.env.DATABASE_URL!);
assert(
  url.hostname === "127.0.0.1" &&
    url.port === "55432" &&
    process.env.ISOLATED_PHASE3 === "yes",
  "Disposable loopback database required",
);
const pool = new Pool({
  connectionString: url.toString(),
  max: 4,
  connectionTimeoutMillis: 10000,
});
let queryCount = 0;
const db: Database = {
  query: async (sql, values) => {
    queryCount++;
    return pool.query(sql, values);
  },
  transaction: async (fn) => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        "SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='30s'",
      );
      const r = await fn(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  },
};
const repo = new PlatformRepository(db);
const fixtureId = (s: string) => stableId("phase3-isolated", s);
const measurements: Record<string, unknown> = {
  environment:
    "Windows local disposable PostgreSQL, repository layer, pool max=4; not HTTP login or staging capacity",
  started: new Date().toISOString(),
};
try {
  const admin = userDto(
    (await db.query("SELECT * FROM yas.users WHERE role='admin' LIMIT 1"))
      .rows[0],
  );
  for (let i = 0; i < 3; i++)
    await db.query(
      "INSERT INTO yas.users(id,full_name,email,role,approval_status) VALUES($1,$2,$3,'admin','approved') ON CONFLICT(id) DO NOTHING",
      [
        fixtureId(`admin${i}`),
        `TEST Administrator ${i}`,
        `phase3-admin-${i}@isolated.test`,
      ],
    );
  await db.query(
    `INSERT INTO yas.users(id,full_name,email,phone,role,approval_status,account_status)
 SELECT x.id,x.name,x.email,'9000000000','student',x.approval,x.account FROM jsonb_to_recordset($1::jsonb) x(id uuid,name text,email text,approval text,account text) ON CONFLICT(id) DO NOTHING`,
    [
      JSON.stringify(
        Array.from({ length: 560 }, (_, i) => ({
          id: fixtureId(`student${i}`),
          name: `TEST Candidate ${String(i).padStart(3, "0")}`,
          email: `phase3-${i}@isolated.test`,
          approval:
            i < 500
              ? "approved"
              : i < 540
                ? "pending"
                : i < 550
                  ? "rejected"
                  : "approved",
          account: i >= 550 ? "suspended" : "active",
        })),
      ),
    ],
  );
  const students = (
    await db.query(
      "SELECT * FROM yas.users WHERE email LIKE 'phase3-%@isolated.test' AND role='student' AND approval_status='approved' AND account_status='active' ORDER BY email",
    )
  ).rows.map(userDto);
  const facts = [
    ["Mathematics", "What is 12 × 8?", "96", "84", "108", "86", "12 × 8 = 96."],
    [
      "Reasoning",
      "What follows 2, 4, 8, 16?",
      "32",
      "24",
      "30",
      "20",
      "Each term doubles.",
    ],
    [
      "English",
      "Which word is the plural of child?",
      "Children",
      "Childs",
      "Childes",
      "Childrens",
      "Children is the irregular plural.",
    ],
    [
      "General Knowledge",
      "Which ocean is the largest by area?",
      "Pacific",
      "Atlantic",
      "Indian",
      "Arctic",
      "The Pacific Ocean has the largest area.",
    ],
    [
      "Computer Science",
      "How many values can one bit represent?",
      "2",
      "4",
      "8",
      "16",
      "A bit represents zero or one.",
    ],
    [
      "Physics",
      "What is the SI unit of force?",
      "Newton",
      "Joule",
      "Watt",
      "Pascal",
      "A newton is kg·m/s².",
    ],
    [
      "Chemistry",
      "What is the atomic number of carbon?",
      "6",
      "8",
      "12",
      "14",
      "Carbon has six protons.",
    ],
    [
      "Biology",
      "Which organ pumps blood through the body?",
      "Heart",
      "Liver",
      "Kidney",
      "Lung",
      "The heart provides the circulatory pumping action.",
    ],
    [
      "Aptitude",
      "What is 25% of 240?",
      "60",
      "40",
      "80",
      "100",
      "240 × 0.25 = 60.",
    ],
    [
      "Numerical Analysis",
      "What is 0.1 + 0.2 in decimal arithmetic?",
      "0.3",
      "0.2",
      "0.12",
      "0.03",
      "One tenth plus two tenths equals three tenths.",
    ],
  ];
  const exams: Exam[] = [];
  for (let i = 0; i < 26; i++) {
    const id = fixtureId(`exam${i}`);
    const existing = (
      await db.query("SELECT id FROM yas.exams WHERE id=$1", [id])
    ).rows[0];
    if (existing) {
      exams.push(await repo.exam(db, id));
      continue;
    }
    const e = blankExam();
    e.id = id;
    e.code = `TEST-P3-${i}`;
    e.title = `TEST ${facts[i % 10][0]} assessment ${i + 1}`;
    e.category = facts[i % 10][0];
    e.subject = e.category;
    e.description = "Isolated deterministic quality assurance fixture.";
    e.status = "published";
    e.duration = [5, 30, 60, 120][i % 4];
    e.maxAttempts = 100;
    e.sections = [{ id: fixtureId(`section${i}`), name: "Test section" }];
    e.questions = Array.from({ length: i === 25 ? 2 : 60 }, (_, j) => {
      const q = blankQuestion(e.sections[0].id);
      q.id = fixtureId(`q${i}-${j}`);
      const f = facts[(i + j) % 10];
      q.text = `Practice ${j + 1}: ${f[1]}`;
      q.options = q.options.map((o, k) => ({
        ...o,
        id: fixtureId(`o${i}-${j}-${k}`),
        text: f[k + 2],
      }));
      q.correctOptionId = q.options[0].id;
      q.marks = 1;
      q.negative = 0.25;
      q.explanation = f[6];
      q.topic = f[0];
      q.tags = ["TEST", "phase3"];
      return q;
    });
    exams.push(await repo.saveExam(admin, e));
  }
  for (const e of exams.slice(0, 3))
    await repo.assign(
      admin,
      e.id,
      students.map((u) => u.id),
    );
  const loadExam = exams[25];
  await repo.assign(
    admin,
    loadExam.id,
    students.map((u) => u.id),
  );
  const counts = (
    await db.query(
      "SELECT (SELECT count(*) FROM yas.users WHERE role='student')::int students,(SELECT count(*) FROM yas.exams WHERE exam_code LIKE 'TEST-P3-%')::int exams,(SELECT count(*) FROM yas.questions q JOIN yas.exams e ON e.id=q.exam_id WHERE e.exam_code LIKE 'TEST-P3-%')::int questions,(SELECT count(*) FROM yas.question_options o JOIN yas.questions q ON q.id=o.question_id JOIN yas.exams e ON e.id=q.exam_id WHERE e.exam_code LIKE 'TEST-P3-%')::int options",
    )
  ).rows[0];
  assert(
    counts.students >= 560 &&
      counts.questions >= 1500 &&
      counts.options >= 4000,
  );
  measurements.fixtures = counts;
  console.info("Phase 3: deterministic isolated fixtures ready.");
  const levels = [];
  for (const n of [10, 50, 100, 250, 500]) {
    const stages: Record<string, number[]> = {
      start: [],
      load: [],
      save: [],
      submit: [],
    };
    let errors = 0;
    const start = performance.now(),
      cpu = process.cpuUsage();
    let peakConnections = 0,
      peakWaiting = 0,
      peakRSS = 0;
    const sample = setInterval(() => {
      peakConnections = Math.max(peakConnections, pool.totalCount);
      peakWaiting = Math.max(peakWaiting, pool.waitingCount);
      peakRSS = Math.max(peakRSS, process.memoryUsage().rss);
    }, 10);
    await Promise.all(
      students.slice(0, n).map(async (u, i) => {
        try {
          let t = performance.now();
          const a = await repo.start(u, loadExam.id);
          stages.start.push(performance.now() - t);
          t = performance.now();
          await repo.exam(db, loadExam.id);
          stages.load.push(performance.now() - t);
          t = performance.now();
          const q = a.questions[0];
          const saved = await repo.saveResponse(
            u,
            a.id,
            q.id,
            { optionId: q.options[i % 2].id, visited: true },
            0,
          );
          stages.save.push(performance.now() - t);
          t = performance.now();
          await Promise.all([repo.submit(u, a.id), repo.submit(u, a.id)]);
          stages.submit.push(performance.now() - t);
          const actual = await repo.attempt(db, a.id);
          assert.equal(actual.result?.score, i % 2 === 0 ? 1 : -0.25);
          assert.equal(
            actual.responses[0].optionId,
            saved.attempt.responses[0].optionId,
          );
        } catch {
          errors++;
        }
      }),
    );
    clearInterval(sample);
    const stats = Object.fromEntries(
      Object.entries(stages).map(([k, v]) => {
        v.sort((a, b) => a - b);
        return [
          k,
          {
            count: v.length,
            p50Ms: Math.round(v[Math.floor(v.length * 0.5)] ?? 0),
            p95Ms: Math.round(v[Math.floor(v.length * 0.95)] ?? 0),
            maxMs: Math.round(v.at(-1) ?? 0),
          },
        ];
      }),
    );
    const level = {
      concurrentStudents: n,
      elapsedMs: Math.round(performance.now() - start),
      errors,
      errorRate: errors / n,
      peakConnections,
      peakWaiting,
      peakRSSMB: Math.round(peakRSS / 1048576),
      cpuMicros: process.cpuUsage(cpu),
      stages: stats,
    };
    levels.push(level);
    console.info(JSON.stringify({ phase3Load: level }));
    if (errors || Object.values(stats).some((s) => s.maxMs > 30000)) {
      measurements.stoppedAt = n;
      break;
    }
  }
  measurements.load = levels;
  assert(
    levels.every((l) => l.errors === 0),
    "Load error threshold exceeded",
  );
  // True duration checks use database timestamps; no browser clock can extend these.
  const timers = [];
  for (const minutes of [5, 30, 60, 120]) {
    const source = exams.find((e) => e.duration === minutes)!;
    await repo.assign(admin, source.id, [students[0].id]);
    const a = await repo.start(students[0], source.id);
    assert.equal(
      Date.parse(a.deadline) - Date.parse(a.startedAt),
      minutes * 60000,
    );
    assert.equal(
      (await repo.start(students[0], source.id)).deadline,
      a.deadline,
    );
    await db.query(
      "UPDATE yas.exam_attempts SET started_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [a.id],
    );
    const late = await repo.saveResponse(
      students[0],
      a.id,
      a.questions[0].id,
      { optionId: a.questions[0].options[0].id },
      0,
    );
    assert(late.expired);
    await repo.submit(students[0], a.id);
    timers.push({
      minutes,
      stableDeadline: true,
      lateSaveRejected: true,
      idempotentFinalization: true,
    });
  }
  measurements.timers = timers;
  const lockedAttempt = await repo.start(students[2], loadExam.id);
  const locker = await pool.connect();
  try {
    await locker.query("BEGIN");
    await locker.query(
      "UPDATE yas.exam_attempts SET started_at=clock_timestamp()-interval '1 minute',expires_at=clock_timestamp()+interval '150 milliseconds' WHERE id=$1",
      [lockedAttempt.id],
    );
    const waiting = repo.saveResponse(
      students[2],
      lockedAttempt.id,
      lockedAttempt.questions[0].id,
      { optionId: lockedAttempt.questions[0].options[0].id },
      0,
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    await locker.query("COMMIT");
    assert((await waiting).expired);
    assert.equal(
      (await repo.attempt(db, lockedAttempt.id)).responses.length,
      0,
    );
    measurements.lockDeadlineRegression =
      "passed: queued save rejected after deadline";
  } finally {
    await locker.query("ROLLBACK");
    locker.release();
  }
  await repo.release(admin, loadExam.id, true);
  // Create distinct, genuinely graded/persisted test submissions for the 10k
  // report case. This is bounded at 50 candidates per batch, never production.
  const reportSeedStart = performance.now();
  for (let batch = 0; batch < 200; batch++) {
    await Promise.all(
      Array.from({ length: 50 }, async (_, j) => {
        const i = batch * 50 + j,
          u = students[i % students.length];
        const a = await repo.start(u, loadExam.id),
          q = a.questions[0];
        await repo.saveResponse(
          u,
          a.id,
          q.id,
          { optionId: q.options[i % 2].id },
          0,
        );
        await repo.submit(u, a.id);
      }),
    );
    if ((batch + 1) % 20 === 0)
      console.info(
        `Phase 3: ${(batch + 1) * 50} distinct report submissions persisted.`,
      );
  }
  measurements.reportDataset = {
    additionalGradedAttempts: 10000,
    elapsedMs: Math.round(performance.now() - reportSeedStart),
  };
  await repo.release(admin, loadExam.id, true);
  const exports = [];
  const persisted = await reportRows(
    db,
    admin,
    reportFilters.parse({ exam: loadExam.id }),
  );
  for (const n of [10, 100, 1000, 10000]) {
    const rows = persisted.slice(0, n);
    assert.equal(rows.length, n);
    assert.equal(new Set(rows.map((r) => r["Attempt reference"])).size, n);
    const t = performance.now(),
      before = process.memoryUsage().rss;
    const csv = csvString(rows);
    const wb = new Workbook(),
      s = wb.addWorksheet("Verified rows");
    const keys = Object.keys(rows[0]);
    s.columns = keys.map((header) => ({ header, key: header }));
    rows.forEach((r) =>
      s.addRow(
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)])),
      ),
    );
    const buffer = await wb.xlsx.writeBuffer();
    const parsed = new Workbook();
    await parsed.xlsx.load(buffer);
    assert.equal(parsed.worksheets[0].rowCount, n + 1);
    for (const [i, row] of rows.entries()) {
      for (const key of ["Score", "Percentage", "Attempt reference", "Email"])
        assert.equal(
          parsed.worksheets[0].getRow(i + 2).getCell(keys.indexOf(key) + 1)
            .value,
          safeCell(row[key]),
        );
    }
    exports.push({
      rows: n,
      source: "distinct persisted, server-graded report rows",
      elapsedMs: Math.round(performance.now() - t),
      rssDeltaMB: Math.round((process.memoryUsage().rss - before) / 1048576),
      csvBytes: Buffer.byteLength(csv),
      xlsxBytes: buffer.byteLength,
    });
  }
  measurements.exports = exports;
  const qc = queryCount,
    t = performance.now();
  const workspace = await repo.workspace(students[1]);
  measurements.workspace = {
    elapsedMs: Math.round(performance.now() - t),
    queries: queryCount - qc,
    bytes: Buffer.byteLength(JSON.stringify(workspace)),
  };
  assert(queryCount - qc < 30, "Workspace N+1 regression");
  const integrity = (
    await db.query(`SELECT
 (SELECT count(*) FROM yas.student_responses r JOIN yas.attempt_questions q ON q.id=r.question_id WHERE r.attempt_id<>q.attempt_id)::int crossed_responses,
 (SELECT count(*) FROM (SELECT attempt_id FROM yas.exam_results GROUP BY attempt_id HAVING count(*)>1) x)::int duplicate_results,
 (SELECT count(*) FROM yas.exam_attempts a LEFT JOIN yas.exam_results r ON r.attempt_id=a.id WHERE a.status='submitted' AND r.id IS NULL)::int missing_results,
 (SELECT count(*) FROM yas.exam_results r JOIN yas.exam_attempts a ON a.id=r.attempt_id WHERE r.user_id<>a.user_id OR r.exam_id<>a.exam_id)::int wrong_owners`)
  ).rows[0];
  assert(Object.values(integrity).every((v) => v === 0));
  measurements.integrity = integrity;
  await db.query("ANALYZE yas.exam_attempts");
  measurements.queryPlan = (
    await db.query(
      "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM yas.exam_attempts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20",
      [students[0].id],
    )
  ).rows;
  // Full logical restore into a second disposable database, never the source.
  const tables = [
    "users",
    "user_profiles",
    "auth_sessions",
    "auth_accounts",
    "auth_verifications",
    "rate_limits",
    "exams",
    "exam_sections",
    "questions",
    "question_options",
    "exam_assignments",
    "exam_schedules",
    "exam_attempts",
    "attempt_questions",
    "student_responses",
    "exam_results",
    "audit_logs",
    "settings",
    "bootstrap_state",
    "migration_history",
  ];
  await db.query("CREATE DATABASE phase3_recovery");
  const restoreUrl = new URL(url);
  restoreUrl.pathname = "/phase3_recovery";
  const restore = new Pool({ connectionString: restoreUrl.toString(), max: 1 });
  const backupStart = performance.now();
  try {
    for (const file of [
      "0001_foundation.sql",
      "0002_integrity_and_indexes.sql",
    ])
      await restore.query(await readFile(`migrations/${file}`, "utf8"));
    await restore.query(
      "CREATE TABLE yas.migration_history(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL)",
    );
    await restore.query("BEGIN");
    await restore.query("SET CONSTRAINTS ALL DEFERRED");
    await restore.query("DELETE FROM yas.settings");
    let restoredRows = 0;
    for (const table of tables) {
      // Preserve PostgreSQL microseconds as JSON strings; pg's JS Date parser
      // truncates them to milliseconds and would make a lossy backup.
      const rows = (
        await db.query(
          `SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) AS records FROM yas.${table} t`,
        )
      ).rows[0].records;
      restoredRows += rows.length;
      if (rows.length)
        await restore.query(
          `INSERT INTO yas.${table} SELECT * FROM jsonb_populate_recordset(NULL::yas.${table},$1::jsonb)`,
          [JSON.stringify(rows)],
        );
    }
    await restore.query("COMMIT");
    // Guards are installed after importing historical submitted responses.
    await restore.query(
      await readFile("migrations/0003_response_deadline_guard.sql", "utf8"),
    );
    for (const table of tables) {
      const checksum = `SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) AS hash FROM yas.${table} t`;
      assert.equal(
        (await restore.query(checksum)).rows[0].hash,
        (await db.query(checksum)).rows[0].hash,
        `Restore mismatch: ${table}`,
      );
    }
    measurements.recovery = {
      tables: tables.length,
      restoredRows,
      checksumsMatch: true,
      elapsedMs: Math.round(performance.now() - backupStart),
      scope: "isolated logical copy and restore; not Neon PITR",
    };
  } finally {
    await restore.end();
    await db.query("DROP DATABASE phase3_recovery");
  }
  measurements.completed = new Date().toISOString();
  await mkdir("verification-artifacts", { recursive: true });
  await writeFile(
    "verification-artifacts/phase3-local.json",
    JSON.stringify(measurements, null, 2),
  );
  console.info("Phase 3: load, timer, report and integrity checks passed.");
} finally {
  await pool.end();
}
