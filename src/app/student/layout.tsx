import { Shell } from "@/components/shell";
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell role="student">{children}</Shell>;
}
