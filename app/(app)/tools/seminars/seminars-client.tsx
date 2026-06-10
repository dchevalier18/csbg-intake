"use client";
import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Chip, CodeChip, Field, Panel } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { createSeminar, markAttendance } from "./actions";

export interface SeminarDTO {
  id: string;
  title: string;
  date: string;
  time: string;
  site: string;
  capacity: number;
  registered: number;
  srvCode: string;
  attendees: {
    id: number;
    name: string;
    clientId: string | null;
    applicationId: string | null;
    intakeStatus: string;
  }[];
}

export interface SrvOption { code: string; label: string }

const INTAKE_CHIP: Record<string, ReactNode> = {
  "enrolled": <Chip tone="sage">Enrolled client</Chip>,
  "in-progress": <Chip tone="amber">Intake in progress</Chip>,
  "not-started": <Chip tone="red">Not started</Chip>,
};

function intakeHref(a: SeminarDTO["attendees"][number]): string {
  const parts = a.name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  return `/intake?first=${encodeURIComponent(first)}&last=${encodeURIComponent(last)}&seminarAttendeeId=${a.id}`;
}

export function SeminarsClient({ seminars, srvOptions, today }: {
  seminars: SeminarDTO[]; srvOptions: SrvOption[]; today: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(seminars[0]?.id ?? "");
  const [showNew, setShowNew] = useState(false);

  // new-seminar form
  const [fTitle, setFTitle] = useState("");
  const [fDate, setFDate] = useState("");
  const [fTime, setFTime] = useState("");
  const [fSite, setFSite] = useState("");
  const [fCap, setFCap] = useState("30");
  const [fSrv, setFSrv] = useState(srvOptions[0]?.code ?? "SRV 3a");

  const sem = seminars.find((s) => s.id === open) ?? seminars[0];

  const submitNew = () => {
    startTransition(async () => {
      const res = await createSeminar({
        title: fTitle, date: fDate, time: fTime, site: fSite,
        capacity: Number(fCap), srvCode: fSrv,
      });
      toast(res.message);
      if (res.ok) {
        setShowNew(false);
        if (res.id) setOpen(res.id);
        setFTitle(""); setFDate(""); setFTime(""); setFSite(""); setFCap("30");
        setFSrv(srvOptions[0]?.code ?? "SRV 3a");
      }
    });
  };

  const postAttendance = (id: string) => {
    startTransition(async () => {
      const res = await markAttendance(id);
      toast(res.message);
    });
  };

  return (
    <div data-screen-label="Housing Counseling seminars">
      <div style={{ marginBottom: 12 }}>
        <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
      </div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Seminars<span className="red">.</span></h1>
          <p className="lede">Housing Counseling workshops — every attendee can flow into intake on the spot, so group services still produce client-level CSBG data.</p>
        </div>
        <button className="calv-btn calv-btn--secondary calv-btn--sm" onClick={() => setShowNew(true)}><I name="plus" size={14} /> New seminar</button>
      </div>

      {sem ? (
        <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 13, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {seminars.map((s) => (
              <button key={s.id} onClick={() => setOpen(s.id)}
                style={{
                  textAlign: "left", background: "#fff", borderRadius: 4, padding: "14px 16px", cursor: "pointer",
                  border: s.id === open ? "1.5px solid var(--calv-red)" : "1px solid var(--calv-slate-15)",
                  boxShadow: s.id === open ? "var(--shadow-md)" : "none", fontFamily: "var(--font-body)",
                }}>
                <div style={{ fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".02em", color: "var(--calv-slate)", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "var(--calv-slate-65)", marginBottom: 8 }}>{new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {s.time}<br />{s.site}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div className="meter" style={{ flex: 1 }}><i style={{ width: (s.capacity ? s.registered / s.capacity * 100 : 0) + "%", background: "var(--calv-teal)" }}></i></div>
                  <span style={{ fontFamily: "var(--font-h1)", fontSize: 12 }}>{s.registered}/{s.capacity}</span>
                </div>
              </button>
            ))}
          </div>

          <Panel title={sem.title} sub={new Date(sem.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + " · " + sem.time + " · " + sem.site}
            right={
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <CodeChip code={sem.srvCode} />
                {sem.date <= today ? (
                  <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={pending} onClick={() => postAttendance(sem.id)}>Mark attendance</button>
                ) : null}
              </div>
            }>
            {sem.attendees.length === 0 ? (
              <div className="empty">Roster opens when registration closes — {sem.registered} registered so far.</div>
            ) : (
              <table className="data">
                <thead><tr><th>Attendee</th><th>Client status</th><th></th></tr></thead>
                <tbody>
                  {sem.attendees.map((a) => (
                    <tr key={a.id}>
                      <td className="cname">{a.name}</td>
                      <td>{INTAKE_CHIP[a.intakeStatus]}</td>
                      <td style={{ textAlign: "right" }}>
                        {a.intakeStatus === "not-started" ? <Link className="calv-btn calv-btn--quiet calv-btn--sm" style={{ textDecoration: "none" }} href={intakeHref(a)}>Start intake</Link> :
                          a.intakeStatus === "in-progress" ? <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>In eligibility queue ({a.applicationId})</span> :
                            <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>Attendance will post as {sem.srvCode}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 14, background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4, padding: "10px 14px", fontSize: 12.5, lineHeight: 1.55 }}>
              After the session, mark attendance once — each attendee with a client record gets a {sem.srvCode} entry; the rest are prompted through quick intake or counted as anonymous outreach.
            </div>
          </Panel>
        </div>
      ) : (
        <Panel><div className="empty">No seminars scheduled yet — create the first one.</div></Panel>
      )}

      {showNew ? (
        <Modal title="New seminar" onClose={() => setShowNew(false)} width={520}>
          <div className="fgrid c2">
            <Field label="Title" required span={2}>
              <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="First-Time Homebuyer Workshop" />
            </Field>
            <Field label="Date" required>
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </Field>
            <Field label="Time">
              <input value={fTime} onChange={(e) => setFTime(e.target.value)} placeholder="9:00 AM – 1:00 PM" />
            </Field>
            <Field label="Site" span={2}>
              <input value={fSite} onChange={(e) => setFSite(e.target.value)} placeholder="CALV Main Office, Allentown" />
            </Field>
            <Field label="Capacity" required>
              <input type="number" min={1} value={fCap} onChange={(e) => setFCap(e.target.value)} />
            </Field>
            <Field label="Service code" hint="Posts to every attendee with a client record.">
              <select value={fSrv} onChange={(e) => setFSrv(e.target.value)}>
                {srvOptions.map((o) => <option key={o.code} value={o.code}>{o.code} — {o.label}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="calv-btn calv-btn--primary calv-btn--sm"
              disabled={pending || !fTitle.trim() || !fDate || !(Number(fCap) >= 1)}
              onClick={submitNew}>Create seminar</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
