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
    const response = responses.find((r) => r.questionId === q.id);
    const valid =
      response?.optionId && q.options.some((o) => o.id === response.optionId);
    const kind = !valid
      ? "unattempted"
      : response.optionId === q.correctOptionId
        ? "correct"
        : "incorrect";
    const score =
      kind === "correct" ? q.marks : kind === "incorrect" ? -q.negative : 0;
    result[kind]++;
    result.score += score;
    result.maximum += q.marks;
    const section = result.sections.find((s) => s.sectionId === q.sectionId);
    if (section) {
      section[kind]++;
      section.score += score;
      section.maximum += q.marks;
    }
  }
  result.score = Number(result.score.toFixed(4));
  result.percentage = result.maximum
    ? Number(((result.score / result.maximum) * 100).toFixed(2))
    : 0;
  result.passed =
    Number.isFinite(passingPercentage) &&
    passingPercentage >= 0 &&
    passingPercentage <= 100 &&
    result.maximum > 0 &&
    result.percentage >= passingPercentage;
  return result;
}
