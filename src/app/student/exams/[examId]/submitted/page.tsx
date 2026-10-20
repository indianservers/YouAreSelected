import { SubmittedScreen } from "@/features/attempts/attempt-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  return <SubmittedScreen examId={examId} />;
}
