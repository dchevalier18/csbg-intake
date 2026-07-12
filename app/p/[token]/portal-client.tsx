"use client";
/* Client self-service portal — the REAL mobile page an applicant opens from a
   text link. Mobile-first (max-width 520 via .portal-body, 44px+ touch targets),
   plain language, three things only: where you stand, what we need, what's next.
   All interactivity (photo uploads, EN/ES toggle) lives here; no DB imports. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/icons";
import { Chip } from "@/components/ui";
import { useToast } from "@/components/toast";
import { portalUploadDoc } from "./actions";

export type PortalHintKey = "received" | "verified" | "income" | "residency" | "id" | "generic";
export interface PortalDoc { key: string; label: string; status: string; hintKey: PortalHintKey }
export interface PortalOrg { name: string; short: string; logoMode: string; logoData: string | null; contactLine: string }
export interface PortalAppointment { what: string; when: string; where: string }

type Lang = "en" | "es";
type StepKey = "started" | "docs" | "review" | "decision";

const STR: Record<Lang, {
  hi: (n: string) => string;
  sub: (program: string, id: string) => string;
  stand: string;
  need: string;
  next: string;
  steps: Record<StepKey, string>;
  waiting: (n: number) => string;
  hints: Record<PortalHintKey, string>;
  snap: string;
  chipSubmitted: string;
  chipVerified: string;
  questions: (n: string) => string;
  toast: (cw: string) => string;
  enrolledTitle: string;
  enrolledBody: (program: string) => string;
  deniedTitle: string;
  deniedBody: string;
}> = {
  en: {
    hi: (n) => `Hi, ${n}.`,
    sub: (program, id) => `${program} application · ${id}`,
    stand: "Where you stand",
    need: "What we need",
    next: "What's next",
    steps: {
      started: "Application started",
      docs: "Documents",
      review: "Eligibility review",
      decision: "Enrollment decision",
    },
    waiting: (n) => `We're waiting on ${n === 0 ? "our review" : `${n} document${n === 1 ? "" : "s"}`} from you`,
    hints: {
      received: "Received — being reviewed",
      verified: "Verified",
      income: "Pay stubs or award letter",
      residency: "Lease, utility bill, or PA ID",
      id: "Driver's license or photo ID",
      generic: "Snap a clear photo",
    },
    snap: "Snap a photo",
    chipSubmitted: "Submitted",
    chipVerified: "Verified",
    questions: (n) => `Questions? Call ${n}`,
    toast: (cw) => `Document received — ${cw} is notified and the eligibility queue updates in real time.`,
    enrolledTitle: "You're enrolled!",
    enrolledBody: (program) => `Welcome to ${program}. Your case worker will reach out with next steps.`,
    deniedTitle: "Decision made",
    deniedBody: "Your case worker will follow up with you about this application.",
  },
  es: {
    hi: (n) => `Hola, ${n}.`,
    sub: (program, id) => `Solicitud de ${program} · ${id}`,
    stand: "Dónde estás",
    need: "Qué necesitamos",
    next: "Qué sigue",
    steps: {
      started: "Solicitud iniciada",
      docs: "Documentos",
      review: "Revisión de elegibilidad",
      decision: "Decisión de inscripción",
    },
    waiting: (n) => (n === 0
      ? "Estamos revisando tu solicitud"
      : `Nos falta${n === 1 ? "" : "n"} ${n} documento${n === 1 ? "" : "s"} tuyo${n === 1 ? "" : "s"}`),
    hints: {
      received: "Recibido — en revisión",
      verified: "Verificado",
      income: "Talones de pago o carta de beneficios",
      residency: "Contrato de renta, factura de servicios o ID de PA",
      id: "Licencia de conducir o identificación con foto",
      generic: "Toma una foto clara",
    },
    snap: "Toma una foto",
    chipSubmitted: "Enviado",
    chipVerified: "Verificado",
    questions: (n) => `¿Preguntas? Llama a ${n}`,
    toast: (cw) => `Documento recibido — ${cw} recibirá un aviso y tu lista se actualiza al momento.`,
    enrolledTitle: "¡Estás inscrito!",
    enrolledBody: (program) => `Bienvenido a ${program}. Tu trabajador social te contactará con los próximos pasos.`,
    deniedTitle: "Decisión tomada",
    deniedBody: "Tu trabajador social se comunicará contigo sobre esta solicitud.",
  },
};

function PortalLogo({ org }: { org: PortalOrg }) {
  if (org.logoMode === "upload" && org.logoData) {
    return (
      <div style={{ background: "#fff", borderRadius: 4, padding: "6px 10px", display: "inline-flex", marginBottom: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={org.logoData} alt={org.name} style={{ maxHeight: 28, maxWidth: 150, display: "block", margin: 0 }} />
      </div>
    );
  }
  if (org.logoMode === "wordmark") {
    return (
      <div style={{ fontFamily: "var(--font-h1)", fontSize: 22, letterSpacing: ".02em", textTransform: "uppercase", color: "#fff", marginBottom: 12 }}>
        {org.short || org.name}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-white.svg" alt={org.name} style={{ height: 30, marginBottom: 12 }} />;
}

export function PortalClient({ token, first, appId, programName, stage, appliedShort, docs, appointment, caseworkerName, org }: {
  token: string;
  first: string;
  appId: string;
  programName: string;
  stage: string;
  appliedShort: string;
  docs: PortalDoc[];
  appointment: PortalAppointment | null;
  caseworkerName: string;
  org: PortalOrg;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const s = STR[lang];
  const cwFirst = caseworkerName.split(" ")[0];
  const missing = docs.filter((d) => d.status === "missing").length;

  const steps: { key: StepKey; done: boolean; current?: boolean; date?: string }[] =
    stage === "approved"
      ? [
          { key: "started", done: true, date: appliedShort },
          { key: "docs", done: true },
          { key: "review", done: true },
          { key: "decision", done: true },
        ]
      : [
          { key: "started", done: true, date: appliedShort },
          { key: "docs", done: stage !== "docs", current: stage === "docs" },
          { key: "review", done: false, current: stage === "review" || stage === "decision" },
          { key: "decision", done: false },
        ];

  async function pick(docKey: string, file: File | undefined) {
    if (!file || busy) return;
    setBusy(docKey);
    try {
      const res = await portalUploadDoc(token, docKey);
      toast(res.ok ? s.toast(cwFirst) : res.message);
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  /* ---------- sections ---------- */

  const stepsSection = (
    <div className="portal-sect">
      <div className="kick">{s.stand}</div>
      <div className="portal-card">
        {steps.map((st, i) => (
          <div key={st.key} style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative", paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
            {i < steps.length - 1 ? (
              <span style={{ position: "absolute", left: 10, top: 22, bottom: 0, width: 2, background: st.done ? "var(--calv-sage)" : "var(--calv-slate-15)" }} />
            ) : null}
            <span style={{
              width: 22, height: 22, borderRadius: 99, flex: "none", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              background: st.done ? "var(--calv-sage)" : st.current ? "var(--calv-amber)" : "var(--calv-slate-15)",
              color: st.done || st.current ? "#fff" : "var(--calv-slate-65)",
            }}>{st.done ? <I name="check" size={12} /> : <span style={{ fontFamily: "var(--font-h1)", fontSize: 11 }}>{i + 1}</span>}</span>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: st.current ? 600 : 400 }}>
                {s.steps[st.key]}
                {st.date ? <span style={{ color: "var(--calv-slate-65)", fontWeight: 300 }}> · {st.date}</span> : null}
              </div>
              {st.current ? <div style={{ fontSize: 12.5, color: "#8A6410" }}>{s.waiting(missing)}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const docsSection = (
    <div className="portal-sect" style={{ padding: "16px 20px 6px" }}>
      <div className="kick">{s.need}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {docs.map((d) => (
          <div key={d.key} className="portal-doc">
            <I name="doc" size={18} style={{ color: d.status === "missing" ? "#8A6410" : "var(--calv-teal)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{d.label}</div>
              <div style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>{s.hints[d.hintKey]}</div>
            </div>
            {d.status === "missing" ? (
              <label className="portal-upload-btn" style={{ opacity: busy === d.key ? 0.65 : 1 }}>
                <I name="upload" size={14} /> {s.snap}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={busy !== null}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    void pick(d.key, f);
                  }}
                />
              </label>
            ) : d.status === "verified" ? (
              <Chip tone="sage">{s.chipVerified}</Chip>
            ) : (
              <Chip tone="teal">{s.chipSubmitted}</Chip>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const whatsNext = (showAppointment: boolean) => (
    <div className="portal-sect" style={{ padding: "16px 20px 28px" }}>
      <div className="kick">{s.next}</div>
      {showAppointment && appointment ? (
        <div className="portal-card" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
            <I name="cal" size={16} style={{ color: "var(--calv-teal)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{appointment.what}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--calv-slate-65)", lineHeight: 1.5 }}>
            {appointment.when}<br />{appointment.where}
          </div>
        </div>
      ) : null}
      <div style={{ background: "var(--calv-teal-15)", borderRadius: 6, padding: "13px 16px", display: "flex", gap: 10, alignItems: "center" }}>
        <I name="phone" size={16} style={{ color: "var(--calv-teal)" }} />
        <div style={{ fontSize: 13, lineHeight: 1.45 }}>
          <strong style={{ fontWeight: 600 }}>{s.questions(caseworkerName)}</strong>
          {org.contactLine ? <><br /><span style={{ color: "var(--calv-slate-65)" }}>{org.contactLine}</span></> : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="portal-body" data-screen-label="Client self-service portal">
      <div className="portal-head" style={{ position: "relative" }}>
        <PortalLogo org={org} />
        <div className="hi">{s.hi(first)}</div>
        <div className="sub">{s.sub(programName, appId)}</div>
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", border: "1px solid rgba(255,255,255,.35)", borderRadius: 4, overflow: "hidden" }}>
          {(["en", "es"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              style={{
                minWidth: 44, minHeight: 32, padding: "0 10px", border: 0, cursor: "pointer",
                fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase",
                background: lang === l ? "#fff" : "transparent",
                color: lang === l ? "var(--calv-slate)" : "rgba(255,255,255,.75)",
              }}
            >{l.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {stage === "denied" ? (
        <>
          <div className="portal-sect">
            <div className="portal-card" style={{ background: "var(--calv-sand-15)", borderColor: "var(--calv-sand-35)" }}>
              <div style={{ fontFamily: "var(--font-h1)", fontSize: 18, textTransform: "uppercase", letterSpacing: ".02em" }}>{s.deniedTitle}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{s.deniedBody}</div>
            </div>
          </div>
          {whatsNext(false)}
        </>
      ) : (
        <>
          {stage === "approved" ? (
            <div className="portal-sect">
              <div className="portal-card" style={{ background: "var(--calv-sage-15)", borderColor: "var(--calv-sage-35)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ width: 22, height: 22, borderRadius: 99, flex: "none", background: "var(--calv-sage)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <I name="check" size={12} />
                </span>
                <div>
                  <div style={{ fontFamily: "var(--font-h1)", fontSize: 18, textTransform: "uppercase", letterSpacing: ".02em", color: "#2F5A41" }}>{s.enrolledTitle}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 3 }}>{s.enrolledBody(programName)}</div>
                </div>
              </div>
            </div>
          ) : null}
          {stepsSection}
          {stage === "approved" ? null : docsSection}
          {whatsNext(true)}
        </>
      )}
    </div>
  );
}
