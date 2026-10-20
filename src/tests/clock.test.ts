// @vitest-environment node
import { it, expect, vi } from "vitest";
import { syncServerClock, serverTime } from "@/lib/server-clock";
it("keeps elapsed server time when the system wall clock jumps", () => {
  const elapsed = vi.spyOn(performance, "now").mockReturnValue(100);
  syncServerClock("2026-10-20T12:00:00.000Z");
  const wall = vi.spyOn(Date, "now").mockReturnValue(0);
  elapsed.mockReturnValue(5100);
  expect(serverTime()).toBe(Date.parse("2026-10-20T12:00:05.000Z"));
  wall.mockReturnValue(9999999999999);
  elapsed.mockReturnValue(10100);
  expect(serverTime()).toBe(Date.parse("2026-10-20T12:00:10.000Z"));
  vi.restoreAllMocks();
});
