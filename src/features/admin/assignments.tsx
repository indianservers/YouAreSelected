"use client";
import { useNow } from "@/lib/use-now";
import { useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Save,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type { User } from "@/types/domain";
import { useDemo } from "@/lib/mock/store";
import { date } from "@/lib/utils";
import {
  Avatar,
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
import { ExamNav } from "@/features/exams/admin-exams";
const localInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export function AssignmentManagement({
  examId,
  mode = "assignments",
}: {
  examId?: string;
  mode?: "assignments" | "schedule";
}) {
  const store = useDemo();
  const [selectedExam, setSelectedExam] = useState(
    examId ?? store.data.exams[0]?.id ?? "",
  );
  const [tab, setTab] = useState<string>(
    mode === "schedule" ? "Schedule" : "Assignments",
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [remove, setRemove] = useState(false);
  const exam = store.data.exams.find((e) => e.id === selectedExam);
  if (!exam)
    return (
      <EmptyState
        title="No examination selected"
        description="Create an examination before assigning learners or scheduling it."
      />
    );
  const users = store.data.users.filter(
    (u) =>
      u.role === "student" &&
      (filter === "all" ||
        (filter === "approved" && u.status === "approved") ||
        (filter === "assigned" &&
          store.data.assignments.some(
            (a) => a.examId === exam.id && a.userId === u.id,
          ))),
  );
  const eligible = users.filter(
    (u) =>
      u.status === "approved" &&
      `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  const columns: ColumnDef<User>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          aria-label="Select all eligible learners"
          checked={
            eligible.length > 0 &&
            eligible.every((u) => selected.includes(u.id))
          }
          onChange={(e) =>
            setSelected(e.target.checked ? eligible.map((u) => u.id) : [])
          }
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={`Assign ${row.original.name}`}
          disabled={row.original.status !== "approved"}
          checked={selected.includes(row.original.id)}
          onChange={(e) =>
            setSelected(
              e.target.checked
                ? [...selected, row.original.id]
                : selected.filter((id) => id !== row.original.id),
            )
          }
        />
      ),
    },
    {
      accessorKey: "name",
      header: "Learner",
      cell: ({ row }) => (
        <div className="table-person">
          <Avatar name={row.original.name} />
          <span>
            <strong>{row.original.name}</strong>
            <small>{row.original.email}</small>
          </span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Approval",
      cell: ({ row }) => <Badge>{row.original.status}</Badge>,
    },
    {
      id: "assignment",
      header: "Assignment",
      cell: ({ row }) =>
        store.data.assignments.some(
          (a) => a.examId === exam.id && a.userId === row.original.id,
        ) ? (
          <Badge tone="blue">Assigned</Badge>
        ) : (
          <span className="muted">Not assigned</span>
        ),
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => {
        const assigned = store.data.assignments.some(
          (a) => a.examId === exam.id && a.userId === row.original.id,
        );
        return (
          <Button
            variant="secondary"
            disabled={!assigned && row.original.status !== "approved"}
            onClick={() => {
              try {
                store.assign(exam.id, [row.original.id], assigned);
                toast.success(
                  assigned ? "Assignment removed." : "Learner assigned.",
                );
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            {assigned ? (
              "Remove assignment"
            ) : (
              <>
                <UserPlus size={14} />
                Assign
              </>
            )}
          </Button>
        );
      },
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="THE RIGHT OPPORTUNITY. THE RIGHT TIME."
        title={
          tab === "Schedule"
            ? "Examination schedule"
            : "Assignments & scheduling"
        }
        description="Connect learners to their next challenge, with a clear window to take it on."
      />
      {examId && <ExamNav examId={exam.id} active={mode} />}
      <div className="panel assignment-exam-select">
        <Field label="Select examination">
          <select
            value={selectedExam}
            onChange={(e) => {
              setSelectedExam(e.target.value);
              setSelected([]);
            }}
          >
            {store.data.exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <Badge>{exam.status}</Badge>
          <span>
            {store.data.assignments.filter((a) => a.examId === exam.id).length}{" "}
            assigned learners
          </span>
        </div>
      </div>
      <Tabs items={["Assignments", "Schedule"]} value={tab} onChange={setTab} />
      {tab === "Schedule" ? (
        <ScheduleEditor key={exam.id} examId={exam.id} />
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <Users size={18} />
            <div>
              <h2>Give your learners their next step.</h2>
              <p>Only approved learners can receive new assignments.</p>
            </div>
          </div>
          <div className="panel-body no-bottom">
            <SearchToolbar
              value={search}
              onChange={setSearch}
              placeholder="Search learners…"
            >
              <select
                aria-label="Filter learners"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All learners</option>
                <option value="approved">Approved only</option>
                <option value="assigned">Assigned candidates</option>
              </select>
              <Button
                disabled={!selected.length}
                onClick={() => {
                  try {
                    store.assign(exam.id, selected);
                    toast.success(`${selected.length} learners assigned.`);
                    setSelected([]);
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                <Check size={15} />
                Assign selected ({selected.length})
              </Button>
              <Button
                variant="secondary"
                disabled={!selected.length}
                onClick={() => setRemove(true)}
              >
                Remove selected
              </Button>
            </SearchToolbar>
          </div>
          <DataTable columns={columns} data={users} search={search} />
        </section>
      )}
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title="Remove selected assignments?"
        description="These learners will no longer be eligible to start this examination."
        destructive
        label="Remove assignments"
        onConfirm={() => {
          store.assign(exam.id, selected, true);
          setSelected([]);
          toast.success("Assignments removed.");
        }}
      />
    </>
  );
}
function ScheduleEditor({ examId }: { examId: string }) {
  const now = useNow();
  const store = useDemo();
  const exam = store.data.exams.find((e) => e.id === examId)!;
  const [start, setStart] = useState(localInput(exam.schedule.start));
  const [end, setEnd] = useState(localInput(exam.schedule.end));
  const [minutes, setMinutes] = useState(exam.duration);
  const [attempts, setAttempts] = useState(exam.maxAttempts);
  const [error, setError] = useState("");
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="detail-grid">
      <section className="panel">
        <div className="panel-heading">
          <CalendarDays size={19} />
          <div>
            <h2>A clear window to do their best.</h2>
            <p>Set opening and closing times for this examination.</p>
          </div>
        </div>
        <form
          className="panel-body form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              if (
                Date.parse(end) <= Date.parse(start) ||
                !Number.isFinite(Date.parse(end)) ||
                !Number.isFinite(Date.parse(start))
              )
                throw Error("End time must be later than start time.");
              if (minutes <= 0 || attempts < 1 || !Number.isInteger(attempts))
                throw Error(
                  "Use a positive duration and integer attempt limit.",
                );
              store.saveExam({
                ...exam,
                duration: minutes,
                maxAttempts: attempts,
                schedule: {
                  start: new Date(start).toISOString(),
                  end: new Date(end).toISOString(),
                  timeZone: localZone,
                },
              });
              setError("");
              toast.success(
                "Schedule updated. Student eligibility is now in sync.",
              );
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        >
          <div className="notice">
            <Clock3 size={17} />
            <span>
              Inputs use <strong>{localZone}</strong>, the browser’s local time
              zone. Values are stored as UTC instants. The configured zone is
              saved explicitly with the schedule.
            </span>
          </div>
          <div className="grid two">
            <Input
              label="Exam opens — date & time"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
            <Input
              label="Exam closes — date & time"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </div>
          <div className="grid two">
            <Input
              label="Duration per attempt (minutes)"
              type="number"
              min="1"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              required
            />
            <Input
              label="Maximum attempts"
              type="number"
              min="1"
              step="1"
              value={attempts}
              onChange={(e) => setAttempts(Number(e.target.value))}
              required
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit">
            <Save size={16} />
            Save schedule
          </Button>
        </form>
      </section>
      <aside className="panel">
        <div className="panel-heading">
          <h3>Current availability</h3>
          <Badge>
            {now < Date.parse(exam.schedule.start)
              ? "Upcoming"
              : now >= Date.parse(exam.schedule.end)
                ? "Expired"
                : "Available"}
          </Badge>
        </div>
        <div className="panel-body">
          <dl className="receipt-details">
            <div>
              <dt>Opens</dt>
              <dd>{date(exam.schedule.start)}</dd>
            </div>
            <div>
              <dt>Closes</dt>
              <dd>{date(exam.schedule.end)}</dd>
            </div>
            <div>
              <dt>Configured time zone</dt>
              <dd>{exam.schedule.timeZone}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{exam.duration} minutes</dd>
            </div>
            <div>
              <dt>Attempt limit</dt>
              <dd>{exam.maxAttempts}</dd>
            </div>
          </dl>
          <div className="soft-note">
            The attempt deadline is the earlier of its duration deadline and the
            schedule closing time. Changes apply to new attempts; active attempt
            deadlines remain fixed.
          </div>
        </div>
      </aside>
    </div>
  );
}
