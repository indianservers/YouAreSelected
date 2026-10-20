import { z } from "zod";
const text = (max = 10000) => z.string().max(max);
const marks=z.number().min(0).max(10000).refine(value=>Math.abs(value*10000-Math.round(value*10000))<0.000001,'Use at most four decimal places for marks.');
const safeText = (max = 10000) =>
  text(max).refine(
    (v) => !/<\/?[a-z][^>]*>/i.test(v),
    "HTML is not supported. Use Markdown or LaTeX.",
  );
export const profileSchema = z.object({
  name: text(150).trim().min(2),
  mobile: z.string().regex(/^\+?[\d -]{10,15}$/),
  institution: text(250),
});
export const questionSchema = z
  .object({
    id: text(100),
    sectionId: text(100),
    text: safeText().min(1),
    options: z
      .array(z.object({ id: text(100).min(1), text: safeText(3000).min(1) }))
      .min(2)
      .max(12),
    correctOptionId: text(100),
    marks: marks.refine(value=>value>=0.0001,'Positive marks must be at least 0.0001.'),
    negative: marks,
    explanation: safeText(),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    topic: text(200),
    tags: z.array(text(100)).max(20),
    image: z.string().url().startsWith("https://").or(z.literal("")).optional(),
  })
  .superRefine((q, ctx) => {
    if (
      new Set(q.options.map((o) => o.id)).size !== q.options.length ||
      !q.options.some((o) => o.id === q.correctOptionId)
    )
      ctx.addIssue({
        code: "custom",
        message: "Choices must be unique with exactly one correct answer.",
      });
  });
export const examSchema = z
  .object({
    id: z.uuid(),
    title: text(250).trim().min(1),
    code: text(80).trim().min(1),
    description: safeText(),
    category: text(150),
    subject: text(150),
    instructions: safeText(),
    sections: z
      .array(z.object({ id: text(100), name: text(200).min(1) }))
      .min(1)
      .max(30),
    questions: z.array(questionSchema).max(500),
    duration: z.number().int().min(1).max(1440),
    maxAttempts: z.number().int().min(1).max(100),
    passingPercentage: z.number().min(0).max(100),
    defaultMarks: marks.refine(value=>value>=0.0001,'Positive marks must be at least 0.0001.'),
    defaultNegative: marks,
    randomQuestions: z.boolean(),
    randomOptions: z.boolean(),
    allowRevisit: z.boolean(),
    allowSections: z.boolean(),
    autoSubmit: z.literal(true),
    showReview: z.boolean(),
    status: z.enum(["draft", "published", "archived"]),
    schedule: z.object({
      start: z.iso.datetime(),
      end: z.iso.datetime(),
      timeZone: z.string().refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Invalid time zone"),
    }),
  })
  .superRefine((e, ctx) => {
    if (Date.parse(e.schedule.end) <= Date.parse(e.schedule.start))
      ctx.addIssue({
        code: "custom",
        message: "End must be later than start.",
      });
    if (
      new Set(e.sections.map((s) => s.id)).size !== e.sections.length ||
      new Set(e.questions.map((q) => q.id)).size !== e.questions.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Section and question IDs must be unique.",
      });
    if (e.questions.some((q) => !e.sections.some((s) => s.id === q.sectionId)))
      ctx.addIssue({
        code: "custom",
        message: "Question must belong to an exam section.",
      });
    if (
      e.status === "published" &&
      (!e.questions.length ||
        !e.description.trim() ||
        !e.category.trim() ||
        !e.subject.trim() ||
        !e.instructions.trim())
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Published examinations require full information and a valid question set.",
      });
  });
export const uuid = z.uuid();
