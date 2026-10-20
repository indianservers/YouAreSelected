import { AttemptScreen } from "@/features/attempts/attempt-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  return <AttemptScreen examId={examId} />;
}
