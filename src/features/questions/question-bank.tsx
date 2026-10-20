"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Copy,
  Eye,
  FileQuestion,
  Italic,
  Plus,
  Save,
  Sigma,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/lib/mock/store";
import { blankQuestion, id } from "@/lib/mock/seed";
import { questionErrors } from "@/lib/rules";
import type { Question } from "@/types/domain";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SearchToolbar,
} from "@/components/ui";
import { MathText } from "@/components/math-text";
import { ExamNav } from "@/features/exams/admin-exams";
export function QuestionBank({ examId }: { examId?: string }) {
  const store = useDemo();
  const [selectedExam, setSelectedExam] = useState(
    examId ?? store.data.exams[0]?.id ?? "",
  );
  const exam = store.data.exams.find((e) => e.id === selectedExam);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [editing, setEditing] = useState<Question | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  if (!exam)
    return (
      <EmptyState
        title="Create your first examination"
        description="Questions belong to an examination. Create an exam draft to get started."
      />
    );
  const update = (patch: Partial<Question>) => {
    setEditing((q) => (q ? { ...q, ...patch } : q));
    setDirty(true);
  };
  const persist = (questions: Question[]) => {
    try {
      store.saveQuestions(exam.id, questions);
      toast.success("Question bank updated.");
      return true;
    } catch (error) {
      toast.error((error as Error).message);
      return false;
    }
  };
  const save = () => {
    if (!editing) return;
    const issues = questionErrors(editing);
    setErrors(issues);
    if (issues.length) return;
    const list = exam.questions.some((q) => q.id === editing.id)
      ? exam.questions.map((q) => (q.id === editing.id ? editing : q))
      : [...exam.questions, editing];
    if (persist(list)) {
      setEditing(null);
      setDirty(false);
    }
  };
  const format = (kind: string) => {
    if (!editing) return;
    const el = textarea.current;
    const start = el?.selectionStart ?? 0,
      end = el?.selectionEnd ?? 0;
    const selection =
      editing.text.slice(start, end) ||
      (kind === "$" ? "x^2 + y^2 = z^2" : "text");
    update({
      text:
        editing.text.slice(0, start) +
        kind +
        selection +
        kind +
        editing.text.slice(end),
    });
  };
  const questions = exam.questions.filter(
    (q) =>
      (section === "all" || q.sectionId === section) &&
      (difficulty === "all" || q.difficulty === difficulty) &&
      `${q.text} ${q.topic} ${q.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="GREAT QUESTIONS OPEN MINDS"
        title="Question bank"
        description="Craft clear questions. Build a better assessment."
        action={
          <Button
            onClick={() => {
              setEditing({
                ...blankQuestion(exam.sections[0]?.id),
                marks: exam.defaultMarks,
                negative: exam.defaultNegative,
              });
              setErrors([]);
              setDirty(false);
            }}
          >
            <Plus size={16} />
            Add question
          </Button>
        }
      />
      {examId && <ExamNav examId={exam.id} active="questions" />}
      <div className="panel question-toolbar">
        <Field label="Examination">
          <select
            value={selectedExam}
            onChange={(e) => {
              setSelectedExam(e.target.value);
              setSection("all");
              setEditing(null);
              setDirty(false);
            }}
          >
            {store.data.exams.map((e) => (
              <option value={e.id} key={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Section">
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="all">All sections</option>
            {exam.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Difficulty">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="all">All difficulties</option>
            {["Easy", "Medium", "Hard"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className={`question-bank-layout ${editing ? "with-editor" : ""}`}>
        <section className="panel">
          <div className="panel-heading">
            <h2>
              {exam.title}
              <span className="count-bubble">{exam.questions.length}</span>
            </h2>
            <Badge>{exam.status}</Badge>
          </div>
          <div className="panel-body no-bottom">
            <SearchToolbar
              value={search}
              onChange={setSearch}
              placeholder="Search questions, topics or tags…"
            />
          </div>
          {questions.length ? (
            questions.map((q) => {
              const index = exam.questions.findIndex(
                (question) => question.id === q.id,
              );
              return (
                <article
                  key={q.id}
                  className={`bank-question ${editing?.id === q.id ? "selected" : ""}`}
                >
                  <div className="bank-question-top">
                    <span>
                      QUESTION {index + 1} ·{" "}
                      {exam.sections.find((s) => s.id === q.sectionId)?.name}
                    </span>
                    <Badge
                      tone={
                        q.difficulty === "Easy"
                          ? "green"
                          : q.difficulty === "Hard"
                            ? "red"
                            : "amber"
                      }
                    >
                      {q.difficulty}
                    </Badge>
                  </div>
                  <button
                    className="question-edit-trigger"
                    onClick={() => {
                      setEditing(structuredClone(q));
                      setErrors([]);
                      setDirty(false);
                    }}
                  >
                    <MathText text={q.text} />
                  </button>
                  <div className="bank-options">
                    {q.options.map((o) => (
                      <div
                        key={o.id}
                        className={
                          o.id === q.correctOptionId ? "bank-correct" : ""
                        }
                      >
                        <span>{o.id === q.correctOptionId ? "●" : "○"}</span>
                        <MathText text={o.text} />
                      </div>
                    ))}
                  </div>
                  <div className="bank-question-footer">
                    <span>
                      {q.topic} · +{q.marks} / −{q.negative}
                    </span>
                    <div className="table-actions">
                      <button
                        title="Move up"
                        aria-label={`Move question ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => {
                          const copy = [...exam.questions];
                          [copy[index - 1], copy[index]] = [
                            copy[index],
                            copy[index - 1],
                          ];
                          persist(copy);
                        }}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        title="Move down"
                        aria-label={`Move question ${index + 1} down`}
                        disabled={index === exam.questions.length - 1}
                        onClick={() => {
                          const copy = [...exam.questions];
                          [copy[index + 1], copy[index]] = [
                            copy[index],
                            copy[index + 1],
                          ];
                          persist(copy);
                        }}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        title="Duplicate question"
                        aria-label={`Duplicate question ${index + 1}`}
                        onClick={() =>
                          persist([
                            ...exam.questions,
                            { ...structuredClone(q), id: id() },
                          ])
                        }
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        title="Delete question"
                        aria-label={`Delete question ${index + 1}`}
                        onClick={() => setRemove(q.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState
              title="Make room for a good question"
              description="Add a question or adjust your filters to find an existing one."
            />
          )}
        </section>
        {editing && (
          <aside className="panel question-editor">
            <div className="panel-heading">
              <FileQuestion size={18} />
              <h2>
                {exam.questions.some((q) => q.id === editing.id)
                  ? "Edit question"
                  : "A new question"}
              </h2>
              <Badge tone="blue">Single correct MCQ</Badge>
            </div>
            <form
              className="panel-body form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <Field label="Section">
                <select
                  value={editing.sectionId}
                  onChange={(e) => update({ sectionId: e.target.value })}
                >
                  {exam.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <label className="field" htmlFor="question-text">
                  <span>Question text *</span>
                </label>
                <div className="rich-toolbar">
                  <button
                    type="button"
                    title="Bold selected text"
                    aria-label="Bold selected text"
                    onClick={() => format("**")}
                  >
                    <Bold size={15} />
                  </button>
                  <button
                    type="button"
                    title="Italic selected text"
                    aria-label="Italic selected text"
                    onClick={() => format("*")}
                  >
                    <Italic size={15} />
                  </button>
                  <button
                    type="button"
                    title="Insert math expression"
                    aria-label="Insert math expression"
                    onClick={() => format("$")}
                  >
                    <Sigma size={16} />
                  </button>
                  <span>Markdown + LaTeX</span>
                </div>
                <textarea
                  id="question-text"
                  ref={textarea}
                  rows={4}
                  value={editing.text}
                  onChange={(e) => update({ text: e.target.value })}
                  required
                />
              </div>
              <Input
                label="Image URL (optional, HTTPS)"
                type="url"
                value={editing.image ?? ""}
                onChange={(e) => update({ image: e.target.value })}
              />
              <div className="options-editor">
                <div className="section-heading">
                  <h4>Answer choices</h4>
                  <small>Select one correct answer</small>
                </div>
                {editing.options.map((o, i) => (
                  <div
                    className={`option-editor ${editing.correctOptionId === o.id ? "correct" : ""}`}
                    key={o.id}
                  >
                    <input
                      type="radio"
                      name="correct-answer"
                      aria-label={`Option ${String.fromCharCode(65 + i)} is correct`}
                      checked={editing.correctOptionId === o.id}
                      onChange={() => update({ correctOptionId: o.id })}
                    />
                    <input
                      aria-label={`Option ${String.fromCharCode(65 + i)} text`}
                      value={o.text}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      onChange={(e) =>
                        update({
                          options: editing.options.map((option) =>
                            option.id === o.id
                              ? { ...option, text: e.target.value }
                              : option,
                          ),
                        })
                      }
                      required
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove option ${String.fromCharCode(65 + i)}`}
                      disabled={editing.options.length <= 2}
                      onClick={() =>
                        update({
                          options: editing.options.filter(
                            (option) => option.id !== o.id,
                          ),
                          correctOptionId:
                            editing.correctOptionId === o.id
                              ? ""
                              : editing.correctOptionId,
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    update({
                      options: [...editing.options, { id: id(), text: "" }],
                    })
                  }
                >
                  <Plus size={14} />
                  Add another option
                </Button>
              </div>
              <div className="grid three">
                <Input
                  label="Positive marks"
                  type="number"
                  min="0.01"
                  step="any"
                  value={editing.marks}
                  onChange={(e) => update({ marks: Number(e.target.value) })}
                />
                <Input
                  label="Negative marks"
                  type="number"
                  min="0"
                  step="any"
                  value={editing.negative}
                  onChange={(e) => update({ negative: Number(e.target.value) })}
                />
                <Field label="Difficulty">
                  <select
                    value={editing.difficulty}
                    onChange={(e) =>
                      update({
                        difficulty: e.target.value as Question["difficulty"],
                      })
                    }
                  >
                    {["Easy", "Medium", "Hard"].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Input
                label="Topic"
                value={editing.topic}
                onChange={(e) => update({ topic: e.target.value })}
              />
              <Input
                label="Tags (comma separated)"
                value={editing.tags.join(", ")}
                onChange={(e) =>
                  update({
                    tags: e.target.value.split(",").map((t) => t.trim()),
                  })
                }
              />
              <Field label="Explanation">
                <textarea
                  rows={3}
                  value={editing.explanation}
                  onChange={(e) => update({ explanation: e.target.value })}
                />
              </Field>
              <div className="question-live-preview">
                <span className="eyebrow">
                  <Eye size={13} />
                  STUDENT PREVIEW · ANSWER KEY HIDDEN
                </span>
                <h3>
                  <MathText
                    text={editing.text || "Your question will appear here."}
                  />
                </h3>
                {editing.image && /^https:\/\//.test(editing.image) && (
                  <Image
                    width={640}
                    height={300}
                    unoptimized
                    className="question-image"
                    src={editing.image}
                    alt="Question preview"
                  />
                )}
                {editing.options.map((o, i) => (
                  <div className="preview-option" key={o.id}>
                    <span>{String.fromCharCode(65 + i)}</span>
                    <MathText text={o.text || "Answer choice"} />
                  </div>
                ))}
              </div>
              {errors.length > 0 && (
                <div className="form-error" role="alert">
                  {errors.join(" ")}
                </div>
              )}
              <div className="button-row">
                <Button type="submit">
                  <Save size={16} />
                  Save question
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setDirty(false);
                  }}
                >
                  Close editor
                </Button>
              </div>
              {dirty && (
                <small className="unsaved-note">
                  You have unsaved changes.
                </small>
              )}
            </form>
          </aside>
        )}
      </div>
      <ConfirmDialog
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title="Delete this question?"
        description="This removes it from future attempts. Existing attempt snapshots are preserved. Published exams must retain a valid question set."
        destructive
        label="Delete question"
        onConfirm={() => {
          if (persist(exam.questions.filter((q) => q.id !== remove))) {
            if (editing?.id === remove) setEditing(null);
          }
        }}
      />
    </>
  );
}
