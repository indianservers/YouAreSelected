import { Suspense } from "react";
import { AdminResults } from "@/features/results/admin-results";
export default function Page() {
  return (
    <Suspense>
      <AdminResults reports />
    </Suspense>
  );
}
