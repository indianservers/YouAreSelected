import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
import "katex/dist/katex.min.css";
export const metadata: Metadata = {
  title: {
    default: "YouAreSelected — A little practice. A bigger future.",
    template: "%s | YouAreSelected",
  },
  description:
    "A focused examination workspace for ambitious learners. Phase 1 interactive demo.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
