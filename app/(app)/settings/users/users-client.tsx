"use client";
import { useEffect, useState } from "react";
import { Panel, Field, Avatar } from "@/components/ui";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { ROLES } from "@/lib/program-types";
import { addUser, updateUserRole, setUserAccess, toggleUserProgram, removeUser } from "./actions";

interface URow {
  id: string;
  name: string;
  role: string;
  initials: string;
  access: string;
  programs: string[];
}

interface PRow {
  id: string;
  short: string;
  color: string;
}

export function UsersClient({ users, programs, currentUserId }: {
  users: URow[]; programs: PRow[]; currentUserId: string;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<URow[]>(users);
  useEffect(() => { setRows(users); }, [users]);

  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<string>("Case Worker");

  function patch(id: string, p: Partial<URow>) {
    setRows((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));
  }

  async function onAdd() {
    const res = await addUser(newName, newUsername, newRole);
    if (res.ok) { setNewName(""); setNewUsername(""); }
    if (res.message) toast(res.message);
  }

  async function onRole(u: URow, role: string) {
    patch(u.id, { role });
    const res = await updateUserRole(u.id, role);
    if (!res.ok && res.message) toast(res.message);
  }

  async function onAccess(u: URow, all: boolean) {
    patch(u.id, { access: all ? "all" : "assigned" });
    const res = await setUserAccess(u.id, all);
    if (!res.ok && res.message) toast(res.message);
  }

  async function onToggleProg(u: URow, pid: string) {
    const has = u.programs.includes(pid);
    patch(u.id, { programs: has ? u.programs.filter((x) => x !== pid) : [...u.programs, pid] });
    const res = await toggleUserProgram(u.id, pid);
    if (!res.ok && res.message) toast(res.message);
  }

  async function onRemove(u: URow) {
    const res = await removeUser(u.id);
    if (res.message) toast(res.message);
  }

  const addDisabled = newName.trim().length < 3;

  return (
    <div>
      <Panel title="Add a user" sub="New users start with no program access — they can't see any client enrollments until assigned." style={{ marginBottom: 13 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <Field label="Full name"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Sam Reyes" /></Field>
          <Field label="Username" required><input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))} placeholder="e.g. sreyes" /></Field>
          <Field label="Role"><select value={newRole} onChange={(e) => setNewRole(e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={addDisabled}
            style={addDisabled ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={onAdd}>
            <I name="plus" size={13} /> Add user
          </button>
        </div>
      </Panel>

      <Panel title="Users & program access" sub="Program assignment controls everything a user can see: client enrollments, applications, services, and program tools. Data Admins and Program Managers can hold all-program access.">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((u) => {
            const all = u.access === "all";
            const isSelf = u.id === currentUserId;
            return (
              <div key={u.id} style={{ display: "grid", gridTemplateColumns: "230px 170px 1fr auto", gap: 16, alignItems: "start", padding: "14px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Avatar initials={u.initials} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}{isSelf ? <span style={{ color: "var(--calv-slate-65)", fontWeight: 300 }}> (you)</span> : null}</div>
                    <div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{all ? "All programs" : u.programs.length + " program" + (u.programs.length === 1 ? "" : "s") + " assigned"}</div>
                  </div>
                </div>
                <div className="field">
                  <select value={u.role} onChange={(e) => onRole(u, e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                </div>
                <div>
                  <label style={{ display: "inline-flex", gap: 7, alignItems: "center", fontSize: 12.5, cursor: "pointer", marginBottom: all ? 0 : 8 }}>
                    <input type="checkbox" checked={all} onChange={(e) => onAccess(u, e.target.checked)} style={{ accentColor: "var(--brand)", width: 15, height: 15 }} />
                    All programs
                  </label>
                  {!all ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {programs.map((p) => {
                        const onIt = u.programs.includes(p.id);
                        return (
                          <button key={p.id} onClick={() => onToggleProg(u, p.id)} title={onIt ? "Click to unassign" : "Click to assign"}
                            style={{
                              display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer",
                              fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".03em",
                              padding: "4px 10px", borderRadius: 999,
                              background: onIt ? "var(--calv-teal-15)" : "#fff", color: onIt ? "var(--calv-teal)" : "var(--calv-slate-65)",
                              border: onIt ? "1px solid var(--calv-teal-35)" : "1px dashed var(--calv-slate-35)",
                            }}>
                            <span style={{ width: 7, height: 7, borderRadius: 99, background: p.color }}></span>{p.short}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={isSelf}
                  style={isSelf ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
                  onClick={() => onRemove(u)} title={isSelf ? "You can't remove yourself" : "Remove user"}><I name="trash" size={13} /></button>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "var(--calv-slate-65)", marginTop: 14, lineHeight: 1.55 }}>
          Tip: sign in as any demo account from the login screen to preview how assignments reshape the workspace.
        </p>
      </Panel>
    </div>
  );
}
