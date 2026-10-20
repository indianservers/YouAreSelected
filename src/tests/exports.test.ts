import { expect, it } from "vitest";
import { csvString, safeCell } from "@/lib/exports";
it("escapes CSV correctly and neutralizes formula injection", () => {
  const csv = csvString([
    { Name: 'A, "quoted" name', Score: -0.5, Email: '=HYPERLINK("bad")' },
  ]);
  expect(csv).toContain('"A, ""quoted"" name"');
  expect(csv).toContain('"-0.5"');
  expect(csv).toContain("'=HYPERLINK");
  expect(safeCell(" +SUM(1,1)")).toBe("' +SUM(1,1)");
});
