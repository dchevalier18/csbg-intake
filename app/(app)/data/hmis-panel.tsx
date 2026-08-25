"use client";
/* PA HMIS sync panel — enrollment-program setting, sync controls, and the
   match queue (link / import as new client / dismiss). Per the CACLV ↔ PA
   HMIS operating understanding, synced records feed internal tracking &
   reporting: dedup-linked, blank-filled, and imported into the directory. */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip, Empty, Panel } from "@/components/ui";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { fmt } from "@/lib/format";
// @/lib/hmis-dates, NOT @/lib/hmis: that module imports the database layer
import { describeWindow, presetWindow, type HmisWindowPreset } from "@/lib/hmis-dates";
import {
  resolveHmisReview, runHmisSync, setHmisProgram, testHmisConnection,
  type HmisSyncPeriod,
} from "./hmis-actions";

const PRESETS: Array<{ id: HmisWindowPreset; label: string }> = [
  { id: "lastFullMonth", label: "Last full month" },
  { id: "fiscalYearToDate", label: "Fiscal year to date" },
  { id: "calendarYearToDate", label: "Calendar year to date" },
];

export interface HmisSyncStats {
  at: string | null;        // ISO datetime of last sync (null = never)
  pulled: number;
  alreadyLinked: number;
  autoLinked: number;
  enriched: number;
  created: number;
  queued: number;
  noDob: number;
  noProgram: number;
}

export interface HmisReviewItem {
  id: number;
  when: string;
  person: { name: string; dob: string; phone: string; email: string };
  candidates: Array<{ id: string; name: string; dob: string; phone: string }>;
}

export function HmisPanel({ configured, stats, reviews, programs, programId, coverage, fyStart, rangeApplies }: {
  configured: boolean;
  stats: HmisSyncStats;
  reviews: HmisReviewItem[];
  programs: Array<{ id: string; name: string }>;
  programId: string | null;
  /** Periods already pulled — what makes a repeat sync detectable. */
  coverage: HmisSyncPeriod[];
  /** The agency's FY start month, so the preset means the same thing here as on
      Reports rather than assuming the federal October. */
  fyStart: string;
  /** False when the client source is the CRQL query or the window parameter
      names are unset — the dates would be sent nowhere. */
  rangeApplies: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyReview, setBusyReview] = useState<number | null>(null);
  const seed = presetWindow("lastFullMonth", new Date(), fyStart);
  const [range, setRange] = useState({ start: seed?.start ?? "", end: seed?.end ?? "" });
  const [force, setForce] = useState(false);

  function applyPreset(id: HmisWindowPreset) {
    const win = presetWindow(id, new Date(), fyStart);
    if (win) setRange(win);
  }

  function onTest() {
    startTransition(async () => {
      const res = await testHmisConnection();
      toast(res.message);
    });
  }
  function onSync() {
    startTransition(async () => {
      const res = await runHmisSync(range, { force });
      toast(res.message);
      if (res.ok) { setForce(false); router.refresh(); }
    });
  }
  function onProgram(id: string) {
    if (!id) return;
    startTransition(async () => {
      const res = await setHmisProgram(id);
      toast(res.message);
      if (res.ok) router.refresh();
    });
  }
  function onResolve(id: number, action: { type: "link"; clientId: string } | { type: "create" } | { type: "dismiss" }) {
    setBusyReview(id);
    startTransition(async () => {
      const res = await resolveHmisReview(id, action);
      setBusyReview(null);
      toast(res.message);
      if (res.ok) router.refresh();
    });
  }

  return (
    <Panel
      title="PA HMIS sync"
      sub="Pulls CACLV-project records from PA HMIS for internal tracking & reporting: matched people are deduplicated (blank fields filled — local data always wins), new people import into the client directory, and totals roll into the org-wide unduplicated report."
      right={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={pending} onClick={onTest}>Test connection</button>
        </div>
      }
      style={{ marginBottom: 13 }}
    >
      {!configured ? (
        <Empty padding={18}>
          Not configured yet — set the connection in Settings → Integrations (applies immediately), or via HMIS_* environment variables.
        </Empty>
      ) : (
        <>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 12, fontSize: 12.5 }}>
          <span style={{ color: "var(--calv-slate-65)" }}>New HMIS people enroll into:</span>
          <select value={programId ?? ""} disabled={pending} onChange={(e) => onProgram(e.target.value)} style={{ maxWidth: 280 }} aria-label="HMIS enrollment program">
            <option value="">— pick a program —</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {!programId ? <Chip tone="amber">required before imports run</Chip> : null}
        </div>

        <div style={{
          border: "1px solid var(--calv-line, #e5e7eb)", borderRadius: 8,
          padding: 12, marginBottom: 14,
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: "var(--calv-slate-65)" }}>Period start</span>
              <input type="date" value={range.start} disabled={pending}
                onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
            </label>
            <label style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: "var(--calv-slate-65)" }}>Period end</span>
              <input type="date" value={range.end} disabled={pending}
                onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
            </label>
            <button className="calv-btn calv-btn--secondary calv-btn--sm"
              disabled={pending || !configured || !range.start || !range.end}
              style={!configured || !range.start || !range.end ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              title={configured ? undefined : "Set the PA HMIS connection in Settings → Integrations first"}
              onClick={onSync}>
              <I name="rotate" size={13} /> Run sync
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>Quick pick:</span>
            {PRESETS.map((p) => (
              <button key={p.id} className="calv-btn calv-btn--quiet calv-btn--sm"
                disabled={pending} onClick={() => applyPreset(p.id)}>{p.label}</button>
            ))}
          </div>
          {rangeApplies ? (
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10, fontSize: 12.5 }}>
              <input type="checkbox" checked={force} disabled={pending}
                onChange={(e) => setForce(e.target.checked)} />
              <span>
                Re-sync a period already pulled
                <span style={{ color: "var(--calv-slate-65)" }}>
                  {" "}— only for data corrected on the HMIS side; normally a repeat is refused
                </span>
              </span>
            </label>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)", marginTop: 10 }}>
              The period is not sent: either the client source is the CRQL query (no{" "}
              <code>WHERE</code> clause) or the window parameter names are blank in
              Settings → Integrations. This sync will pull whatever the source returns.
            </div>
          )}
        </div>

        {coverage.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
              Periods already synced
              <span style={{ fontWeight: 400, color: "var(--calv-slate-65)" }}>
                {" "}— a repeat is refused; undoing a sync frees its period
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {coverage.map((p) => (
                <div key={p.jobId} style={{ display: "flex", gap: 10, fontSize: 12.5, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, minWidth: 190 }}>
                    {describeWindow({ start: p.start, end: p.end })}
                  </span>
                  <span style={{ color: "var(--calv-slate-65)" }}>
                    {fmt(p.created)} imported · {fmt(p.enriched)} blank-filled
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 22, fontSize: 12.5, color: "var(--calv-slate-65)", flexWrap: "wrap", marginBottom: reviews.length ? 14 : 0 }}>
          {stats.at ? (
            <>
              <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(stats.pulled)}</strong> HMIS records last sync</span>
              <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(stats.created)}</strong> imported as clients</span>
              <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(stats.alreadyLinked + stats.autoLinked)}</strong> linked (deduplicated)</span>
              <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(stats.enriched)}</strong> blank-filled</span>
              <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(reviews.length)}</strong> awaiting review</span>
              {stats.noDob > 0 ? <span><strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{fmt(stats.noDob)}</strong> snapshot-only (no DOB)</span> : null}
            </>
          ) : (
            <span>Configured — run the first sync to pull the CACLV-project snapshot.</span>
          )}
        </div>
        </>
      )}

      {reviews.map((r) => (
        <div key={r.id} style={{ border: "1px solid var(--calv-slate-15)", borderRadius: 4, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8, flexWrap: "wrap" }}>
            <Chip tone="amber">HMIS match · {r.when}</Chip>
            <span style={{ fontWeight: 600 }}>{r.person.name}</span>
            <span style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>
              b. {r.person.dob || "—"}{r.person.phone ? " · " + r.person.phone : ""}{r.person.email ? " · " + r.person.email : ""}
            </span>
          </div>
          <table className="data compact">
            <thead><tr><th>Possible match</th><th>DOB</th><th>Phone</th><th></th></tr></thead>
            <tbody>
              {r.candidates.map((c) => (
                <tr key={c.id}>
                  <td className="cname">{c.name}<div style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 11, textTransform: "none", color: "var(--calv-slate-65)" }}>{c.id}</div></td>
                  <td>{c.dob}</td>
                  <td>{c.phone || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="calv-btn calv-btn--secondary calv-btn--sm" disabled={pending && busyReview === r.id}
                      onClick={() => onResolve(r.id, { type: "link", clientId: c.id })}>
                      Same person — link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={pending && busyReview === r.id}
              onClick={() => onResolve(r.id, { type: "create" })}>
              Different person — import as new client
            </button>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={pending && busyReview === r.id}
              onClick={() => onResolve(r.id, { type: "dismiss" })}>
              Dismiss — keep out of the directory
            </button>
          </div>
        </div>
      ))}
    </Panel>
  );
}
