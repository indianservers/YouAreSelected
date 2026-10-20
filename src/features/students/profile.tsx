"use client";
import { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  LockKeyhole,
  Save,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { usePlatform } from "@/lib/client/store";
import { date } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Input,
  PageHeader,
  StatCard,
} from "@/components/ui";
export function Profile() {
  const store = usePlatform();
  const user = store.data.users.find((u) => u.id === store.sessionId)!;
  const [profile, setProfile] = useState({
    name: user.name,
    mobile: user.mobile,
    institution: user.institution,
  });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="THE PERSON BEHIND THE PROGRESS"
        title="My profile"
        description="Keep your details up to date and make this workspace yours."
      />
      <div className="profile-banner panel">
        <Avatar name={user.name} size="large" />
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <Badge>{user.status}</Badge>
        </div>
        <span>Member since {date(user.registeredAt, "dd MMM yyyy")}</span>
      </div>
      <div className="grid two stats-grid">
        <StatCard
          label="Assigned examinations"
          value={
            store.data.assignments.filter((a) => a.userId === user.id).length
          }
          icon={<BookOpen size={18} />}
        />
        <StatCard
          label="Completed attempts"
          value={
            store.data.attempts.filter(
              (a) => a.userId === user.id && a.status === "submitted",
            ).length
          }
          icon={<CheckCircle2 size={18} />}
        />
      </div>
      <div className="grid two">
        <section className="panel">
          <div className="panel-heading">
            <UserRound size={18} />
            <h2>Personal information</h2>
          </div>
          <form
            className="panel-body form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await store.updateProfile(profile);
                toast.success("Profile updated.");
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            <Input
              label="Full name"
              value={profile.name}
              required
              minLength={2}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
            <Input
              label="Email address"
              type="email"
              value={user.email}
              disabled
            />
            <Input
              label="Mobile number"
              type="tel"
              value={profile.mobile}
              required
              pattern="[+0-9 -]{10,15}"
              onChange={(e) =>
                setProfile({ ...profile, mobile: e.target.value })
              }
            />
            <Input
              label="Institution / organization"
              value={profile.institution}
              onChange={(e) =>
                setProfile({ ...profile, institution: e.target.value })
              }
            />
            <Button type="submit">
              <Save size={16} />
              Save changes
            </Button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <LockKeyhole size={18} />
            <h2>Change password</h2>
          </div>
          <form
            className="panel-body form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (next !== confirm) throw Error("New passwords must match.");
                await store.changePassword(current, next);
                setCurrent("");
                setNext("");
                setConfirm("");
                toast.success(
                  "Password changed. Other sessions have been revoked.",
                );
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            <div className="notice">
              Choose a unique password of at least 12 characters. Changing it
              revokes other active sessions.
            </div>
            <Input
              label="Current password"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
            <Input
              label="New password"
              type="password"
              minLength={12}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              minLength={10}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <Button variant="secondary" type="submit">
              Update password
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}
