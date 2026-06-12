import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · CSBG Client Intake System" };

export default async function LoginPage() {
  const me = await getCurrentUser();
  if (me) redirect("/dashboard");

  const org = (await db.select().from(t.organization).where(eq(t.organization.id, 1)))[0];
  const demoUsers = await db
    .select({ name: t.users.name, role: t.users.role, username: t.users.username, initials: t.users.initials })
    .from(t.users)
    .where(eq(t.users.active, 1))
    .orderBy(asc(t.users.name));

  return (
    <div className="login-wrap" style={{ "--brand": org?.accent ?? "#D14124" } as React.CSSProperties}>
      <div className="login-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-white.svg" alt={org?.name ?? "Community Action"} />
        <h1>CSBG Client<br />Intake System</h1>
        <p>
          One pass captures everything the CSBG Annual Report 3.0 needs — intake, eligibility,
          service delivery, and outcomes for {org?.name ?? "your Community Action Agency"}.
        </p>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)" }}>
          {org?.region} · OMB 0970-0492
        </p>
      </div>
      <div className="login-form">
        <LoginForm demoUsers={demoUsers} />
      </div>
    </div>
  );
}
