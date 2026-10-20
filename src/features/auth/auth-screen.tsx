"use client";
import { useState } from "react";
import { PasswordRecovery } from "./password-recovery";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/shell";
import { Button, Input } from "@/components/ui";
import { usePlatform } from "@/lib/client/store";
const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  name: z.string(),
  mobile: z.string(),
  institution: z.string(),
  confirm: z.string(),
  terms: z.boolean(),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;
export function AuthScreen({
  mode = "login",
}: {
  mode?: "login" | "register" | "forgot";
}) {
  const router = useRouter();
  const store = usePlatform();
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    control,

    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      mobile: "",
      institution: "",
      confirm: "",
      terms: false,
      remember: true,
    },
  });
  const password = useWatch({ control, name: "password" });
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      if (mode === "register") {
        if (values.name.trim().length < 2) throw Error("Enter your full name.");
        if (!/^\+?[\d\s-]{10,15}$/.test(values.mobile))
          throw Error("Enter a valid mobile number.");
        if (
          values.password.length < 12 ||
          !/[A-Z]/.test(values.password) ||
          !/[0-9]/.test(values.password)
        )
          throw Error(
            "Use at least 12 characters, an uppercase letter and a number.",
          );
        if (values.password !== values.confirm)
          throw Error("Passwords must match.");
        if (!values.terms) throw Error("Please accept the terms.");
        await store.register(values);
        setDone(true);
        toast.success("Registration received. Await administrator approval.");
      } else {
        const user = await store.login(
          values.email,
          values.password,
          values.remember,
        );
        toast.success(`Welcome, ${user.name.split(" ")[0]}.`);
        router.push(user.role === "admin" ? "/admin" : "/student/dashboard");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  });
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div className="story-content">
          <span className="pill-light">
            <Sparkles size={14} />
            Small steps. Extraordinary possibilities.
          </span>
          <h1>
            Your ambition.
            <br />
            Our platform.
            <br />
            <em>A brighter future.</em>
          </h1>
          <p>
            Turn preparation into confidence with a thoughtfully designed
            examination experience.
          </p>
          <div className="auth-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-icon">
              <GraduationCap size={66} strokeWidth={1.3} />
            </div>
            <div className="art-chip top">
              <TrendingUp size={18} />
              <span>Progress, every day.</span>
            </div>
            <div className="art-chip bottom">
              <CheckCircle2 size={19} />
              <span>One step closer to selected.</span>
            </div>
            <span className="art-spark spark-one">+</span>
            <span className="art-spark spark-two">✦</span>
          </div>
          <div className="story-benefits">
            <span>
              <BookOpen size={17} />
              Purposeful practice
            </span>
            <span>
              <ShieldCheck size={17} />
              Focused exam experience
            </span>
            <span>
              <TrendingUp size={17} />
              Meaningful insights
            </span>
          </div>
        </div>
        <small className="story-footer">
          Built for the next generation of achievers.
        </small>
      </aside>
      <main className="auth-main">
        <div className="auth-top">
          <span className="demo-label">
            <span />
            Examination Platform
          </span>
          <Link href="/">
            Back to home <ArrowRight size={14} />
          </Link>
        </div>
        <div className="auth-form-wrap">
          {done ? (
            <div className="registration-success">
              <div className="success-symbol">
                <Check size={32} />
              </div>
              <span className="eyebrow">YOU’RE ON THE LIST</span>
              <h1>Great things start here.</h1>
              <p>
                Your account has been created and is pending administrator
                approval. Log in to explore your workspace while you wait.
              </p>
              <Button asChild>
                <Link href="/login">
                  Continue to login <ArrowRight size={17} />
                </Link>
              </Button>
            </div>
          ) : mode === "forgot" ? (
            <PasswordRecovery />
          ) : (
            <>
              <span className="eyebrow">
                {mode === "register"
                  ? "YOUR JOURNEY BEGINS HERE"
                  : "LET’S MAKE PROGRESS"}
              </span>
              <h1>
                {mode === "register" ? "Create your account." : "Welcome back."}
              </h1>
              <p>
                {mode === "register"
                  ? "A little preparation today. A world of possibilities tomorrow."
                  : "Your next achievement is just a little practice away."}
              </p>
              <form onSubmit={submit} noValidate className="auth-form">
                {mode === "register" && (
                  <Input
                    label="Full name"
                    autoComplete="name"
                    {...register("name")}
                  />
                )}
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register("email")}
                  error={errors.email?.message}
                />
                {mode === "register" && (
                  <Input
                    label="Mobile number"
                    type="tel"
                    autoComplete="tel"
                    {...register("mobile")}
                  />
                )}
                <div className="password-field">
                  <Input
                    label="Password"
                    type={show ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    {...register("password")}
                    error={errors.password?.message}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {mode === "register" ? (
                  <>
                    <div className="password-strength">
                      <div
                        style={{
                          width: `${Math.min(100, password.length * 6 + (/[A-Z]/.test(password) ? 15 : 0) + (/[0-9]/.test(password) ? 15 : 0))}%`,
                        }}
                      />
                      <small>
                        12+ characters, one uppercase letter and one number
                      </small>
                    </div>
                    <Input
                      label="Confirm password"
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      {...register("confirm")}
                    />
                    <Input
                      label="Institution / organization (optional)"
                      {...register("institution")}
                    />
                    <label className="checkbox-line">
                      <input type="checkbox" {...register("terms")} />I agree to
                      the examination rules and account terms.
                    </label>
                  </>
                ) : (
                  <div className="auth-options">
                    <label className="checkbox-line">
                      <input type="checkbox" {...register("remember")} />
                      Remember session
                    </label>
                    <Link href="/forgot-password">Forgot password?</Link>
                  </div>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <Button
                  disabled={isSubmitting || !store.ready}
                  type="submit"
                  className="full-width"
                >
                  {mode === "register"
                    ? "Create account"
                    : "Sign in to your workspace"}
                  <ArrowRight size={17} />
                </Button>
              </form>
              <p className="auth-alternative">
                {mode === "register"
                  ? "Already have an account?"
                  : "New around here?"}{" "}
                <Link href={mode === "register" ? "/login" : "/register"}>
                  {mode === "register" ? "Sign in" : "Create an account"}
                </Link>
              </p>
            </>
          )}
        </div>
        <p className="auth-footer">
          <LockKeyhole size={13} />
          Secure sign-in · Private records
        </p>
      </main>
    </div>
  );
}
