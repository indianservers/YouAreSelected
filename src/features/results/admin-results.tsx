"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Award,
  CheckCircle2,
  Download,
  Eye,
  LockKeyhole,
  Send,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type { ExamAttempt } from "@/types/domain";
import { useDemo } from "@/lib/mock/store";
import { downloadResults } from "@/lib/exports";
import { date } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { ResultDetail } from "./student-results";
export function AdminResults({
  examId,
  reports = false,
}: {
  examId?: string;
  reports?: boolean;
}) {
  const store = useDemo();
  const params = useSearchParams();
  const [examFilter, setExamFilter] = useState(examId ?? "all");
  const [publication, setPublication] = useState("all");
  const [student, setStudent] = useState("all");
  const [status, setStatus] = useState("submitted");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [release, setRelease] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState(false);
  const selectedAttempt = params.get("attempt");
  const rows = store.data.attempts.filter(
    (a) =>
      (examFilter === "all" || a.examId === examFilter) &&
      (publication === "all" ||
        (publication === "published" && a.publication.released) ||
        (publication === "withheld" && !a.publication.released)) &&
      (student === "all" || student === a.userId) &&
      (status === "all" || a.status === status) &&
      (!from || Date.parse(a.submittedAt ?? a.startedAt) >= Date.parse(from)) &&
      (!to ||
        Date.parse(a.submittedAt ?? a.startedAt) < Date.parse(to) + 86400000),
  );
  const submitted = rows.filter((a) => a.status === "submitted");
  const scored = submitted.map((a) => a.result!);
  const average = scored.length
    ? Math.round(scored.reduce((n, r) => n + r.percentage, 0) / scored.length)
    : 0;
  const highest = scored.length
    ? Math.max(...scored.map((r) => r.percentage))
    : 0;
  const passRate = scored.length
    ? Math.round((scored.filter((r) => r.passed).length / scored.length) * 100)
    : 0;
  const columns: ColumnDef<ExamAttempt>[] = [
    {
      id: "student",
      header: "Learner",
      accessorFn: (a) => store.data.users.find((u) => u.id === a.userId)?.name,
      cell: ({ row }) => {
        const user = store.data.users.find((u) => u.id === row.original.userId);
        return (
          <div className="table-person">
            <Avatar name={user?.name ?? "Unknown"} />
            <span>
              <strong>{user?.name}</strong>
              <small>{user?.email}</small>
            </span>
          </div>
        );
      },
    },
    {
      id: "exam",
      header: "Examination",
      accessorFn: (a) => store.data.exams.find((e) => e.id === a.examId)?.title,
    },
    {
      accessorKey: "submittedAt",
      header: "Attempt date",
      cell: ({ row }) =>
        date(row.original.submittedAt ?? row.original.startedAt, "dd MMM yyyy"),
    },
    {
      id: "score",
      header: "Score",
      accessorFn: (a) => a.result?.score,
      cell: ({ row }) =>
        row.original.result
          ? `${row.original.result.score} / ${row.original.result.maximum}`
          : "—",
    },
    {
      id: "percentage",
      header: "Percentage",
      accessorFn: (a) => a.result?.percentage,
      cell: ({ row }) =>
        row.original.result ? `${row.original.result.percentage}%` : "—",
    },
    { id: "correct", header: "Correct", accessorFn: (a) => a.result?.correct },
    {
      id: "incorrect",
      header: "Incorrect",
      accessorFn: (a) => a.result?.incorrect,
    },
    {
      id: "unattempted",
      header: "Unattempted",
      accessorFn: (a) => a.result?.unattempted,
    },
    {
      id: "status",
      header: "Result status",
      cell: ({ row }) => (
        <Badge>
          {row.original.status === "in-progress"
            ? "In Progress"
            : row.original.publication.released
              ? "Published"
              : "Withheld"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Answer sheet",
      cell: ({ row }) =>
        row.original.status === "submitted" ? (
          <Link
            className="text-link"
            href={`/admin/results/${row.original.examId}?attempt=${row.original.id}`}
          >
            <Eye size={15} />
            View attempt
          </Link>
        ) : (
          <span className="muted">In progress</span>
        ),
    },
  ];
  const doExport = async (format: "csv" | "xlsx") => {
    setExporting(true);
    try {
      await downloadResults(store.data, submitted, format);
      toast.success(`${format.toUpperCase()} export downloaded.`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setExporting(false);
    }
  };
  if (selectedAttempt)
    return <ResultDetail attemptId={selectedAttempt} admin />;
  return (
    <>
      <PageHeader
        eyebrow="TURN ATTEMPTS INTO UNDERSTANDING"
        title={reports ? "Reports & exports" : "Results & publication"}
        description={
          reports
            ? "A clear, portable view of your examination outcomes."
            : "Review performance and decide when learners can see their results."
        }
        action={
          <div className="button-row">
            <Button
              variant="secondary"
              disabled={exporting || !submitted.length}
              onClick={() => doExport("csv")}
            >
              <Download size={15} />
              Export CSV
            </Button>
            <Button
              variant="secondary"
              disabled={exporting || !submitted.length}
              onClick={() => doExport("xlsx")}
            >
              <Download size={15} />
              Export Excel
            </Button>
          </div>
        }
      />
      <div className="grid three stats-grid">
        <StatCard
          label="Assigned learners"
          value={
            new Set(
              store.data.assignments
                .filter((a) => examFilter === "all" || a.examId === examFilter)
                .map((a) => a.userId),
            ).size
          }
          icon={<Users size={18} />}
        />
        <StatCard
          label="Started attempts"
          value={rows.length}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Submitted attempts"
          value={submitted.length}
          icon={<CheckCircle2 size={18} />}
        />
        <StatCard
          label="Average score"
          value={`${average}%`}
          icon={<Award size={18} />}
        />
        <StatCard
          label="Highest score"
          value={`${highest}%`}
          icon={<Trophy size={18} />}
        />
        <StatCard
          label="Pass rate"
          value={`${passRate}%`}
          icon={<CheckCircle2 size={18} />}
        />
      </div>
      <section className="panel">
        <div className="results-filters">
          <Field label="Examination">
            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
            >
              <option value="all">All examinations</option>
              {store.data.exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Publication">
            <select
              value={publication}
              onChange={(e) => setPublication(e.target.value)}
            >
              <option value="all">All results</option>
              <option value="published">Published</option>
              <option value="withheld">Withheld</option>
            </select>
          </Field>
          <Field label="Learner">
            <select
              value={student}
              onChange={(e) => setStudent(e.target.value)}
            >
              <option value="all">All learners</option>
              {store.data.users
                .filter((u) => u.role === "student")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Attempt status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All attempts</option>
              <option value="submitted">Submitted</option>
              <option value="in-progress">In progress</option>
            </select>
          </Field>
          <Field label="From date">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To date">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
        <div className="publication-toolbar">
          <div>
            <h3>Control the moment of insight.</h3>
            <p>
              Release applies to all submitted attempts in the selected
              examination. Choose an exam to continue.
            </p>
          </div>
          <div className="button-row">
            <Button
              variant="secondary"
              disabled={examFilter === "all" || !submitted.length}
              onClick={() => setRelease(false)}
            >
              <LockKeyhole size={15} />
              Withhold results
            </Button>
            <Button
              disabled={examFilter === "all" || !submitted.length}
              onClick={() => setRelease(true)}
            >
              <Send size={15} />
              Release results
            </Button>
          </div>
        </div>
        <DataTable columns={columns} data={rows} />
      </section>
      <div className="soft-note mt">
        Exports use the filtered submitted records and include calculated
        scores, counts, publication state, and submission references. No answer
        keys are included.
      </div>
      <ConfirmDialog
        open={release !== null}
        onOpenChange={(v) => !v && setRelease(null)}
        title={release ? "Release these results?" : "Withhold these results?"}
        description={`${release ? "Students will be able to view" : "Students will no longer be able to view"} scores and configured answer reviews for all submitted attempts of this examination.`}
        label={release ? "Release results" : "Withhold results"}
        onConfirm={() => {
          store.release(examFilter, !!release);
          toast.success(release ? "Results published." : "Results withheld.");
          setRelease(null);
        }}
      />
    </>
  );
}
