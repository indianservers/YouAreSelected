"use client";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  FileQuestion,
  LockKeyhole,
  Trophy,
} from "lucide-react";
import { useDemo } from "@/lib/mock/store";
import { date, duration } from "@/lib/utils";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { PerformanceChart, ScoreRing } from "@/components/charts";
import { MathText } from "@/components/math-text";
import type { ExamAttempt } from "@/types/domain";
export function AnswerSheet({ attempt }: { attempt: ExamAttempt }) {
  return (
    <section className="panel mt">
      <div className="panel-heading">
        <h2>Your answer sheet</h2>
        <Badge tone="blue">Read-only</Badge>
      </div>
      <div className="panel-body">
        {attempt.questions.map((q, i) => {
          const response = attempt.responses.find((r) => r.questionId === q.id);
          return (
            <article key={q.id} className="answer-review">
              <div className="section-heading">
                <span>
                  Question {i + 1} · {q.topic}
                </span>
                <Badge>
                  {!response?.optionId
                    ? "Unattempted"
                    : response.optionId === q.correctOptionId
                      ? "Correct"
                      : "Incorrect"}
                </Badge>
              </div>
              <h3>
                <MathText text={q.text} />
              </h3>
              {q.options.map((o) => (
                <div
                  className={`review-option ${o.id === q.correctOptionId ? "correct-option" : ""} ${o.id === response?.optionId ? "chosen-option" : ""}`}
                  key={o.id}
                >
                  <MathText text={o.text} />
                  <span>
                    {o.id === q.correctOptionId ? "Correct answer" : ""}
                    {o.id === response?.optionId ? " · Your choice" : ""}
                  </span>
                </div>
              ))}
              <p>
                <strong>Explanation: </strong>
                <MathText
                  text={q.explanation || "No explanation was provided."}
                />
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
export function ResultDetail({
  attemptId,
  admin = false,
}: {
  attemptId: string;
  admin?: boolean;
}) {
  const { data, sessionId } = useDemo();
  const attempt = data.attempts.find(
    (a) => a.id === attemptId && (admin || a.userId === sessionId),
  );
  if (!attempt || attempt.status !== "submitted")
    return (
      <EmptyState
        title="Result not found"
        description="A submitted attempt is required to view results."
      />
    );
  const exam = data.exams.find((e) => e.id === attempt.examId);
  const result = attempt.result!;
  if (!admin && !attempt.publication.released)
    return (
      <>
        <PageHeader
          title="A little patience. More insight soon."
          description={exam?.title}
        />
        <div className="pending-result panel">
          <LockKeyhole size={40} />
          <h2>Results Awaiting Publication.</h2>
          <p>
            Your answers have been submitted. Your administrator will release
            your score and analysis when ready.
          </p>
          <Badge>Results Pending</Badge>
          <Button asChild variant="secondary">
            <Link href="/student/results">Back to my results</Link>
          </Button>
        </div>
      </>
    );
  return (
    <>
      <Link
        className="back-link"
        href={admin ? "/admin/results" : "/student/results"}
      >
        <ArrowLeft size={15} />
        Back to results
      </Link>
      <PageHeader
        eyebrow="A MOMENT TO REFLECT & GROW"
        title={exam?.title ?? "Examination result"}
        description={`${data.users.find((u) => u.id === attempt.userId)?.name} · Submitted ${date(attempt.submittedAt!)}`}
        action={<Badge>{result.passed ? "Passed" : "Not passed"}</Badge>}
      />
      <div className="result-summary panel">
        <ScoreRing score={result.percentage} />
        <div>
          <span className="eyebrow">YOUR PERFORMANCE</span>
          <h2>
            {result.score} <span>/ {result.maximum} marks</span>
          </h2>
          <p>Every attempt gives you something to build on.</p>
          <div className="result-counts">
            <span>
              <i className="green-dot" />
              {result.correct} correct
            </span>
            <span>
              <i className="red-dot" />
              {result.incorrect} incorrect
            </span>
            <span>
              <i />
              {result.unattempted} unattempted
            </span>
          </div>
        </div>
        <div className="result-time">
          <Clock3 size={21} />
          <strong>
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
          </strong>
          <small>Time taken</small>
          <Badge tone="blue">Pass threshold {attempt.passingPercentage}%</Badge>
        </div>
      </div>
      <section className="panel mt">
        <div className="panel-heading">
          <h2>Section-wise performance</h2>
        </div>
        <div className="grid two panel-body">
          <PerformanceChart
            data={result.sections.map((s) => ({
              name: s.name,
              value: s.score,
            }))}
          />
          <div>
            {result.sections.map((s) => (
              <div key={s.sectionId} className="section-result">
                <strong>
                  {s.name}
                  <span>
                    {s.score} / {s.maximum}
                  </span>
                </strong>
                <div className="progress-track">
                  <div
                    style={{
                      width: `${Math.max(0, s.maximum ? (s.score / s.maximum) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <small>
                  {s.correct} correct · {s.incorrect} incorrect ·{" "}
                  {s.unattempted} unattempted
                </small>
              </div>
            ))}
          </div>
        </div>
      </section>
      {(admin || exam?.showReview) && <AnswerSheet attempt={attempt} />}
    </>
  );
}
export function StudentResults() {
  const { data, sessionId } = useDemo();
  const attempts = data.attempts.filter(
    (a) => a.userId === sessionId && a.status === "submitted",
  );
  return (
    <>
      <PageHeader
        eyebrow="LOOK BACK. MOVE FORWARD."
        title="Your progress, in perspective."
        description="Every attempt tells a story. Find the lessons in yours."
      />
      <div className="grid three stats-grid">
        <StatCard
          label="Completed attempts"
          value={attempts.length}
          icon={<FileQuestion size={18} />}
        />
        <StatCard
          label="Published results"
          value={attempts.filter((a) => a.publication.released).length}
          icon={<Trophy size={18} />}
        />
        <StatCard
          label="Awaiting publication"
          value={attempts.filter((a) => !a.publication.released).length}
          icon={<Clock3 size={18} />}
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>My results</h2>
        </div>
        {!attempts.length ? (
          <EmptyState
            title="Your progress starts with an attempt"
            description="Once you submit an examination, your result status will appear here."
            action={
              <Button asChild>
                <Link href="/student/exams">
                  Explore examinations <ArrowRight size={16} />
                </Link>
              </Button>
            }
          />
        ) : (
          attempts.map((a) => (
            <Link
              key={a.id}
              className="result-row"
              href={`/student/results/${a.id}`}
            >
              <span className="exam-category-icon violet">
                <Trophy size={20} />
              </span>
              <div>
                <strong>
                  {data.exams.find((e) => e.id === a.examId)?.title}
                </strong>
                <small>
                  {date(a.submittedAt!)} · {a.questions.length} questions
                </small>
              </div>
              <Badge>
                {a.publication.released
                  ? "Results Published"
                  : "Results Pending"}
              </Badge>
              <strong>
                {a.publication.released ? `${a.result?.percentage}%` : "—"}
              </strong>
              <ArrowRight size={17} />
            </Link>
          ))
        )}
      </section>
    </>
  );
}
