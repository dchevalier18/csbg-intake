// Settings — Organization (white-label) + Programs (configure by type)
function ScreenSettings({ org, setOrg, programs, setPrograms, users, setUsers, currentUserId, fplHistory, setFplHistory, lists, setLists, fields, setFields, applicants, toast, tweaks }) {
  const [tab, setTab] = useState("Organization");
  return (
    <div data-screen-label="Settings">
      <div className="page-head">
        <div>
          <h1 className="page-h1">Settings<span className="red">.</span></h1>
          <p className="lede">Configure this workspace for your agency — brand, programs, people, poverty guidelines, and the intake form itself.</p>
        </div>
        <Seg options={["Organization", "Programs", "Users", "FPL", "Forms"]} value={tab} onChange={setTab} />
      </div>
      {tab === "Organization" ? <OrgSettings org={org} setOrg={setOrg} toast={toast} /> :
        tab === "Programs" ? <ProgramSettings programs={programs} setPrograms={setPrograms} toast={toast} /> :
          tab === "Users" ? <UserSettings users={users} setUsers={setUsers} programs={programs} currentUserId={currentUserId} toast={toast} /> :
            tab === "FPL" ? <FplSettings fplHistory={fplHistory} setFplHistory={setFplHistory} org={org} setOrg={setOrg} applicants={applicants} toast={toast} /> :
              <FormSettings fields={fields} setFields={setFields} lists={lists} setLists={setLists} toast={toast} />}
    </div>
  );
}

// ---------- Organization / white-label ----------
function OrgSettings({ org, setOrg, toast }) {
  const set = (k, v) => setOrg(prev => ({ ...prev, [k]: v }));
  const fileRef = useRef(null);

  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setOrg(prev => ({ ...prev, logoData: r.result, logoMode: "upload" })); toast("Logo uploaded — your sidebar updated."); };
    r.readAsDataURL(f);
  }

  return (
    <div className="row2" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <Panel title="Agency profile" sub="Names and region appear across the workspace and on exported CSBG reports.">
          <div className="fgrid c2">
            <Field label="Organization name" required span={2}><input value={org.name} onChange={e => set("name", e.target.value)} /></Field>
            <Field label="Short name / abbreviation"><input value={org.short} onChange={e => set("short", e.target.value)} placeholder="e.g. CALV" /></Field>
            <Field label="Tagline"><input value={org.tagline} onChange={e => set("tagline", e.target.value)} /></Field>
            <Field label="Service region" span={2}><input value={org.region} onChange={e => set("region", e.target.value)} placeholder="Counties served" /></Field>
            <Field label="Fiscal year starts" hint="CSBG federal FY runs Oct 1 – Sep 30"><select value={org.fyStart} onChange={e => set("fyStart", e.target.value)}>{["October", "July", "January", "April"].map(m => <option key={m}>{m}</option>)}</select></Field>
            <Field label="CSBG income ceiling" hint="% of Federal Poverty Level — your state's limit">
              <select value={org.csbgCeiling} onChange={e => set("csbgCeiling", Number(e.target.value))}>{[100, 125, 150, 175, 200].map(p => <option key={p} value={p}>{p}% FPL</option>)}</select>
            </Field>
          </div>
        </Panel>

        <Panel title="Brand color" sub="Sets the accent across buttons, highlights, and headlines. Pick the closest match to your agency's identity.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {ACCENTS.map(a => (
              <button key={a.id} onClick={() => set("accent", a.hex)}
                style={{
                  display: "flex", gap: 9, alignItems: "center", padding: "10px 12px", cursor: "pointer", textAlign: "left",
                  background: "#fff", borderRadius: 4, fontFamily: "var(--font-body)", fontSize: 12.5,
                  border: org.accent === a.hex ? "2px solid " + a.hex : "1px solid var(--calv-slate-15)",
                }}>
                <span style={{ width: 22, height: 22, borderRadius: 4, background: a.hex, flex: "none", boxShadow: org.accent === a.hex ? "0 0 0 2px #fff inset" : "none" }}></span>
                {a.name}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 13, position: "sticky", top: 16 }}>
        <Panel title="Logo" sub="Shown top-left in the navigation.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {[["calv", "CALV brand mark"], ["wordmark", "Text wordmark (" + (org.short || "abbr.") + ")"], ["upload", "Upload your logo"]].map(([mode, label]) => (
              <label key={mode} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid var(--calv-slate-15)", borderRadius: 4, fontSize: 13, cursor: "pointer", background: org.logoMode === mode ? "var(--calv-sand-15)" : "#fff" }}>
                <input type="radio" name="logoMode" checked={org.logoMode === mode} onChange={() => mode === "upload" ? fileRef.current.click() : set("logoMode", mode)} style={{ accentColor: org.accent }} />
                {label}
              </label>
            ))}
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
          </div>
          <div style={{ fontFamily: "var(--font-sub)", fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--calv-slate-65)", marginBottom: 8 }}>Preview on nav</div>
          <div style={{ background: "var(--calv-slate)", borderRadius: 4, padding: "16px 18px" }}>
            <OrgMark org={org} />
          </div>
          {org.logoMode === "upload" && org.logoData ?
            <button className="calv-btn calv-btn--quiet calv-btn--sm" style={{ marginTop: 10 }} onClick={() => fileRef.current.click()}>Replace image</button> : null}
        </Panel>
        <div style={{ background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4, padding: "14px 16px", fontSize: 12.5, lineHeight: 1.55, color: "var(--calv-slate)" }}>
          Changes apply live and are saved to this workspace. In production these settings are scoped per agency, so each CAA running on the platform sees only its own brand, programs, and data.
        </div>
      </div>
    </div>
  );
}

// ---------- Programs ----------
function ProgramSettings({ programs, setPrograms, toast }) {
  const [editing, setEditing] = useState(null); // program object or "new"

  function save(p) {
    setPrograms(prev => {
      const exists = prev.some(x => x.id === p.id);
      return exists ? prev.map(x => x.id === p.id ? p : x) : [...prev, p];
    });
    setEditing(null);
    toast(programs.some(x => x.id === p.id) ? "Program updated." : "Program “" + p.name + "” added — its tools are now in the sidebar.");
  }
  function remove(id) {
    const p = programs.find(x => x.id === id);
    setPrograms(prev => prev.filter(x => x.id !== id));
    setEditing(null);
    toast("Removed “" + p.name + "”. Tools no longer used by any program were hidden.");
  }

  return (
    <div>
      <div className="toolbar">
        <span style={{ fontSize: 13, color: "var(--calv-slate-65)" }}>{programs.length} programs configured · each program's <strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>type</strong> decides which tools and data sources turn on.</span>
        <button className="calv-btn calv-btn--primary calv-btn--sm" style={{ marginLeft: "auto" }} onClick={() => setEditing("new")}><I name="plus" size={14} /> Add program</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 13 }}>
        {programs.map(p => {
          const t = programType(p.type);
          return (
            <div key={p.id} className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ height: 5, background: p.color }}></div>
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <h3 className="ptitle" style={{ fontSize: 17 }}>{p.name}</h3>
                    <p className="psub" style={{ margin: "3px 0 0" }}>{t.name}{p.enrolled != null ? " · " + p.enrolled + " enrolled" : ""}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setEditing(p)}><I name="edit" size={13} /></button>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: "var(--font-sub)", fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--calv-slate-65)", marginBottom: 6 }}>Tools activated</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <Chip outline>Intake & services</Chip>
                    {p.caps.length ? p.caps.map(c => <Chip key={c} tone="teal">{capLabel(c)}</Chip>) : <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>core case management only</span>}
                  </div>
                </div>
                {p.sources.length ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: "var(--font-sub)", fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--calv-slate-65)", marginBottom: 6 }}>Data sources</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{p.sources.map(s => <Chip key={s} tone="amber"><I name="plug" size={11} /> {s}</Chip>)}</div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {editing ? <ProgramEditor program={editing === "new" ? null : editing} onSave={save} onRemove={remove} onClose={() => setEditing(null)} existingIds={programs.map(p => p.id)} /> : null}
    </div>
  );
}

function ProgramEditor({ program, onSave, onRemove, onClose, existingIds }) {
  const isNew = !program;
  const [name, setName] = useState(program ? program.name : "");
  const [short, setShort] = useState(program ? program.short : "");
  const [typeId, setTypeId] = useState(program ? program.type : "case-mgmt");
  const [color, setColor] = useState(program ? program.color : PROGRAM_COLORS[1]);
  const t = programType(typeId);
  const [sources, setSources] = useState(program ? program.sources.slice() : t.sources.slice());

  // when type changes on a NEW program, adopt that type's recommended sources
  function pickType(id) {
    setTypeId(id);
    setSources(programType(id).sources.slice());
  }
  const EXTRA_SOURCES = ["Spreadsheet import", "CAP60", "HMIS (PA-503)", "RX Office", "Hancock"];
  function toggleSource(s) { setSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]); }

  function submit() {
    const id = program ? program.id : (short || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) + "-" + Math.floor(Math.random() * 900 + 100);
    onSave({
      id, name: name.trim(), short: (short || name).trim().slice(0, 22), color, type: typeId,
      caps: programType(typeId).caps.slice(), sources,
      enrolled: program ? program.enrolled : 0,
    });
  }

  return (
    <Modal title={isNew ? "Add a program" : "Edit " + program.name} onClose={onClose} width={720}>
      <div className="fgrid c2" style={{ marginBottom: 18 }}>
        <Field label="Program name" required><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Emergency Rental Assistance" autoFocus /></Field>
        <Field label="Short label" hint="Shown on chips & tables"><input value={short} onChange={e => setShort(e.target.value)} placeholder="e.g. ERA" /></Field>
      </div>

      <div className="calv-label" style={{ marginBottom: 10 }}>Program type — this decides which tools turn on</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        {PROGRAM_TYPES.map(pt => (
          <button key={pt.id} onClick={() => pickType(pt.id)}
            style={{
              textAlign: "left", padding: "12px 14px", borderRadius: 4, cursor: "pointer", background: "#fff",
              border: typeId === pt.id ? "2px solid var(--brand)" : "1px solid var(--calv-slate-15)",
            }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 5 }}>
              <I name={pt.icon} size={16} style={{ color: typeId === pt.id ? "var(--brand)" : "var(--calv-slate-65)" }} />
              <span style={{ fontFamily: "var(--font-sub)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".02em" }}>{pt.name}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--calv-slate-65)", lineHeight: 1.45, marginBottom: 8 }}>{pt.blurb}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {pt.caps.length ? pt.caps.map(c => <span key={c} className="chip teal" style={{ fontSize: 9.5, padding: "2px 7px" }}>{capLabel(c)}</span>) : <span style={{ fontSize: 11, color: "var(--calv-slate-35)" }}>core only</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="fgrid c2" style={{ marginBottom: 18, alignItems: "start" }}>
        <div>
          <div className="calv-label" style={{ marginBottom: 8 }}>Color</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PROGRAM_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} title={c}
                style={{ width: 30, height: 30, borderRadius: 4, background: c, cursor: "pointer", border: color === c ? "3px solid var(--calv-slate)" : "1px solid var(--calv-slate-15)" }}></button>
            ))}
          </div>
        </div>
        <div>
          <div className="calv-label" style={{ marginBottom: 8 }}>Data sources to connect</div>
          {t.sources.length ? <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "0 0 8px" }}>Recommended for {t.name}: {t.sources.join(", ")}.</p> : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {EXTRA_SOURCES.map(s => (
              <label key={s} style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 10px", border: "1px solid var(--calv-slate-15)", borderRadius: 4, fontSize: 12, cursor: "pointer", background: sources.includes(s) ? "var(--calv-amber-15)" : "#fff" }}>
                <input type="checkbox" checked={sources.includes(s)} onChange={() => toggleSource(s)} style={{ accentColor: "var(--brand)" }} /> {s}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
        {!isNew ? <button className="calv-btn calv-btn--ghost calv-btn--sm" onClick={() => onRemove(program.id)}><I name="trash" size={13} /> Remove program</button> : <span></span>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onClose}>Cancel</button>
          <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!name.trim()} style={!name.trim() ? { opacity: .45, cursor: "not-allowed" } : null} onClick={submit}>
            <I name="check" size={14} /> {isNew ? "Add program" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
window.ScreenSettings = ScreenSettings;

// ---------- Users & program access ----------
function UserSettings({ users, setUsers, programs, currentUserId, toast }) {
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Case Worker");

  function update(id, patch) { setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u)); }
  function toggleProg(u, pid) {
    const has = (u.programs || []).includes(pid);
    update(u.id, { programs: has ? u.programs.filter(x => x !== pid) : [...(u.programs || []), pid] });
  }
  function addUser() {
    const name = newName.trim();
    const initials = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const allAccess = newRole === "Data Admin" || newRole === "Program Manager";
    setUsers(prev => [...prev, { id: "u" + Date.now().toString(36), name, role: newRole, initials, programs: [], access: allAccess ? "all" : undefined }]);
    setNewName("");
    toast(allAccess ? "User added with all-program access." : "User added — assign their programs below.");
  }
  function removeUser(id) {
    const u = users.find(x => x.id === id);
    setUsers(prev => prev.filter(x => x.id !== id));
    toast("Removed " + u.name + ". Their historical entries remain attributed.");
  }

  return (
    <div>
      <Panel title="Add a user" sub="New users start with no program access — they can't see any client enrollments until assigned." style={{ marginBottom: 13 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr auto", gap: 12, alignItems: "end" }}>
          <Field label="Full name"><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Sam Reyes" /></Field>
          <Field label="Role"><select value={newRole} onChange={e => setNewRole(e.target.value)}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></Field>
          <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={newName.trim().length < 3} style={newName.trim().length < 3 ? { opacity: .45, cursor: "not-allowed" } : null} onClick={addUser}><I name="plus" size={13} /> Add user</button>
        </div>
      </Panel>

      <Panel title="Users & program access" sub="Program assignment controls everything a user can see: client enrollments, applications, services, and program tools. Data Admins and Program Managers can hold all-program access.">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {users.map(u => {
            const all = u.access === "all";
            return (
              <div key={u.id} style={{ display: "grid", gridTemplateColumns: "230px 170px 1fr auto", gap: 16, alignItems: "start", padding: "14px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div className="avatar">{u.initials}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}{u.id === currentUserId ? <span style={{ color: "var(--calv-slate-65)", fontWeight: 300 }}> (you)</span> : null}</div>
                    <div style={{ fontSize: 11.5, color: "var(--calv-slate-65)" }}>{all ? "All programs" : (u.programs || []).length + " program" + ((u.programs || []).length === 1 ? "" : "s") + " assigned"}</div>
                  </div>
                </div>
                <div className="field">
                  <select value={u.role} onChange={e => update(u.id, { role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
                </div>
                <div>
                  <label style={{ display: "inline-flex", gap: 7, alignItems: "center", fontSize: 12.5, cursor: "pointer", marginBottom: all ? 0 : 8 }}>
                    <input type="checkbox" checked={all} onChange={e => update(u.id, { access: e.target.checked ? "all" : undefined })} style={{ accentColor: "var(--brand)", width: 15, height: 15 }} />
                    All programs
                  </label>
                  {!all ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {programs.map(p => {
                        const onIt = (u.programs || []).includes(p.id);
                        return (
                          <button key={p.id} onClick={() => toggleProg(u, p.id)} title={onIt ? "Click to unassign" : "Click to assign"}
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
                <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={u.id === currentUserId}
                  style={u.id === currentUserId ? { opacity: .35, cursor: "not-allowed" } : null}
                  onClick={() => removeUser(u.id)} title={u.id === currentUserId ? "You can't remove yourself" : "Remove user"}><I name="trash" size={13} /></button>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "var(--calv-slate-65)", marginTop: 14, lineHeight: 1.55 }}>
          Tip: use the user menu (top right) to preview the workspace as any of these users — their navigation, caseload, eligibility queue, and tools change with their assignments.
        </p>
      </Panel>
    </div>
  );
}
window.UserSettings = UserSettings;

// ---------- Federal Poverty Guidelines (versioned) ----------
function FplSettings({ fplHistory, setFplHistory, org, setOrg, applicants, toast }) {
  const active = fplHistory.find(s => s.status === "active") || fplHistory[fplHistory.length - 1];
  const [showPublish, setShowPublish] = useState(false);
  const [pYear, setPYear] = useState(active.year + 1);
  const [pBase, setPBase] = useState(active.base);
  const [pPer, setPPer] = useState(active.perAdditional);
  const patchActive = (k, v) => setFplHistory(prev => prev.map(s => s.year === active.year ? { ...s, [k]: v } : s));
  const annualOf = (s, size) => (s.base || 0) + (s.perAdditional || 0) * (size - 1);
  const pinnedCount = (y) => CLIENTS.filter(c => c.fplYear === y).length + (applicants || []).filter(a => a.fplYear === y).length;
  const sizes = [1, 2, 3, 4, 5, 6, 7, 8];

  function publish() {
    const y = Number(pYear);
    if (fplHistory.some(s => s.year === y)) { toast("FPL " + y + " already exists in the guideline history."); return; }
    setFplHistory(prev => [...prev.map(s => ({ ...s, status: "archived" })), { year: y, base: Number(pBase), perAdditional: Number(pPer), effective: "2026-06-10", status: "active" }]);
    setShowPublish(false);
    setPYear(y + 1);
    toast("FPL " + y + " is now active. " + (CLIENTS.length + (applicants || []).length) + " existing cases remain pinned to the schedule they were assessed under.");
  }
  function makeActive(year) {
    setFplHistory(prev => prev.map(s => ({ ...s, status: s.year === year ? "active" : "archived" })));
    toast("FPL " + year + " set as the active schedule for new assessments. Pinned cases are unaffected.");
  }

  return (
    <div>
      <div className="row2" style={{ gridTemplateColumns: "1fr 1.15fr", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Panel title={"Active schedule · FPL " + active.year} sub="Used for every NEW assessment from today forward. Corrections here do not touch cases already assessed — they stay pinned to their stored schedule.">
            <div className="fgrid c2">
              <Field label="Household of 1 (annual $)"><input type="number" step="10" value={active.base} onChange={e => patchActive("base", Number(e.target.value))} /></Field>
              <Field label="Each additional person (+$)"><input type="number" step="10" value={active.perAdditional} onChange={e => patchActive("perAdditional", Number(e.target.value))} /></Field>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "12px 0 0" }}>Effective {new Date(active.effective + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · 48 contiguous states — Alaska & Hawaii use separate tables.</p>
          </Panel>
          <Panel title="CSBG income ceiling" sub="Your state's eligibility limit as a percentage of FPL. Applied at assessment time against the schedule in force.">
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div className="field" style={{ width: 150 }}>
                <select value={org.csbgCeiling} onChange={e => setOrg(prev => ({ ...prev, csbgCeiling: Number(e.target.value) }))}>{[100, 125, 150, 175, 200].map(p => <option key={p} value={p}>{p}% FPL</option>)}</select>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>A household of 3 currently qualifies up to <strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>{money(annualOf(active, 3) * org.csbgCeiling / 100)}/yr</strong>.</span>
            </div>
          </Panel>
        </div>
        <Panel title={"Preview · FPL " + active.year} sub={"Annual guideline by household size, with your " + org.csbgCeiling + "% ceiling applied."}>
          <table className="data">
            <thead><tr><th>Household size</th><th className="num">100% FPL (annual)</th><th className="num">Monthly</th><th className="num">{org.csbgCeiling}% ceiling</th></tr></thead>
            <tbody>
              {sizes.map(s => (
                <tr key={s}>
                  <td className="cname">{s}</td>
                  <td className="num">{money(annualOf(active, s))}</td>
                  <td className="num" style={{ color: "var(--calv-slate-65)" }}>{money(annualOf(active, s) / 12)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{money(annualOf(active, s) * org.csbgCeiling / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", marginTop: 12 }}>For households over 8, add {money(active.perAdditional || 0)} per additional person.</p>
        </Panel>
      </div>

      <Panel title="Guideline history" sub="Every schedule ever configured stays on record. Enrolled and closed cases keep the schedule they were assessed under — publishing a new year never rewrites a prior eligibility determination."
        right={<button className="calv-btn calv-btn--primary calv-btn--sm" onClick={() => setShowPublish(s => !s)}><I name="plus" size={13} /> Publish new year</button>}>
        {showPublish ? (
          <div style={{ margin: "4px 0 18px", padding: "14px 16px", background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4 }}>
            <div className="calv-label" style={{ marginBottom: 10 }}>Publish a new guideline year</div>
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
              <Field label="Year"><input type="number" value={pYear} onChange={e => setPYear(e.target.value)} /></Field>
              <Field label="Household of 1 (annual $)"><input type="number" step="10" value={pBase} onChange={e => setPBase(e.target.value)} /></Field>
              <Field label="Each additional person (+$)"><input type="number" step="10" value={pPer} onChange={e => setPPer(e.target.value)} /></Field>
              <button className="calv-btn calv-btn--primary calv-btn--sm" onClick={publish}><I name="check" size={13} /> Publish & activate</button>
              <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => setShowPublish(false)}>Cancel</button>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--calv-slate-65)", margin: "10px 0 0" }}>The current schedule is archived automatically. New intakes assess against the new year; nothing already assessed is recalculated.</p>
          </div>
        ) : null}
        <table className="data">
          <thead><tr><th>Guideline year</th><th className="num">Household of 1</th><th className="num">Each additional</th><th>Effective</th><th>Status</th><th className="num">Cases pinned</th><th></th></tr></thead>
          <tbody>
            {[...fplHistory].sort((a, b) => b.year - a.year).map(s => (
              <tr key={s.year}>
                <td className="cname">FPL {s.year}</td>
                <td className="num">{money(s.base)}</td>
                <td className="num">{money(s.perAdditional)}</td>
                <td>{new Date(s.effective + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td>{s.status === "active" ? <Chip tone="sage">Active</Chip> : <Chip>Archived</Chip>}</td>
                <td className="num">{pinnedCount(s.year) || "—"}</td>
                <td style={{ textAlign: "right" }}>{s.status !== "active" ? <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => makeActive(s.year)}>Make active</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--calv-slate-65)", marginTop: 14, lineHeight: 1.55 }}>
          <strong style={{ fontWeight: 600, color: "var(--calv-slate)" }}>How pinning works:</strong> every intake and eligibility determination stores the guideline year it was assessed against. Client profiles, the eligibility queue, and the D12 income-level report all calculate from the pinned schedule — so a case enrolled under FPL {active.year - 1} keeps its original determination even after FPL {active.year} goes live.
        </p>
      </Panel>
    </div>
  );
}

// ---------- Forms: intake questions + answer lists ----------
function FormSettings({ fields, setFields, lists, setLists, toast }) {
  const listKeys = Object.keys(lists);
  const [sel, setSel] = useState(listKeys[0]);
  const [newVal, setNewVal] = useState("");
  const [qLabel, setQLabel] = useState("");
  const [qType, setQType] = useState("choice");
  const [qOpts, setQOpts] = useState("");
  const [qCode, setQCode] = useState("");

  function update(id, patch) { setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f)); }
  function removeField(id) { setFields(prev => prev.filter(f => f.id !== id)); toast("Question removed from the intake form."); }
  function addField() {
    setFields(prev => [...prev, { id: "q" + Date.now().toString(36), label: qLabel.trim(), code: qCode.trim(), type: qType, optionsText: qOpts, enabled: true }]);
    setQLabel(""); setQOpts(""); setQCode("");
    toast("Question added — it's live on the intake form and counts toward report readiness.");
  }
  function setListValue(key, i, v) { setLists(prev => ({ ...prev, [key]: { ...prev[key], values: prev[key].values.map((x, j) => j === i ? v : x) } })); }
  function removeListValue(key, i) { setLists(prev => ({ ...prev, [key]: { ...prev[key], values: prev[key].values.filter((x, j) => j !== i) } })); toast("Value removed — existing records keep their stored answer."); }
  function addListValue(key) {
    const v = newVal.trim();
    if (!v) return;
    setLists(prev => ({ ...prev, [key]: { ...prev[key], values: [...prev[key].values, v] } }));
    setNewVal("");
    toast("Value added to " + lists[key].label + ".");
  }

  return (
    <div>
      <Panel title="Intake questions · characteristics step" sub="Turn questions on or off, relabel them, or add new ones as CSBG data requirements change. Enabled questions count toward each record's report-readiness meter." style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {fields.map(fd => (
            <div key={fd.id} style={{ display: "grid", gridTemplateColumns: "34px 1.5fr 90px 130px 1.4fr auto", gap: 12, alignItems: "center", padding: "9px 2px", borderBottom: "1px solid var(--calv-slate-15)" }}>
              <input type="checkbox" checked={fd.enabled} onChange={e => update(fd.id, { enabled: e.target.checked })} title={fd.enabled ? "On the form — click to disable" : "Hidden — click to enable"} style={{ width: 16, height: 16, accentColor: "var(--brand)", justifySelf: "center" }} />
              <div className="field"><input value={fd.label} onChange={e => update(fd.id, { label: e.target.value })} style={{ opacity: fd.enabled ? 1 : .5 }} /></div>
              <div className="field"><input value={fd.code || ""} onChange={e => update(fd.id, { code: e.target.value })} placeholder="Code" style={{ opacity: fd.enabled ? 1 : .5 }} /></div>
              <Chip outline>{FIELD_TYPE_LABELS[fd.type] || fd.type}</Chip>
              <div>
                {fd.type === "list" ? <a className="tlink" style={{ fontSize: 12 }} onClick={() => setSel(fd.list)}>answers: {lists[fd.list] ? lists[fd.list].label : fd.list} ↓</a> :
                  fd.type === "choice" ? <div className="field"><input value={fd.optionsText || ""} onChange={e => update(fd.id, { optionsText: e.target.value })} placeholder="Options, comma-separated" /></div> :
                    <span style={{ fontSize: 12, color: "var(--calv-slate-65)" }}>{fd.type === "yesno" ? "No / Yes" : "Free " + fd.type + " entry"}</span>}
              </div>
              {fd.builtin ?
                <span style={{ fontSize: 11, color: "var(--calv-slate-65)", whiteSpace: "nowrap" }}>standard</span> :
                <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => removeField(fd.id)} title="Remove question"><I name="trash" size={13} /></button>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--calv-sand-15)", border: "1px solid var(--calv-sand-35)", borderRadius: 4 }}>
          <div className="calv-label" style={{ marginBottom: 10 }}>Add a question</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 130px 1.4fr 90px auto", gap: 12, alignItems: "end" }}>
            <Field label="Question label"><input value={qLabel} onChange={e => setQLabel(e.target.value)} placeholder="e.g. Primary language" /></Field>
            <Field label="Answer type"><select value={qType} onChange={e => setQType(e.target.value)}>{["choice", "text", "yesno", "number", "date"].map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}</select></Field>
            <Field label="Options (if choice list)"><input value={qOpts} onChange={e => setQOpts(e.target.value)} placeholder="English, Spanish, Other" disabled={qType !== "choice"} style={qType !== "choice" ? { opacity: .4 } : null} /></Field>
            <Field label="CSBG code"><input value={qCode} onChange={e => setQCode(e.target.value)} placeholder="e.g. C9" /></Field>
            <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={qLabel.trim().length < 3 || (qType === "choice" && !qOpts.trim())}
              style={(qLabel.trim().length < 3 || (qType === "choice" && !qOpts.trim())) ? { opacity: .45, cursor: "not-allowed" } : null} onClick={addField}><I name="plus" size={13} /> Add</button>
          </div>
        </div>
      </Panel>

      <Panel title="Answer lists" sub="The dropdown, select, and checklist values used across intake, eligibility, and reporting. Edits apply everywhere a list is used; existing records keep their stored answers.">
        <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {listKeys.map(k => (
              <button key={k} onClick={() => setSel(k)}
                style={{
                  textAlign: "left", padding: "9px 12px", borderRadius: 4, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13,
                  background: sel === k ? "var(--brand-15)" : "#fff", color: "var(--calv-slate)",
                  border: sel === k ? "1.5px solid var(--brand)" : "1px solid var(--calv-slate-15)",
                }}>
                {lists[k].label}
                <span style={{ float: "right", color: "var(--calv-slate-65)", fontSize: 11.5 }}>{lists[k].values.length}</span>
              </button>
            ))}
          </div>
          <div>
            <div className="calv-label" style={{ marginBottom: 10 }}>{lists[sel].label} — {lists[sel].values.length} values</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, maxWidth: 560 }}>
              {lists[sel].values.map((v, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div className="field" style={{ flex: 1 }}><input value={v} onChange={e => setListValue(sel, i, e.target.value)} /></div>
                  <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={() => removeListValue(sel, i)} title="Remove value"><I name="x" size={13} /></button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <div className="field" style={{ flex: 1 }}><input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="Add a value…" onKeyDown={e => { if (e.key === "Enter") addListValue(sel); }} /></div>
                <button className="calv-btn calv-btn--secondary calv-btn--sm" disabled={!newVal.trim()} style={!newVal.trim() ? { opacity: .45, cursor: "not-allowed" } : null} onClick={() => addListValue(sel)}><I name="plus" size={13} /> Add</button>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
Object.assign(window, { FplSettings, FormSettings });
