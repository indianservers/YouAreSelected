"use client";
import { useState } from "react";
import { Database, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { usePlatform } from "@/lib/client/store";
import { Badge, Button, Input, PageHeader } from "@/components/ui";
export function AdminSettings() {
  const store = usePlatform();
  const [organization, setOrganization] = useState(
    store.data.settings.organization,
  );
  const [email, setEmail] = useState(store.data.settings.supportEmail);
  return (
    <>
      <PageHeader
        eyebrow="MAKE THE WORKSPACE YOURS"
        title="Workspace settings"
        description="Organization details and account security for your examination platform."
      />
      <div className="grid two">
        <section className="panel">
          <div className="panel-heading">
            <h2>Organization details</h2>
          </div>
          <form
            className="panel-body form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await store.settings(organization, email);
                toast.success("Workspace settings saved.");
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            <Input
              label="Organization name"
              required
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
            <Input
              label="Support email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={store.busy}>
              <Save size={16} />
              Save settings
            </Button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <ShieldCheck size={19} />
            <h2>Persistent, private records</h2>
            <Badge tone="green">Server managed</Badge>
          </div>
          <div className="panel-body">
            <p>
              Accounts use Argon2id password hashing and revocable HttpOnly
              sessions. Administrative changes are authorized on the server and
              recorded in the audit log.
            </p>
            <p>
              Attempt timing, submissions, grading and result publication are
              enforced by PostgreSQL-backed services. There is no browser data
              reset or demo administrator bypass.
            </p>
            <div className="soft-note">
              <Database size={17} />
              Database migrations, initial administrator setup and optional
              sample content are controlled CLI operations.
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>File and email services</h2>
          </div>
          <div className="panel-body">
            <p>
              Questions support HTTPS image URLs. File uploads are unavailable
              until durable object storage is configured.
            </p>
            <p>
              Password reset requires configured email delivery. If it is
              unavailable, the recovery form reports that limitation and sends
              no simulated email.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Security and operations</h2>
          </div>
          <div className="panel-body">
            <p>
              Keep database and authentication secrets in server environment
              settings. Manage backups and Neon branches through your database
              provider.
            </p>
            <p>
              Phase 3 security, load, accessibility and operational audits
              remain a separate task.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
