// Explicit disposable local PostgreSQL harness. Never loaded by the production application.
import EmbeddedPostgres from "embedded-postgres";
import { mkdir, mkdtemp } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
const workspace = resolve(".");
const root = resolve(".test-databases");
if (!root.startsWith(workspace + sep))
  throw Error("Test database must remain within the workspace.");
await mkdir(root, { recursive: true });
const directory = await mkdtemp(resolve(root, "run-"));
if (!resolve(directory).startsWith(root + sep))
  throw Error("Unsafe test database path.");
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: "postgres",
  password: "postgres",
  port: 55432,
  persistent: false,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let child: ReturnType<typeof spawn> | undefined;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child?.kill();
  await pg.stop().catch(() => {});
  process.exit(0);
}
try {
  await pg.initialise();
  await pg.start();
  const password =
    process.env.E2E_ADMIN_PASSWORD ?? randomBytes(24).toString("base64url");
  const email = process.env.E2E_ADMIN_EMAIL ?? "admin@isolated.test";
  const env = {
    ...process.env,
    DATABASE_URL:
      "postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable",
    DATABASE_URL_UNPOOLED:
      "postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable",
    AUTH_SECRET: randomBytes(48).toString("base64url"),
    APP_URL: "http://localhost:3000",
    BOOTSTRAP_ADMIN_EMAIL: email,
    BOOTSTRAP_ADMIN_PASSWORD: password,
    BOOTSTRAP_ADMIN_NAME: "Integration Administrator",
    CONFIRM_SAMPLE_SEED: "yes",
  };
  // Verify the real controlled migration/bootstrap/seed commands, including idempotent reruns.
  const run = promisify(execFile);
  for (const command of [
    "inspect",
    "plan",
    "migrate",
    "migrate",
    "verify",
    "health",
    "bootstrap",
    "bootstrap",
  ]) {
    try {
      await run(
        process.execPath,
        ["--import", "tsx", "scripts/database.ts", command],
        { env, windowsHide: true },
      );
    } catch (error) {
      console.error(`Isolated CLI verification failed: ${command}.`);
      const stderr = String(
        (error as { stderr?: string }).stderr ?? "",
      ).replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted database URL]");
      console.error(stderr);
      throw Error("CLI verification failed.");
    }
  }
  for (let i = 0; i < 2; i++) {
    try {
      await run(process.execPath, ["--import", "tsx", "scripts/seed.mts"], {
        env,
        windowsHide: true,
      });
    } catch (error) {
      console.error("Isolated sample seed failed.");
      console.error(
        String((error as { stderr?: string }).stderr ?? "").replace(
          /postgres(?:ql)?:\/\/\S+/g,
          "[redacted database URL]",
        ),
      );
      throw Error("Seed verification failed.");
    }
  }
  console.info(
    "Isolated PostgreSQL: migrations, schema, bootstrap and idempotent sample seed verified.",
  );
  child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--port", "3000"],
    { env, stdio: "inherit", windowsHide: true },
  );
  child.on("exit", () => void stop());
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
} catch {
  console.error(
    "The isolated PostgreSQL test harness could not start. No production database was contacted.",
  );
  await pg.stop().catch(() => {});
  process.exit(1);
}
