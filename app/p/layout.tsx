import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/toast";

/* Public client portal — tokenized, NO auth, NO app shell (no sidebar/topbar).
   Reuses the root layout (fonts + global CSS) only. Links are texted to
   applicants, so keep them out of search indexes. */

export const metadata: Metadata = {
  title: "Your application",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
