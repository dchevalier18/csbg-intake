"use client";
import { useActionState, useRef, useState } from "react";
import { signIn, type SignInState } from "../actions";
import { Field, Avatar } from "@/components/ui";

interface DemoUser { name: string; role: string; username: string; initials: string }

export function LoginForm({ demoUsers }: { demoUsers: DemoUser[] }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function quickSignIn(u: DemoUser) {
    setUsername(u.username);
    setPassword("demo1234");
    // submit on the next frame so controlled inputs carry the new values
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <div className="login-card">
      <h2 className="calv-subhead" style={{ marginBottom: 4 }}>Sign in</h2>
      <p style={{ fontSize: 13, color: "var(--calv-slate-65)", margin: "0 0 18px" }}>
        Use your staff account. Access is scoped to your assigned programs.
      </p>
      {state.error ? <div className="login-error">{state.error}</div> : null}
      <form ref={formRef} action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Username" required>
          <input name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. dana" />
        </Field>
        <Field label="Password" required>
          <input name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <button className="calv-btn calv-btn--primary" disabled={pending || !username || !password}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div style={{ marginTop: 22 }}>
        <div className="calv-label" style={{ marginBottom: 4 }}>Demo accounts</div>
        <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "0 0 8px" }}>
          One click signs you in (password <code>demo1234</code>) — each account shows how program
          assignment reshapes the workspace.
        </p>
        <div className="login-demo">
          {demoUsers.map((u) => (
            <button key={u.username} type="button" onClick={() => quickSignIn(u)} disabled={pending}>
              <Avatar initials={u.initials} size={26} />
              <span style={{ flex: 1 }}>
                <strong style={{ fontWeight: 600 }}>{u.name}</strong>
                <span style={{ color: "var(--calv-slate-65)", display: "block", fontSize: 11 }}>{u.role}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
