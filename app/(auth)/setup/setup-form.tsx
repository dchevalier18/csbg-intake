"use client";
import { useActionState } from "react";
import { Field } from "@/components/ui";
import { completeSetup, type SetupState } from "./actions";

interface SetupDefaults {
  name: string;
  short: string;
  region: string;
  jurisdiction: string;
  csbgCeiling: number;
  incomeLookbackDays: number;
}

export function SetupForm({ defaults, jurisdictions }: {
  defaults: SetupDefaults;
  jurisdictions: Array<{ id: string; label: string }>;
}) {
  const [state, formAction, pending] = useActionState<SetupState, FormData>(completeSetup, {});

  return (
    <div className="login-wrap" style={{ "--brand": "#006269" } as React.CSSProperties}>
      <div className="login-brand">
        <h1>Welcome to<br />CAP Trellis</h1>
        <p>
          A few answers stand this system up for your agency: who you are, which poverty-guideline
          table applies, your state&apos;s eligibility policy, and the first administrator account.
          Everything here can be changed later in Settings.
        </p>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)" }}>
          CSBG Annual Report 3.0 · OMB 0970-0492
        </p>
      </div>
      <div className="login-form">
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 460 }}>
          <div>
            <div className="calv-label" style={{ marginBottom: 8 }}>Your agency</div>
            <div className="fgrid c2">
              <Field label="Organization name" required span={2}>
                <input name="orgName" defaultValue={defaults.name} placeholder="e.g. Riverbend Community Action" autoFocus />
              </Field>
              <Field label="Short name">
                <input name="short" defaultValue={defaults.short} placeholder="e.g. RCA" />
              </Field>
              <Field label="Service region">
                <input name="region" defaultValue={defaults.region} placeholder="Counties served" />
              </Field>
            </div>
          </div>

          <div>
            <div className="calv-label" style={{ marginBottom: 8 }}>Eligibility policy</div>
            <div className="fgrid c2">
              <Field label="Poverty-guideline table" hint="HHS publishes separate tables for AK and HI">
                <select name="jurisdiction" defaultValue={defaults.jurisdiction}>
                  {jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
                </select>
              </Field>
              <Field label="CSBG income ceiling" hint="Your state's limit, % of FPL">
                <select name="csbgCeiling" defaultValue={defaults.csbgCeiling}>
                  {[100, 125, 150, 175, 200].map((p) => <option key={p} value={p}>{p}% FPL</option>)}
                </select>
              </Field>
              <Field label="Income lookback" hint="State documentation policy" span={2}>
                <select name="incomeLookbackDays" defaultValue={defaults.incomeLookbackDays}>
                  {[[30, "30 days"], [60, "60 days"], [90, "90 days"], [365, "12 months"]].map(([v, l]) =>
                    <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div>
            <div className="calv-label" style={{ marginBottom: 8 }}>First administrator</div>
            <div className="fgrid c2">
              <Field label="Full name" required>
                <input name="adminName" placeholder="Your name" />
              </Field>
              <Field label="Username" required>
                <input name="username" autoComplete="username" placeholder="lowercase, no spaces" />
              </Field>
              <Field label="Password" required hint="At least 10 characters">
                <input name="password" type="password" autoComplete="new-password" />
              </Field>
              <Field label="Confirm password" required>
                <input name="confirm" type="password" autoComplete="new-password" />
              </Field>
            </div>
          </div>

          {state.error ? (
            <div style={{ fontSize: 12.5, color: "var(--calv-red)", lineHeight: 1.5 }}>{state.error}</div>
          ) : null}

          <button className="calv-btn calv-btn--primary" type="submit" disabled={pending}>
            {pending ? "Setting up…" : "Create my agency workspace"}
          </button>
          <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: 0, lineHeight: 1.5 }}>
            The latest HHS poverty guidelines are already loaded. Next you&apos;ll add programs,
            document requirements, and staff accounts in Settings.
          </p>
        </form>
      </div>
    </div>
  );
}
