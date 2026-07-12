"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { I } from "@/components/icons";
import { useLang, pick } from "@/lib/i18n";

export interface SidebarOrg {
  name: string;
  short: string;
  logoMode: string;
  logoData: string | null;
}
export interface SidebarProgram { id: string; short: string; color: string }
export interface SidebarFy { label: string; range: string; pctElapsed: number }

const STR = {
  en: {
    appName: "CAP Trellis",
    newIntake: "New intake",
    work: "Work",
    dashboard: "Dashboard",
    eligibility: "Eligibility queue",
    denials: "Denials",
    clients: "Clients",
    services: "Service log",
    myPrograms: "My programs",
    noPrograms: "No programs assigned — ask an administrator.",
    insight: "Insight",
    reports: "Reports & CSBG rollup",
    admin: "Admin",
    data: "Data & integrations",
    settings: "Settings",
    portal: "Client portal preview",
    fyCard: (label: string) => `${label} reporting period`,
    fyElapsed: (pct: number) => `${pct}% of the federal fiscal year elapsed`,
  },
  es: {
    appName: "CAP Trellis",
    newIntake: "Nueva admisión",
    work: "Trabajo",
    dashboard: "Panel",
    eligibility: "Cola de elegibilidad",
    denials: "Denegaciones",
    clients: "Clientes",
    services: "Registro de servicios",
    myPrograms: "Mis programas",
    noPrograms: "Sin programas asignados — consulta a un administrador.",
    insight: "Análisis",
    reports: "Informes y consolidado CSBG",
    admin: "Administración",
    data: "Datos e integraciones",
    settings: "Configuración",
    portal: "Vista previa del portal del cliente",
    fyCard: (label: string) => `Período de informe ${label}`,
    fyElapsed: (pct: number) => `${pct}% del año fiscal federal transcurrido`,
  },
};

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
  const lang = useLang();
  const s = pick(lang, STR);
  const is = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="nav">
      <OrgMark org={org} />
      <div className="app-name">{s.appName}</div>
      <Link href="/intake" className="calv-btn calv-btn--primary calv-btn--sm nav-cta" style={{ textDecoration: "none" }}>
        <I name="plus" size={14} /> {s.newIntake}
      </Link>
      <div className="sect">{s.work}</div>
      <NavLink href="/dashboard" active={is("/dashboard")} icon="home" label={s.dashboard} />
      <NavLink href="/eligibility" active={is("/eligibility")} icon="shield" label={s.eligibility} count={applicantCount} />
      <NavLink href="/denials" active={is("/denials")} icon="rotate" label={s.denials} />
      <NavLink href="/clients" active={is("/clients")} icon="users" label={s.clients} />
      <NavLink href="/services" active={is("/services")} icon="hand" label={s.services} />
      <div className="sect">{s.myPrograms}</div>
      {navPrograms.length === 0 ? (
        <div className="nav-empty">{s.noPrograms}</div>
      ) : null}
      {navPrograms.map((p) => (
        <NavLink key={p.id} href={`/programs/${p.id}`} active={is(`/programs/${p.id}`)} dot={p.color} label={p.short} />
      ))}
      <div className="sect">{s.insight}</div>
      <NavLink href="/reports" active={is("/reports")} icon="chart" label={s.reports} />
      <div className="sect">{s.admin}</div>
      {isAdmin ? (
        <>
          <NavLink href="/data" active={is("/data")} icon="plug" label={s.data} />
          <NavLink href="/settings" active={is("/settings")} icon="settings" label={s.settings} />
        </>
      ) : null}
      <NavLink href="/portal-preview" active={is("/portal-preview")} icon="phone" label={s.portal} />
      <div className="fy-card">
        <strong>{s.fyCard(fy.label)}</strong>
        {fy.range}
        <div className="bar"><i style={{ width: fy.pctElapsed + "%" }} /></div>
        {s.fyElapsed(fy.pctElapsed)}
      </div>
    </aside>
  );
}
