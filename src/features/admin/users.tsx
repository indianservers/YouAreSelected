"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { usePlatform, request } from "@/lib/client/store";
import type { User, UserStatus } from "@/types/domain";
import { date } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  PageHeader,
  SearchToolbar,
  Tabs,
  Input,
} from "@/components/ui";
export function UsersManagement() {
  const store = usePlatform();
  const [tab, setTab] = useState("All users");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<{
    ids: string[];
    status: UserStatus;
  } | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState("registeredAt");
  const [desc, setDesc] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: "10",
        search,
        status: tab === "All users" ? "all" : tab.toLowerCase(),
        sort,
        desc: String(desc),
      });
      void request<{ users: User[]; total: number }>(
        `/api/platform/users?${query}`,
      )
        .then((r) => {
          if (!cancelled) {
            setUsers(r.users);
            setTotal(r.total);
            setLoadError("");
          }
        })
        .catch((e) => {
          if (!cancelled) setLoadError(e.message);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page, search, tab, sort, desc, store.data.users]);
  const matchingUsers = users.filter((u) =>
    `${u.name} ${u.email} ${u.mobile} ${u.status} ${u.registeredAt}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const columns: ColumnDef<User>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          aria-label="Select matching users"
          checked={
            matchingUsers.length > 0 &&
            matchingUsers.every((u) => selected.includes(u.id))
          }
          onChange={(e) =>
            setSelected(e.target.checked ? matchingUsers.map((u) => u.id) : [])
          }
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.original.name}`}
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
        <button
          className="table-person"
          onClick={() => setProfile(row.original)}
        >
          <Avatar name={row.original.name} />
          <span>
            <strong>{row.original.name}</strong>
            <small>{row.original.email}</small>
          </span>
        </button>
      ),
    },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "mobile", header: "Mobile" },
    {
      accessorKey: "registeredAt",
      header: "Registered",
      cell: ({ row }) => date(row.original.registeredAt, "dd MMM yyyy"),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge>{row.original.status}</Badge>,
    },
    {
      id: "assigned",
      header: "Assigned exams",
      accessorFn: (u) =>
        store.data.assignments.filter((a) => a.userId === u.id).length,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <select
          aria-label={`Change status for ${row.original.name}`}
          value=""
          onChange={(e) => {
            if (e.target.value)
              setAction({
                ids: [row.original.id],
                status: e.target.value as UserStatus,
              });
          }}
        >
          <option value="">Manage user</option>
          <option value="approved">Approve / Reactivate</option>
          <option value="rejected">Reject</option>
          <option value="suspended">Suspend</option>
          <option value="pending">Return to pending</option>
        </select>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="OPENING DOORS TO OPPORTUNITY"
        title="Learners & approvals"
        description="A thoughtful review today can be someone’s first step forward."
        action={
          <Badge tone="blue">
            {store.data.users.filter((u) => u.role === "student").length}{" "}
            learners
          </Badge>
        }
      />
      <div className="panel">
        <Tabs
          items={["All users", "Pending", "Approved", "Rejected", "Suspended"]}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
            setSelected([]);
          }}
        />
        <div className="panel-body no-bottom">
          <SearchToolbar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search learners, email or mobile…"
          >
            <select
              aria-label="Sort learners"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="registeredAt">Registration date</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="status">Status</option>
            </select>
            <Button variant="secondary" onClick={() => setDesc(!desc)}>
              {desc ? "Descending" : "Ascending"}
            </Button>
            <Button
              disabled={!selected.length}
              onClick={() => setAction({ ids: selected, status: "approved" })}
            >
              <UserCheck size={16} />
              Approve selected ({selected.length})
            </Button>
          </SearchToolbar>
        </div>
        {loadError && (
          <p className="form-error" role="alert">
            {loadError}
          </p>
        )}
        <DataTable
          columns={columns}
          data={users}
          server={{ page, pageSize: 10, total, onPage: setPage }}
        />
      </div>
      <ConfirmDialog
        open={!!action}
        onOpenChange={(v) => !v && setAction(null)}
        title={`Set ${action?.ids.length ?? 0} learner(s) to ${action?.status}?`}
        description="This change is stored in the database and audited. Only approved learners can start assigned examinations."
        label="Update status"
        onConfirm={async () => {
          if (action) {
            await store.setStatus(action.ids, action.status);
            toast.success("Learner status updated.");
            setSelected([]);
          }
        }}
      />
      <ConfirmDialog
        open={!!profile}
        onOpenChange={(v) => !v && setProfile(null)}
        title={profile?.name ?? "Learner profile"}
        description={profile?.email}
        label="Done"
        onConfirm={() => setProfile(null)}
      >
        {profile && (
          <div className="profile-dialog">
            <Badge>{profile.status}</Badge>
            <p>
              {profile.mobile} · {profile.institution || "Independent learner"}
            </p>
            <p>Registered {date(profile.registeredAt)}</p>
            <div className="form-stack">
              <Input
                label="Learner full name"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
              <Input
                label="Learner mobile"
                value={profile.mobile}
                onChange={(e) =>
                  setProfile({ ...profile, mobile: e.target.value })
                }
              />
              <Input
                label="Learner institution"
                value={profile.institution}
                onChange={(e) =>
                  setProfile({ ...profile, institution: e.target.value })
                }
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await store.updateProfile(
                      {
                        name: profile.name,
                        mobile: profile.mobile,
                        institution: profile.institution,
                      },
                      profile.id,
                    );
                    toast.success("Learner profile updated.");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Save learner details
              </Button>
            </div>
            <h4>Exam assignments</h4>
            {store.data.exams.map((e) => {
              const assigned = store.data.assignments.some(
                (a) => a.examId === e.id && a.userId === profile.id,
              );
              return (
                <div className="assignment-line" key={e.id}>
                  <Link href={`/admin/exams/${e.id}/assignments`}>
                    {e.title}
                  </Link>
                  <Button
                    variant="secondary"
                    disabled={!assigned && profile.status !== "approved"}
                    onClick={async () => {
                      try {
                        await store.assign(e.id, [profile.id], assigned);
                        toast.success(
                          assigned ? "Assignment removed." : "Exam assigned.",
                        );
                      } catch (error) {
                        toast.error((error as Error).message);
                      }
                    }}
                  >
                    {assigned ? (
                      "Remove"
                    ) : (
                      <>
                        <Check size={13} />
                        Assign
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
