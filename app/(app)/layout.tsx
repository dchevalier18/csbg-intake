import type { CSSProperties, ReactNode } from "react";
import { eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser, isAdmin } from "@/lib/auth";
import { visiblePrograms } from "@/lib/access";
import { currentFY } from "@/lib/format";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { ToastProvider } from "@/components/toast";
import { LangProvider } from "@/lib/i18n";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const org = (await db.select().from(t.organization).where(eq(t.organization.id, 1)))[0]!;
  const navPrograms = await visiblePrograms(user);
  const fy = currentFY();

  // open applications visible to this user (terminal stages excluded)
  const visibleIds = navPrograms.map((p) => p.id);
  const openCount = visibleIds.length
    ? (await db.select({ stage: t.applications.stage }).from(t.applications)
        .where(inArray(t.applications.programId, visibleIds)))
        .filter((a) => a.stage !== "approved" && a.stage !== "denied").length
    : 0;

  return (
    <LangProvider lang={user.locale}>
    <ToastProvider>
      <a href="#main" className="skip-link">Skip to main content</a>
      <div className="app" style={{ "--brand": org.accent } as CSSProperties}>
        <Sidebar
          org={{ name: org.name, short: org.short, logoMode: org.logoMode, logoData: org.logoData }}
          navPrograms={navPrograms.map((p) => ({ id: p.id, short: p.short, color: p.color }))}
          isAdmin={isAdmin(user)}
          applicantCount={openCount}
          fy={{ label: fy.label, range: fy.range, pctElapsed: fy.pctElapsed }}
        />
        <main className="content" id="main">
          <Topbar
            user={{ name: user.name, role: user.role, initials: user.initials, locale: user.locale }}
            fyLabel={fy.label}
            onSignOut={signOut}
          />
          {children}
        </main>
      </div>
    </ToastProvider>
    </LangProvider>
  );
}
