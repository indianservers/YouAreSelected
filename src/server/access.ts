import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { database } from "./db";
import { ServiceError } from "./errors";
import { userDto } from "./dto";
export async function requireUser(requestHeaders?: Headers) {
  const resolvedHeaders = requestHeaders ?? (await headers());
  const session = await getAuth()
    .api.getSession({
      headers: resolvedHeaders,
    })
    .catch(() => {
      throw new ServiceError(
        503,
        "Sign-in service is temporarily unavailable.",
      );
    });
  if (!session) throw new ServiceError(401, "Please sign in.");
  const { rows } = await database
    .query(
      "SELECT u.*,p.institution FROM yas.users u LEFT JOIN yas.user_profiles p ON p.user_id=u.id WHERE u.id=$1",
      [session.user.id],
    )
    .catch(() => {
      throw new ServiceError(
        503,
        "Account service is temporarily unavailable.",
      );
    });
  const user = rows[0];
  if (
    !user ||
    user.account_status !== "active" ||
    user.approval_status === "rejected"
  )
    throw new ServiceError(403, "Your account is not active.");
  return userDto(user);
}
export async function requireAdmin(requestHeaders?: Headers) {
  const user = await requireUser(requestHeaders);
  if (user.role !== "admin")
    throw new ServiceError(403, "Administrator access is required.");
  return user;
}
export async function protectPage(role: "admin" | "student") {
  try {
    const user = await requireUser();
    if (user.role !== role)
      redirect(user.role === "admin" ? "/admin" : "/student/dashboard");
    return user;
  } catch (e) {
    if (e instanceof ServiceError) redirect("/login");
    throw e;
  }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : new URL(request.url).origin;
  if (
    !origin ||
    origin !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ServiceError(403, "Cross-origin request rejected.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ServiceError(415, "Use application/json.");
}
