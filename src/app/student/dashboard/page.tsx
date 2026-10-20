import { Suspense } from "react";
import { StudentDashboard } from "@/features/students/dashboard";
export default function Page() {
  return (
    <Suspense>
      <StudentDashboard />
    </Suspense>
  );
}
