import { describe, it, expect } from "vitest";
import { grade } from "@/lib/grading";
import { seed } from "@/server/sample-content";
import type { StudentResponse } from "@/types/domain";
const exam = seed().exams[0];
const response = (questionId: string, optionId?: string): StudentResponse => ({
  questionId,
  optionId,
  visited: true,
  review: false,
});
describe("deterministic single-correct MCQ grading", () => {
  it("passes an exact 29 percent decimal boundary without binary rounding error", () => {
    const qs = Array.from({ length: 100 }, (_, i) => ({
      ...exam.questions[0],
      id: `boundary-${i}`,
      marks: 0.01,
    }));
    expect(
      grade(
        qs,
        qs.slice(0, 29).map((q) => response(q.id, q.correctOptionId)),
        exam.sections,
        29,
      ).passed,
    ).toBe(true);
  });
  it("accumulates four-decimal marks exactly in totals and sections", () => {
    const qs = Array.from({ length: 100 }, (_, i) => ({
      ...exam.questions[0],
      id: `decimal-${i}`,
      marks: 0.1,
      negative: 0.025,
    }));
    const r = grade(
      qs,
      qs.map((q, i) =>
        response(
          q.id,
          i < 80
            ? q.correctOptionId
            : q.options.find((o) => o.id !== q.correctOptionId)!.id,
        ),
      ),
      exam.sections,
      75,
    );
    expect(r.score).toBe(7.5);
    expect(r.maximum).toBe(10);
    expect(r.sections[0].score).toBe(7.5);
    expect(r.sections[0].maximum).toBe(10);
    expect(r.passed).toBe(true);
  });
  it("does not round a failing score up across the pass boundary", () => {
    const q = { ...exam.questions[0], marks: 39.999 };
    const other = { ...exam.questions[1], marks: 60.001 };
    const r = grade(
      [q, other],
      [response(q.id, q.correctOptionId)],
      exam.sections,
      40,
    );
    expect(r.percentage).toBe(40);
    expect(r.passed).toBe(false);
  });
  it.each([0, -1, NaN, Infinity])(
    "rejects invalid maximum marks %s",
    (marks) => {
      expect(() =>
        grade([{ ...exam.questions[0], marks }], [], exam.sections, 40),
      ).toThrow();
    },
  );
  it("grades all correct and calculates section performance", () => {
    const r = grade(
      exam.questions,
      exam.questions.map((q) => response(q.id, q.correctOptionId)),
      exam.sections,
      40,
    );
    expect(r.score).toBe(20);
    expect(r.percentage).toBe(100);
    expect(r.correct).toBe(10);
    expect(r.passed).toBe(true);
    expect(r.sections.reduce((n, s) => n + s.score, 0)).toBe(20);
  });
  it("deducts configured negative marks for all incorrect", () => {
    const r = grade(
      exam.questions,
      exam.questions.map((q) =>
        response(q.id, q.options.find((o) => o.id !== q.correctOptionId)!.id),
      ),
      exam.sections,
      40,
    );
    expect(r.score).toBe(-5);
    expect(r.incorrect).toBe(10);
    expect(r.percentage).toBe(-25);
    expect(r.passed).toBe(false);
  });
  it("awards zero for all unattempted questions", () => {
    const r = grade(exam.questions, [], exam.sections, 40);
    expect(r.score).toBe(0);
    expect(r.unattempted).toBe(10);
  });
  it("handles mixed responses, review flags and unequal marks", () => {
    const qs = exam.questions
      .slice(0, 3)
      .map((q, i) => ({ ...q, marks: [3, 2, 5][i], negative: 0.75 }));
    const r = grade(
      qs,
      [
        { ...response(qs[0].id, qs[0].correctOptionId), review: true },
        response(
          qs[1].id,
          qs[1].options.find((o) => o.id !== qs[1].correctOptionId)!.id,
        ),
      ],
      exam.sections,
      20,
    );
    expect(r.score).toBe(2.25);
    expect(r.maximum).toBe(10);
    expect(r.percentage).toBe(22.5);
    expect(r.correct).toBe(1);
    expect(r.incorrect).toBe(1);
    expect(r.unattempted).toBe(1);
    expect(r.passed).toBe(true);
  });
  it("applies an inclusive passing threshold", () => {
    const qs = exam.questions.slice(0, 2);
    expect(
      grade(qs, [response(qs[0].id, qs[0].correctOptionId)], exam.sections, 50)
        .passed,
    ).toBe(true);
    expect(
      grade(qs, [response(qs[0].id, qs[0].correctOptionId)], exam.sections, 51)
        .passed,
    ).toBe(false);
  });
  it("treats invalid, absent and foreign responses as unattempted", () => {
    const r = grade(
      exam.questions,
      [
        response(exam.questions[0].id, "invalid"),
        response("foreign", "o1"),
        response(exam.questions[1].id),
      ],
      exam.sections,
      40,
    );
    expect(r.unattempted).toBe(10);
    expect(r.score).toBe(0);
  });
  it("handles an empty exam and invalid pass threshold safely", () => {
    expect(grade([], [], [], 40).percentage).toBe(0);
    expect(grade([], [], [], 0).passed).toBe(false);
    expect(grade(exam.questions, [], exam.sections, NaN).passed).toBe(false);
  });
});
