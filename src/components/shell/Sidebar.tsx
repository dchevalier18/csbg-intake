"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { I } from "@/components/icons";

export interface SidebarOrg {
  name: string;
  short: string;
  logoMode: string;
  logoData: string | null;
}
export interface SidebarProgram { id: string; short: string; color: string }
export interface SidebarFy { label: string; range: string; pctElapsed: number }

export function OrgMark({ org }: { org: SidebarOrg }) {
  if (org.logoMode === "upload" && org.logoData) {
    // eslint-disable-next-line @next/next/no-img-element
    return <div className="orgmark-plate"><img src={org.logoData} alt={org.name} /></div>;
  }
  if (org.logoMode === "wordmark") {
    return <div className="orgmark-word">{org.short || org.name}</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="mark" src="/brand/logo-white.svg" alt={org.name} />;
}

function NavLink({ href, active, icon, dot, label, count }: {
  href: string; active: boolean; icon?: string; dot?: string; label: string; count?: number;
}) {
  return (
    <Link href={href} className={"navlink" + (active ? " active" : "")}>
      {icon ? <I name={icon} size={15} /> : <span className="pdot" style={{ background: dot }} />} {label}
      {count ? <span className="count">{count}</span> : null}
    </Link>
  );
}

export function Sidebar({ org, navPrograms, isAdmin, applicantCount, fy }: {
  org: SidebarOrg;
  navPrograms: SidebarProgram[];
  isAdmin: boolean;
  applicantCount: number;
  fy: SidebarFy;
}) {
  const pathname = usePathname();
  const is = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="nav">
      <OrgMark org={org} />
      <div className="app-name">CSBG Client System</div>
      <Link href="/intake" className="calv-btn calv-btn--primary calv-btn--sm nav-cta" style={{ textDecoration: "none" }}>
        <I name="plus" size={14} /> New intake
      </Link>
      <div className="sect">Work</div>
      <NavLink href="/dashboard" active={is("/dashboard")} icon="home" label="Dashboard" />
      <NavLink href="/eligibility" active={is("/eligibility")} icon="shield" label="Eligibility queue" count={applicantCount} />
      <NavLink href="/clients" active={is("/clients")} icon="users" label="Clients" />
      <NavLink href="/services" active={is("/services")} icon="hand" label="Service log" />
      <div className="sect">My programs</div>
      {navPrograms.length === 0 ? (
        <div className="nav-empty">No programs assigned — ask an administrator.</div>
      ) : null}
      {navPrograms.map((p) => (
        <NavLink key={p.id} href={`/programs/${p.id}`} active={is(`/programs/${p.id}`)} dot={p.color} label={p.short} />
      ))}
      <div className="sect">Insight</div>
      <NavLink href="/reports" active={is("/reports")} icon="chart" label="Reports & CSBG rollup" />
      <div className="sect">Admin</div>
      {isAdmin ? (
        <>
          <NavLink href="/data" active={is("/data")} icon="plug" label="Data & integrations" />
          <NavLink href="/settings" active={is("/settings")} icon="settings" label="Settings" />
        </>
      ) : null}
      <NavLink href="/portal-preview" active={is("/portal-preview")} icon="phone" label="Client portal preview" />
      <div className="fy-card">
        <strong>{fy.label} reporting period</strong>
        {fy.range}
        <div className="bar"><i style={{ width: fy.pctElapsed + "%" }} /></div>
        {fy.pctElapsed}% of the federal fiscal year elapsed
      </div>
    </aside>
  );
}
