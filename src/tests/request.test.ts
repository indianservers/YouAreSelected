// @vitest-environment node
import { it, expect } from "vitest";
import { readJson } from "@/server/request";
import { safeError } from "@/server/errors";
it("rejects malformed JSON as a client error", async () => {
  await expect(
    readJson(new Request("http://localhost", { method: "POST", body: "{" })),
  ).rejects.toMatchObject({ status: 400 });
});
it("bounds chunked request bodies without trusting content-length", async () => {
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode("123456"));
      c.close();
    },
  });
  const request = new Request("http://localhost", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
  await expect(readJson(request, 4)).rejects.toMatchObject({ status: 413 });
});
it("preserves valid JSON and maps uniqueness conflicts without raw SQL", async () => {
  expect(
    await readJson(
      new Request("http://localhost", { method: "POST", body: '{"ok":true}' }),
    ),
  ).toEqual({ ok: true });
  expect(safeError({ code: "23505", detail: "confidential SQL" })).toEqual({
    status: 409,
    message: "This record already exists. Refresh and try again.",
  });
});
