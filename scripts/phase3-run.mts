import { spawn } from "node:child_process";
// Environment flags are portable across Windows and Linux shells.
const child = spawn(
  process.execPath,
  ["--import", "tsx", "scripts/test-server.mts"],
  {
    env: { ...process.env, PHASE3: "1", PHASE3_ONLY: "1" },
    stdio: "inherit",
    windowsHide: true,
  },
);
child.on("error", () => {
  console.error("Could not start isolated Phase 3 checks.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
