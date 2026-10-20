import { Shell } from "@/components/shell";
import { protectPage } from "@/server/access";
export const dynamic = "force-dynamic";
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await protectPage("student");
  return <Shell role="student">{children}</Shell>;
}
