import { it, expect } from "vitest";
import { storageSchema } from "@/lib/mock/storage-schema";
import { seed } from "@/lib/mock/seed";
it("accepts seed data and rejects corrupt or unsupported persisted snapshots", () => {
  expect(storageSchema.safeParse(seed()).success).toBe(true);
  expect(storageSchema.safeParse({ version: 0, users: [] }).success).toBe(
    false,
  );
  const data = seed();
  expect(
    storageSchema.safeParse({
      ...data,
      exams: [
        { ...data.exams[0], schedule: { start: "not-a-date", end: "oops" } },
      ],
    }).success,
  ).toBe(false);
  expect(
    storageSchema.safeParse({ ...data, attempts: [{ id: "broken" }] }).success,
  ).toBe(false);
});
