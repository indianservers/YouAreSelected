import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { migrationDigests } from "../src/server/migration-checksum";
import { hash } from "@node-rs/argon2";
import { connectionString } from "../src/server/db";
const command = process.argv[2] ?? "inspect";
const pool = new Pool({
  connectionString: connectionString(
    command === "health" ? "DATABASE_URL" : "DATABASE_URL_UNPOOLED",
  ),
  max: 1,
  connectionTimeoutMillis: 10000,
});
async function main() {
  if (command === "inspect") {
    const { rows } = await pool.query(
      "SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1,2",
    );
    for (const row of rows) {
      try {
        const identifier = `"${String(row.table_schema).replaceAll('"', '""')}"."${String(row.table_name).replaceAll('"', '""')}"`;
        row.records = Number(
          (await pool.query(`SELECT count(*) AS n FROM ${identifier}`)).rows[0]
            .n,
        );
      } catch {
        row.records = "unavailable";
      }
    }
    console.table(rows);
    return;
  }
  if (command === "health") {
    await pool.query("SELECT 1");
    const exists = (
      await pool.query("SELECT to_regclass('yas.users') IS NOT NULL AS ready")
    ).rows[0].ready;
    console.log(
      exists
        ? "Database reachable; application schema present."
        : "Database reachable; application migrations not yet applied.",
    );
    return;
  }
  if (command === "migrate" || command === "plan") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('yas:migrations'))",
      );
      const existing = (
        await client.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema='yas'",
        )
      ).rows.map((r) => r.table_name);
      if (existing.length && !existing.includes("migration_history"))
        throw new Error(
          "Existing untracked yas schema found. Review manually before migrating.",
        );
      await client.query("CREATE SCHEMA IF NOT EXISTS yas");
      await client.query(
        "CREATE TABLE IF NOT EXISTS yas.migration_history(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const applied = (
        await client.query("SELECT name,checksum FROM yas.migration_history")
      ).rows;
      for (const name of (await readdir("migrations"))
        .filter((n) => n.endsWith(".sql"))
        .sort()) {
        const sql = await readFile(`migrations/${name}`, "utf8");
        const digests = migrationDigests(sql);
        const checksum = digests[0];
        const old = applied.find((r) => r.name === name);
        if (old) {
          if (!digests.includes(old.checksum))
            throw new Error(
              "An applied migration checksum changed. Refusing to continue.",
            );
          console.log(`${name}: already applied`);
          continue;
        }
        console.log(
          `${name}: ${command === "plan" ? "pending (not applied)" : "applying"}`,
        );
        if (command === "migrate") {
          await client.query(sql);
          await client.query(
            "INSERT INTO yas.migration_history(name,checksum) VALUES($1,$2)",
            [name, checksum],
          );
        }
      }
      await client.query(command === "plan" ? "ROLLBACK" : "COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    return;
  }
  if (command === "verify") {
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
    for (const name of tables) {
      if (
        !(
          await pool.query("SELECT to_regclass($1) IS NOT NULL AS present", [
            `yas.${name}`,
          ])
        ).rows[0].present
      )
        throw new Error(`Missing table: ${name}`);
    }
    console.log(`${tables.length} expected tables verified.`);
    return;
  }
  if (command === "bootstrap") {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(),
      password = process.env.BOOTSTRAP_ADMIN_PASSWORD,
      name = process.env.BOOTSTRAP_ADMIN_NAME ?? "Administrator";
    if (
      !email ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      !password ||
      password.length < 16
    )
      throw new Error(
        "Supply BOOTSTRAP_ADMIN_EMAIL and a unique BOOTSTRAP_ADMIN_PASSWORD of at least 16 characters through the environment.",
      );
    const passwordHash = await hash(password, {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('yas:bootstrap'))",
      );
      if (
        (await client.query("SELECT id FROM yas.bootstrap_state WHERE id=1"))
          .rows.length
      ) {
        console.log("Bootstrap already completed; no changes.");
        await client.query("ROLLBACK");
        return;
      }
      if (
        (await client.query("SELECT id FROM yas.users WHERE email=$1", [email]))
          .rows.length
      )
        throw new Error(
          "Bootstrap email already exists. Refusing to promote an existing registration.",
        );
      const id = randomUUID();
      await client.query(
        "INSERT INTO yas.users(id,full_name,email,role,approval_status) VALUES($1,$2,$3,'admin','approved')",
        [id, name, email],
      );
      await client.query(
        "INSERT INTO yas.auth_accounts(user_id,account_id,provider_id,password_hash) VALUES($1::uuid,$1::text,'credential',$2)",
        [id, passwordHash],
      );
      await client.query("INSERT INTO yas.user_profiles(user_id) VALUES($1)", [
        id,
      ]);
      await client.query(
        "INSERT INTO yas.bootstrap_state(id,user_id) VALUES(1,$1)",
        [id],
      );
      await client.query(
        "INSERT INTO yas.audit_logs(actor_user_id,action,entity_type,entity_id) VALUES($1::uuid,'admin.bootstrap','user',$1::text)",
        [id],
      );
      await client.query("COMMIT");
      console.log(
        "Initial administrator created. Remove bootstrap variables now.",
      );
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    return;
  }
  throw new Error("Use inspect, plan, migrate, verify, health, or bootstrap.");
}
main()
  .catch(() => {
    console.error(
      "Database operation failed. Check configuration and schema compatibility; no credentials were logged.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
