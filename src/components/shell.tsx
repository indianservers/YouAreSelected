"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  X,
  BarChart3,
  UserRound,
} from "lucide-react";
import { usePlatform } from "@/lib/client/store";
import { Avatar, Badge, LoadingSkeleton, EmptyState, Button } from "./ui";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-symbol">
        <GraduationCap size={23} />
      </span>
      <span>
        YouAre<span className="brand-accent">Selected</span>
        <small>YOUR NEXT CHAPTER STARTS HERE</small>
      </span>
    </Link>
  );
}
export function Shell({
  role,
  children,
}: {
  role: "admin" | "student";
  children: ReactNode;
}) {
  const state = usePlatform();
  const router = useRouter();
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const user = state.data.users.find((u) => u.id === state.sessionId);
  useEffect(() => {
    if (state.ready && !state.error && (!user || user.role !== role)) {
      router.replace(
        user
          ? user.role === "admin"
            ? "/admin"
            : "/student/dashboard"
          : "/login",
      );
    }
  }, [state.ready, state.error, user, role, router]);
  if (state.ready && !user && state.error)
    return (
      <EmptyState
        title="Workspace temporarily unavailable"
        description={state.error}
        action={
          <Button onClick={() => void state.load().catch(() => {})}>
            Retry loading workspace
          </Button>
        }
      />
    );
  if (!state.ready || !user || user.role !== role) return <LoadingSkeleton />;
  const admin = role === "admin";
  const nav = admin
    ? ([
        [LayoutDashboard, "Overview", "/admin"],
        [Users, "Users & approvals", "/admin/users"],
        [BookOpen, "Examinations", "/admin/exams"],
        [ListChecks, "Question bank", "/admin/questions"],
        [CalendarDays, "Assignments & scheduling", "/admin/assignments"],
        [Trophy, "Results", "/admin/results"],
        [BarChart3, "Reports", "/admin/reports"],
        [Settings, "Settings", "/admin/settings"],
      ] as const)
    : ([
        [LayoutDashboard, "Overview", "/student/dashboard"],
        [BookOpen, "My examinations", "/student/exams"],
        [Trophy, "My results", "/student/results"],
        [UserRound, "My profile", "/student/profile"],
      ] as const);
  const pending = state.data.users.filter((u) => u.status === "pending").length;
  const submitted = state.data.attempts.filter(
    (a) =>
      a.userId === user.id &&
      a.status === "submitted" &&
      !a.publication.released,
  ).length;
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <button
          className="mobile-overlay"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-only icon-button"
            aria-label="Close menu"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-icon">
            {admin ? <ShieldCheck size={18} /> : <GraduationCap size={18} />}
          </span>
          <div>
            <strong>{admin ? "Admin workspace" : "Student workspace"}</strong>
            <small>{state.data.settings.organization}</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {nav.map(([Icon, label, href]) => {
            const active =
              href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link ${active ? "active" : ""}`}
                onClick={() => setMobile(false)}
                title={label}
              >
                <Icon size={19} />
                <span>{label}</span>
                {label === "Users & approvals" && pending > 0 && (
                  <b>{pending}</b>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-box">
            <span className="support-orbit">
              <LifeBuoy size={20} />
            </span>
            <strong>A little help goes a long way.</strong>
            <p>Questions about your account?</p>
            <a href={`mailto:${state.data.settings.supportEmail}`}>
              Contact support <ArrowUpRight size={14} />
            </a>
          </div>
          <button
            className="nav-link collapse-control"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft size={18} />
            <span>
              {collapsed ? "Expand navigation" : "Collapse navigation"}
            </span>
          </button>
          <div className="sidebar-profile">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <small>{admin ? "Administrator" : "Aspiring achiever"}</small>
            </div>
            <button
              aria-label="Log out"
              title="Log out"
              className="icon-button"
              onClick={async () => {
                await state.logout();
                router.push("/login");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="app-header">
          <div className="header-left">
            <button
              className="mobile-only icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {nav.find(([, , href]) =>
                  href === "/admin"
                    ? pathname === href
                    : pathname.startsWith(href),
                )?.[1] ?? "Examination"}
              </strong>
            </span>
          </div>
          <div className="header-right">
            <span className="demo-label">
              <span />
              Connected workspace
            </span>
            <form
              className="header-search"
              action={admin ? "/admin/exams" : "/student/exams"}
            >
              <Search size={16} />
              <input
                name="q"
                aria-label="Search examinations"
                placeholder="Search examinations…"
              />
              <kbd>↵</kbd>
            </form>
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                <i />
              </button>
              {notifications && (
                <div className="notification-menu">
                  <strong>Your updates</strong>
                  <p>
                    {admin
                      ? `${pending} registrations await your review.`
                      : submitted
                        ? `${submitted} submitted results await publication.`
                        : "Your assigned examinations are ready to explore."}
                  </p>
                  <Link
                    onClick={() => setNotifications(false)}
                    href={admin ? "/admin/users" : "/student/results"}
                  >
                    View updates <ArrowUpRight size={14} />
                  </Link>
                  <small>Updates from your examination workspace.</small>
                </div>
              )}
            </div>
            <Link href={admin ? "/admin/settings" : "/student/profile"}>
              <Avatar name={user.name} />
            </Link>
          </div>
        </header>
        <main
          id="main-content"
          className={`main-content ${pathname.endsWith("/attempt") ? "attempt-content" : ""}`}
        >
          {user.status !== "approved" && (
            <div className="notice">
              <Badge>{user.status}</Badge> Your account is awaiting
              administrator approval. Examination access is restricted.
            </div>
          )}
          {state.error && (
            <div className="notice" role="alert">
              {state.error}
              <button
                onClick={() =>
                  void state
                    .load()
                    .then(() => state.retrySaves())
                    .catch(() => {})
                }
              >
                Retry connection & saves
              </button>
            </div>
          )}
          {children}
          <footer className="app-footer">
            <span>© {new Date().getFullYear()} YouAreSelected</span>
            <span>A little practice. A bigger future.</span>
            <span>Secure examination workspace</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
