import { ExamDetails } from "@/features/students/exam-details";
export default async function Page({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  return <ExamDetails examId={examId} instructions />;
}
