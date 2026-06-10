/* Shared presentational primitives — usable from server AND client components.
   No hooks, no event handlers here; interactive pieces live in ui-client.tsx. */
import type { CSSProperties, ReactNode } from "react";
import { I } from "./icons";

export function Chip({ tone = "", outline, children }: { tone?: string; outline?: boolean; children: ReactNode }) {
  return <span className={"chip " + tone + (outline ? " outline" : "")}>{children}</span>;
}

export function CodeChip({ code, show = true }: { code: string; show?: boolean }) {
  if (!show) return null;
  return <span className="code-chip">{code}</span>;
}

export function ProgramDot({ color, label }: { color: string; label: string }) {
  return <span className="pdot-lab"><i style={{ background: color }} />{label}</span>;
}

export function Meter({ pct, tone }: { pct: number; tone?: "" | "warn" | "bad" }) {
  const cls = tone ?? (pct >= 90 ? "" : pct >= 70 ? "warn" : "bad");
  return (
    <div className="meter-row">
      <div className={"meter " + cls} style={{ flex: 1 }}><i style={{ width: pct + "%" }} /></div>
      <span className="pct">{pct}%</span>
    </div>
  );
}

export function Kpi({ kick, value, foot, tone, accent }: {
  kick: string; value: ReactNode; foot?: ReactNode; tone?: "good" | "bad"; accent?: string;
}) {
  return (
    <div className="kpi" style={{ "--kpi-accent": accent } as CSSProperties}>
      <div className="kick">{kick}</div>
      <div className="n">{value}</div>
      {foot ? <div className={"foot " + (tone ?? "")}>{foot}</div> : null}
    </div>
  );
}

export function Panel({ title, sub, right, style, className, children }: {
  title?: string; sub?: string; right?: ReactNode; style?: CSSProperties; className?: string; children?: ReactNode;
}) {
  return (
    <div className={"panel " + (className ?? "")} style={style}>
      {(title || right) ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            {title ? <h3 className="ptitle">{title}</h3> : null}
            {sub ? <p className="psub">{sub}</p> : null}
          </div>
          {right ? <div>{right}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Field({ label, required, hint, span, children }: {
  label: string; required?: boolean; hint?: string; span?: number; children: ReactNode;
}) {
  return (
    <div className="field" style={span ? { gridColumn: "span " + span } : undefined}>
      <label>{label}{required ? <span className="req"> *</span> : null}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function PageHead({ title, titleAccent, lede, right }: {
  title: ReactNode; titleAccent?: ReactNode; lede?: ReactNode; right?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-h1">{title}{titleAccent ? <> <span className="red">{titleAccent}</span></> : null}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Notice({ tone = "sand", icon, children, right }: {
  tone?: "warn" | "sand" | "good" | "bad"; icon?: string; children: ReactNode; right?: ReactNode;
}) {
  const iconColor = tone === "warn" ? "#8A6410" : tone === "bad" ? "#B73719" : tone === "good" ? "#2F5A41" : "var(--calv-slate-65)";
  return (
    <div className={"notice " + tone}>
      {icon ? <I name={icon} size={16} style={{ color: iconColor, marginTop: 1 }} /> : null}
      <div style={{ flex: 1 }}>{children}</div>
      {right}
    </div>
  );
}

export function Empty({ children, padding }: { children: ReactNode; padding?: number }) {
  return <div className="empty" style={padding ? { padding } : undefined}>{children}</div>;
}

/** Shown when the current user's program assignments don't include a screen. */
export function Restricted({ what }: { what?: string }) {
  return (
    <div className="panel" style={{ maxWidth: 520, margin: "60px auto", textAlign: "center", padding: "40px 36px" }}>
      <I name="shield" size={34} style={{ color: "var(--calv-slate-35)" }} />
      <h3 className="ptitle" style={{ marginTop: 14 }}>No access to {what ?? "this area"}</h3>
      <p style={{ fontSize: 13, color: "var(--calv-slate-65)", lineHeight: 1.6, margin: "8px 0 0" }}>
        Your account isn&apos;t assigned to a program that includes this. An administrator can update your
        program assignments in <strong style={{ fontWeight: 600 }}>Settings → Users</strong>.
      </p>
    </div>
  );
}

export function Avatar({ initials, size = 34 }: { initials: string; size?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials}
    </div>
  );
}
