import { Suspense } from "react";
import { AdminResults } from "@/features/results/admin-results";
export default async function Page({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  return (
    <Suspense>
      <AdminResults examId={examId} />
    </Suspense>
  );
}
