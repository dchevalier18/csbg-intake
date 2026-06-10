"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/icons";
import { Avatar } from "@/components/ui";

export interface TopbarUser { name: string; role: string; initials: string }
interface SearchHit { id: string; name: string; sub: string; initial: string }

export function Topbar({ user, fyLabel, onSignOut }: {
  user: TopbarUser;
  fyLabel: string;
  onSignOut: () => Promise<void>;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const ctl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        if (res.ok) setResults(await res.json());
      } catch { /* aborted */ }
    }, 120);
    return () => { ctl.abort(); clearTimeout(id); };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="topbar">
      <div className="search">
        <I name="search" size={15} />
        <input
          placeholder="Search clients by name, ID, or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {results.length > 0 ? (
          <div className="results">
            {results.map((c) => (
              <button key={c.id} type="button" onClick={() => { setQ(""); setResults([]); router.push(`/clients/${c.id}`); }}>
                <span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>{c.initial}</span>
                <span>
                  <strong style={{ fontWeight: 600 }}>{c.name}</strong>
                  <span style={{ color: "var(--calv-slate-65)", marginLeft: 8 }}>{c.sub}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span className="fy-chip">{fyLabel} · OCT 1 – SEP 30</span>
        <div style={{ position: "relative" }} ref={wrapRef}>
          <button
            type="button"
            className="user-chip"
            onClick={() => setMenuOpen((o) => !o)}
            style={{ background: "none", border: 0, cursor: "pointer", padding: "4px 6px", borderRadius: 4 }}
          >
            <span>{user.name} <span className="role">· {user.role}</span></span>
            <Avatar initials={user.initials} />
          </button>
          {menuOpen ? (
            <div className="user-menu">
              <div className="user-menu-head">Signed in as {user.name}</div>
              <button type="button" onClick={() => { setMenuOpen(false); void onSignOut(); }}>
                <I name="logout" size={15} style={{ color: "var(--calv-slate-65)" }} />
                <span style={{ flex: 1, textAlign: "left" }}>Sign out<span style={{ color: "var(--calv-slate-65)", display: "block", fontSize: 11 }}>Switch users from the sign-in screen</span></span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
