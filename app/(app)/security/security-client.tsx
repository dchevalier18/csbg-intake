"use client";
/* My account security — TOTP enrollment + signed-in devices. */
import { useState } from "react";
import { Chip, Field, PageHead, Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { shortDate, localDateOf } from "@/lib/format";
import {
  startTotpEnrollment, confirmTotpEnrollment, disableTotp, regenerateRecovery,
  revokeMySession, signOutEverywhereElse,
} from "./actions";

interface SessionRow {
  fp: string;
  createdAt: string | null;
  expiresAt: string;
  userAgent: string | null;
  current: boolean;
}

function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export function SecurityClient({ totpEnabled, recoveryCount, sessions }: {
  totpEnabled: boolean;
  recoveryCount: number;
  sessions: SessionRow[];
}) {
  const toast = useToast();
  const [enrolling, setEnrolling] = useState<{ secret: string; otpauth: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const [manageCode, setManageCode] = useState("");

  async function onStart() {
    const res = await startTotpEnrollment();
    if (res.ok && res.secret && res.otpauth) setEnrolling({ secret: res.secret, otpauth: res.otpauth });
    toast(res.message);
  }

  async function onConfirm() {
    const res = await confirmTotpEnrollment(confirmCode);
    toast(res.message);
    if (res.ok) {
      setEnrolling(null);
      setConfirmCode("");
      if (res.recoveryCodes) setFreshCodes(res.recoveryCodes);
    }
  }

  async function onDisable() {
    const res = await disableTotp(manageCode);
    toast(res.message);
    if (res.ok) { setManageCode(""); setFreshCodes(null); }
  }

  async function onRegenerate() {
    const res = await regenerateRecovery(manageCode);
    toast(res.message);
    if (res.ok) { setManageCode(""); if (res.recoveryCodes) setFreshCodes(res.recoveryCodes); }
  }

  async function onRevoke(fp: string) {
    const res = await revokeMySession(fp);
    toast(res.message);
  }

  async function onSignOutOthers() {
    const res = await signOutEverywhereElse();
    toast(res.message);
  }

  const groupedSecret = (s: string) => s.match(/.{1,4}/g)?.join(" ") ?? s;

  return (
    <div>
      <PageHead
        title="Your account,"
        titleAccent="locked down."
        lede="Two-step verification protects the client records behind your sign-in. These settings are yours — every staff account manages its own."
      />

      <div className="row2" style={{ gridTemplateColumns: "1.1fr 1fr", alignItems: "start" }}>
        <Panel
          title="Two-step verification (authenticator app)"
          sub="After your password, a 6-digit code from your phone. Works with Google Authenticator, Microsoft Authenticator, Authy, 1Password, and any TOTP app."
          right={totpEnabled ? <Chip tone="sage">On</Chip> : <Chip>Off</Chip>}
        >
          {!totpEnabled && !enrolling ? (
            <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={onStart}>
              Turn on two-step verification
            </button>
          ) : null}

          {enrolling ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div className="calv-label" style={{ marginBottom: 6 }}>1 · Add the key to your authenticator app</div>
                <div style={{ fontFamily: "monospace", fontSize: 16, letterSpacing: ".08em", padding: "10px 14px", background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4, wordBreak: "break-all" }}>
                  {groupedSecret(enrolling.secret)}
                </div>
                <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "6px 0 0" }}>
                  Type it in manually (choose &ldquo;time-based&rdquo;), or on a phone <a href={enrolling.otpauth} style={{ fontWeight: 600 }}>tap here to open your authenticator</a>.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end" }}>
                <Field label="2 · Enter the 6-digit code the app shows">
                  <input value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} inputMode="numeric" placeholder="123 456" />
                </Field>
                <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={onConfirm} style={{ marginBottom: 2 }}>Verify & turn on</button>
                <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => { setEnrolling(null); setConfirmCode(""); }} style={{ marginBottom: 2 }}>Cancel</button>
              </div>
            </div>
          ) : null}

          {totpEnabled ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 12.5, color: "var(--calv-slate-65)", margin: 0 }}>
                {recoveryCount} single-use recovery code{recoveryCount === 1 ? "" : "s"} remaining. Changes below need a current code from your app.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "180px auto auto", gap: 10, alignItems: "end" }}>
                <Field label="Current code">
                  <input value={manageCode} onChange={(e) => setManageCode(e.target.value)} inputMode="numeric" placeholder="123 456" />
                </Field>
                <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onRegenerate} style={{ marginBottom: 2 }}>New recovery codes</button>
                <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onDisable} style={{ marginBottom: 2 }}>Turn off</button>
              </div>
            </div>
          ) : null}

          {freshCodes ? (
            <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--calv-sage-15)", border: "1px solid var(--calv-sage-35)", borderRadius: 4 }}>
              <div className="calv-label" style={{ marginBottom: 8 }}>Recovery codes — save these now, they are shown once</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, fontFamily: "monospace", fontSize: 13 }}>
                {freshCodes.map((c) => <span key={c}>{c}</span>)}
              </div>
              <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "8px 0 0" }}>
                Each works once if you lose your phone. Store them like a password — not on a sticky note on the monitor.
              </p>
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Signed-in devices"
          sub="Every browser currently signed in to your account. Sign out anything you don't recognize."
          right={<button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onSignOutOthers}>Sign out everywhere else</button>}
        >
          <table className="data">
            <thead><tr><th>Device</th><th>Signed in</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.fp}>
                  <td className="cname">{deviceLabel(s.userAgent)}{s.current ? <span style={{ marginLeft: 8 }}><Chip tone="sage">This browser</Chip></span> : null}</td>
                  <td>{s.createdAt ? shortDate(localDateOf(s.createdAt)) : "—"}</td>
                  <td>{shortDate(localDateOf(s.expiresAt))}</td>
                  <td style={{ textAlign: "right" }}>
                    {!s.current ? (
                      <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => onRevoke(s.fp)}>Sign out</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", marginTop: 12, lineHeight: 1.5 }}>
            Locked out of two-step verification with no recovery codes? Whoever runs your server can reset it:
            {" "}<code>npm run mfa:reset -- your-username</code> — the reset is written to the audit log.
          </p>
        </Panel>
      </div>
    </div>
  );
}
