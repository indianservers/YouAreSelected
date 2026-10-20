import { randomUUID } from "node:crypto";
// Only allowlisted fields enter logs. Never serialize request bodies, headers,
// error messages/stacks, SQL parameters, tokens or user-entered strings.
export function operationLog(
  event: string,
  fields: {
    requestId?: string;
    status?: number;
    durationMs?: number;
    code?: string;
  } = {},
) {
  console.info(
    JSON.stringify({ time: new Date().toISOString(), event, ...fields }),
  );
}
export function requestId() {
  return randomUUID();
}
export function observe<A extends unknown[]>(
  event: string,
  handler: (...args: A) => Promise<Response>,
) {
  return async (...args: A) => {
    const id = requestId(),
      start = performance.now();
    const response = await handler(...args);
    response.headers.set("X-Request-Id", id);
    response.headers.set("Cache-Control", "no-store");
    operationLog(event, {
      requestId: id,
      status: response.status,
      durationMs: Math.round(performance.now() - start),
    });
    return response;
  };
}
