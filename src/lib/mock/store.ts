"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { seed, id } from "./seed";
import { grade } from "@/lib/grading";
import { eligibility, examErrors, questionErrors } from "@/lib/rules";
import { storageSchema } from "./storage-schema";
import type { Repositories } from "@/lib/repositories/contracts";
import type { DemoData, ExamAttempt } from "@/types/domain";
interface Store extends Repositories {
  data: DemoData;
  sessionId: string | null;
  ready: boolean;
  setReady(): void;
  reset(): void;
  settings(organization: string, supportEmail: string): void;
}
const shuffled = <T>(values: T[]): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
export const useDemo = create<Store>()(
  persist(
    (set, get) => ({
      data: seed(),
      sessionId: null,
      ready: false,
      setReady: () => set({ ready: true }),
      login: (email, password, remember) => {
        const user = get().data.users.find(
          (u) =>
            u.email.toLowerCase() === email.trim().toLowerCase() &&
            u.demoPassword === password,
        );
        if (!user) throw Error("Email or password is incorrect.");
        if (user.status === "rejected" || user.status === "suspended")
          throw Error(`This demo account is ${user.status}.`);
        sessionStorage.setItem("yas-session", user.id);
        localStorage.setItem("yas-remember", remember ? "yes" : "no");
        set({ sessionId: user.id });
        return user;
      },
      logout: () => {
        sessionStorage.removeItem("yas-session");
        localStorage.removeItem("yas-remember");
        set({ sessionId: null });
      },
      register: (input) => {
        if (
          get().data.users.some(
            (u) => u.email.toLowerCase() === input.email.trim().toLowerCase(),
          )
        )
          throw Error("An account with this email already exists.");
        const user = {
          id: id(),
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          mobile: input.mobile,
          institution: input.institution,
          demoPassword: input.password,
          role: "student" as const,
          status: "pending" as const,
          registeredAt: new Date().toISOString(),
        };
        set((s) => ({ data: { ...s.data, users: [...s.data.users, user] } }));
        return user;
      },
      changePassword: (current, next) => {
        const u = get().data.users.find((u) => u.id === get().sessionId);
        if (!u || u.demoPassword !== current)
          throw Error("Current demo password is incorrect.");
        if (next.length < 10) throw Error("Use at least 10 characters.");
        set((s) => ({
          data: {
            ...s.data,
            users: s.data.users.map((user) =>
              user.id === u.id ? { ...user, demoPassword: next } : user,
            ),
          },
        }));
      },
      updateProfile: (input) =>
        set((s) => ({
          data: {
            ...s.data,
            users: s.data.users.map((u) =>
              u.id === s.sessionId ? { ...u, ...input } : u,
            ),
          },
        })),
      setStatus: (ids, status) =>
        set((s) => ({
          data: {
            ...s.data,
            users: s.data.users.map((u) =>
              ids.includes(u.id) && u.role === "student" ? { ...u, status } : u,
            ),
          },
        })),
      saveExam: (exam) => {
        if (exam.status === "published") {
          const errors = examErrors(exam);
          if (errors.length) throw Error(errors.join(" "));
        } else if (!exam.title.trim())
          throw Error("An exam title is required.");
        set((s) => ({
          data: {
            ...s.data,
            exams: s.data.exams.some((e) => e.id === exam.id)
              ? s.data.exams.map((e) =>
                  e.id === exam.id ? structuredClone(exam) : e,
                )
              : [...s.data.exams, structuredClone(exam)],
          },
        }));
      },
      duplicateExam: (examId) => {
        const exam = get().data.exams.find((e) => e.id === examId);
        if (!exam) throw Error("Exam not found.");
        const copy = {
          ...structuredClone(exam),
          id: id(),
          title: `${exam.title} (copy)`,
          code: `${exam.code}-COPY`,
          status: "draft" as const,
        };
        get().saveExam(copy);
        return copy.id;
      },
      saveQuestions: (examId, questions) => {
        if (questions.some((q) => questionErrors(q).length))
          throw Error("Fix the question validation errors.");
        const exam = get().data.exams.find((e) => e.id === examId);
        if (!exam) throw Error("Exam not found.");
        get().saveExam({ ...exam, questions });
      },
      assign: (examId, userIds, remove = false) => {
        if (!get().data.exams.some((e) => e.id === examId))
          throw Error("Exam not found.");
        if (
          !remove &&
          userIds.some(
            (userId) =>
              !get().data.users.some(
                (u) =>
                  u.id === userId &&
                  u.role === "student" &&
                  u.status === "approved",
              ),
          )
        )
          throw Error("Only approved students can be assigned.");
        set((s) => ({
          data: {
            ...s.data,
            assignments: remove
              ? s.data.assignments.filter(
                  (a) => !(a.examId === examId && userIds.includes(a.userId)),
                )
              : [
                  ...s.data.assignments,
                  ...userIds
                    .filter(
                      (userId) =>
                        !s.data.assignments.some(
                          (a) => a.examId === examId && a.userId === userId,
                        ),
                    )
                    .map((userId) => ({ id: id(), examId, userId })),
                ],
          },
        }));
      },
      start: (examId) => {
        const state = get();
        const user = state.data.users.find((u) => u.id === state.sessionId);
        const exam = state.data.exams.find((e) => e.id === examId);
        if (!exam || !user) throw Error("Exam or session not found.");
        const reason = eligibility(state.data, exam, user);
        if (reason) throw Error(reason);
        const existing = state.data.attempts.find(
          (a) =>
            a.examId === examId &&
            a.userId === user.id &&
            a.status === "in-progress",
        );
        if (existing) return existing;
        const now = Date.now();
        const original = structuredClone(exam.questions);
        // Keep sections contiguous when section navigation is restricted.
        const ordered = exam.allowSections
          ? exam.randomQuestions
            ? shuffled(original)
            : original
          : exam.sections.flatMap((section) => {
              const group = original.filter((q) => q.sectionId === section.id);
              return exam.randomQuestions ? shuffled(group) : group;
            });
        const questions = ordered.map((q) => ({
          ...q,
          options: exam.randomOptions ? shuffled(q.options) : q.options,
        }));
        const attempt: ExamAttempt = {
          currentIndex: 0,
          id: id(),
          examId,
          userId: user.id,
          startedAt: new Date(now).toISOString(),
          deadline: new Date(
            Math.min(
              now + exam.duration * 60000,
              Date.parse(exam.schedule.end),
            ),
          ).toISOString(),
          status: "in-progress",
          questions,
          sections: structuredClone(exam.sections),
          passingPercentage: exam.passingPercentage,
          responses: [],
          publication: { released: false },
        };
        set((s) => ({
          data: { ...s.data, attempts: [...s.data.attempts, attempt] },
        }));
        return attempt;
      },
      respond: (attemptId, questionId, patch) => {
        const attempt = get().data.attempts.find((a) => a.id === attemptId);
        if (!attempt || attempt.status === "submitted") return;
        if (Date.now() >= Date.parse(attempt.deadline)) {
          get().submit(attemptId);
          return;
        }
        if (!attempt.questions.some((q) => q.id === questionId)) return;
        set((s) => ({
          data: {
            ...s.data,
            attempts: s.data.attempts.map((a) =>
              a.id === attemptId
                ? {
                    ...a,
                    currentIndex: patch.visited
                      ? a.questions.findIndex((q) => q.id === questionId)
                      : a.currentIndex,
                    responses: a.responses.some(
                      (r) => r.questionId === questionId,
                    )
                      ? a.responses.map((r) =>
                          r.questionId === questionId ? { ...r, ...patch } : r,
                        )
                      : [
                          ...a.responses,
                          {
                            questionId,
                            review: false,
                            visited: false,
                            ...patch,
                          },
                        ],
                  }
                : a,
            ),
          },
        }));
      },
      submit: (attemptId) =>
        set((s) => ({
          data: {
            ...s.data,
            attempts: s.data.attempts.map((a) =>
              a.id === attemptId && a.status === "in-progress"
                ? {
                    ...a,
                    status: "submitted",
                    submittedAt: new Date(
                      Math.min(Date.now(), Date.parse(a.deadline)),
                    ).toISOString(),
                    result: grade(
                      a.questions,
                      a.responses,
                      a.sections,
                      a.passingPercentage,
                    ),
                  }
                : a,
            ),
          },
        })),
      release: (examId, released) =>
        set((s) => ({
          data: {
            ...s.data,
            attempts: s.data.attempts.map((a) =>
              a.examId === examId && a.status === "submitted"
                ? {
                    ...a,
                    publication: {
                      released,
                      releasedAt: released
                        ? new Date().toISOString()
                        : undefined,
                    },
                  }
                : a,
            ),
          },
        })),
      reset: () => {
        sessionStorage.removeItem("yas-session");
        localStorage.removeItem("yas-remember");
        set({ data: seed(), sessionId: null });
      },
      settings: (organization, supportEmail) =>
        set((s) => ({
          data: { ...s.data, settings: { organization, supportEmail } },
        })),
    }),
    {
      name: "yas-demo-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ data: s.data, sessionId: s.sessionId }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Store> | undefined;
        // A versioned shape check plus fresh seed fallback protects corrupt or old demo storage.
        try {
          if (
            !p?.data ||
            p.data.version !== 1 ||
            !Array.isArray(p.data.users) ||
            !Array.isArray(p.data.exams) ||
            !Array.isArray(p.data.attempts) ||
            !Array.isArray(p.data.assignments) ||
            !p.data.settings
          )
            return current;
          if (
            p.data.exams.some(
              (e) =>
                !e.schedule ||
                !Array.isArray(e.questions) ||
                !Array.isArray(e.sections) ||
                e.questions.some((q) => questionErrors(q).length),
            ) ||
            p.data.users.some((u) => !u.id || !u.email || !u.demoPassword)
          )
            return current;
          const parsed = storageSchema.safeParse(p.data);
          if (!parsed.success) return current;
          const session =
            localStorage.getItem("yas-remember") === "yes"
              ? p.sessionId
              : sessionStorage.getItem("yas-session");
          return {
            ...current,
            data: parsed.data,
            sessionId: p.data.users.some((u) => u.id === session)
              ? (session ?? null)
              : null,
          };
        } catch {
          return current;
        }
      },
    },
  ),
);
