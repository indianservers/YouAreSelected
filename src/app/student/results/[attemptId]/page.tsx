import { ResultDetail } from "@/features/results/student-results";
export default async function Page({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <ResultDetail attemptId={attemptId} />;
}
