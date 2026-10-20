import { beforeEach, describe, it, expect } from "vitest";
import { useDemo } from "@/lib/mock/store";
import { seed } from "@/lib/mock/seed";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useDemo.setState({ data: seed(), sessionId: null, ready: true });
});
describe("shared mock repository workflows", () => {
  it("randomizes without losing correct option identities and preserves sequential sections", () => {
    const s = useDemo.getState();
    const exam = s.data.exams[0];
    s.saveExam({
      ...exam,
      randomQuestions: true,
      randomOptions: true,
      allowSections: false,
    });
    s.login("student@demo.test", "Student@12345", true);
    const attempt = s.start(exam.id);
    expect(attempt.questions).toHaveLength(exam.questions.length);
    expect(new Set(attempt.questions.map((q) => q.id)).size).toBe(
      exam.questions.length,
    );
    expect(
      attempt.questions.slice(0, 5).every((q) => q.sectionId === "reasoning"),
    ).toBe(true);
    expect(
      attempt.questions.every((q) =>
        q.options.some((o) => o.id === q.correctOptionId),
      ),
    ).toBe(true);
  });
  it("authenticates both roles, rejects invalid credentials and restores session", () => {
    const s = useDemo.getState();
    expect(() => s.login("student@demo.test", "wrong", true)).toThrow();
    expect(s.login("admin@demo.test", "Admin@12345", true).role).toBe("admin");
    s.logout();
    expect(s.login("student@demo.test", "Student@12345", true).role).toBe(
      "student",
    );
    expect(useDemo.getState().sessionId).toBe("student");
    s.logout();
    expect(useDemo.getState().sessionId).toBeNull();
  });
  it("registers a pending learner, rejects duplicates and prevents ineligible assignments", () => {
    const s = useDemo.getState();
    const u = s.register({
      name: "New Learner",
      email: "new@demo.test",
      password: "Student@12345",
      mobile: "9000000088",
      institution: "Demo",
    });
    expect(u.status).toBe("pending");
    expect(() =>
      s.register({
        name: "Duplicate",
        email: "NEW@demo.test",
        password: "Student@12345",
        mobile: "9000000088",
        institution: "",
      }),
    ).toThrow(/exists/);
    expect(() => s.assign("exam-1", [u.id])).toThrow(/approved/);
    s.setStatus([u.id], "approved");
    s.assign("exam-1", [u.id]);
    expect(
      useDemo.getState().data.assignments.some((a) => a.userId === u.id),
    ).toBe(true);
    s.assign("exam-1", [u.id], true);
    expect(
      useDemo.getState().data.assignments.some((a) => a.userId === u.id),
    ).toBe(false);
  });
  it("keeps deadlines stable, snapshots questions, grades once and gates publication", () => {
    const s = useDemo.getState();
    s.login("student@demo.test", "Student@12345", true);
    const attempt = s.start("exam-1");
    expect(s.start("exam-1").deadline).toBe(attempt.deadline);
    const q = attempt.questions[0];
    s.respond(attempt.id, q.id, { optionId: q.correctOptionId, review: true });
    const exam = useDemo.getState().data.exams[0];
    s.saveExam({
      ...exam,
      questions: exam.questions.map((question) => ({ ...question, marks: 10 })),
    });
    s.submit(attempt.id);
    let a = useDemo.getState().data.attempts.find((a) => a.id === attempt.id)!;
    expect(a.result?.score).toBe(2);
    expect(a.publication.released).toBe(false);
    const submittedAt = a.submittedAt;
    s.submit(attempt.id);
    s.respond(attempt.id, q.id, { optionId: undefined });
    a = useDemo.getState().data.attempts.find((a) => a.id === attempt.id)!;
    expect(a.submittedAt).toBe(submittedAt);
    expect(a.responses[0].optionId).toBe(q.correctOptionId);
    s.release("exam-1", true);
    expect(
      useDemo.getState().data.attempts.find((a) => a.id === attempt.id)!
        .publication.released,
    ).toBe(true);
    s.release("exam-1", false);
    expect(
      useDemo.getState().data.attempts.find((a) => a.id === attempt.id)!
        .publication.released,
    ).toBe(false);
    expect(() => s.start("exam-1")).toThrow(/attempts/);
  });
  it("submits an expired attempt before accepting a response and resets data", () => {
    const s = useDemo.getState();
    s.login("student@demo.test", "Student@12345", true);
    const attempt = s.start("exam-1");
    useDemo.setState((st) => ({
      data: {
        ...st.data,
        attempts: st.data.attempts.map((a) =>
          a.id === attempt.id
            ? { ...a, deadline: new Date(Date.now() - 1000).toISOString() }
            : a,
        ),
      },
    }));
    s.respond(attempt.id, attempt.questions[0].id, { optionId: "o1" });
    expect(useDemo.getState().data.attempts[0].status).toBe("submitted");
    expect(useDemo.getState().data.attempts[0].responses).toEqual([]);
    s.reset();
    expect(useDemo.getState().data.attempts).toEqual([]);
    expect(useDemo.getState().sessionId).toBeNull();
  });
});
