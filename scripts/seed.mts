import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
import { Pool } from "pg";
import { connectionString, type Database } from "../src/server/db";
import { PlatformRepository, stableId } from "../src/server/platform";
import { seed } from "../src/server/sample-content";
import { userDto } from "../src/server/dto";
import { ServiceError } from "../src/server/errors";
if (process.env.CONFIRM_SAMPLE_SEED !== "yes")
  throw new Error(
    "Set CONFIRM_SAMPLE_SEED=yes to explicitly load sample exam content.",
  );
const pool = new Pool({ connectionString: connectionString(), max: 2 });
const db: Database = {
  query: (s, v) => pool.query(s, v),
  transaction: async (fn) => {
    const tx = await pool.connect();
    try {
      await tx.query("BEGIN");
      const result = await fn(tx);
      await tx.query("COMMIT");
      return result;
    } catch (e) {
      await tx.query("ROLLBACK");
      throw e;
    } finally {
      tx.release();
    }
  },
};
try {
  const admin = (
    await pool.query(
      "SELECT * FROM yas.users WHERE role='admin' AND account_status='active' AND approval_status='approved' ORDER BY created_at LIMIT 1",
    )
  ).rows[0];
  if (!admin) throw new Error("Bootstrap an administrator before seeding.");
  const repo = new PlatformRepository(db);
  for (const exam of seed().exams) {
    const id = stableId("sample-exams", exam.id);
    if (
      (
        await pool.query(
          "SELECT id FROM yas.exams WHERE id=$1 OR exam_code=$2",
          [id, exam.code],
        )
      ).rows.length
    ) {
      console.log(`${exam.code}: already present; left unchanged.`);
      continue;
    }
    await repo.saveExam(userDto(admin), { ...exam, id });
    console.log(`${exam.code}: sample examination added.`);
  }
  console.log(
    "Sample content seeded. No accounts, assignments or fake attempts were imported.",
  );
} catch (error) {
  console.error(
    error instanceof ServiceError
      ? error.message
      : `Database code: ${error && typeof error === "object" && "code" in error ? String(error.code) : "INTERNAL"}`,
  );
  console.error(
    "Sample seed failed. Check schema and configuration; credentials were not logged.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
