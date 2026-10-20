"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { useDemo } from "@/lib/mock/store";
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
} from "@/components/ui";
export function UsersManagement() {
  const store = useDemo();
  const [tab, setTab] = useState("All users");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<{
    ids: string[];
    status: UserStatus;
  } | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const users = store.data.users.filter(
    (u) =>
      u.role === "student" &&
      (tab === "All users" || u.status === tab.toLowerCase()),
  );
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
          onChange={setTab}
        />
        <div className="panel-body no-bottom">
          <SearchToolbar
            value={search}
            onChange={setSearch}
            placeholder="Search learners, email or mobile…"
          >
            <Button
              disabled={!selected.length}
              onClick={() => setAction({ ids: selected, status: "approved" })}
            >
              <UserCheck size={16} />
              Approve selected ({selected.length})
            </Button>
          </SearchToolbar>
        </div>
        <DataTable columns={columns} data={users} search={search} />
      </div>
      <ConfirmDialog
        open={!!action}
        onOpenChange={(v) => !v && setAction(null)}
        title={`Set ${action?.ids.length ?? 0} learner(s) to ${action?.status}?`}
        description="This updates the shared demo state. Only approved learners can start assigned examinations."
        label="Update status"
        onConfirm={() => {
          if (action) {
            store.setStatus(action.ids, action.status);
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
                    onClick={() => {
                      try {
                        store.assign(e.id, [profile.id], assigned);
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
