"use client";
/* Settings → Organization — white-label config (design: screens-settings.jsx / OrgSettings). */
import { useRef, useState, type ChangeEvent } from "react";
import { Panel, Field } from "@/components/ui";
import { useToast } from "@/components/toast";
import { ACCENTS } from "@/lib/program-types";
import { updateOrgAccent, updateOrgLogo, updateOrgProfile } from "./actions";

export interface OrgProps {
  name: string;
  short: string;
  tagline: string;
  region: string;
  accent: string;
  logoMode: string;
  logoData: string | null;
  fyStart: string;
  csbgCeiling: number;
}

const LABEL_KICK: React.CSSProperties = {
  fontFamily: "var(--font-sub)", fontSize: 10, fontWeight: 700, letterSpacing: ".04em",
  textTransform: "uppercase", color: "var(--calv-slate-65)", marginBottom: 8,
};

export function OrgSettingsClient({ org }: { org: OrgProps }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: org.name, short: org.short, tagline: org.tagline,
    region: org.region, fyStart: org.fyStart, csbgCeiling: org.csbgCeiling,
  });
  const savedRef = useRef(JSON.stringify({
    name: org.name, short: org.short, tagline: org.tagline,
    region: org.region, fyStart: org.fyStart, csbgCeiling: org.csbgCeiling,
  }));
  const [accent, setAccent] = useState(org.accent);
  const [logoMode, setLogoMode] = useState(org.logoMode);
  const [logoData, setLogoData] = useState<string | null>(org.logoData);

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function saveProfile(next = form) {
    const snap = JSON.stringify(next);
    if (snap === savedRef.current) return; // nothing changed since the last save
    const res = await updateOrgProfile(next);
    if (res.ok) savedRef.current = snap;
    toast(res.message);
  }

  function setAndSave<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    const next = { ...form, [k]: v };
    setForm(next);
    void saveProfile(next);
  }

  async function pickAccent(hex: string) {
    setAccent(hex);
    const res = await updateOrgAccent(hex);
    toast(res.message);
  }

  async function pickLogoMode(mode: string) {
    setLogoMode(mode);
    const res = await updateOrgLogo({ mode });
    toast(res.message);
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!f) return;
    if (f.size > 500 * 1024) {
      toast("That image is too large — keep it under 500 KB.");
      return;
    }
    const r = new FileReader();
    r.onload = async () => {
      const data = String(r.result ?? "");
      const res = await updateOrgLogo({ mode: "upload", data });
      if (res.ok) {
        setLogoMode("upload");
        setLogoData(data);
      }
      toast(res.message);
    };
    r.readAsDataURL(f);
  }

  return (
    <div className="row2" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <Panel title="Agency profile" sub="Names and region appear across the workspace and on exported CSBG reports.">
          <div className="fgrid c2">
            <Field label="Organization name" required span={2}>
              <input value={form.name} onChange={(e) => setField("name", e.target.value)} onBlur={() => void saveProfile()} />
            </Field>
            <Field label="Short name / abbreviation">
              <input value={form.short} onChange={(e) => setField("short", e.target.value)} onBlur={() => void saveProfile()} placeholder="e.g. CALV" />
            </Field>
            <Field label="Tagline">
              <input value={form.tagline} onChange={(e) => setField("tagline", e.target.value)} onBlur={() => void saveProfile()} />
            </Field>
            <Field label="Service region" span={2}>
              <input value={form.region} onChange={(e) => setField("region", e.target.value)} onBlur={() => void saveProfile()} placeholder="Counties served" />
            </Field>
            <Field label="Fiscal year starts" hint="CSBG federal FY runs Oct 1 – Sep 30">
              <select value={form.fyStart} onChange={(e) => setAndSave("fyStart", e.target.value)}>
                {["October", "July", "January", "April"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="CSBG income ceiling" hint="% of Federal Poverty Level — your state's limit">
              <select value={form.csbgCeiling} onChange={(e) => setAndSave("csbgCeiling", Number(e.target.value))}>
                {[100, 125, 150, 175, 200].map((p) => <option key={p} value={p}>{p}% FPL</option>)}
              </select>
            </Field>
          </div>
        </Panel>

        <Panel title="Brand color" sub="Sets the accent across buttons, highlights, and headlines. Pick the closest match to your agency's identity.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => void pickAccent(a.hex)}
                style={{
                  display: "flex", gap: 9, alignItems: "center", padding: "10px 12px", cursor: "pointer", textAlign: "left",
                  background: "#fff", borderRadius: 4, fontFamily: "var(--font-body)", fontSize: 12.5,
                  border: accent === a.hex ? "2px solid " + a.hex : "1px solid var(--calv-slate-15)",
                }}
              >
                <span style={{ width: 22, height: 22, borderRadius: 4, background: a.hex, flex: "none", boxShadow: accent === a.hex ? "0 0 0 2px #fff inset" : "none" }}></span>
                {a.name}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 13, position: "sticky", top: 16 }}>
        <Panel title="Logo" sub="Shown top-left in the navigation.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {([["calv", "CALV brand mark"], ["wordmark", "Text wordmark (" + (form.short || "abbr.") + ")"], ["upload", "Upload your logo"]] as const).map(([mode, label]) => (
              <label
                key={mode}
                style={{
                  display: "flex", gap: 10, alignItems: "center", padding: "10px 12px",
                  border: "1px solid var(--calv-slate-15)", borderRadius: 4, fontSize: 13, cursor: "pointer",
                  background: logoMode === mode ? "var(--calv-sand-15)" : "#fff",
                }}
              >
                <input
                  type="radio"
                  name="logoMode"
                  checked={logoMode === mode}
                  onChange={() => (mode === "upload" ? fileRef.current?.click() : void pickLogoMode(mode))}
                  style={{ accentColor: accent }}
                />
                {label}
              </label>
            ))}
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
          </div>
          <div style={LABEL_KICK}>Preview on nav</div>
          <div style={{ background: "var(--calv-slate)", borderRadius: 4, padding: "16px 18px" }}>
            {logoMode === "upload" && logoData ? (
              <div style={{ background: "#fff", borderRadius: 4, padding: "8px 11px", display: "inline-flex", maxWidth: 184 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoData} alt={form.name} style={{ maxHeight: 40, maxWidth: 160, display: "block" }} />
              </div>
            ) : logoMode === "wordmark" ? (
              <div style={{ fontFamily: "var(--font-h1)", fontSize: 25, letterSpacing: ".02em", color: "#fff", textTransform: "uppercase", lineHeight: 1 }}>
                {form.short || form.name}
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/brand/logo-white.svg" alt={form.name} style={{ height: 40, display: "block" }} />
            )}
          </div>
          {logoMode === "upload" && logoData ? (
            <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>
              Replace image
            </button>
          ) : null}
        </Panel>
        <div style={{ background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4, padding: "14px 16px", fontSize: 12.5, lineHeight: 1.55, color: "var(--calv-slate)" }}>
          Changes apply live and are saved to this workspace. These settings are scoped to your agency&rsquo;s workspace — each CAA running on the platform sees only its own brand, programs, and data.
        </div>
      </div>
    </div>
  );
}
