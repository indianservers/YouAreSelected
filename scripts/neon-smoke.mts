// A single authorized administrator sign-in/sign-out; creates no test records.
import { config } from "dotenv";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
config({ path: ".env.bootstrap", quiet: true });
const base = "http://localhost:3001";
let ready = false;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(base + "/login")).ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
assert(ready, "Local provider smoke server unavailable");
const t = performance.now();
const login = await fetch(base + "/api/auth/sign-in/email", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  }),
});
assert.equal(login.status, 200, "Provider administrator login failed");
const loginMs = Math.round(performance.now() - t);
const cookie = login.headers
  .getSetCookie()
  .map((v) => v.split(";")[0])
  .join("; ");
assert(cookie, "No administrator session cookie");
try {
  const workspace = await fetch(base + "/api/platform/workspace", {
    headers: { Cookie: cookie },
  });
  assert.equal(workspace.status, 200);
  const body = await workspace.json();
  assert(body.data.users.some((u: { role: string }) => u.role === "admin"));
  assert.equal(
    body.data.exams.length,
    0,
    "Unexpected live examinations: no write was attempted",
  );
  const health = await fetch(base + "/api/health", {
    headers: { Cookie: cookie },
  });
  assert.equal(health.status, 200);
  await mkdir("verification-artifacts", { recursive: true });
  await writeFile(
    "verification-artifacts/neon-smoke.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        database: "Neon",
        adminLogin: true,
        workspaceRead: true,
        adminHealth: true,
        loginMs,
        health: await health.json(),
        testDataInserted: false,
      },
      null,
      2,
    ),
  );
} finally {
  const out = await fetch(base + "/api/auth/sign-out", {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: "{}",
  });
  assert(out.ok);
  const revoked = await fetch(base + "/api/platform/workspace", {
    headers: { Cookie: cookie },
  });
  assert.equal(revoked.status, 401);
}
console.info(
  "Neon administrator login, workspace, diagnostics and logout revocation passed. No test data was inserted.",
);
