"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Copy,
  Eye,
  FileQuestion,
  Plus,
  Save,
  Send,
  Settings2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type { Exam } from "@/types/domain";
import { usePlatform } from "@/lib/client/store";
import { blankExam } from "@/lib/exam-defaults";
import { examErrors } from "@/lib/rules";
import { date } from "@/lib/utils";
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SearchToolbar,
  Tabs,
} from "@/components/ui";
export function ExamManagement() {
  const store = usePlatform();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState("All exams");
  const exams = store.data.exams.filter(
    (e) => tab === "All exams" || e.status === tab.toLowerCase(),
  );
  const columns: ColumnDef<Exam>[] = [
    {
      accessorKey: "title",
      header: "Examination",
      cell: ({ row }) => (
        <Link
          className="table-person"
          href={`/admin/exams/${row.original.id}/edit`}
        >
          <span className="exam-category-icon violet">
            <BookOpen size={20} />
          </span>
          <span>
            <strong>{row.original.title}</strong>
            <small>
              {row.original.code} · {row.original.category}
            </small>
          </span>
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge>{row.original.status}</Badge>,
    },
    {
      id: "questions",
      header: "Questions",
      accessorFn: (e) => e.questions.length,
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => `${row.original.duration} min`,
    },
    {
      id: "assigned",
      header: "Assigned",
      accessorFn: (e) =>
        store.data.assignments.filter((a) => a.examId === e.id).length,
    },
    {
      id: "schedule",
      header: "Window closes",
      cell: ({ row }) => date(row.original.schedule.end, "dd MMM yyyy"),
    },
    {
      id: "actions",
      header: "Manage",
      cell: ({ row }) => (
        <div className="table-actions">
          <Link
            title="Edit exam"
            aria-label={`Edit ${row.original.title}`}
            href={`/admin/exams/${row.original.id}/edit`}
          >
            <Settings2 size={16} />
          </Link>
          <Link
            title="Questions"
            aria-label={`Questions for ${row.original.title}`}
            href={`/admin/exams/${row.original.id}/questions`}
          >
            <FileQuestion size={16} />
          </Link>
          <Link
            title="Assignments"
            aria-label={`Assignments for ${row.original.title}`}
            href={`/admin/exams/${row.original.id}/assignments`}
          >
            <Users size={16} />
          </Link>
          <Link
            title="Schedule"
            aria-label={`Schedule for ${row.original.title}`}
            href={`/admin/exams/${row.original.id}/schedule`}
          >
            <CalendarDays size={16} />
          </Link>
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="THOUGHTFUL ASSESSMENTS. MEANINGFUL PROGRESS."
        title="Examinations"
        description="Shape the next opportunity for your learners."
        action={
          <Button asChild>
            <Link href="/admin/exams/new">
              <Plus size={16} />
              Create examination
            </Link>
          </Button>
        }
      />
      <section className="panel">
        <Tabs
          items={["All exams", "Published", "Draft", "Archived"]}
          value={tab}
          onChange={setTab}
        />
        <div className="panel-body no-bottom">
          <SearchToolbar
            value={search}
            onChange={setSearch}
            placeholder="Search exams, codes or categories…"
          />
        </div>
        <DataTable columns={columns} data={exams} search={search} />
      </section>
    </>
  );
}
export function ExamNav({
  examId,
  active,
}: {
  examId: string;
  active: string;
}) {
  return (
    <div className="exam-admin-nav">
      {[
        ["edit", "Exam details", Settings2],
        ["questions", "Question bank", FileQuestion],
        ["assignments", "Assignments", Users],
        ["schedule", "Schedule", CalendarDays],
      ].map(([key, label, Icon]) => (
        <Link
          key={String(key)}
          className={key === active ? "active" : ""}
          href={`/admin/exams/${examId}/${key}`}
        >
          <Icon size={16} />
          {String(label)}
        </Link>
      ))}
    </div>
  );
}
export function ExamEditor({ examId }: { examId?: string }) {
  const store = usePlatform();
  const router = useRouter();
  const existing = store.data.exams.find((e) => e.id === examId);
  const [exam, setExam] = useState<Exam>(() =>
    structuredClone(existing ?? blankExam()),
  );
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = <K extends keyof Exam>(key: K, value: Exam[K]) => {
    setExam((e) => ({ ...e, [key]: value }));
    setDirty(true);
  };
  const save = async (status: Exam["status"]) => {
    try {
      const value = { ...exam, status };
      const saved = await store.saveExam(value);
      setExam(saved);
      setDirty(false);
      setErrors([]);
      toast.success(
        status === "published"
          ? "Examination published."
          : "Examination saved.",
      );
      if (!existing) router.replace(`/admin/exams/${exam.id}/edit`);
    } catch (error) {
      setErrors(
        status === "published"
          ? examErrors({ ...exam, status })
          : [(error as Error).message],
      );
      toast.error("Review the exam configuration.");
    }
  };
  if (examId && !existing)
    return (
      <EmptyState
        title="Exam not found"
        description="Select an examination from the library."
      />
    );
  return (
    <>
      <Link className="back-link" href="/admin/exams">
        <ArrowLeft size={15} />
        All examinations
      </Link>
      <PageHeader
        eyebrow={existing ? exam.code : "A NEW OPPORTUNITY STARTS HERE"}
        title={existing ? "Edit examination" : "Create an examination"}
        description="Give your learners a clear, well-considered assessment."
        action={
          <div className="button-row">
            <Button variant="secondary" onClick={() => setPreview(true)}>
              <Eye size={16} />
              Preview
            </Button>
            {existing && (
              <Button
                variant="secondary"
                onClick={async () => {
                  const copy = await store.duplicateExam(exam.id);
                  router.push(`/admin/exams/${copy}/edit`);
                }}
              >
                <Copy size={16} />
                Duplicate
              </Button>
            )}
          </div>
        }
      />
      {existing && <ExamNav examId={exam.id} active="edit" />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          save(exam.status);
        }}
        className="editor-form"
      >
        <div className="editor-main">
          <section className="panel">
            <div className="panel-heading">
              <span className="form-section-number">01</span>
              <div>
                <h2>The essentials</h2>
                <p>A clear introduction to what learners can expect.</p>
              </div>
            </div>
            <div className="panel-body form-stack">
              <div className="grid two">
                <Input
                  label="Exam title *"
                  value={exam.title}
                  onChange={(e) => update("title", e.target.value)}
                  required
                />
                <Input
                  label="Exam code *"
                  value={exam.code}
                  onChange={(e) => update("code", e.target.value)}
                  required
                />
              </div>
              <Field label="Description *">
                <textarea
                  rows={3}
                  value={exam.description}
                  onChange={(e) => update("description", e.target.value)}
                  required
                />
              </Field>
              <div className="grid two">
                <Input
                  label="Category *"
                  value={exam.category}
                  onChange={(e) => update("category", e.target.value)}
                  required
                />
                <Input
                  label="Subject *"
                  value={exam.subject}
                  onChange={(e) => update("subject", e.target.value)}
                  required
                />
              </div>
              <Field label="Examination instructions *">
                <textarea
                  rows={5}
                  value={exam.instructions}
                  onChange={(e) => update("instructions", e.target.value)}
                  required
                />
              </Field>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span className="form-section-number">02</span>
              <div>
                <h2>Structure & scoring</h2>
                <p>Build a balanced assessment with clear marking rules.</p>
              </div>
            </div>
            <div className="panel-body form-stack">
              <Field
                label="Sections (one per line)"
                hint="Existing section identifiers stay stable when renamed. Remove section questions before removing a section."
              >
                <textarea
                  rows={3}
                  value={exam.sections.map((s) => s.name).join("\n")}
                  onChange={(e) =>
                    update(
                      "sections",
                      e.target.value.split("\n").map((name, i) => ({
                        id: exam.sections[i]?.id ?? `section-${i + 1}`,
                        name,
                      })),
                    )
                  }
                />
              </Field>
              <div className="grid three">
                <Input
                  label="Default positive marks"
                  type="number"
                  min="0.01"
                  step="any"
                  value={exam.defaultMarks}
                  onChange={(e) =>
                    update("defaultMarks", Number(e.target.value))
                  }
                />
                <Input
                  label="Default negative marks"
                  type="number"
                  min="0"
                  step="any"
                  value={exam.defaultNegative}
                  onChange={(e) =>
                    update("defaultNegative", Number(e.target.value))
                  }
                />
                <Input
                  label="Passing percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={exam.passingPercentage}
                  onChange={(e) =>
                    update("passingPercentage", Number(e.target.value))
                  }
                />
              </div>
              <div className="info-metrics">
                <span>
                  <strong>{exam.questions.length}</strong>questions
                </span>
                <span>
                  <strong>
                    {exam.questions.reduce((n, q) => n + q.marks, 0)}
                  </strong>
                  maximum marks
                </span>
                {existing ? (
                  <Link href={`/admin/exams/${exam.id}/questions`}>
                    Manage question set <ArrowRight size={16} />
                  </Link>
                ) : (
                  <small>Save a draft to add questions.</small>
                )}
              </div>
              <label className="switch-line">
                <span>
                  <strong>Randomize question order</strong>
                  <small>A different sequence for each new attempt.</small>
                </span>
                <input
                  type="checkbox"
                  checked={exam.randomQuestions}
                  onChange={(e) => update("randomQuestions", e.target.checked)}
                />
              </label>
              <label className="switch-line">
                <span>
                  <strong>Randomize answer options</strong>
                  <small>
                    Option identifiers remain stable for correct scoring.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={exam.randomOptions}
                  onChange={(e) => update("randomOptions", e.target.checked)}
                />
              </label>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span className="form-section-number">03</span>
              <h2>Attempt experience</h2>
            </div>
            <div className="panel-body form-stack">
              <div className="grid two">
                <Input
                  label="Duration (minutes)"
                  type="number"
                  min="1"
                  value={exam.duration}
                  onChange={(e) => update("duration", Number(e.target.value))}
                />
                <Input
                  label="Maximum attempts"
                  type="number"
                  min="1"
                  step="1"
                  value={exam.maxAttempts}
                  onChange={(e) =>
                    update("maxAttempts", Number(e.target.value))
                  }
                />
              </div>
              {(
                [
                  [
                    "allowRevisit",
                    "Allow revisiting questions",
                    "Students can move back and update earlier responses.",
                  ],
                  [
                    "allowSections",
                    "Allow section navigation",
                    "Students can switch freely between sections.",
                  ],
                  [
                    "showReview",
                    "Allow answer review after publication",
                    "Show correct answers and explanations only after release.",
                  ],
                ] as const
              ).map(([key, label, hint]) => (
                <label className="switch-line" key={key}>
                  <span>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={exam[key]}
                    onChange={(e) => update(key, e.target.checked)}
                  />
                </label>
              ))}
              <div className="notice">
                Auto-submit on timeout is always enabled. Results require an
                explicit administrator release.
              </div>
            </div>
          </section>
        </div>
        <aside className="editor-aside">
          <section className="panel">
            <div className="panel-heading">
              <h3>Ready when you are.</h3>
              <Badge>{exam.status}</Badge>
            </div>
            <div className="panel-body form-stack">
              <Field label="Visibility">
                <select
                  value={exam.status}
                  onChange={(e) =>
                    update("status", e.target.value as Exam["status"])
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
              <p className="muted">
                Published examinations require complete information, a valid
                question set, and a valid schedule.
              </p>
              {errors.length > 0 && (
                <div role="alert" className="form-error">
                  <ul>
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button type="submit">
                <Save size={16} />
                Save changes
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => save("draft")}
              >
                Save draft
              </Button>
              <Button type="button" onClick={() => save("published")}>
                <Send size={16} />
                Publish examination
              </Button>
              {dirty && (
                <small className="unsaved-note">
                  You have unsaved changes.
                </small>
              )}
            </div>
          </section>
          <div className="editor-note">
            <ShieldCheckIcon />
            <h4>A thoughtful exam is a fair exam.</h4>
            <p>
              Check your questions, marking and schedule before publishing.
              Existing attempts keep their original question snapshot.
            </p>
          </div>
        </aside>
      </form>
      <ConfirmDialog
        open={preview}
        onOpenChange={setPreview}
        title={exam.title || "Untitled examination"}
        description="Student-facing exam preview · Nothing is saved by previewing."
        label="Close preview"
        onConfirm={() => setPreview(false)}
      >
        <p>{exam.description}</p>
        <p>
          {exam.duration} minutes · {exam.questions.length} questions ·{" "}
          {exam.questions.reduce((n, q) => n + q.marks, 0)} marks
        </p>
        <p className="pre-wrap">{exam.instructions}</p>
        <h4>Sections</h4>
        <p>{exam.sections.map((s) => s.name).join(" · ")}</p>
      </ConfirmDialog>
    </>
  );
}
function ShieldCheckIcon() {
  return <BookOpen size={26} />;
}
