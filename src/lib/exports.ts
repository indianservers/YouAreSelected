// Neutralize spreadsheet formula injection in user-controlled text fields.
export const safeCell = (value: unknown) =>
  value instanceof Date?value.toISOString():typeof value === "string" && /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
export function csvString(rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? {});
  const escape = (value: unknown) =>
    `"${String(safeCell(value) ?? "").replaceAll('"', '""')}"`;
  return (
    "\ufeff" +
    [
      headers.map(escape).join(","),
      ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
    ].join("\r\n")
  );
}
