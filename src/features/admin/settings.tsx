"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/lib/mock/store";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  PageHeader,
} from "@/components/ui";
export function AdminSettings() {
  const store = useDemo();
  const router = useRouter();
  const [organization, setOrganization] = useState(
    store.data.settings.organization,
  );
  const [email, setEmail] = useState(store.data.settings.supportEmail);
  const [reset, setReset] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="MAKE THE WORKSPACE YOURS"
        title="Workspace settings"
        description="A few details that keep your demo experience in order."
      />
      <div className="grid two">
        <section className="panel">
          <div className="panel-heading">
            <h2>Organization details</h2>
          </div>
          <form
            className="panel-body form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              store.settings(organization, email);
              toast.success("Workspace settings saved.");
            }}
          >
            <Input
              label="Organization name"
              value={organization}
              required
              onChange={(e) => setOrganization(e.target.value)}
            />
            <Input
              label="Support email"
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit">
              <Save size={16} />
              Save settings
            </Button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <ShieldCheck size={19} />
            <h2>About this environment</h2>
            <Badge tone="amber">Demo only</Badge>
          </div>
          <div className="panel-body">
            <p>
              Phase 1 uses isolated mock repositories and browser storage.
              Client-side role checks, timers, scoring and result visibility
              demonstrate the workflow; they do not provide production security.
            </p>
            <p>
              Data is limited to this browser origin and is not synchronized
              across users, devices, browsers, or serverless instances. Use
              sample information only.
            </p>
            <div className="soft-note">
              <Database size={17} />
              No database connection or environment variables are required.
            </div>
          </div>
        </section>
        <section className="panel danger-panel">
          <div className="panel-heading">
            <RotateCcw size={18} />
            <h2>A fresh start</h2>
          </div>
          <div className="panel-body">
            <p>
              Reset all demo examinations, learner accounts, assignments,
              attempts, settings and results to their original sample state. You
              will be logged out.
            </p>
            <Button variant="danger" onClick={() => setReset(true)}>
              <RotateCcw size={16} />
              Reset Demo Data
            </Button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>What comes next</h2>
          </div>
          <div className="panel-body">
            <p>
              <strong>Phase 2:</strong> Neon PostgreSQL, migrations, server
              authentication, permissions, authoritative timing, transactions,
              scoring and durable reporting.
            </p>
            <p>
              <strong>Phase 3:</strong> Security and accessibility audits,
              integration and concurrency testing, performance and operational
              readiness.
            </p>
            <small>These phases are intentionally deferred.</small>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={reset}
        onOpenChange={setReset}
        title="Reset this demo workspace?"
        description="All browser demo changes will be permanently removed. The original demo accounts will be restored."
        destructive
        label="Reset demo data"
        onConfirm={() => {
          store.reset();
          toast.success("Demo data reset.");
          router.push("/login");
        }}
      />
    </>
  );
}
