"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Info,
  ShieldCheck,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/lib/mock/store";
import { eligibility, examStatus } from "@/lib/rules";
import { date } from "@/lib/utils";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
export function ExamDetails({
  examId,
  instructions = false,
}: {
  examId: string;
  instructions?: boolean;
}) {
  const store = useDemo();
  const router = useRouter();
  const [ack, setAck] = useState(false);
  const exam = store.data.exams.find((e) => e.id === examId);
  const user = store.data.users.find((u) => u.id === store.sessionId)!;
  if (!exam)
    return (
      <EmptyState
        title="Exam not found"
        description="This examination is no longer in your demo workspace."
        action={
          <Button asChild>
            <Link href="/student/exams">Back to examinations</Link>
          </Button>
        }
      />
    );
  const reason = eligibility(store.data, exam, user);
  const status = examStatus(store.data, exam, user.id);
  const completed = store.data.attempts.filter(
    (a) =>
      a.examId === exam.id && a.userId === user.id && a.status === "submitted",
  );
  return (
    <>
      <Link className="back-link" href="/student/exams">
        <ArrowLeft size={15} />
        Back to examinations
      </Link>
      <PageHeader
        eyebrow={
          instructions ? "BEFORE YOU BEGIN" : exam.category.toUpperCase()
        }
        title={exam.title}
        description={exam.description}
        action={<Badge>{status}</Badge>}
      />
      <div className="grid four stats-grid">
        <StatCard
          label="Questions"
          value={exam.questions.length}
          icon={<FileQuestion size={18} />}
        />
        <StatCard
          label="Duration"
          value={`${exam.duration} min`}
          icon={<Clock3 size={18} />}
        />
        <StatCard
          label="Maximum marks"
          value={exam.questions.reduce((n, q) => n + q.marks, 0)}
          icon={<Target size={18} />}
        />
        <StatCard
          label="Attempt limit"
          value={exam.maxAttempts}
          icon={<CheckCircle2 size={18} />}
        />
      </div>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <BookOpen size={19} />
            <h2>Set yourself up for a good attempt.</h2>
          </div>
          <div className="panel-body">
            <h3>Examination instructions</h3>
            <p className="pre-wrap">{exam.instructions}</p>
            <ol className="instruction-list">
              <li>
                Select one answer for each question. Each question’s positive
                and negative marks are displayed.
              </li>
              <li>
                The timer starts as soon as you begin and continues across
                refreshes. The attempt ends at its deadline or the schedule
                closing time.
              </li>
              <li>
                {exam.allowRevisit
                  ? "You may revisit questions and clear or change your answers."
                  : "Revisiting earlier questions is disabled. Save carefully before moving forward."}
              </li>
              <li>
                {exam.allowSections
                  ? "You may navigate between sections."
                  : "Sections must be completed in sequence."}
              </li>
              <li>
                Marked answers are graded normally. Unanswered questions earn
                zero.
              </li>
              <li>
                Results remain private until your administrator releases them.
              </li>
              <li>
                This is a client-side demonstration. Timing and access are not
                secure or authoritative.
              </li>
            </ol>
            <h3>Sections & marking</h3>
            {exam.sections.map((s) => (
              <div className="section-summary" key={s.id}>
                <span>{s.name}</span>
                <Badge tone="blue">
                  {exam.questions.filter((q) => q.sectionId === s.id).length}{" "}
                  questions
                </Badge>
              </div>
            ))}
            <p className="muted">
              Default marking: +{exam.defaultMarks} correct · −
              {exam.defaultNegative} incorrect. Per-question marks may vary.
              Passing threshold: {exam.passingPercentage}%.
            </p>
          </div>
        </section>
        <aside>
          <div className="panel">
            <div className="panel-heading">
              <CalendarDays size={18} />
              <h3>Your examination window</h3>
            </div>
            <div className="panel-body">
              <div className="schedule-detail">
                <small>OPENS</small>
                <strong>{date(exam.schedule.start)}</strong>
                <small>CLOSES</small>
                <strong>{date(exam.schedule.end)}</strong>
                <p>
                  Displayed in local time · configured zone:{" "}
                  {exam.schedule.timeZone}
                </p>
              </div>
              {reason && (
                <div className="notice">
                  <Info size={17} />
                  {reason}
                </div>
              )}
              {instructions ? (
                <>
                  <label className="checkbox-line ack">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    I have read the instructions and understand the examination
                    rules.
                  </label>
                  <Button
                    className="full-width"
                    disabled={!!reason || !ack}
                    onClick={() => {
                      try {
                        store.start(exam.id);
                        router.push(`/student/exams/${exam.id}/attempt`);
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    Start examination <ArrowRight size={16} />
                  </Button>
                </>
              ) : (
                <Button className="full-width" asChild>
                  <Link href={`/student/exams/${exam.id}/instructions`}>
                    Read instructions <ArrowRight size={16} />
                  </Link>
                </Button>
              )}
              <div className="soft-note">
                <ShieldCheck size={16} />
                Your responses are saved in this browser.
              </div>
            </div>
          </div>
          {completed.length > 0 && (
            <div className="panel mt">
              <div className="panel-heading">
                <h3>Previous attempts</h3>
              </div>
              {completed.map((a, i) => (
                <Link
                  key={a.id}
                  className="result-link"
                  href={`/student/results/${a.id}`}
                >
                  <span>Attempt {i + 1}</span>
                  <Badge>
                    {a.publication.released
                      ? "Results Published"
                      : "Results Pending"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
