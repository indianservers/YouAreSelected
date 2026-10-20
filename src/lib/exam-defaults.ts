import type { Exam, Question } from "@/types/domain";
export const id = () => crypto.randomUUID();
export function blankQuestion(sectionId = "reasoning"): Question {
  return {
    id: id(),
    sectionId,
    text: "",
    options: ["a", "b", "c", "d"].map((id) => ({ id, text: "" })),
    correctOptionId: "",
    marks: 2,
    negative: 0.5,
    explanation: "",
    difficulty: "Medium",
    topic: "",
    tags: [],
  };
}
export function blankExam(): Exam {
  const now = Date.now();
  return {
    id: id(),
    title: "",
    code: "",
    description: "",
    category: "",
    subject: "",
    instructions:
      "Read each question carefully. Select one answer per question. Incorrect answers may attract negative marks. Submit before the timer ends.",
    sections: [
      { id: "reasoning", name: "General aptitude" },
      { id: "knowledge", name: "General knowledge" },
    ],
    questions: [],
    duration: 30,
    maxAttempts: 1,
    passingPercentage: 40,
    defaultMarks: 2,
    defaultNegative: 0.5,
    randomQuestions: false,
    randomOptions: false,
    allowRevisit: true,
    allowSections: true,
    autoSubmit: true,
    showReview: true,
    status: "draft",
    schedule: {
      start: new Date(now - 86400000).toISOString(),
      end: new Date(now + 7 * 86400000).toISOString(),
      timeZone: "Asia/Kolkata",
    },
  };
}
