import type { DemoData, ExamAttempt } from "@/types/domain";
export function exportRows(data: DemoData, attempts: ExamAttempt[]) {
  return attempts
    .filter((a) => a.result)
    .map((a) => ({
      Student: data.users.find((u) => u.id === a.userId)?.name ?? "Unknown",
      Email: data.users.find((u) => u.id === a.userId)?.email ?? "",
      Examination:
        data.exams.find((e) => e.id === a.examId)?.title ?? "Unknown",
      "Attempt reference": a.id,
      "Submitted at": a.submittedAt ?? "",
      Score: a.result!.score,
      "Maximum marks": a.result!.maximum,
      Percentage: a.result!.percentage,
      Correct: a.result!.correct,
      Incorrect: a.result!.incorrect,
      Unattempted: a.result!.unattempted,
      "Time taken (seconds)": Math.max(
        0,
        Math.round(
          (Date.parse(a.submittedAt!) - Date.parse(a.startedAt)) / 1000,
        ),
      ),
      Result: a.result!.passed ? "Passed" : "Not passed",
      Publication: a.publication.released ? "Published" : "Withheld",
    }));
}
// Neutralize spreadsheet formula injection in user-controlled text fields.
export const safeCell = (value: unknown) =>
  typeof value === "string" && /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
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
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadResults(
  data: DemoData,
  attempts: ExamAttempt[],
  format: "csv" | "xlsx",
) {
  const rows = exportRows(data, attempts);
  if (!rows.length) throw Error("No submitted results to export.");
  if (format === "csv") {
    download(
      new Blob([csvString(rows)], { type: "text/csv;charset=utf-8" }),
      "youareselected-results.csv",
    );
    return;
  }
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Examination results");
  sheet.columns = Object.keys(rows[0]).map((header) => ({
    header,
    key: header,
    width: header === "Examination" ? 38 : 24,
  }));
  rows.forEach((row) =>
    sheet.addRow(
      Object.fromEntries(Object.entries(row).map(([k, v]) => [k, safeCell(v)])),
    ),
  );
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF6554DC" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: "A1",
    to: { row: 1, column: sheet.columns.length },
  };
  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "youareselected-results.xlsx",
  );
}
