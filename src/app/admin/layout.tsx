import { Shell } from "@/components/shell";
import { protectPage } from "@/server/access";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await protectPage("admin");
  return <Shell role="admin">{children}</Shell>;
}
