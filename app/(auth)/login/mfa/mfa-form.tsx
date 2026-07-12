"use client";
import { useActionState } from "react";
import { Field } from "@/components/ui";
import { verifyMfa, type SignInState } from "../../actions";

export function MfaForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(verifyMfa, {});

  return (
    <div className="login-wrap" style={{ "--brand": "#006269" } as React.CSSProperties}>
      <div className="login-brand">
        <h1>One more<br />step, {name}.</h1>
        <p>
          Your account is protected with two-step verification. Open your authenticator
          app and enter the current 6-digit code — or use one of your recovery codes.
        </p>
      </div>
      <div className="login-form">
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 360 }}>
          <Field label="Verification code" required hint="6 digits from your app, or a recovery code (XXXX-XXXX)">
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123 456"
              style={{ fontSize: 20, letterSpacing: ".12em", textAlign: "center" }}
            />
          </Field>
          {state.error ? (
            <div role="alert" style={{ fontSize: 12.5, color: "var(--calv-red)", lineHeight: 1.5 }}>{state.error}</div>
          ) : null}
          <button className="calv-btn calv-btn--primary" type="submit" disabled={pending}>
            {pending ? "Checking…" : "Verify & sign in"}
          </button>
          <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: 0, lineHeight: 1.5 }}>
            Locked out with no recovery codes? Whoever runs your server can reset
            two-step verification with <code>npm run mfa:reset -- your-username</code>.
          </p>
        </form>
      </div>
    </div>
  );
}
