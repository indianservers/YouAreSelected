"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { request } from "@/lib/client/store";
export function PasswordRecovery() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);
  return (
    <>
      <span className="eyebrow">A SECURE WAY BACK</span>
      <h1>{token ? "Choose a new password." : "A fresh start."}</h1>
      <p>
        {token
          ? "This reset link is single-use and expires after 30 minutes."
          : "Request a reset link if your organization has configured email delivery."}
      </p>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setMessage("");
          setBusy(true);
          try {
            if (token) {
              if (password !== confirm) throw Error("Passwords must match.");
              await request("/api/auth/reset-password", {
                newPassword: password,
                token,
              });
              setMessage("Password changed. You can now sign in.");
            } else {
              await request("/api/auth/request-password-reset", {
                email,
                redirectTo: `${window.location.origin}/forgot-password`,
              });
              setMessage(
                "If an eligible account exists, a password reset link will be sent.",
              );
            }
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {token ? (
          <>
            <Input
              label="New password"
              type="password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Confirm new password"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </>
        ) : (
          <Input
            label="Email address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <Button type="submit" disabled={busy}>
          {token ? "Reset password" : "Request reset link"}
        </Button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        <Button asChild variant="secondary">
          <Link href="/login">Back to login</Link>
        </Button>
      </form>
    </>
  );
}
