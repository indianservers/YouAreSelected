import type {
  ExamResult,
  ExamSection,
  Question,
  StudentResponse,
} from "@/types/domain";
export function grade(
  questions: Question[],
  responses: StudentResponse[],
  sections: ExamSection[],
  passingPercentage: number,
): ExamResult {
  // Four decimal places match PostgreSQL numeric marks. Accumulate integers,
  // including section totals, rather than adding binary floating-point marks.
  const units = (value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 10000)
      throw new Error("Invalid marking scheme.");
    return Math.round(value * 10000);
  };
  const answers = new Map(responses.map((r) => [r.questionId, r]));
  const result: ExamResult = {
    score: 0,
    maximum: 0,
    percentage: 0,
    correct: 0,
    incorrect: 0,
    unattempted: 0,
    passed: false,
    sections: sections.map((s) => ({
      ...s,
      sectionId: s.id,
      score: 0,
      maximum: 0,
      correct: 0,
      incorrect: 0,
      unattempted: 0,
    })),
  };
  for (const q of questions) {
    const response = answers.get(q.id);
    const valid =
      response?.optionId && q.options.some((o) => o.id === response.optionId);
    const kind = !valid
      ? "unattempted"
      : response.optionId === q.correctOptionId
        ? "correct"
        : "incorrect";
    const score =
      kind === "correct"
        ? units(q.marks)
        : kind === "incorrect"
          ? -units(q.negative)
          : 0;
    const maximum = units(q.marks);
    if (!maximum) throw new Error("Question marks must be positive.");
    result[kind]++;
    result.score += score;
    result.maximum += maximum;
    const section = result.sections.find((s) => s.sectionId === q.sectionId);
    if (section) {
      section[kind]++;
      section.score += score;
      section.maximum += maximum;
    }
  }
  const scoreUnits = result.score,
    maximumUnits = result.maximum;
  result.score /= 10000;
  result.maximum /= 10000;
  for (const section of result.sections) {
    section.score /= 10000;
    section.maximum /= 10000;
  }
  result.percentage = result.maximum
    ? Number(((result.score / result.maximum) * 100).toFixed(2))
    : 0;
  result.passed =
    Number.isFinite(passingPercentage) &&
    passingPercentage >= 0 &&
    passingPercentage <= 100 &&
    result.maximum > 0 &&
    scoreUnits * 10000 >= maximumUnits * Math.round(passingPercentage * 100);
  return result;
}
