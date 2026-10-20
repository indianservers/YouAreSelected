import { getAuth } from "@/server/auth";
import { checkOrigin } from "@/server/access";
import { safeError } from "@/server/errors";
import { database } from "@/server/db";
import { z } from "zod";
import { observe } from "@/server/logging";
import { readJson } from "@/server/request";
export const runtime = "nodejs";
const signup = z
  .object({
    name: z.string().trim().min(2).max(150),
    email: z.email().max(250),
    phone: z.string().regex(/^\+?[\d -]{10,15}$/),
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
    institution: z.string().max(250).optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
  });
async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    if (request.method === "POST") {
      checkOrigin(request);
      await readJson(request.clone(), 16384);
    }
    let registration: z.infer<typeof signup> | undefined;
    let duplicate = false;
    if (url.pathname.endsWith("/sign-up/email")) {
      const parsed = signup.safeParse(await request.clone().json());
      if (!parsed.success)
        return Response.json(
          {
            message:
              "Enter a name, valid email/phone and a password of at least 12 characters.",
          },
          { status: 400 },
        );
      registration = parsed.data;
      duplicate = !!(
        await database.query("SELECT id FROM yas.users WHERE email=$1", [
          registration.email.trim().toLowerCase(),
        ])
      ).rows[0];
    }
    if (
      url.pathname.endsWith("/request-password-reset") &&
      (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    )
      return Response.json(
        {
          message:
            "Password reset email is not configured. Contact your administrator.",
        },
        { status: 503 },
      );
    const response = await getAuth().handler(request);
    if (registration && response.ok) {
      const body = await response.clone().json();
      const actual = (
        await database.query("SELECT id FROM yas.users WHERE email=$1", [
          registration.email.trim().toLowerCase(),
        ])
      ).rows[0];
      if (duplicate || !actual || actual.id !== body.user?.id)
        return Response.json(
          { message: "An account with this email already exists." },
          { status: 409 },
        );
      if (body.user?.id)
        await database.query(
          "INSERT INTO yas.user_profiles(user_id,institution) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET institution=EXCLUDED.institution",
          [body.user.id, registration.institution ?? ""],
        );
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const safe = safeError(error);
    return Response.json({ message: safe.message }, { status: safe.status });
  }
}
export const GET = observe("auth.read", handle);
export const POST = observe("auth.write", handle);
