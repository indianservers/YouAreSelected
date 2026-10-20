import type { WorkspaceData, Exam, Question } from "@/types/domain";
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
const bank = [
  [
    "What is 15% of 240?",
    ["24", "30", "36", "48"],
    2,
    "15/100 × 240 = 36.",
    "Percentages",
    "reasoning",
  ],
  [
    "If a train travels 180 km in 3 hours, what is its average speed?",
    ["45 km/h", "60 km/h", "90 km/h", "120 km/h"],
    1,
    "Average speed = distance ÷ time = 180 ÷ 3.",
    "Speed and distance",
    "reasoning",
  ],
  [
    "Complete the sequence: 2, 6, 12, 20, 30, …",
    ["36", "40", "42", "44"],
    2,
    "The terms are n(n + 1). The next term is 6 × 7 = 42.",
    "Number series",
    "reasoning",
  ],
  [
    "Solve $x^2 - 5x + 6 = 0$. Which pair gives its roots?",
    ["1 and 6", "2 and 3", "−2 and −3", "0 and 5"],
    1,
    "Factorising gives (x − 2)(x − 3) = 0.",
    "Algebra",
    "reasoning",
  ],
  [
    "The ratio of two numbers is 3:5. Their sum is 64. Find the smaller number.",
    ["16", "20", "24", "40"],
    2,
    "One part is 64/8 = 8. The smaller number is 3 × 8 = 24.",
    "Ratios",
    "reasoning",
  ],
  [
    "Which institution is responsible for monetary policy in India?",
    ["SEBI", "Reserve Bank of India", "NITI Aayog", "Finance Commission"],
    1,
    "The Reserve Bank of India formulates and implements monetary policy.",
    "Economy",
    "knowledge",
  ],
  [
    "Which article of the Indian Constitution guarantees equality before the law?",
    ["Article 14", "Article 19", "Article 21", "Article 32"],
    0,
    "Article 14 guarantees equality before the law and equal protection of the laws.",
    "Polity",
    "knowledge",
  ],
  [
    "Which gas is most abundant in Earth’s atmosphere?",
    ["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"],
    2,
    "Nitrogen constitutes approximately 78% of the atmosphere.",
    "Science",
    "knowledge",
  ],
  [
    "The Dandi March took place in which year?",
    ["1919", "1922", "1930", "1942"],
    2,
    "Mahatma Gandhi led the Salt March in 1930.",
    "History",
    "knowledge",
  ],
  [
    "Which river is known as the Dakshin Ganga?",
    ["Krishna", "Godavari", "Kaveri", "Narmada"],
    1,
    "The Godavari is commonly called the Dakshin Ganga.",
    "Geography",
    "knowledge",
  ],
] as const;
export function seed(): WorkspaceData {
  const now = Date.now();
  const date = (d: number) => new Date(now + d * 86400000).toISOString();
  const names = [
    "SSC CGL Mock Test",
    "UPSC Prelims Practice Test",
    "Banking PO Mock Test",
    "Railway NTPC Test",
    "Mathematics Aptitude Assessment",
    "General Knowledge Practice",
  ];
  const exams = names.map((title, i): Exam => ({
    ...blankExam(),
    id: `exam-${i + 1}`,
    title,
    code: `YAS-${101 + i}`,
    category: [
      "Government exams",
      "Civil services",
      "Banking",
      "Railways",
      "Aptitude",
      "General knowledge",
    ][i],
    subject: i === 4 ? "Mathematics" : "General studies",
    description: [
      "Build exam-day confidence with a balanced test of reasoning, quantitative aptitude and general awareness.",
      "Strengthen your foundations with a focused practice set for the civil services preliminary examination.",
      "Sharpen your accuracy and speed with a curated banking aptitude assessment.",
      "Prepare for the next step with practical reasoning and general awareness questions.",
      "Put your problem-solving skills to the test with focused quantitative questions.",
      "Explore history, science, polity and geography in a short knowledge check.",
    ][i],
    duration: [30, 45, 30, 20, 15, 15][i],
    status: "published",
    schedule: {
      start: date(i === 1 ? 2 : i === 3 ? -10 : -1),
      end: date(i === 1 ? 5 : i === 3 ? -2 : 14),
      timeZone: "Asia/Kolkata",
    },
    questions: bank
      .filter((_, j) => (i === 4 ? j < 5 : i === 5 ? j >= 5 : true))
      .map((b, j) => ({
        id: `e${i + 1}-q${j + 1}`,
        sectionId: b[5],
        text: b[0],
        options: b[1].map((text, k) => ({ id: `o${k}`, text })),
        correctOptionId: `o${b[2]}`,
        marks: 2,
        negative: 0.5,
        explanation: b[3],
        topic: b[4],
        tags: [b[4]],
        difficulty: j % 3 === 0 ? "Easy" : "Medium",
      })),
  }));
  const users: WorkspaceData["users"] = [
    {
      id: "admin",
      name: "Demo Administrator",
      email: "admin@demo.test",
      role: "admin",
      status: "approved",
      mobile: "9000000000",
      institution: "Indian Servers",
      registeredAt: date(-30),
    },
    {
      id: "student",
      name: "Arjun Sharma",
      email: "student@demo.test",
      role: "student",
      status: "approved",
      mobile: "9000000001",
      institution: "Delhi University",
      registeredAt: date(-14),
    },
    ...[
      "Priya Patel",
      "Rahul Verma",
      "Ananya Reddy",
      "Vikram Singh",
      "Meera Nair",
      "Karthik Rao",
      "Sara Khan",
    ].map((name, i) => ({
      id: `user-${i}`,
      name,
      email: `candidate${i + 1}@demo.test`,
      role: "student" as const,
      status: (
        [
          "pending",
          "approved",
          "approved",
          "suspended",
          "pending",
          "rejected",
          "approved",
        ] as const
      )[i],
      mobile: `90000000${10 + i}`,
      institution: [
        "Delhi University",
        "Osmania University",
        "Independent learner",
      ][i % 3],
      registeredAt: date(-i - 1),
    })),
  ];
  return {
    version: 1,
    users,
    exams,
    assignments: exams.map((e) => ({
      id: `assignment-${e.id}`,
      examId: e.id,
      userId: "student",
    })),
    attempts: [],
    settings: {
      organization: "YouAreSelected",
      supportEmail: "support@demo.test",
    },
  };
}
