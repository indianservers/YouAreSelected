"use client";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { MotionConfig } from "motion/react";
import { useDemo } from "@/lib/mock/store";
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    Promise.resolve(useDemo.persist.rehydrate()).finally(() =>
      useDemo.getState().setReady(),
    );
  }, []);
  return (
    <>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <Toaster richColors position="bottom-right" />
    </>
  );
}
