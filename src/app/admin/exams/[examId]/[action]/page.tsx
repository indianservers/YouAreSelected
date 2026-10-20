import { notFound } from "next/navigation";
import { ExamEditor } from "@/features/exams/admin-exams";
import { QuestionBank } from "@/features/questions/question-bank";
import { AssignmentManagement } from "@/features/admin/assignments";
export default async function Page({
  params,
}: {
  params: Promise<{ examId: string; action: string }>;
}) {
  const { examId, action } = await params;
  if (action === "edit") return <ExamEditor key={examId} examId={examId} />;
  if (action === "questions") return <QuestionBank examId={examId} />;
  if (action === "assignments" || action === "schedule")
    return <AssignmentManagement examId={examId} mode={action} />;
  notFound();
}
