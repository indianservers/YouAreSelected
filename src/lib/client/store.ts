"use client";
import { create } from "zustand";
import { toast } from "sonner";
import type {
  WorkspaceData,
  Exam,
  ExamAttempt,
  Question,
  User,
  UserProfile,
  UserStatus,
} from "@/types/domain";
import type { Repositories } from "@/lib/repositories/contracts";
export const emptyData = (): WorkspaceData => ({
  version: 1,
  users: [],
  exams: [],
  assignments: [],
  attempts: [],
  settings: { organization: "YouAreSelected", supportEmail: "" },
});
export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new HttpError(
      "The server could not be reached. Please retry.",
      res.status,
    );
  }
  if (!res.ok)
    throw new HttpError(
      data.message ?? data.error?.message ?? "The request failed.",
      res.status,
    );
  return data as T;
}
interface Store extends Repositories {
  data: WorkspaceData;
  sessionId: string | null;
  ready: boolean;
  busy: boolean;
  error: string;
  clockOffset: number;
  pendingSaves: number;
  retrySaves(): Promise<void>;
  load(): Promise<void>;
  login(email: string, password: string, remember: boolean): Promise<User>;
  logout(): Promise<void>;
  register(
    input: UserProfile & { email: string; password: string },
  ): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  updateProfile(profile: UserProfile, userId?: string): Promise<void>;
  setStatus(ids: string[], status: UserStatus): Promise<void>;
  saveExam(exam: Exam): Promise<Exam>;
  duplicateExam(id: string): Promise<string>;
  saveQuestions(examId: string, questions: Question[]): Promise<void>;
  assign(examId: string, userIds: string[], remove?: boolean): Promise<void>;
  start(examId: string): Promise<ExamAttempt>;
  respond(
    attemptId: string,
    questionId: string,
    patch: { optionId?: string; review?: boolean; visited?: boolean },
  ): Promise<void>;
  submit(id: string): Promise<void>;
  release(examId: string, released: boolean, attemptId?: string): Promise<void>;
  settings(organization: string, supportEmail: string): Promise<void>;
}
let responseQueue: Promise<void> = Promise.resolve();
let refresh: Promise<void> | null = null;
let writes = 0;
type PendingResponse = {
  token: number;
  attemptId: string;
  questionId: string;
  patch: { optionId?: string; review?: boolean; visited?: boolean };
};
let serial = 0;
let pendingResponses: PendingResponse[] = [];
let failedResponses: PendingResponse[] = [];
function overlay(attempt: ExamAttempt): ExamAttempt {
  return pendingResponses
    .filter((p) => p.attemptId === attempt.id)
    .reduce((a, p) => {
      if (a.status === "submitted") return a;
      const existing = a.responses.find((r) => r.questionId === p.questionId);
      return {
        ...a,
        currentIndex: p.patch.visited
          ? a.questions.findIndex((q) => q.id === p.questionId)
          : a.currentIndex,
        responses: [
          ...a.responses.filter((r) => r.questionId !== p.questionId),
          {
            questionId: p.questionId,
            visited: false,
            review: false,
            ...existing,
            ...p.patch,
          },
        ],
      };
    }, attempt);
}
export const usePlatform = create<Store>()((set, get) => {
  const command = async <T>(
    operation: string,
    body: unknown,
    update = true,
  ): Promise<T> => {
    set({ busy: ++writes > 0 });
    try {
      const r = await request<{ result: T; serverNow: string }>(
        `/api/platform/${operation}`,
        body,
      );
      set({ clockOffset: Date.parse(r.serverNow) - Date.now(), error: "" });
      if (update) await get().load();
      return r.result;
    } finally {
      set({ busy: --writes > 0 });
    }
  };
  return {
    data: emptyData(),
    sessionId: null,
    ready: false,
    busy: false,
    error: "",
    clockOffset: 0,
    pendingSaves: 0,
    retrySaves: async () => {
      const failures = [...failedResponses];
      failedResponses = [];
      for (const failure of failures)
        await get().respond(
          failure.attemptId,
          failure.questionId,
          failure.patch,
        );
    },
    load: () => {
      if (refresh) return refresh;
      refresh = (async () => {
        try {
          const state = await request<{
            data: WorkspaceData;
            sessionId: string;
            serverNow: string;
          }>("/api/platform/workspace");
          set({
            ...state,
            data: { ...state.data, attempts: state.data.attempts.map(overlay) },
            clockOffset: Date.parse(state.serverNow) - Date.now(),
            ready: true,
            error: "",
          });
        } catch (error) {
          if (error instanceof HttpError && [401, 403].includes(error.status)) {
            set({ data: emptyData(), sessionId: null, ready: true, error: "" });
          } else {
            set({ ready: true, error: (error as Error).message });
            throw error;
          }
        }
      })().finally(() => (refresh = null));
      return refresh;
    },
    login: async (email, password, remember) => {
      await request("/api/auth/sign-in/email", {
        email,
        password,
        rememberMe: remember,
      });
      await get().load();
      const user = get().data.users.find((u) => u.id === get().sessionId);
      if (!user) throw Error("Unable to restore your session.");
      return user;
    },
    logout: async () => {
      await responseQueue;
      await request("/api/auth/sign-out", {});
      set({ data: emptyData(), sessionId: null });
    },
    register: async (input) => {
      await request("/api/auth/sign-up/email", {
        name: input.name,
        email: input.email,
        password: input.password,
        confirmPassword: input.password,
        phone: input.mobile,
        institution: input.institution,
      });
    },
    changePassword: async (currentPassword, newPassword) => {
      await request("/api/auth/change-password", {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
    },
    updateProfile: (profile, userId) => command("profile", { profile, userId }),
    setStatus: (ids, status) => command("user-status", { ids, status }),
    saveExam: (exam) => command<Exam>("save-exam", exam),
    duplicateExam: async (examId) =>
      (await command<Exam>("duplicate-exam", { examId })).id,
    saveQuestions: (examId, questions) =>
      command("save-questions", {
        examId,
        questions,
        version: get().data.exams.find((e) => e.id === examId)?.version,
      }),
    assign: (examId, userIds, remove = false) =>
      command("assign", { examId, userIds, remove }),
    start: (examId) => command<ExamAttempt>("start", { examId }),
    respond: (attemptId, questionId, patch) => {
      const task = { token: ++serial, attemptId, questionId, patch };
      pendingResponses.push(task);
      set((s) => ({
        pendingSaves: pendingResponses.length,
        data: {
          ...s.data,
          attempts: s.data.attempts.map((a) =>
            a.id === attemptId ? overlay(a) : a,
          ),
        },
      }));
      responseQueue = responseQueue.then(async () => {
        const attempt = get().data.attempts.find((a) => a.id === attemptId);
        if (!attempt || attempt.status === "submitted") {
          pendingResponses = pendingResponses.filter(
            (p) => p.token !== task.token,
          );
          set({ pendingSaves: pendingResponses.length });
          return;
        }
        const payload = {
          attemptId,
          questionId,
          patch: {
            ...patch,
            ...("optionId" in patch
              ? { optionId: patch.optionId ?? null }
              : {}),
          },
          revision: attempt.revision ?? 0,
        };
        for (;;) {
          try {
            const result = await command<{
              attempt: ExamAttempt;
              expired: boolean;
            }>("respond", payload, false);
            pendingResponses = pendingResponses.filter(
              (p) => p.token !== task.token,
            );
            failedResponses = failedResponses.filter(
              (p) =>
                !(p.attemptId === attemptId && p.questionId === questionId),
            );
            set((s) => ({
              pendingSaves: pendingResponses.length,
              data: {
                ...s.data,
                attempts: s.data.attempts.map((a) =>
                  a.id === attemptId ? overlay(result.attempt) : a,
                ),
              },
            }));
            if (result.expired)
              toast.info(
                "Your deadline has passed. The server submitted your attempt.",
              );
            return;
          } catch (error) {
            if (!(error instanceof HttpError) || error.status >= 500) {
              set({
                error:
                  "Connection interrupted. Responses are queued in this tab and will retry. Keep this page open.",
              });
              await new Promise((resolve) => setTimeout(resolve, 3000));
              continue;
            }
            pendingResponses = pendingResponses.filter(
              (p) => p.token !== task.token,
            );
            failedResponses.push(task);
            set({
              error:
                "Your last response could not be saved. Retry your selection before leaving this page.",
            });
            toast.error((error as Error).message);
            try {
              await get().load();
            } catch {
              /* The error notice remains visible until reconnection. */
            }
            set({
              pendingSaves: pendingResponses.length,
              error:
                "A response could not be saved. Review the latest answers, then retry saving before submission.",
            });
            return;
          }
        }
      });
      return responseQueue;
    },
    submit: async (attemptId) => {
      await responseQueue;
      if (failedResponses.length)
        throw Error("Retry unsaved responses before submitting.");
      await command("submit", { attemptId });
    },
    release: (examId, released, attemptId) =>
      command("release", { examId, released, attemptId }),
    settings: (organization, supportEmail) =>
      command("settings", { organization, supportEmail }),
  };
});
