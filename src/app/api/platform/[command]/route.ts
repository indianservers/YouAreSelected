import { z } from "zod";
import { requireUser, checkOrigin } from "@/server/access";
import { database } from "@/server/db";
import { PlatformRepository } from "@/server/platform";
import { safeError, ServiceError } from "@/server/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const repo = new PlatformRepository(database);
const ids = z.array(z.uuid()).min(1).max(500);
const success = (value: unknown) =>
  Response.json(value, { headers: { "Cache-Control": "no-store" } });
export async function GET(
  request: Request,
  { params }: { params: Promise<{ command: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { command } = await params;
    const url = new URL(request.url);
    if (command === "workspace") {
      const data = await repo.workspace(user);
      return success({
        data,
        sessionId: user.id,
        serverNow: (await database.query("SELECT clock_timestamp() AS now"))
          .rows[0].now,
      });
    }
    if (command === "users") {
      const q = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          examId: z.uuid().optional(),
          pageSize: z.coerce.number().int().min(1).max(100).default(10),
          search: z.string().max(200).default(""),
          status: z
            .enum(["all", "pending", "approved", "rejected", "suspended"])
            .default("all"),
          sort: z
            .enum(["name", "email", "registeredAt", "status"])
            .default("registeredAt"),
          desc: z
            .enum(["true", "false"])
            .default("true")
            .transform((v) => v === "true"),
        })
        .parse(Object.fromEntries(url.searchParams));
      return success(await repo.users(user, q));
    }
    return Response.json({ message: "Not found." }, { status: 404 });
  } catch (error) {
    const e =
      error instanceof z.ZodError
        ? { status: 400, message: "Invalid request parameters." }
        : safeError(error);
    return Response.json({ message: e.message }, { status: e.status });
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ command: string }> },
) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length") ?? 0) > 1500000)
      return Response.json({ message: "Request too large." }, { status: 413 });
    const user = await requireUser(request.headers);
    const body = await request.json();
    const { command } = await params;
    let result: unknown;
    if (
      [
        "save-exam",
        "duplicate-exam",
        "save-questions",
        "user-status",
        "assign",
        "release",
        "settings",
      ].includes(command) &&
      user.role !== "admin"
    )
      throw new ServiceError(403, "Administrator access is required.");
    switch (command) {
      case "save-exam":
        result = await repo.saveExam(user, body);
        break;
      case "duplicate-exam":
        result = await repo.duplicateExam(
          user,
          z.object({ examId: z.uuid() }).parse(body).examId,
        );
        break;
      case "save-questions": {
        const p = z
          .object({
            examId: z.uuid(),
            questions: z.array(z.unknown()).max(500),
            version: z.number().int(),
          })
          .parse(body);
        await repo.actor(database, user, true);
        const exam = await repo.exam(database, p.examId);
        result = await repo.saveExam(user, {
          ...exam,
          questions: p.questions,
          version: p.version,
        });
        break;
      }
      case "profile": {
        const p = z
          .object({ profile: z.unknown(), userId: z.uuid().optional() })
          .parse(body);
        await repo.profile(user, p.profile, p.userId);
        break;
      }
      case "user-status": {
        const p = z
          .object({
            ids,
            status: z.enum(["pending", "approved", "rejected", "suspended"]),
          })
          .parse(body);
        await repo.status(user, p.ids, p.status);
        break;
      }
      case "assign": {
        const p = z
          .object({
            examId: z.uuid(),
            userIds: ids,
            remove: z.boolean().default(false),
          })
          .parse(body);
        await repo.assign(user, p.examId, p.userIds, p.remove);
        break;
      }
      case "start":
        result = await repo.start(
          user,
          z.object({ examId: z.uuid() }).parse(body).examId,
        );
        break;
      case "respond": {
        const p = z
          .object({
            attemptId: z.uuid(),
            questionId: z.uuid(),
            revision: z.number().int().nonnegative(),
            patch: z
              .object({
                optionId: z.uuid().nullable().optional(),
                review: z.boolean().optional(),
                visited: z.boolean().optional(),
              })
              .strict(),
          })
          .strict()
          .parse(body);
        result = await repo.saveResponse(
          user,
          p.attemptId,
          p.questionId,
          p.patch,
          p.revision,
        );
        break;
      }
      case "submit":
        result = await repo.submit(
          user,
          z.object({ attemptId: z.uuid() }).strict().parse(body).attemptId,
        );
        break;
      case "release": {
        const p = z
          .object({
            examId: z.uuid(),
            released: z.boolean(),
            attemptId: z.uuid().optional(),
          })
          .parse(body);
        await repo.release(user, p.examId, p.released, p.attemptId);
        break;
      }
      case "settings": {
        const p = z
          .object({
            organization: z.string().trim().min(1).max(200),
            supportEmail: z.email().or(z.literal("")),
          })
          .parse(body);
        await repo.settings(user, p);
        break;
      }
      default:
        return Response.json(
          { message: "Unknown operation." },
          { status: 404 },
        );
    }
    return success({
      result,
      serverNow: (await database.query("SELECT clock_timestamp() AS now"))
        .rows[0].now,
    });
  } catch (error) {
    const e =
      error instanceof z.ZodError
        ? { status: 400, message: error.issues.map((i) => i.message).join(" ") }
        : safeError(error);
    return Response.json({ message: e.message }, { status: e.status });
  }
}
