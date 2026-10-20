import type {
  DemoData,
  Exam,
  ExamAttempt,
  Question,
  User,
  UserProfile,
  UserStatus,
} from "@/types/domain";
export interface AuthRepository {
  login(email: string, password: string, remember: boolean): User;
  logout(): void;
  register(input: UserProfile & { email: string; password: string }): User;
  changePassword(current: string, next: string): void;
}
export interface UserRepository {
  updateProfile(input: UserProfile): void;
  setStatus(ids: string[], status: UserStatus): void;
}
export interface ExamRepository {
  saveExam(exam: Exam): void;
  duplicateExam(id: string): string;
}
export interface QuestionRepository {
  saveQuestions(examId: string, questions: Question[]): void;
}
export interface AssignmentRepository {
  assign(examId: string, userIds: string[], remove?: boolean): void;
}
export interface AttemptRepository {
  start(examId: string): ExamAttempt;
  respond(
    attemptId: string,
    questionId: string,
    patch: { optionId?: string; review?: boolean; visited?: boolean },
  ): void;
  submit(id: string): void;
}
export interface ResultRepository {
  release(examId: string, released: boolean): void;
}
export type Repositories = AuthRepository &
  UserRepository &
  ExamRepository &
  QuestionRepository &
  AssignmentRepository &
  AttemptRepository &
  ResultRepository;
export interface Snapshot {
  data: DemoData;
  sessionId: string | null;
}
