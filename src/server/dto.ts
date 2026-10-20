import type {
  User,
  Exam,
  ExamAttempt,
  Question,
  ExamResult,
  StudentResponse,
} from "@/types/domain";
export const iso = (v: unknown) => new Date(v as string).toISOString();
export function userDto(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: String(row.full_name),
    email: String(row.email),
    mobile: String(row.phone ?? ""),
    institution: String(row.institution ?? ""),
    role: row.role === "admin" ? "admin" : "student",
    status:
      row.account_status === "suspended"
        ? "suspended"
        : (row.approval_status as User["status"]),
    registeredAt: iso(row.created_at),
  };
}
export function examDto(
  row: Record<string, unknown>,
  sections: Exam["sections"],
  questions: Question[],
): Exam {
  return {
    id: String(row.id),
    version: Number(row.version),
    title: String(row.title),
    code: String(row.exam_code),
    description: String(row.description),
    category: String(row.category),
    subject: String(row.subject),
    instructions: String(row.instructions),
    duration: Number(row.duration_minutes),
    maxAttempts: Number(row.max_attempts),
    passingPercentage: Number(row.passing_percentage),
    defaultMarks: Number(row.default_marks),
    defaultNegative: Number(row.default_negative_marks),
    randomQuestions: !!row.randomize_questions,
    randomOptions: !!row.randomize_options,
    allowRevisit: !!row.allow_question_navigation,
    allowSections: !!row.allow_section_navigation,
    autoSubmit: true,
    showReview: row.result_visibility_mode === "review",
    status: row.publication_status as Exam["status"],
    sections,
    questions,
    schedule: {
      start: iso(row.starts_at),
      end: iso(row.ends_at),
      timeZone: String(row.timezone),
    },
  };
}
export function attemptDto(
  row: Record<string, unknown>,
  questions: Question[],
  responses: StudentResponse[],
): ExamAttempt {
  const result: ExamResult | undefined =
    row.earned_marks === null || row.earned_marks === undefined
      ? undefined
      : {
          score: Number(row.earned_marks),
          maximum: Number(row.maximum_marks),
          percentage: Number(row.percentage),
          correct: Number(row.correct_count),
          incorrect: Number(row.incorrect_count),
          unattempted: Number(row.unattempted_count),
          passed: !!row.passed,
          sections: row.section_results as ExamResult["sections"],
        };
  return {
    id: String(row.id),
    examId: String(row.exam_id),
    userId: String(row.user_id),
    currentIndex: Number(row.current_index),
    revision: Number(row.revision),
    allowRevisit: !!row.allow_revisit,
    allowSections: !!row.allow_sections,
    showReview: !!row.show_review,
    startedAt: iso(row.started_at),
    deadline: iso(row.expires_at),
    submittedAt: row.submitted_at ? iso(row.submitted_at) : undefined,
    status: row.status as ExamAttempt["status"],
    questions,
    responses,
    sections: row.sections_snapshot as Exam["sections"],
    passingPercentage: Number(row.passing_percentage),
    result,
    publication: {
      released: row.result_publication === "published",
      releasedAt: row.published_at ? iso(row.published_at) : undefined,
    },
  };
}
export function safeQuestion(q: Question, metadataOnly = false): Question {
  const { correctOptionId: _, explanation: __, ...safe } = q;
  void _;
  void __;
  return {
    ...safe,
    ...(metadataOnly ? { text: "", options: [], image: undefined } : {}),
  };
}
export function safeAttempt(a: ExamAttempt, admin: boolean): ExamAttempt {
  if (admin) return a;
  const published = a.status === "submitted" && a.publication.released;
  return {
    ...a,
    questions: a.questions.map((q) =>
      published && a.showReview ? q : safeQuestion(q),
    ),
    result: published ? a.result : undefined,
  };
}
