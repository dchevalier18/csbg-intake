"use client";
import { useEffect, useRef, useState } from "react";
import { Panel, Field, Chip } from "@/components/ui";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  updateIntakeField, removeIntakeField, addIntakeField,
  updateListValue, removeListValue, addListValue,
} from "./actions";

const FIELD_TYPE_LABELS: Record<string, string> = {
  list: "Standard list",
  choice: "Choice list",
  yesno: "Yes / No",
  text: "Text",
  number: "Number",
  date: "Date",
};

interface FRow {
  id: string;
  label: string;
  code: string;
  type: string;
  listKey: string | null;
  optionsText: string | null;
  enabled: number;
  builtin: number;
}

interface LRow {
  key: string;
  label: string;
  values: Array<{ id: number; value: string }>;
}

export function FormsClient({ fields, lists }: { fields: FRow[]; lists: LRow[] }) {
  const toast = useToast();
  const [sel, setSel] = useState(lists[0]?.key ?? "");
  useEffect(() => {
    if (!lists.some((l) => l.key === sel)) setSel(lists[0]?.key ?? "");
  }, [lists, sel]);
  const listsPanelRef = useRef<HTMLDivElement>(null);

  const [newVal, setNewVal] = useState("");
  const [qLabel, setQLabel] = useState("");
  const [qType, setQType] = useState("choice");
  const [qOpts, setQOpts] = useState("");
  const [qCode, setQCode] = useState("");

  const selList = lists.find((l) => l.key === sel);

  function selectList(key: string) {
    setSel(key);
    listsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onRemoveField(id: string) {
    const res = await removeIntakeField(id);
    if (res.message) toast(res.message);
  }

  async function onAddField() {
    const res = await addIntakeField(qLabel, qType, qOpts, qCode);
    if (res.ok) { setQLabel(""); setQOpts(""); setQCode(""); }
    if (res.message) toast(res.message);
  }

  async function onRemoveValue(id: number) {
    const res = await removeListValue(id);
    if (res.message) toast(res.message);
  }

  async function onAddValue() {
    const v = newVal.trim();
    if (!v || !selList) return;
    const res = await addListValue(selList.key, v);
    if (res.ok) setNewVal("");
    if (res.message) toast(res.message);
  }

  const addQDisabled = qLabel.trim().length < 3 || (qType === "choice" && !qOpts.trim());

  return (
    <div>
      <Panel title="Intake questions · characteristics step" sub="Turn questions on or off, relabel them, or add new ones as CSBG data requirements change. Enabled questions count toward each record's report-readiness meter." style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {fields.map((fd) => (
            <FieldRow key={fd.id} fd={fd}
              listLabel={fd.listKey ? (lists.find((l) => l.key === fd.listKey)?.label ?? fd.listKey) : ""}
              onSelectList={selectList} onRemove={onRemoveField} />
          ))}
        </div>
        <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4 }}>
          <div className="calv-label" style={{ marginBottom: 10 }}>Add a question</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 130px 1.4fr 90px auto", gap: 12, alignItems: "end" }}>
            <Field label="Question label"><input value={qLabel} onChange={(e) => setQLabel(e.target.value)} placeholder="e.g. Primary language" /></Field>
            <Field label="Answer type"><select value={qType} onChange={(e) => setQType(e.target.value)}>{["choice", "text", "yesno", "number", "date"].map((ty) => <option key={ty} value={ty}>{FIELD_TYPE_LABELS[ty]}</option>)}</select></Field>
            <Field label="Options (if choice list)"><input value={qOpts} onChange={(e) => setQOpts(e.target.value)} placeholder="English, Spanish, Other" disabled={qType !== "choice"} style={qType !== "choice" ? { opacity: 0.4 } : undefined} /></Field>
            <Field label="CSBG code"><input value={qCode} onChange={(e) => setQCode(e.target.value)} placeholder="e.g. C9" /></Field>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={addQDisabled}
              style={addQDisabled ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={onAddField}><I name="plus" size={13} /> Add</button>
          </div>
        </div>
      </Panel>

      <div ref={listsPanelRef}>
        <Panel title="Answer lists" sub="The dropdown, select, and checklist values used across intake, eligibility, and reporting. Edits apply everywhere a list is used; existing records keep their stored answers.">
          <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 20, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {lists.map((l) => (
                <button key={l.key} onClick={() => setSel(l.key)}
                  style={{
                    textAlign: "left", padding: "9px 12px", borderRadius: 4, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13,
                    background: sel === l.key ? "var(--brand-15)" : "#fff", color: "var(--calv-slate)",
                    border: sel === l.key ? "1.5px solid var(--brand)" : "1px solid var(--calv-slate-15)",
                  }}>
                  {l.label}
                  <span style={{ float: "right", color: "var(--calv-slate-65)", fontSize: 11.5 }}>{l.values.length}</span>
                </button>
              ))}
            </div>
            {selList ? (
              <div>
                <div className="calv-label" style={{ marginBottom: 10 }}>{selList.label} — {selList.values.length} values</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, maxWidth: 560 }}>
                  {selList.values.map((v) => (
                    <ValueRow key={v.id} id={v.id} value={v.value} onRemove={onRemoveValue} />
                  ))}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                    <div className="field" style={{ flex: 1 }}><input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="Add a value…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddValue(); } }} /></div>
                    <button className="calv-btn calv-btn--secondary calv-btn--sm" disabled={!newVal.trim()} style={!newVal.trim() ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={onAddValue}><I name="plus" size={13} /> Add</button>
                  </div>
                </div>
              </div>
            ) : <div />}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FieldRow({ fd, listLabel, onSelectList, onRemove }: {
  fd: FRow;
  listLabel: string;
  onSelectList: (key: string) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState(fd.label);
  const [code, setCode] = useState(fd.code);
  const [opts, setOpts] = useState(fd.optionsText ?? "");
  const [enabled, setEnabled] = useState(fd.enabled === 1);
  useEffect(() => {
    setLabel(fd.label);
    setCode(fd.code);
    setOpts(fd.optionsText ?? "");
    setEnabled(fd.enabled === 1);
  }, [fd.label, fd.code, fd.optionsText, fd.enabled]);

  async function onToggle(on: boolean) {
    setEnabled(on);
    await updateIntakeField(fd.id, { enabled: on });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "34px 1.5fr 90px 130px 1.4fr auto", gap: 12, alignItems: "center", padding: "9px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
      <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} title={enabled ? "On the form — click to disable" : "Hidden — click to enable"} style={{ width: 16, height: 16, accentColor: "var(--brand)", justifySelf: "center" }} />
      <div className="field"><input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => { if (label.trim() && label !== fd.label) updateIntakeField(fd.id, { label }); }} style={{ opacity: enabled ? 1 : 0.5 }} /></div>
      <div className="field"><input value={code} onChange={(e) => setCode(e.target.value)} onBlur={() => { if (code !== fd.code) updateIntakeField(fd.id, { code }); }} placeholder="Code" style={{ opacity: enabled ? 1 : 0.5 }} /></div>
      <Chip outline>{FIELD_TYPE_LABELS[fd.type] || fd.type}</Chip>
      <div>
        {fd.type === "list" ? (
          <a className="tlink" style={{ fontSize: 12 }} onClick={() => fd.listKey && onSelectList(fd.listKey)}>answers: {listLabel} ↓</a>
        ) : fd.type === "choice" ? (
          <div className="field"><input value={opts} onChange={(e) => setOpts(e.target.value)} onBlur={() => { if (opts !== (fd.optionsText ?? "")) updateIntakeField(fd.id, { optionsText: opts }); }} placeholder="Options, comma-separated" /></div>
        ) : (
          <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>{fd.type === "yesno" ? "No / Yes" : "Free " + fd.type + " entry"}</span>
        )}
      </div>
      {fd.builtin === 1 ? (
        <span style={{ fontSize: 11, color: "var(--calv-slate-65)", whiteSpace: "nowrap" }}>standard</span>
      ) : (
        <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => onRemove(fd.id)} title="Remove question"><I name="trash" size={13} /></button>
      )}
    </div>
  );
}

function ValueRow({ id, value, onRemove }: {
  id: number;
  value: string;
  onRemove: (id: number) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div className="field" style={{ flex: 1 }}><input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) updateListValue(id, v); }} /></div>
      <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => onRemove(id)} title="Remove value"><I name="x" size={13} /></button>
    </div>
  );
}
