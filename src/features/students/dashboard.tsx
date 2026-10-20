"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Flame,
  GraduationCap,
  LayoutGrid,
  List,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { useDemo } from "@/lib/mock/store";
import { examStatus } from "@/lib/rules";
import { date } from "@/lib/utils";
import type { Exam } from "@/types/domain";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  SearchToolbar,
  StatCard,
  Tabs,
  TextLink,
} from "@/components/ui";
export function ExamCard({ exam, index = 0 }: { exam: Exam; index?: number }) {
  const { data, sessionId } = useDemo();
  const status = examStatus(data, exam, sessionId ?? "");
  return (
    <motion.article
      className="exam-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.035 }}
    >
      <div className="exam-card-top">
        <span
          className={`exam-category-icon ${["blue", "violet", "teal", "amber"][index % 4]}`}
        >
          <BookOpen size={23} />
        </span>
        <Badge>{status}</Badge>
      </div>
      <div className="exam-card-body">
        <span className="exam-category">{exam.category}</span>
        <h3>
          <Link href={`/student/exams/${exam.id}`}>{exam.title}</Link>
        </h3>
        <p>{exam.description}</p>
      </div>
      <div className="exam-meta">
        <span>
          <FileQuestion size={14} />
          {exam.questions.length} questions
        </span>
        <span>
          <Clock3 size={14} />
          {exam.duration} min
        </span>
        <span>
          <Target size={14} />
          {exam.questions.reduce((n, q) => n + q.marks, 0)} marks
        </span>
      </div>
      <div className="exam-schedule">
        <CalendarDays size={15} />
        <div>
          <span>
            {status === "Upcoming" ? "Opens" : "Window opened"}{" "}
            {date(exam.schedule.start, "dd MMM, hh:mm a")}
          </span>
          <small>
            Closes {date(exam.schedule.end, "dd MMM, hh:mm a")} · local time
          </small>
        </div>
      </div>
      <div className="exam-card-footer">
        <span>
          {exam.maxAttempts} attempt{exam.maxAttempts !== 1 ? "s" : ""}{" "}
          available
        </span>
        <Link href={`/student/exams/${exam.id}`} className="exam-card-cta">
          {status === "In Progress"
            ? "Resume exam"
            : status === "Results Published"
              ? "View details"
              : status === "Available"
                ? "View & start"
                : "View details"}
          <ArrowRight size={16} />
        </Link>
      </div>
    </motion.article>
  );
}
export function StudentDashboard({ listOnly = false }: { listOnly?: boolean }) {
  const { data, sessionId } = useDemo();
  const user = data.users.find((u) => u.id === sessionId)!;
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState("All exams");
  const [view, setView] = useState("grid");
  const assigned = data.exams.filter((e) =>
    data.assignments.some((a) => a.examId === e.id && a.userId === sessionId),
  );
  const attempts = data.attempts.filter(
    (a) => a.userId === sessionId && a.status === "submitted",
  );
  const released = attempts.filter((a) => a.publication.released);
  const average = released.length
    ? Math.round(
        released.reduce((sum, a) => sum + (a.result?.percentage ?? 0), 0) /
          released.length,
      )
    : 0;
  const upcoming = assigned.filter(
    (e) => examStatus(data, e, user.id) === "Upcoming",
  );
  const available = assigned.filter(
    (e) => examStatus(data, e, user.id) === "Available",
  );
  const exams = assigned.filter((e) => {
    const status = examStatus(data, e, user.id);
    return (
      `${e.title} ${e.category}`.toLowerCase().includes(search.toLowerCase()) &&
      (tab === "All exams" ||
        (tab === "Upcoming" && status === "Upcoming") ||
        (tab === "Available now" &&
          ["Available", "In Progress"].includes(status)) ||
        (tab === "Completed" &&
          ["Results Pending", "Results Published"].includes(status)))
    );
  });
  return (
    <>
      <PageHeader
        eyebrow={
          listOnly
            ? "YOUR PREPARATION, YOUR PACE"
            : date(new Date().toISOString(), "EEEE, dd MMMM yyyy").toUpperCase()
        }
        title={
          listOnly
            ? "My examinations"
            : `Let’s make progress, ${user.name.split(" ")[0]}.`
        }
        description={
          listOnly
            ? "Every assessment is an opportunity to move one step closer."
            : "A fresh opportunity to learn, practice, and get closer to your goals."
        }
        action={
          <Button variant="secondary" asChild>
            <Link href="/student/results">
              <TrendingUp size={16} />
              View my progress <ArrowUpRight size={15} />
            </Link>
          </Button>
        }
      />
      {!listOnly && (
        <>
          <section className="welcome-banner">
            <div>
              <span className="banner-kicker">
                <Sparkles size={14} />
                YOUR NEXT CHAPTER IS TAKING SHAPE
              </span>
              <h2>
                Big ambitions.
                <br />
                <span>One focused step at a time.</span>
              </h2>
              <p>
                {available.length
                  ? `${available.length} examinations are ready for you. Let’s put your preparation to work.`
                  : "Keep your momentum. Explore your upcoming examinations."}
              </p>
              <Link href="/student/exams">
                Explore your exams <ArrowRight size={16} />
              </Link>
            </div>
            <div className="banner-art" aria-hidden="true">
              <div className="banner-orbit" />
              <span className="banner-book">
                <GraduationCap size={62} strokeWidth={1.2} />
              </span>
              <span className="banner-mini">
                <CheckCircle2 size={18} />A little better, every day.
              </span>
              <span className="banner-star">✦</span>
            </div>
          </section>
          <div className="grid four stats-grid">
            <StatCard
              label="Assigned exams"
              value={assigned.length.toString().padStart(2, "0")}
              detail="Your opportunities to grow"
              icon={<BookOpen size={18} />}
            />
            <StatCard
              label="Upcoming exams"
              value={upcoming.length.toString().padStart(2, "0")}
              detail="Something to look forward to"
              icon={<CalendarDays size={18} />}
            />
            <StatCard
              label="Completed exams"
              value={attempts.length.toString().padStart(2, "0")}
              detail="Every attempt counts"
              icon={<CheckCircle2 size={18} />}
            />
            <StatCard
              label="Average score"
              value={released.length ? `${average}%` : "—"}
              detail={
                released.length
                  ? "Across published results"
                  : "Your story is just beginning"
              }
              icon={<TrendingUp size={18} />}
            />
          </div>
        </>
      )}
      <div className="student-main-grid">
        <section>
          <div className="section-heading">
            <div>
              <h2>
                {listOnly ? "Your exam library" : "Your examinations"}
                <span className="count-bubble">{assigned.length}</span>
              </h2>
              <p>Find your focus. Take your next step.</p>
            </div>
            {!listOnly && (
              <TextLink href="/student/exams">View all exams</TextLink>
            )}
          </div>
          <div className="exam-filter-row">
            <Tabs
              items={["All exams", "Upcoming", "Available now", "Completed"]}
              value={tab}
              onChange={setTab}
            />
            <div className="view-toggle">
              <button
                aria-label="Grid view"
                className={view === "grid" ? "active" : ""}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                aria-label="List view"
                className={view === "list" ? "active" : ""}
                onClick={() => setView("list")}
              >
                <List size={16} />
              </button>
            </div>
          </div>
          <SearchToolbar
            value={search}
            onChange={setSearch}
            placeholder="Search your examinations…"
          />
          <div className={view === "grid" ? "exam-grid" : "exam-list"}>
            {exams.map((exam, i) => (
              <ExamCard key={exam.id} exam={exam} index={i} />
            ))}
          </div>
          {!exams.length && (
            <EmptyState
              title="A little breathing room"
              description="No examinations match this view. Try another tab, or ask your administrator for an assignment."
            />
          )}
        </section>
        {!listOnly && (
          <aside className="student-aside">
            <div className="side-panel">
              <div className="section-heading">
                <h3>Coming up next</h3>
                <CalendarDays size={17} />
              </div>
              {upcoming.length ? (
                upcoming.map((e) => (
                  <Link
                    className="upcoming-item"
                    key={e.id}
                    href={`/student/exams/${e.id}`}
                  >
                    <span className="calendar-tile">
                      <small>{date(e.schedule.start, "MMM")}</small>
                      <strong>{date(e.schedule.start, "dd")}</strong>
                    </span>
                    <div>
                      <strong>{e.title}</strong>
                      <small>
                        {date(e.schedule.start, "hh:mm a")} · {e.duration} min
                      </small>
                    </div>
                    <ArrowUpRight size={15} />
                  </Link>
                ))
              ) : (
                <p className="muted">
                  No upcoming examinations. You’re all caught up.
                </p>
              )}
              <div className="soft-note">
                <Clock3 size={15} />
                <span>
                  All times are shown in your browser’s local time zone.
                </span>
              </div>
            </div>
            <div className="motivation-card">
              <span className="motivation-icon">
                <Flame size={23} />
              </span>
              <span className="eyebrow">A MOMENT OF ENCOURAGEMENT</span>
              <h3>
                Consistency beats
                <br />
                perfection.
              </h3>
              <p>
                Some days, progress is a score. Other days, it’s simply showing
                up. Both count.
              </p>
              <div className="motivation-rule" />
              <span>You’re building something good.</span>
            </div>
            <div className="side-panel">
              <span className="quick-tip">
                <Trophy size={17} />
                MAKE THE MOST OF YOUR ATTEMPT
              </span>
              <ul className="tips-list">
                <li>Read the instructions before starting.</li>
                <li>Keep an eye on negative marking.</li>
                <li>Mark tricky questions for review.</li>
                <li>Leave a moment to check your answers.</li>
              </ul>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
