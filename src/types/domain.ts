export type Role = "admin" | "student";
export type UserStatus = "pending" | "approved" | "rejected" | "suspended";
export interface UserProfile {
  name: string;
  mobile: string;
  institution: string;
}
export interface User extends UserProfile {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  registeredAt: string;
}
export interface AnswerOption {
  id: string;
  text: string;
}
export interface ExamSection {
  id: string;
  name: string;
}
export interface Question {
  id: string;
  sectionId: string;
  text: string;
  options: AnswerOption[];
  correctOptionId?: string;
  marks: number;
  negative: number;
  explanation?: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  tags: string[];
  image?: string;
}
export interface ExamSchedule {
  start: string;
  end: string;
  timeZone: string;
}
export interface Exam {
  version?: number;
  id: string;
  title: string;
  code: string;
  description: string;
  category: string;
  subject: string;
  instructions: string;
  sections: ExamSection[];
  questions: Question[];
  duration: number;
  maxAttempts: number;
  passingPercentage: number;
  defaultMarks: number;
  defaultNegative: number;
  randomQuestions: boolean;
  randomOptions: boolean;
  allowRevisit: boolean;
  allowSections: boolean;
  autoSubmit: boolean;
  showReview: boolean;
  status: "draft" | "published" | "archived";
  schedule: ExamSchedule;
}
export interface ExamAssignment {
  id: string;
  examId: string;
  userId: string;
}
export interface StudentResponse {
  questionId: string;
  optionId?: string;
  review: boolean;
  visited: boolean;
}
export interface SectionResult {
  sectionId: string;
  name: string;
  score: number;
  maximum: number;
  correct: number;
  incorrect: number;
  unattempted: number;
}
export interface ExamResult {
  score: number;
  maximum: number;
  percentage: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  passed: boolean;
  sections: SectionResult[];
}
export interface ResultPublication {
  released: boolean;
  releasedAt?: string;
}
export interface ExamAttempt {
  revision?: number;
  allowRevisit?: boolean;
  allowSections?: boolean;
  showReview?: boolean;
  currentIndex: number;
  id: string;
  examId: string;
  userId: string;
  startedAt: string;
  deadline: string;
  submittedAt?: string;
  status: "in-progress" | "submitted";
  responses: StudentResponse[];
  questions: Question[];
  sections: ExamSection[];
  passingPercentage: number;
  result?: ExamResult;
  publication: ResultPublication;
}
export interface WorkspaceData {
  metrics?: {
    totalUsers: number;
    pendingUsers: number;
    approvedUsers: number;
    totalExams: number;
    activeExams: number;
    submittedAttempts: number;
    assignedExams: number;
    upcomingExams: number;
    publishedResults: number;
    averageScore: number;
    participation: { name: string; value: number }[];
  };
  version: 1;
  users: User[];
  exams: Exam[];
  assignments: ExamAssignment[];
  attempts: ExamAttempt[];
  settings: { organization: string; supportEmail: string };
}
