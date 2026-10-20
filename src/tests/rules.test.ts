import { describe, it, expect } from "vitest";
import { seed } from "@/lib/mock/seed";
import { eligibility, examErrors, questionErrors } from "@/lib/rules";
describe("exam eligibility and validation", () => {
  it("permits only approved, assigned, published exams within a valid window", () => {
    const data = seed(),
      exam = data.exams[0],
      user = data.users[1];
    expect(eligibility(data, exam, user)).toBeNull();
    expect(eligibility(data, exam, { ...user, status: "pending" })).toMatch(
      /approved/,
    );
    expect(eligibility({ ...data, assignments: [] }, exam, user)).toMatch(
      /assigned/,
    );
    expect(eligibility(data, { ...exam, status: "draft" }, user)).toMatch(
      /published/,
    );
    expect(
      eligibility(data, exam, user, Date.parse(exam.schedule.start) - 1),
    ).toMatch(/not opened/);
    expect(
      eligibility(data, exam, user, Date.parse(exam.schedule.end)),
    ).toMatch(/closed/);
  });
  it("rejects incomplete published exams and invalid question choices", () => {
    const e = seed().exams[0];
    expect(examErrors(e)).toEqual([]);
    expect(examErrors({ ...e, questions: [] })).toContain(
      "Add a valid question set before publishing.",
    );
    const q = e.questions[0];
    expect(questionErrors({ ...q, correctOptionId: "bad" })).toContain(
      "Select exactly one correct answer.",
    );
    expect(
      questionErrors({ ...q, options: [q.options[0], q.options[0]] }),
    ).toContain("Option identifiers must be unique.");
    expect(questionErrors({ ...q, negative: -1 }).length).toBeGreaterThan(0);
  });
});
