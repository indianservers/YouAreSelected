import { z } from "zod";
const section = z.object({ id: z.string(), name: z.string() });
const question = z.object({
  id: z.string(),
  sectionId: z.string(),
  text: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })),
  correctOptionId: z.string(),
  marks: z.number(),
  negative: z.number(),
  explanation: z.string(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  topic: z.string(),
  tags: z.array(z.string()),
  image: z.string().optional(),
});
const resultCounts = {
  score: z.number(),
  maximum: z.number(),
  correct: z.number(),
  incorrect: z.number(),
  unattempted: z.number(),
};
const result = z.object({
  ...resultCounts,
  percentage: z.number(),
  passed: z.boolean(),
  sections: z.array(
    z.object({ ...resultCounts, sectionId: z.string(), name: z.string() }),
  ),
});
const instant = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)));
export const storageSchema = z.object({
  version: z.literal(1),
  users: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      mobile: z.string(),
      institution: z.string(),
      role: z.enum(["admin", "student"]),
      status: z.enum(["pending", "approved", "rejected", "suspended"]),
      registeredAt: instant,
      demoPassword: z.string(),
    }),
  ),
  exams: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      code: z.string(),
      description: z.string(),
      category: z.string(),
      subject: z.string(),
      instructions: z.string(),
      sections: z.array(section),
      questions: z.array(question),
      duration: z.number(),
      maxAttempts: z.number(),
      passingPercentage: z.number(),
      defaultMarks: z.number(),
      defaultNegative: z.number(),
      randomQuestions: z.boolean(),
      randomOptions: z.boolean(),
      allowRevisit: z.boolean(),
      allowSections: z.boolean(),
      autoSubmit: z.boolean(),
      showReview: z.boolean(),
      status: z.enum(["draft", "published", "archived"]),
      schedule: z.object({
        start: instant,
        end: instant,
        timeZone: z.string(),
      }),
    }),
  ),
  assignments: z.array(
    z.object({ id: z.string(), examId: z.string(), userId: z.string() }),
  ),
  attempts: z.array(
    z
      .object({
        id: z.string(),
        examId: z.string(),
        userId: z.string(),
        currentIndex: z.number().int().nonnegative().default(0),
        startedAt: instant,
        deadline: instant,
        submittedAt: instant.optional(),
        status: z.enum(["in-progress", "submitted"]),
        responses: z.array(
          z.object({
            questionId: z.string(),
            optionId: z.string().optional(),
            review: z.boolean(),
            visited: z.boolean(),
          }),
        ),
        questions: z.array(question).min(1),
        sections: z.array(section),
        passingPercentage: z.number(),
        result: result.optional(),
        publication: z.object({
          released: z.boolean(),
          releasedAt: instant.optional(),
        }),
      })
      .refine(
        (a) =>
          a.currentIndex < a.questions.length &&
          (a.status !== "submitted" || (!!a.result && !!a.submittedAt)),
      ),
  ),
  settings: z.object({ organization: z.string(), supportEmail: z.string() }),
});
