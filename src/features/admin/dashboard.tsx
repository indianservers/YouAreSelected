"use client";
import { useNow } from "@/lib/use-now";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileQuestion,
  Plus,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { usePlatform } from "@/lib/client/store";
import { date, examDate } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  StatCard,
  TextLink,
} from "@/components/ui";
import { PerformanceChart } from "@/components/charts";
export function AdminDashboard() {
  const now = useNow();
  const { data } = usePlatform();
  const users = data.users.filter((u) => u.role === "student");
  const pending = users.filter((u) => u.status === "pending");
  const submitted = data.attempts.filter((a) => a.status === "submitted");
  const active = data.exams.filter(
    (e) =>
      e.status === "published" &&
      Date.parse(e.schedule.start) <= now &&
      Date.parse(e.schedule.end) > now,
  );
  const participation =
    data.metrics?.participation ??
    data.exams.map((e) => ({
      name: e.code,
      value: data.attempts.filter((a) => a.examId === e.id).length,
    }));
  return (
    <>
      <PageHeader
        eyebrow="A CLEAR VIEW OF WHAT’S NEXT"
        title="Good things are taking shape."
        description="Your examinations, learners, and progress — all in one place."
        action={
          <Button asChild>
            <Link href="/admin/exams/new">
              <Plus size={16} />
              Create examination
            </Link>
          </Button>
        }
      />
      <div className="admin-welcome">
        <span className="admin-welcome-icon">
          <ClipboardCheck size={25} />
        </span>
        <div>
          <h3>Your workspace is ready for the next big step.</h3>
          <p>
            {pending.length} learners are waiting for approval. A small action
            can open a new opportunity.
          </p>
        </div>
        <Link href="/admin/users">
          Review approvals <ArrowRight size={16} />
        </Link>
      </div>
      <div className="grid three stats-grid">
        <StatCard
          label="Total learners"
          value={data.metrics?.totalUsers ?? users.length}
          detail="Registered learners"
          icon={<Users size={18} />}
        />
        <StatCard
          label="Pending approvals"
          value={data.metrics?.pendingUsers ?? pending.length}
          detail="Ready for your review"
          icon={<Clock3 size={18} />}
        />
        <StatCard
          label="Approved learners"
          value={
            data.metrics?.approvedUsers ??
            users.filter((u) => u.status === "approved").length
          }
          detail="Eligible for exam assignments"
          icon={<UserCheck size={18} />}
        />
        <StatCard
          label="Total examinations"
          value={data.metrics?.totalExams ?? data.exams.length}
          icon={<BookOpen size={18} />}
        />
        <StatCard
          label="Active examinations"
          value={data.metrics?.activeExams ?? active.length}
          detail="Published and within their window"
          icon={<CalendarDays size={18} />}
        />
        <StatCard
          label="Submitted attempts"
          value={data.metrics?.submittedAttempts ?? submitted.length}
          icon={<CheckCircle2 size={18} />}
        />
      </div>
      <div className="admin-chart-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Participation at a glance</h2>
              <p>Started attempts by examination</p>
            </div>
            <Badge tone="blue">Live database data</Badge>
          </div>
          <div className="panel-body">
            <PerformanceChart data={participation} />
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Exam status</h2>
            <BookOpen size={18} />
          </div>
          <div className="panel-body status-breakdown">
            {(["published", "draft", "archived"] as const).map((s, i) => {
              const count = data.exams.filter((e) => e.status === s).length;
              return (
                <div key={s}>
                  <div>
                    <Badge tone={["green", "amber", "blue"][i]}>{s}</Badge>
                    <strong>{count}</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{
                        width: `${data.exams.length ? (count / data.exams.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="muted">
              Keep drafts private until the question set and schedule are ready.
            </p>
          </div>
        </section>
      </div>
      <div className="quick-actions panel">
        <h3>Make something happen</h3>
        {[
          [Plus, "Create exam", "/admin/exams/new"],
          [UserCheck, "Approve learners", "/admin/users"],
          [FileQuestion, "Add questions", "/admin/questions"],
          [Users, "Assign students", "/admin/assignments"],
          [Trophy, "Review results", "/admin/results"],
        ].map(([Icon, label, href]) => (
          <Link key={String(href)} href={String(href)}>
            <Icon size={19} />
            {String(label)}
            <ArrowUpRight size={15} />
          </Link>
        ))}
      </div>
      <div className="grid two mt">
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent registrations</h2>
            <TextLink href="/admin/users">All users</TextLink>
          </div>
          {[...users]
            .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
            .slice(0, 4)
            .map((u) => (
              <div className="person-row" key={u.id}>
                <Avatar name={u.name} />
                <div>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </div>
                <Badge>{u.status}</Badge>
              </div>
            ))}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent submissions</h2>
            <TextLink href="/admin/results">View results</TextLink>
          </div>
          {submitted.length ? (
            submitted
              .slice(-4)
              .reverse()
              .map((a) => (
                <Link
                  className="person-row"
                  key={a.id}
                  href={`/admin/results/${a.examId}?attempt=${a.id}`}
                >
                  <span className="exam-category-icon violet">
                    <CheckCircle2 size={18} />
                  </span>
                  <div>
                    <strong>
                      {data.users.find((u) => u.id === a.userId)?.name}
                    </strong>
                    <small>
                      {data.exams.find((e) => e.id === a.examId)?.title} ·{" "}
                      {date(a.submittedAt!, "dd MMM")}
                    </small>
                  </div>
                  <Badge>
                    {a.publication.released ? "Published" : "Pending"}
                  </Badge>
                </Link>
              ))
          ) : (
            <EmptyState
              title="Ready for the first submission"
              description="Submitted attempts will appear here as learners finish their examinations."
            />
          )}
        </section>
      </div>
      <section className="panel mt">
        <div className="panel-heading">
          <h2>Upcoming examinations</h2>
          <TextLink href="/admin/exams">Manage exams</TextLink>
        </div>
        {data.exams
          .filter((e) => Date.parse(e.schedule.start) > now)
          .map((e) => (
            <Link
              key={e.id}
              className="result-row"
              href={`/admin/exams/${e.id}/schedule`}
            >
              <CalendarDays size={21} />
              <div>
                <strong>{e.title}</strong>
                <small>
                  {examDate(e.schedule.start, e.schedule.timeZone)} ·{" "}
                  {e.schedule.timeZone}
                </small>
              </div>
              <Badge>Upcoming</Badge>
              <ArrowRight size={16} />
            </Link>
          ))}
      </section>
    </>
  );
}
