"use client";
/* Interactive pieces of the program start page — the enrolled-clients table's
   sorting and filtering, plus row-click navigation. Receives plain serializable
   props; no DB or server-only imports. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Chip, Meter } from "@/components/ui";

export interface MemberRow {
  id: string;
  name: string;
  hh: string;        // "Household type · size"
  fplLabel: string;  // "118% FPL" (pinned-year math, computed server-side)
  fplTone: string;   // sage | amber | red
  fplPct: number;    // the same figure as a number, so the column can sort
  pct: number;       // live completeness %
  worker: string;    // case worker name
  /** When THIS program's enrollment began (ISO date), or null when unknown. */
  enrolled: string | null;
  /** True when the date was backfilled from the client record rather than
      recorded against this program — the column says so rather than implying
      a precision the data doesn't have. */
  enrolledInferred: boolean;
}

type SortKey = "name" | "enrolled" | "hh" | "fpl" | "pct" | "worker";
type Period = "cy" | "prevCy" | "all";

const CY = new Date().getFullYear();

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "cy", label: `${CY}` },
  { id: "prevCy", label: `${CY - 1}` },
  { id: "all", label: "All time" },
];

/** ISO date → "Mar 4, 2026"; null → "—". Parsed as parts, not `new Date(iso)`,
    which would shift the day backwards in timezones behind UTC. */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const router = useRouter();
  // Defaults to the current calendar year, per the reporting rhythm staff work
  // in. When that hides most of a program's roster the count is shown with a
  // one-click way out, because a table quietly showing 12 of 157 reads as a bug.
  const [period, setPeriod] = useState<Period>("cy");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("enrolled");
  const [asc, setAsc] = useState(false);

  const inPeriod = useMemo(() => rows.filter((r) => {
    if (period === "all") return true;
    const year = r.enrolled?.slice(0, 4);
    if (!year) return false;   // undated enrollments can't be in a year
    return year === String(period === "cy" ? CY : CY - 1);
  }), [rows, period]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q === ""
      ? inPeriod
      : inPeriod.filter((r) =>
          r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
          || r.worker.toLowerCase().includes(q));
    const dir = asc ? 1 : -1;
    const by: Record<SortKey, (r: MemberRow) => string | number> = {
      name: (r) => r.name.toLowerCase(),
      // undated sorts last in either direction rather than pretending to be 0
      enrolled: (r) => r.enrolled ?? "",
      hh: (r) => r.hh.toLowerCase(),
      fpl: (r) => r.fplPct,
      pct: (r) => r.pct,
      worker: (r) => r.worker.toLowerCase(),
    };
    return [...matched].sort((a, b) => {
      const x = by[sort](a);
      const y = by[sort](b);
      if (x === y) return a.name.localeCompare(b.name);
      return (x > y ? 1 : -1) * dir;
    });
  }, [inPeriod, query, sort, asc]);

  const hidden = rows.length - inPeriod.length;
  const undated = rows.filter((r) => !r.enrolled).length;
  const inferred = rows.some((r) => r.enrolledInferred);

  function header(key: SortKey, label: string, style?: React.CSSProperties) {
    const active = sort === key;
    return (
      <th style={{ ...style, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
        title={`Sort by ${label.toLowerCase()}`}
        onClick={() => { if (active) setAsc(!asc); else { setSort(key); setAsc(key === "name" || key === "hh" || key === "worker"); } }}>
        {label}
        <span style={{ opacity: active ? 0.85 : 0.25, marginLeft: 4, fontSize: 10 }}>
          {active ? (asc ? "▲" : "▼") : "▾"}
        </span>
      </th>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 2 }}>
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={"calv-btn calv-btn--sm " + (period === p.id ? "calv-btn--secondary" : "calv-btn--quiet")}
              title={p.id === "all" ? "Every enrollment on this program" : `Enrollments that began in ${p.label}`}>
              {p.label}
            </button>
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, client ID or case worker"
          style={{ flex: "1 1 240px", minWidth: 180, fontSize: 13 }} />
        <span style={{ fontSize: 12.5, color: "var(--calv-slate-65)", marginLeft: "auto" }}>
          {visible.length} of {rows.length}
        </span>
      </div>

      {hidden > 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)", marginBottom: 8 }}>
          {hidden} enrollment{hidden === 1 ? "" : "s"} outside {period === "cy" ? CY : CY - 1}
          {undated > 0 && period !== "all" ? ` (${undated} with no recorded date)` : ""} —{" "}
          <button className="tlink" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
            onClick={() => setPeriod("all")}>show all time</button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="empty">
          {rows.length === 0
            ? "No enrollments yet — start with a new intake."
            : "No enrollments match this filter."}
        </div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              {header("name", "Client")}
              {header("enrolled", "Enrolled")}
              {header("hh", "Household")}
              {header("fpl", "Income vs FPL")}
              {header("pct", "Report-ready")}
              {header("worker", "Case worker")}
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className="rowlink" onClick={() => router.push("/clients/" + c.id)}>
                <td className="cname">{c.name}</td>
                <td style={{ whiteSpace: "nowrap", color: c.enrolled ? undefined : "var(--calv-slate-65)" }}>
                  {fmtDate(c.enrolled)}
                  {c.enrolledInferred ? <span title="Matches the client record's enrollment date" style={{ color: "var(--calv-slate-65)" }}> *</span> : null}
                </td>
                <td style={{ color: "var(--calv-slate-65)" }}>{c.hh}</td>
                <td><Chip tone={c.fplTone}>{c.fplLabel}</Chip></td>
                <td style={{ minWidth: 110 }}><Meter pct={c.pct} /></td>
                <td>{c.worker}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {inferred ? (
        <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "8px 0 0" }}>
          * Matches the client record&rsquo;s enrollment date. Enrollments made before per-program
          dates were recorded were backfilled from it, so they share one date across every
          program that client is in.
        </p>
      ) : null}
    </div>
  );
}
