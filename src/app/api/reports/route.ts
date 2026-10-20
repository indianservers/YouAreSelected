import { requireAdmin } from "@/server/access";
import { database } from "@/server/db";
import { reportFilters, reportRows } from "@/server/reports";
import { csvString, safeCell } from "@/lib/exports";
import { safeError } from "@/server/errors";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await requireAdmin(request.headers);
    const filters = reportFilters.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const rows = await reportRows(database, actor, filters);
    if (new URL(request.url).searchParams.get("preview") === "1")
      return Response.json(
        { rows, limit: 10000 },
        { headers: { "Cache-Control": "no-store" } },
      );
    const headers = {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="youareselected-${filters.kind}.${filters.format}"`,
      "X-Export-Limit": "10000",
    };
    if (filters.format === "csv")
      return new Response(csvString(rows), {
        headers: { ...headers, "Content-Type": "text/csv;charset=utf-8" },
      });
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Report");
    const keys = Object.keys(rows[0] ?? {});
    sheet.columns = keys.map((header) => ({ header, key: header, width: 25 }));
    rows.forEach((row) =>
      sheet.addRow(
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, safeCell(value)]),
        ),
      ),
    );
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...headers,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    const e =
      error instanceof z.ZodError
        ? { status: 400, message: "Invalid report filters." }
        : safeError(error);
    return Response.json({ message: e.message }, { status: e.status });
  }
}
