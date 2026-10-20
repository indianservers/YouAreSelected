import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./auth-schema";
export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}
export interface Database extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}
let pool: Pool | undefined;
export function connectionString(key = "DATABASE_URL") {
  const value = process.env[key];
  if (!value) throw new Error(`${key} must be configured on the server.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid PostgreSQL server configuration.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Invalid PostgreSQL configuration.");
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (
    !local &&
    !["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")
  )
    throw new Error("PostgreSQL TLS is required.");
  return value;
}
export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString(),
      max: 4,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });
    pool.on("error", () => console.error("Database connection interrupted."));
  }
  return pool;
}
export function getDrizzle() {
  return drizzle(getPool(), { schema });
}
export const database: Database = {
  query: (text, values) => getPool().query(text, values),
  transaction: async (fn) => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '10s'");
      const result = await fn(client as PoolClient);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },
};
