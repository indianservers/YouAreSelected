import type { DemoData, Exam, User, Question } from "@/types/domain";
export function questionErrors(q: Question): string[] {
  const errors: string[] = [];
  if (!q.text.trim()) errors.push("Question text is required.");
  if (q.options.length < 2 || q.options.some((o) => !o.text.trim()))
    errors.push("Provide at least two non-empty choices.");
  if (new Set(q.options.map((o) => o.id)).size !== q.options.length)
    errors.push("Option identifiers must be unique.");
  if (!q.options.some((o) => o.id === q.correctOptionId))
    errors.push("Select exactly one correct answer.");
  if (
    !Number.isFinite(q.marks) ||
    q.marks <= 0 ||
    !Number.isFinite(q.negative) ||
    q.negative < 0
  )
    errors.push("Marks must be positive and deductions non-negative.");
  if (
    q.image &&
    !/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(q.image)
  )
    errors.push("Use an HTTPS image URL or PNG/JPEG/WebP data image.");
  return errors;
}
export function examErrors(e: Exam): string[] {
  const errors: string[] = [];
  if (
    !e.title.trim() ||
    !e.code.trim() ||
    !e.category.trim() ||
    !e.subject.trim() ||
    !e.description.trim() ||
    !e.instructions.trim()
  )
    errors.push("Complete all required exam information.");
  if (
    !Number.isFinite(e.duration) ||
    e.duration <= 0 ||
    !Number.isInteger(e.maxAttempts) ||
    e.maxAttempts < 1
  )
    errors.push("Enter a positive duration and an integer attempt limit.");
  if (
    !Number.isFinite(e.passingPercentage) ||
    e.passingPercentage < 0 ||
    e.passingPercentage > 100
  )
    errors.push("Passing percentage must be between 0 and 100.");
  if (
    !Number.isFinite(e.defaultMarks) ||
    e.defaultMarks <= 0 ||
    !Number.isFinite(e.defaultNegative) ||
    e.defaultNegative < 0
  )
    errors.push("Default marks are invalid.");
  if (
    !e.sections.length ||
    e.sections.some((s) => !s.name.trim()) ||
    new Set(e.sections.map((s) => s.id)).size !== e.sections.length
  )
    errors.push("Provide unique, named sections.");
  if (
    !e.questions.length ||
    e.questions.some(
      (q) =>
        questionErrors(q).length ||
        !e.sections.some((s) => s.id === q.sectionId),
    )
  )
    errors.push("Add a valid question set before publishing.");
  if (
    !Number.isFinite(Date.parse(e.schedule.start)) ||
    !Number.isFinite(Date.parse(e.schedule.end)) ||
    Date.parse(e.schedule.end) <= Date.parse(e.schedule.start)
  )
    errors.push("The schedule end must be later than its start.");
  return errors;
}
export function eligibility(
  data: DemoData,
  exam: Exam,
  user: User,
  now = Date.now(),
): string | null {
  if (user.status !== "approved")
    return "Your account must be approved by an administrator.";
  if (exam.status !== "published") return "This examination is not published.";
  if (
    !data.assignments.some((a) => a.examId === exam.id && a.userId === user.id)
  )
    return "You have not been assigned to this examination.";
  if (now < Date.parse(exam.schedule.start))
    return "This examination has not opened yet.";
  if (now >= Date.parse(exam.schedule.end))
    return "The examination window has closed.";
  const attempts = data.attempts.filter(
    (a) => a.examId === exam.id && a.userId === user.id,
  );
  if (attempts.some((a) => a.status === "in-progress")) return null;
  if (attempts.length >= exam.maxAttempts)
    return "You have used all available attempts.";
  return null;
}
export function examStatus(
  data: DemoData,
  e: Exam,
  userId: string,
  now = Date.now(),
): string {
  const a = data.attempts
    .filter((a) => a.examId === e.id && a.userId === userId)
    .at(-1);
  if (a?.status === "in-progress") return "In Progress";
  if (a?.status === "submitted")
    return a.publication.released ? "Results Published" : "Results Pending";
  if (e.status !== "published") return e.status;
  if (now < Date.parse(e.schedule.start)) return "Upcoming";
  if (now >= Date.parse(e.schedule.end)) return "Expired";
  return "Available";
}
