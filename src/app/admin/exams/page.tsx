import { Suspense } from "react";
import { ExamManagement } from "@/features/exams/admin-exams";
export default function Page() {
  return (
    <Suspense>
      <ExamManagement />
    </Suspense>
  );
}
