"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Flag,
  Grid2X2,
  Info,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/lib/mock/store";
import { date, duration } from "@/lib/utils";
import { MathText } from "@/components/math-text";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
export function AttemptScreen({ examId }: { examId: string }) {
  const store = useDemo();
  const router = useRouter();
  const exam = store.data.exams.find((e) => e.id === examId);
  const attempt = store.data.attempts
    .filter((a) => a.examId === examId && a.userId === store.sessionId)
    .at(-1);
  const [index, setIndex] = useState(attempt?.currentIndex ?? 0);
  const [now, setNow] = useState(Date.now);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const question = attempt?.questions[index];
  const respond = store.respond;
  const submit = store.submit;
  const attemptId = attempt?.id;
  const attemptStatus = attempt?.status;
  const questionId = question?.id;
  useEffect(() => {
    if (!attempt || attempt.status === "submitted") return;
    const tick = () => {
      setNow(Date.now());
      if (Date.now() >= Date.parse(attempt.deadline)) submit(attempt.id);
    };
    tick();
    const interval = setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [attempt?.id, attempt?.deadline, attempt?.status, submit, attempt]);
  useEffect(() => {
    if (attempt?.status === "submitted")
      router.replace(`/student/exams/${examId}/submitted`);
  }, [attempt?.status, examId, router]);
  useEffect(() => {
    if (attemptId && questionId && attemptStatus === "in-progress")
      respond(attemptId, questionId, { visited: true });
  }, [attemptId, attemptStatus, questionId, respond]);
  if (!attempt || !exam || !question)
    return (
      <EmptyState
        title="Your attempt hasn’t started"
        description="Read and acknowledge the instructions to begin an eligible examination."
        action={
          <Button asChild>
            <Link href={`/student/exams/${examId}/instructions`}>
              View instructions
            </Link>
          </Button>
        }
      />
    );
  if (attempt.status === "submitted")
    return (
      <EmptyState
        title="This attempt is submitted"
        description="Your answers are now read-only."
        action={
          <Button asChild>
            <Link href={`/student/exams/${examId}/submitted`}>
              View submission
            </Link>
          </Button>
        }
      />
    );
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(attempt.deadline) - now) / 1000),
  );
  const answered = attempt.responses.filter((r) => r.optionId).length;
  const review = attempt.responses.filter((r) => r.review).length;
  const response = attempt.responses.find((r) => r.questionId === question.id);
  const section = attempt.sections.find((s) => s.id === question.sectionId);
  const move = (next: number) => {
    if (next < 0 || next >= attempt.questions.length) return;
    if (!exam.allowRevisit && next < index) {
      toast.error("Revisiting previous questions is disabled.");
      return;
    }
    if (
      !exam.allowSections &&
      attempt.questions[next].sectionId !== question.sectionId &&
      next !== index + 1
    ) {
      toast.error("Complete sections in sequence.");
      return;
    }
    setIndex(next);
    setDrawer(false);
  };
  const finish = () => {
    store.submit(attempt.id);
    toast.success("Your examination has been submitted.");
  };
  return (
    <>
      <div className="attempt-header">
        <div>
          <span className="eyebrow">FOCUS MODE · BROWSER DEMO</span>
          <h1>{exam.title}</h1>
          <p>
            {section?.name} <span>·</span> {answered} of{" "}
            {attempt.questions.length} answered
          </p>
        </div>
        <div className="attempt-header-actions">
          <div
            className={`exam-timer ${remaining < 300 ? "urgent" : ""}`}
            role="timer"
            aria-label={`Time remaining ${duration(remaining)}`}
          >
            <Clock3 size={20} />
            <div>
              <small>TIME REMAINING</small>
              <strong>{duration(remaining)}</strong>
            </div>
          </div>
          <Button
            variant="secondary"
            className="mobile-only"
            onClick={() => setDrawer(true)}
            aria-label="Open question navigator"
          >
            <Grid2X2 size={18} />
          </Button>
          <Button onClick={() => setConfirm(true)}>
            <Send size={16} />
            <span>Submit exam</span>
          </Button>
        </div>
      </div>
      <div
        className="attempt-progress"
        aria-label={`${answered} questions answered`}
      >
        <div
          style={{ width: `${(answered / attempt.questions.length) * 100}%` }}
        />
      </div>
      <div className="attempt-layout">
        <section className="question-panel">
          <div className="question-topline">
            <span>
              QUESTION {index + 1} <small>OF {attempt.questions.length}</small>
            </span>
            <div>
              <Badge tone="green">+{question.marks} marks</Badge>
              <Badge tone="red">−{question.negative} marks</Badge>
            </div>
          </div>
          {exam.allowSections && (
            <div className="section-tabs">
              {attempt.sections
                .filter((s) =>
                  attempt.questions.some((q) => q.sectionId === s.id),
                )
                .map((s) => (
                  <button
                    key={s.id}
                    className={s.id === question.sectionId ? "active" : ""}
                    onClick={() =>
                      move(
                        attempt.questions.findIndex(
                          (q) => q.sectionId === s.id,
                        ),
                      )
                    }
                  >
                    {s.name}
                  </button>
                ))}
            </div>
          )}
          <div className="question-body">
            <div className="question-topic">
              {question.topic || section?.name}
            </div>
            <h2>
              <MathText text={question.text} />
            </h2>
            {question.image && (
              <Image
                width={640}
                height={300}
                unoptimized
                className="question-image"
                src={question.image}
                alt="Question diagram"
              />
            )}
            <fieldset className="answer-options">
              <legend className="sr-only">Select one answer</legend>
              {question.options.map((o, i) => (
                <label
                  className={`answer-option ${response?.optionId === o.id ? "selected" : ""}`}
                  key={o.id}
                >
                  <input
                    type="radio"
                    name={`answer-${question.id}`}
                    value={o.id}
                    checked={response?.optionId === o.id}
                    onChange={() =>
                      respond(attempt.id, question.id, {
                        optionId: o.id,
                        visited: true,
                      })
                    }
                  />
                  <span className="option-letter">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>
                    <MathText text={o.text} />
                  </span>
                  {response?.optionId === o.id && <CheckCircle2 size={20} />}
                </label>
              ))}
            </fieldset>
            <div className="response-actions">
              <Button
                variant="ghost"
                disabled={!response?.optionId}
                onClick={() =>
                  respond(attempt.id, question.id, { optionId: undefined })
                }
              >
                <X size={16} />
                Clear response
              </Button>
              <Button
                variant={response?.review ? "secondary" : "ghost"}
                onClick={() =>
                  respond(attempt.id, question.id, {
                    review: !response?.review,
                    visited: true,
                  })
                }
              >
                <Flag size={16} />
                {response?.review ? "Marked for review" : "Mark for review"}
              </Button>
            </div>
          </div>
          <div className="question-footer">
            <Button
              variant="secondary"
              disabled={index === 0 || !exam.allowRevisit}
              onClick={() => move(index - 1)}
            >
              <ArrowLeft size={16} />
              Previous
            </Button>
            <span>Changes saved in this browser</span>
            <Button
              onClick={() =>
                index < attempt.questions.length - 1
                  ? move(index + 1)
                  : setConfirm(true)
              }
            >
              {index === attempt.questions.length - 1
                ? "Review & submit"
                : "Save & next"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
        {drawer && (
          <button
            className="mobile-overlay"
            aria-label="Close question navigator"
            onClick={() => setDrawer(false)}
          />
        )}
        <aside
          className={`question-navigator ${drawer ? "navigator-open" : ""}`}
        >
          <div className="panel-heading">
            <h3>Question navigator</h3>
            <button
              className="icon-button mobile-only"
              onClick={() => setDrawer(false)}
              aria-label="Close navigator"
            >
              <X size={18} />
            </button>
            <span className="count-bubble">{attempt.questions.length}</span>
          </div>
          <div className="navigator-body">
            {attempt.sections.map((s) => (
              <div key={s.id}>
                <h4>{s.name}</h4>
                <div className="question-numbers">
                  {attempt.questions.map((q, i) => {
                    if (q.sectionId !== s.id) return null;
                    const r = attempt.responses.find(
                      (r) => r.questionId === q.id,
                    );
                    const state = r?.review
                      ? r.optionId
                        ? "answered-review"
                        : "review"
                      : r?.optionId
                        ? "answered"
                        : r?.visited
                          ? "unanswered"
                          : "unvisited";
                    return (
                      <button
                        aria-label={`Question ${i + 1}: ${state}`}
                        aria-current={i === index ? "step" : undefined}
                        className={`question-number ${state} ${index === i ? "current" : ""}`}
                        key={q.id}
                        onClick={() => move(i)}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="navigator-legend">
              {[
                ["unvisited", "Not visited"],
                ["unanswered", "Not answered"],
                ["answered", "Answered"],
                ["review", "Marked for review"],
                ["answered-review", "Answered & marked"],
              ].map(([c, t]) => (
                <div key={c}>
                  <span className={`legend-square ${c}`} />
                  {t}
                </div>
              ))}
            </div>
            <div className="soft-note">
              <Info size={17} />
              <span>
                Marked responses are included in scoring. Review them before
                submitting.
              </span>
            </div>
            <div className="navigator-summary">
              <span>
                Answered<strong>{answered}</strong>
              </span>
              <span>
                Remaining<strong>{attempt.questions.length - answered}</strong>
              </span>
              <span>
                Review<strong>{review}</strong>
              </span>
            </div>
          </div>
        </aside>
      </div>
      <div className="exam-footnote">
        <ShieldCheck size={14} />
        Client-side demo timing · Your deadline persists on refresh · Submission
        is final
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Ready to submit?"
        description="Your answers will become read-only. Take a moment to check your progress."
        label="Submit examination"
        onConfirm={finish}
      >
        <div className="submission-counts">
          <div>
            <strong>{answered}</strong>
            <span>Answered</span>
          </div>
          <div>
            <strong>{attempt.questions.length - answered}</strong>
            <span>Unanswered</span>
          </div>
          <div>
            <strong>{review}</strong>
            <span>For review</span>
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
export function SubmittedScreen({ examId }: { examId: string }) {
  const { data, sessionId } = useDemo();
  const attempt = data.attempts
    .filter(
      (a) =>
        a.examId === examId &&
        a.userId === sessionId &&
        a.status === "submitted",
    )
    .at(-1);
  const exam = data.exams.find((e) => e.id === examId);
  if (!attempt)
    return (
      <EmptyState
        title="No submission yet"
        description="Complete an examination to see its submission receipt."
      />
    );
  const answered = attempt.responses.filter((r) => r.optionId).length;
  return (
    <>
      <div className="submission-hero">
        <div className="success-symbol">
          <CheckCircle2 size={38} />
        </div>
        <span className="eyebrow">ONE MORE STEP FORWARD</span>
        <h1>Test submitted successfully.</h1>
        <p>
          You showed up and gave it your best. That’s progress worth
          celebrating.
        </p>
        <Badge>
          {attempt.publication.released
            ? "Results Published"
            : "Results Pending"}
        </Badge>
      </div>
      <div className="submission-receipt panel">
        <PageHeader
          title={exam?.title ?? "Examination"}
          description="Your submission receipt"
        />
        <div className="grid three">
          <StatCard
            label="Total questions"
            value={attempt.questions.length}
            icon={<Grid2X2 size={18} />}
          />
          <StatCard
            label="Answered"
            value={answered}
            icon={<CheckCircle2 size={18} />}
          />
          <StatCard
            label="Unanswered"
            value={attempt.questions.length - answered}
            icon={<Info size={18} />}
          />
        </div>
        <dl className="receipt-details">
          <div>
            <dt>Marked for review</dt>
            <dd>{attempt.responses.filter((r) => r.review).length}</dd>
          </div>
          <div>
            <dt>Time taken</dt>
            <dd>
              {duration(
                Math.max(
                  0,
                  Math.round(
                    (Date.parse(attempt.submittedAt!) -
                      Date.parse(attempt.startedAt)) /
                      1000,
                  ),
                ),
              )}
            </dd>
          </div>
          <div>
            <dt>Submitted at</dt>
            <dd>{date(attempt.submittedAt!)}</dd>
          </div>
          <div>
            <dt>Submission reference</dt>
            <dd className="mono">{attempt.id}</dd>
          </div>
        </dl>
        <div className="notice">
          {attempt.publication.released
            ? "Your administrator has published this result."
            : "Results awaiting publication. Your administrator will release results when they are ready."}
        </div>
        <div className="hero-actions">
          <Button asChild>
            <Link href="/student/dashboard">
              Back to dashboard <ArrowRight size={16} />
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href={`/student/results/${attempt.id}`}>
              View result status
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
