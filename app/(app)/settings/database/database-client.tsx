"use client";
/* Settings → Database & storage — PostgreSQL runtime health, connection facts,
   and on-demand pg_dump backups. */
import { useTransition } from "react";
import { Chip, Notice, Panel } from "@/components/ui";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { backupNow, runHealthCheck } from "./actions";

export interface DbStats {
  engine: string;
  server: string;
  database: string;
  role: string;
  size: string;
  tables: number;
  rowCounts: { label: string; n: string }[];
}

export interface BackupRow { name: string; size: string; created: string }

export function DatabaseSettingsClient({ stats, backups }: {
  stats: DbStats;
  backups: BackupRow[];
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const health = () => {
    startTransition(async () => {
      const res = await runHealthCheck();
      toast(res.message);
    });
  };

  const backup = () => {
    startTransition(async () => {
      const res = await backupNow();
      toast(res.message);
    });
  };

  const facts: Array<[string, string]> = [
    ["Engine", stats.engine],
    ["Server", stats.server],
    ["Database", stats.database],
    ["Role", stats.role],
    ["Database size", stats.size],
    ["Tables", String(stats.tables)],
  ];

  return (
    <div>
      <Panel
        title="PostgreSQL database — active"
        sub="The live store for this workspace. The schema bootstraps on start and seeds demo data when empty."
        style={{ marginBottom: 13 }}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="calv-btn calv-btn--ghost calv-btn--sm" disabled={pending} onClick={health}>
              <I name="shield" size={13} /> Run health check
            </button>
            <a className="calv-btn calv-btn--ghost calv-btn--sm" href="/settings/database/export" download>
              <I name="doc" size={13} /> Export all data (JSON)
            </a>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={pending} onClick={backup}>
              <I name="layers" size={13} /> Back up now
            </button>
          </div>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 24px" }}>
          {facts.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--calv-slate-15)", fontSize: 13 }}>
              <span style={{ color: "var(--calv-slate-65)" }}>{k}</span>
              <span style={{ fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {stats.rowCounts.map((r) => <Chip key={r.label} outline>{r.label}: <strong style={{ fontWeight: 700 }}>{r.n}</strong></Chip>)}
        </div>
      </Panel>

      <Panel
        title="Connection"
        sub="Where this workspace finds its database — managed on the host, not in the app."
        style={{ marginBottom: 13 }}
        right={<Chip tone="sage">PostgreSQL active</Chip>}
      >
        <Notice tone="sand" icon="alert">
          The connection is set by the <strong style={{ fontWeight: 600 }}>DATABASE_URL</strong> environment variable
          (in the systemd unit on the server, or <code>.env.local</code> in development) and is read once at startup.
          Pointing the workspace at a different server or database means updating that variable and restarting the
          app — credentials are never stored in this database.
        </Notice>
      </Panel>

      <Panel title="Backups" sub="Logical pg_dump snapshots — written to data/backups on the app server.">
        {backups.length === 0 ? (
          <div className="empty" style={{ padding: 20 }}>No backups yet — take the first one with “Back up now” above.</div>
        ) : (
          <table className="data">
            <thead><tr><th>File</th><th className="num">Size</th><th>Created</th></tr></thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name}>
                  <td className="cname">{b.name}</td>
                  <td className="num">{b.size}</td>
                  <td>{b.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
