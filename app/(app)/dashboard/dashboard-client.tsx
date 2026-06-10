"use client";

import { useRouter } from "next/navigation";
import { Chip, ProgramDot } from "@/components/ui";
import { I } from "@/components/icons";

export interface FollowupRow {
  id: string;
  name: string;
  programColor: string;
  programShort: string;
  dueToday: boolean;
  dueLabel: string;
  what: string;
}

export function FollowupsTable({ rows }: { rows: FollowupRow[] }) {
  const router = useRouter();
  return (
    <table className="data">
      <thead><tr><th>Client</th><th>Program</th><th>Due</th><th>What</th><th></th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="rowlink" onClick={() => router.push(`/clients/${r.id}`)}>
            <td className="cname">{r.name}</td>
            <td><ProgramDot color={r.programColor} label={r.programShort} /></td>
            <td>{r.dueToday ? <Chip tone="red">Due today</Chip> : r.dueLabel}</td>
            <td style={{ color: "var(--calv-slate-65)", maxWidth: 240 }}>{r.what}</td>
            <td style={{ textAlign: "right" }}><I name="arrow" size={14} style={{ color: "var(--calv-slate-35)" }} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
