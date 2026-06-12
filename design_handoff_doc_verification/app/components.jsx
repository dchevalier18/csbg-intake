// CSBG Client Intake System — shared components
const { useState, useEffect, useMemo, useRef } = React;

// ---------- tiny icon set (lucide-style, 1.5px stroke) ----------
function Icon({ d, size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", ...style }}>
      {d.split("|").map((p, i) => <path key={i} d={p}></path>)}
    </svg>
  );
}
const ICONS = {
  search: "M21 21l-4.3-4.3|M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  home: "M3 10.5L12 3l9 7.5|M5 9.5V21h14V9.5",
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M22 21v-2a4 4 0 0 0-3-3.9|M16 3.1a4 4 0 0 1 0 7.8",
  clipboard: "M9 5h6a1 1 0 0 0 1-1 1 1 0 0 0-1-1H9a1 1 0 0 0-1 1 1 1 0 0 0 1 1z|M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2|M9 12h6|M9 16h4",
  check: "M20 6L9 17l-5-5",
  shield: "M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z|M9 12l2 2 4-4",
  chart: "M3 3v18h18|M7 14v3|M11 9v8|M15 12v5|M19 6v11",
  plug: "M9 7V3|M15 7V3|M6 7h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V7z|M12 17v4",
  hand: "M12 3v9|M8 6v7|M16 6v7|M4.5 12.5l2 4A6 6 0 0 0 12 20a6 6 0 0 0 6-6V8",
  plus: "M12 5v14|M5 12h14",
  alert: "M12 9v4|M12 17h.01|M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M9 13h6|M9 17h6",
  arrow: "M5 12h14|M13 6l6 6-6 6",
  x: "M18 6L6 18|M6 6l12 12",
  cal: "M8 2v4|M16 2v4|M3 8h18|M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.5 2.8.7a2 2 0 0 1 1.7 2z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9|M10.3 21a1.9 1.9 0 0 0 3.4 0",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M17 8l-5-5-5 5|M12 3v12",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  building: "M3 21h18|M5 21V7l8-4v18|M19 21V11l-6-4|M9 9v.01|M9 13v.01|M9 17v.01",
  edit: "M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z",
  trash: "M3 6h18|M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6|M10 11v6|M14 11v6",
  layers: "M12 2l9 5-9 5-9-5 9-5z|M3 12l9 5 9-5|M3 17l9 5 9-5",
};
function I({ name, size, style }) { return <Icon d={ICONS[name]} size={size} style={style} />; }

// ---------- helpers ----------
const fmt = (n) => Number(n).toLocaleString("en-US");
const money = (n) => "$" + fmt(Math.round(n));
function fplStatus(pct) {
  if (pct <= FPL.csbgLimit) return { label: pct + "% FPL", tone: "sage", eligible: true };
  if (pct <= 200) return { label: pct + "% FPL", tone: "amber", eligible: false };
  return { label: pct + "% FPL", tone: "red", eligible: false };
}
const staffById = (id) => ((typeof window !== "undefined" && window.ACTIVE_USERS) || STAFF).find(s => s.id === id) || { name: "—", initials: "–" };
const clientById = (id) => CLIENTS.find(c => c.id === id) || {};

// ---------- atoms ----------
function Chip({ tone = "", children, outline }) {
  return <span className={"chip " + tone + (outline ? " outline" : "")}>{children}</span>;
}
function CodeChip({ code, show }) {
  if (!show) return null;
  return <span className="code-chip">{code}</span>;
}
function ProgramDot({ id, short }) {
  const p = programById(id);
  return <span className="pdot-lab"><i style={{ background: p.color }}></i>{short ? p.short : p.name}</span>;
}
function Meter({ pct, tone }) {
  const cls = tone || (pct >= 90 ? "" : pct >= 70 ? "warn" : "bad");
  return (
    <div className="meter-row">
      <div className={"meter " + cls} style={{ flex: 1 }}><i style={{ width: pct + "%" }}></i></div>
      <span className="pct">{pct}%</span>
    </div>
  );
}
function Kpi({ kick, value, foot, tone, accent }) {
  return (
    <div className="kpi" style={{ "--kpi-accent": accent }}>
      <div className="kick">{kick}</div>
      <div className="n">{value}</div>
      {foot ? <div className={"foot " + (tone || "")}>{foot}</div> : null}
    </div>
  );
}
function Panel({ title, sub, children, right, style, className }) {
  return (
    <div className={"panel " + (className || "")} style={style}>
      {(title || right) ?
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            {title ? <h3 className="ptitle">{title}</h3> : null}
            {sub ? <p className="psub">{sub}</p> : null}
          </div>
          {right ? <div>{right}</div> : null}
        </div> : null}
      {children}
    </div>
  );
}
function Field({ label, required, hint, children, span }) {
  return (
    <div className="field" style={span ? { gridColumn: "span " + span } : null}>
      <label>{label}{required ? <span className="req"> *</span> : null}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}
function Modal({ title, onClose, children, width }) {
  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={width ? { maxWidth: width } : null}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 className="ptitle" style={{ margin: 0 }}>{title}</h3>
          <button className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onClose}><I name="x" size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast"><span className="ok"><I name="check" size={15} /></span>{msg}</div>;
}

// shown when the current user's program assignments don't include a screen
function Restricted({ what }) {
  return (
    <div className="panel" style={{ maxWidth: 520, margin: "60px auto", textAlign: "center", padding: "40px 36px" }}>
      <I name="shield" size={34} style={{ color: "var(--calv-slate-35)" }} />
      <h3 className="ptitle" style={{ marginTop: 14 }}>No access to {what || "this area"}</h3>
      <p style={{ fontSize: 13, color: "var(--calv-slate-65)", lineHeight: 1.6, margin: "8px 0 0" }}>
        Your account isn't assigned to a program that includes this. An administrator can update your
        program assignments in <strong style={{ fontWeight: 600 }}>Settings → Users</strong>.
      </p>
    </div>
  );
}

// persists a slice of state to localStorage (own keys only)
function usePersistentState(key, initial) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; }
    catch (e) { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }, [key, v]);
  return [v, setV];
}

// ---------- shell ----------
function OrgMark({ org }) {
  if (org.logoMode === "upload" && org.logoData)
    return <div className="orgmark-plate"><img src={org.logoData} alt={org.name} /></div>;
  if (org.logoMode === "wordmark")
    return <div className="orgmark-word">{org.short || org.name}</div>;
  return <img className="mark" src="calv/logos/primary-notagline-white.svg" alt={org.name} />;
}

const WORK_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "eligibility", label: "Eligibility queue", icon: "shield", countKey: "applicants" },
  { id: "clients", label: "Clients", icon: "users" },
  { id: "services", label: "Service log", icon: "hand" },
];
const ADMIN_NAV = [
  { id: "data", label: "Data & integrations", icon: "plug", admin: true },
  { id: "settings", label: "Settings", icon: "settings", admin: true },
  { id: "portal", label: "Client portal preview", icon: "phone" },
];

function NavBtn({ n, route, go, applicantCount }) {
  return (
    <button className={"navlink" + (route === n.id ? " active" : "")} onClick={() => go(n.id)}>
      {n.icon ? <I name={n.icon} size={15} /> : <span className="pdot" style={{ background: n.dot }}></span>} {n.label}
      {n.countKey === "applicants" && applicantCount ? <span className="count">{applicantCount}</span> : null}
    </button>
  );
}

function Sidebar({ route, programId, go, applicantCount, onNewIntake, org, navPrograms, isAdmin }) {
  return (
    <aside className="nav">
      <OrgMark org={org} />
      <div className="app-name">CSBG Client System</div>
      <button className="calv-btn calv-btn--primary calv-btn--sm nav-cta" onClick={onNewIntake}>
        <I name="plus" size={14} /> New intake
      </button>
      <div className="sect">Work</div>
      {WORK_NAV.map(n => <NavBtn key={n.id} n={n} route={route} go={go} applicantCount={applicantCount} />)}
      <div className="sect">My programs</div>
      {navPrograms.length === 0 ? <div className="nav-empty">No programs assigned — ask an administrator.</div> : null}
      {navPrograms.map(p => (
        <button key={p.id} className={"navlink" + (route === "program" && programId === p.id ? " active" : "")} onClick={() => go("program/" + p.id)}>
          <span className="pdot" style={{ background: p.color }}></span> {p.short}
        </button>
      ))}
      <div className="sect">Insight</div>
      <NavBtn n={{ id: "reports", label: "Reports & CSBG rollup", icon: "chart" }} route={route} go={go} />
      <div className="sect">Admin</div>
      {ADMIN_NAV.filter(n => !n.admin || isAdmin).map(n => <NavBtn key={n.id} n={n} route={route} go={go} />)}
      <div className="fy-card">
        <strong>{FY.label} reporting period</strong>
        {FY.range}
        <div className="bar"><i style={{ width: FY.pctElapsed + "%" }}></i></div>
        {FY.pctElapsed}% of the federal fiscal year elapsed
      </div>
    </aside>
  );
}

function Topbar({ go, openClient, users, currentUser, onSwitchUser }) {
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = q.toLowerCase();
    return visibleClients().filter(c =>
      (c.first + " " + c.last).toLowerCase().includes(t) || c.id.toLowerCase().includes(t) || (c.phone || "").includes(t)
    ).slice(0, 5);
  }, [q, currentUser && currentUser.id]);
  return (
    <div className="topbar">
      <div className="search">
        <I name="search" size={15} />
        <input placeholder="Search clients by name, ID, or phone…" value={q} onChange={e => setQ(e.target.value)} />
        {results.length > 0 ?
          <div className="results">
            {results.map(c => (
              <button key={c.id} onClick={() => { setQ(""); openClient(c.id); }}>
                <span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>{c.first[0]}</span>
                <span><strong style={{ fontWeight: 600 }}>{c.first} {c.last}</strong>
                  <span style={{ color: "var(--calv-slate-65)", marginLeft: 8 }}>{c.id} · {c.address.split(",")[1]}</span></span>
              </button>
            ))}
          </div> : null}
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span className="fy-chip">{FY.label} · OCT 1 – SEP 30</span>
        <div style={{ position: "relative" }}>
          <button className="user-chip" onClick={() => setMenuOpen(o => !o)}
            style={{ background: "none", border: 0, cursor: "pointer", padding: "4px 6px", borderRadius: 4 }}>
            <span>{currentUser.name} <span className="role">· {currentUser.role}</span></span>
            <div className="avatar">{currentUser.initials}</div>
          </button>
          {menuOpen ? (
            <div className="user-menu">
              <div className="user-menu-head">Switch user (demo)</div>
              {users.map(u => (
                <button key={u.id} onClick={() => { setMenuOpen(false); onSwitchUser(u.id); }}>
                  <span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>{u.initials}</span>
                  <span style={{ flex: 1, textAlign: "left" }}>{u.name}<span style={{ color: "var(--calv-slate-65)", display: "block", fontSize: 11 }}>{u.role}{u.access === "all" ? " · all programs" : " · " + (u.programs || []).length + " programs"}</span></span>
                  {u.id === currentUser.id ? <I name="check" size={14} style={{ color: "var(--calv-sage)" }} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  useState, useEffect, useMemo, useRef, usePersistentState,
  Icon, I, ICONS, fmt, money, fplStatus, staffById, clientById,
  Chip, CodeChip, ProgramDot, Meter, Kpi, Panel, Field, Seg, Modal, Toast, Restricted,
  OrgMark, Sidebar, Topbar,
});
