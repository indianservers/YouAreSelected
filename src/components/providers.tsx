"use client";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { MotionConfig } from "motion/react";
import { usePlatform } from "@/lib/client/store";
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const load = () => {
      if (!usePlatform.getState().busy)
        void usePlatform
          .getState()
          .load()
          .catch(() => {});
    };
    // Discard obsolete, insecure Phase 1 data; it is never imported into PostgreSQL.
    localStorage.removeItem("yas-demo-v1");
    localStorage.removeItem("yas-remember");
    sessionStorage.removeItem("yas-session");
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("focus", load);
    window.addEventListener("online", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("online", load);
    };
  }, []);
  return (
    <>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <Toaster richColors position="bottom-right" />
    </>
  );
}
