// @vitest-environment node
import { expect, it } from "vitest";
import { migrationDigests } from "@/server/migration-checksum";
it("keeps canonical migration checksums portable across Windows and Linux", () => {
  const lf = "SELECT 1;\nSELECT 2;\n",
    crlf = lf.replaceAll("\n", "\r\n");
  expect(migrationDigests(lf)).toEqual(migrationDigests(crlf));
  expect(migrationDigests(lf)).toHaveLength(2);
});
it("still rejects changed SQL content", () => {
  const original = migrationDigests("SELECT 1;\n");
  expect(
    migrationDigests("SELECT 2;\n").some((d) => original.includes(d)),
  ).toBe(false);
});
