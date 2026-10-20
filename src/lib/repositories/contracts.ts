import type {
  WorkspaceData,
  Exam,
  ExamAttempt,
  Question,
  User,
  UserProfile,
  UserStatus,
} from "@/types/domain";
export interface AuthRepository {
  login(email: string, password: string, remember: boolean): Promise<User>;
  logout(): Promise<void>;
  register(
    input: UserProfile & { email: string; password: string },
  ): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
}
export interface UserRepository {
  updateProfile(input: UserProfile, userId?: string): Promise<void>;
  setStatus(ids: string[], status: UserStatus): Promise<void>;
}
export interface ExamRepository {
  saveExam(exam: Exam): Promise<Exam>;
  duplicateExam(id: string): Promise<string>;
}
export interface QuestionRepository {
  saveQuestions(examId: string, questions: Question[]): Promise<void>;
}
export interface AssignmentRepository {
  assign(examId: string, userIds: string[], remove?: boolean): Promise<void>;
}
export interface AttemptRepository {
  start(examId: string): Promise<ExamAttempt>;
  respond(
    attemptId: string,
    questionId: string,
    patch: { optionId?: string; review?: boolean; visited?: boolean },
  ): Promise<void>;
  submit(id: string): Promise<void>;
}
export interface ResultRepository {
  release(examId: string, released: boolean, attemptId?: string): Promise<void>;
}
export type Repositories = AuthRepository &
  UserRepository &
  ExamRepository &
  QuestionRepository &
  AssignmentRepository &
  AttemptRepository &
  ResultRepository;
export interface Snapshot {
  data: WorkspaceData;
  sessionId: string | null;
}
