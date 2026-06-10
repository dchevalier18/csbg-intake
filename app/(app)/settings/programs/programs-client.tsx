"use client";
/* Settings → Programs — configure programs by type (design: screens-settings.jsx / ProgramSettings + ProgramEditor). */
import { useState } from "react";
import { Chip, Field } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { DATA_SOURCES, PROGRAM_COLORS, PROGRAM_TYPES, capLabel, programType } from "@/lib/program-types";
import { createProgram, removeProgram, updateProgram } from "./actions";

export interface ProgramCard {
  id: string;
  name: string;
  short: string;
  color: string;
  type: string;
  sources: string[];
  enrolled: number;
}

const KICK: React.CSSProperties = {
  fontFamily: "var(--font-sub)", fontSize: 10, fontWeight: 700, letterSpacing: ".04em",
  textTransform: "uppercase", color: "var(--calv-slate-65)", marginBottom: 6,
};

export function ProgramsSettingsClient({ programs }: { programs: ProgramCard[] }) {
  const toast = useToast();
  const [editing, setEditing] = useState<ProgramCard | "new" | null>(null);

  return (
    <div>
      <div className="toolbar">
        <span style={{ fontSize: 13, color: "var(--calv-slate-65)" }}>
          {programs.length} programs configured · each program&rsquo;s <strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>type</strong> decides which tools and data sources turn on.
        </span>
        <button type="button" className="calv-btn calv-btn--primary calv-btn--sm" style={{ marginLeft: "auto" }} onClick={() => setEditing("new")}>
          <I name="plus" size={14} /> Add program
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 13 }}>
        {programs.map((p) => {
          const t = programType(p.type);
          return (
            <div key={p.id} className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ height: 5, background: p.color }}></div>
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <h3 className="ptitle" style={{ fontSize: 17 }}>{p.name}</h3>
                    <p className="psub" style={{ margin: "3px 0 0" }}>{t.name} · {p.enrolled} enrolled</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setEditing(p)} title={"Edit " + p.name}>
                      <I name="edit" size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={KICK}>Tools activated</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <Chip outline>Intake &amp; services</Chip>
                    {t.caps.length
                      ? t.caps.map((c) => <Chip key={c} tone="teal">{capLabel(c)}</Chip>)
                      : <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>core case management only</span>}
                  </div>
                </div>
                {p.sources.length ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={KICK}>Data sources</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {p.sources.map((s) => <Chip key={s} tone="amber"><I name="plug" size={11} /> {s}</Chip>)}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {editing ? (
        <ProgramEditor
          program={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          toast={toast}
        />
      ) : null}
    </div>
  );
}

function ProgramEditor({ program, onClose, toast }: {
  program: ProgramCard | null;
  onClose: () => void;
  toast: (msg: string) => void;
}) {
  const isNew = !program;
  const [name, setName] = useState(program ? program.name : "");
  const [short, setShort] = useState(program ? program.short : "");
  const [typeId, setTypeId] = useState(program ? program.type : "case-mgmt");
  const [color, setColor] = useState(program ? program.color : PROGRAM_COLORS[1]);
  const t = programType(typeId);
  const [sources, setSources] = useState<string[]>(program ? program.sources.slice() : t.sources.slice());
  const [busy, setBusy] = useState(false);

  // when type changes on a NEW program, adopt that type's recommended sources
  function pickType(id: string) {
    setTypeId(id);
    if (isNew) setSources(programType(id).sources.slice());
  }
  function toggleSource(s: string) {
    setSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const payload = { name: name.trim(), short: (short || name).trim().slice(0, 22), color, type: typeId, sources };
    const res = program ? await updateProgram(program.id, payload) : await createProgram(payload);
    setBusy(false);
    toast(res.message);
    if (res.ok) onClose();
  }

  async function remove() {
    if (!program || busy) return;
    setBusy(true);
    const res = await removeProgram(program.id);
    setBusy(false);
    toast(res.message);
    if (res.ok) onClose();
  }

  return (
    <Modal title={isNew ? "Add a program" : "Edit " + program!.name} onClose={onClose} width={720}>
      <div className="fgrid c2" style={{ marginBottom: 18 }}>
        <Field label="Program name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency Rental Assistance" autoFocus />
        </Field>
        <Field label="Short label" hint="Shown on chips & tables">
          <input value={short} onChange={(e) => setShort(e.target.value)} placeholder="e.g. ERA" />
        </Field>
      </div>

      <div className="calv-label" style={{ marginBottom: 10 }}>Program type — this decides which tools turn on</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        {PROGRAM_TYPES.map((pt) => (
          <button
            key={pt.id}
            type="button"
            onClick={() => pickType(pt.id)}
            style={{
              textAlign: "left", padding: "12px 14px", borderRadius: 4, cursor: "pointer", background: "#fff",
              border: typeId === pt.id ? "2px solid var(--brand)" : "1px solid var(--calv-slate-15)",
            }}
          >
            <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 5 }}>
              <I name={pt.icon} size={16} style={{ color: typeId === pt.id ? "var(--brand)" : "var(--calv-slate-65)" }} />
              <span style={{ fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".02em" }}>{pt.name}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--calv-slate-65)", lineHeight: 1.45, marginBottom: 8 }}>{pt.blurb}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {pt.caps.length
                ? pt.caps.map((c) => <span key={c} className="chip teal" style={{ fontSize: 9.5, padding: "2px 7px" }}>{capLabel(c)}</span>)
                : <span style={{ fontSize: 11, color: "var(--calv-slate-35)" }}>core only</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="fgrid c2" style={{ marginBottom: 18, alignItems: "start" }}>
        <div>
          <div className="calv-label" style={{ marginBottom: 8 }}>Color</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PROGRAM_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                title={c}
                style={{ width: 30, height: 30, borderRadius: 4, background: c, cursor: "pointer", border: color === c ? "3px solid var(--calv-slate)" : "1px solid var(--calv-slate-15)" }}
              ></button>
            ))}
          </div>
        </div>
        <div>
          <div className="calv-label" style={{ marginBottom: 8 }}>Data sources to connect</div>
          {t.sources.length ? (
            <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "0 0 8px" }}>
              Recommended for {t.name}: {t.sources.join(", ")}.
            </p>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {DATA_SOURCES.map((s) => (
              <label
                key={s}
                style={{
                  display: "flex", gap: 6, alignItems: "center", padding: "6px 10px",
                  border: "1px solid var(--calv-slate-15)", borderRadius: 4, fontSize: 12, cursor: "pointer",
                  background: sources.includes(s) ? "var(--calv-amber-15)" : "#fff",
                }}
              >
                <input type="checkbox" checked={sources.includes(s)} onChange={() => toggleSource(s)} style={{ accentColor: "var(--brand)" }} /> {s}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
        {!isNew ? (
          <button type="button" className="calv-btn calv-btn--ghost calv-btn--sm" onClick={() => void remove()}>
            <I name="trash" size={13} /> Remove program
          </button>
        ) : <span></span>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="calv-btn calv-btn--primary calv-btn--sm"
            disabled={!name.trim() || busy}
            style={!name.trim() || busy ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
            onClick={() => void submit()}
          >
            <I name="check" size={14} /> {isNew ? "Add program" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
