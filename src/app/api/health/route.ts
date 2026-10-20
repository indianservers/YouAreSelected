import { requireAdmin } from "@/server/access";
import { database } from "@/server/db";
import { safeError } from "@/server/errors";
import { observe } from "@/server/logging";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = observe("health.read", async (request: Request) => {
  try {
    await requireAdmin(request.headers);
    const start = performance.now();
    await database.query("SELECT 1");
    return Response.json({
      status: "ok",
      database: "reachable",
      databaseMs: Math.round(performance.now() - start),
    });
  } catch (error) {
    const e = safeError(error);
    return Response.json({ message: e.message }, { status: e.status });
  }
});
