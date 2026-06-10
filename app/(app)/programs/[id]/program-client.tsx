"use client";
/* Interactive pieces of the program start page — row-click navigation only.
   Receives plain serializable props; no DB or server-only imports. */
import { useRouter } from "next/navigation";
import { Chip, Meter } from "@/components/ui";

export interface MemberRow {
  id: string;
  name: string;
  hh: string;        // "Household type · size"
  fplLabel: string;  // "118% FPL" (pinned-year math, computed server-side)
  fplTone: string;   // sage | amber | red
  pct: number;       // live completeness %
  worker: string;    // case worker name
}

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const router = useRouter();
  return (
    <table className="data">
      <thead><tr><th>Client</th><th>Household</th><th>Income vs FPL</th><th>Report-ready</th><th>Case worker</th></tr></thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="rowlink" onClick={() => router.push("/clients/" + c.id)}>
            <td className="cname">{c.name}</td>
            <td style={{ color: "var(--calv-slate-65)" }}>{c.hh}</td>
            <td><Chip tone={c.fplTone}>{c.fplLabel}</Chip></td>
            <td style={{ minWidth: 110 }}><Meter pct={c.pct} /></td>
            <td>{c.worker}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
