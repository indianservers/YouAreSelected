import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { hash, verify } from "@node-rs/argon2";
import { database, getDrizzle } from "./db";
import * as schema from "./auth-schema";
let instance: ReturnType<typeof createAuth> | undefined;
export function passwordHash(password: string) {
  return hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}
function createAuth() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.includes("REPLACE_WITH"))
    throw new Error(
      "Configure a high-entropy AUTH_SECRET of at least 32 characters.",
    );
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.APP_URL || new URL(process.env.APP_URL).protocol !== "https:")
  )
    throw new Error("Configure APP_URL with the canonical HTTPS origin.");
  return betterAuth({
    appName: "YouAreSelected",
    secret,
    baseURL: process.env.APP_URL,
    database: drizzleAdapter(getDrizzle(), {
      provider: "pg",
      schema,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      password: {
        hash: passwordHash,
        verify: ({ hash, password }) => verify(hash, password),
      },
      resetPasswordTokenExpiresIn: 1800,
      revokeSessionsOnPasswordReset: true,
      ...(process.env.RESEND_API_KEY && process.env.EMAIL_FROM
        ? {
            sendResetPassword: async ({
              user,
              url,
            }: {
              user: { email: string };
              url: string;
            }) => {
              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: process.env.EMAIL_FROM,
                  to: user.email,
                  subject: "Reset your YouAreSelected password",
                  text: `Use this one-time link within 30 minutes to reset your password: ${url}\nIf you did not request this, ignore this email.`,
                }),
              });
              if (!res.ok)
                throw new Error("Password reset delivery unavailable.");
            },
          }
        : {}),
    },
    user: {
      additionalFields: {
        phone: { type: "string", required: true },
        role: { type: "string", input: false, defaultValue: "student" },
        approvalStatus: {
          type: "string",
          input: false,
          defaultValue: "pending",
        },
        accountStatus: { type: "string", input: false, defaultValue: "active" },
      },
    },
    session: {
      expiresIn: 7 * 86400,
      updateAge: 86400,
      cookieCache: { enabled: false },
    },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
      useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 300, max: 10 },
        "/sign-up/email": { window: 3600, max: 10 },
        "/request-password-reset": { window: 3600, max: 5 },
      },
      customStorage: {
        consume: async (key, rule) => {
          const now = Date.now();
          const { rows } = await database.query<{
            count: number;
            last_request: string;
          }>(
            `INSERT INTO yas.rate_limits(key,count,last_request) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN yas.rate_limits.last_request<$3 THEN 1 ELSE yas.rate_limits.count+1 END,last_request=CASE WHEN yas.rate_limits.last_request<$3 THEN $2 ELSE yas.rate_limits.last_request END RETURNING count,last_request`,
            [key, now, now - rule.window * 1000],
          );
          return {
            allowed: rows[0].count <= rule.max,
            retryAfter: Math.max(
              1,
              Math.ceil(
                (Number(rows[0].last_request) + rule.window * 1000 - now) /
                  1000,
              ),
            ),
          };
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const { rows } = await database.query(
              "SELECT account_status,approval_status FROM yas.users WHERE id=$1",
              [session.userId],
            );
            if (
              !rows[0] ||
              rows[0].account_status !== "active" ||
              rows[0].approval_status === "rejected"
            )
              throw new APIError("FORBIDDEN", {
                message:
                  "This account is not active. Contact your administrator.",
              });
            await database.query(
              "UPDATE yas.users SET last_login_at=now() WHERE id=$1",
              [session.userId],
            );
            return { data: session };
          },
        },
      },
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, email: user.email.trim().toLowerCase() },
          }),
        },
      },
    },
    logger: { disabled: true },
  });
}
export function getAuth() {
  return (instance ??= createAuth());
}
