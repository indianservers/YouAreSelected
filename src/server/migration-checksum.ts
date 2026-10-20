import { createHash } from "node:crypto";
// Hash canonical LF for new entries, while accepting legacy Windows hashes.
// No SQL content other than line endings is ignored or rewritten.
export function migrationDigests(sql: string) {
  const canonical = sql.replaceAll("\r\n", "\n");
  return [
    ...new Set(
      [canonical, sql, canonical.replaceAll("\n", "\r\n")].map((value) =>
        createHash("sha256").update(value).digest("hex"),
      ),
    ),
  ];
}
