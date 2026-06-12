/* ============================================================
   CSBG Client Intake System — Configuration layer
   Makes the platform multi-tenant: any Community Action Agency can
   white-label the org, then add programs whose TYPE activates the
   right tools and data-source considerations.
   ============================================================ */

// ---------- Brand accent presets (white-label) ----------
const ACCENTS = [
  { id: "red",    name: "Action Red",   hex: "#D14124" }, // CALV default
  { id: "teal",   name: "Deep Teal",    hex: "#006269" },
  { id: "green",  name: "Forest Green", hex: "#2F7D4F" },
  { id: "blue",   name: "Civic Blue",   hex: "#2A5DB0" },
  { id: "indigo", name: "Indigo",       hex: "#4B3F9E" },
  { id: "plum",   name: "Plum",         hex: "#7A3E6B" },
  { id: "rust",   name: "Rust",         hex: "#B5601F" },
  { id: "slate",  name: "Steel",        hex: "#3F5560" },
];

// palette offered when assigning a per-program color
const PROGRAM_COLORS = ["#D14124", "#006269", "#6FA287", "#F1B434", "#8A6410", "#598E93", "#7A3E6B", "#2A5DB0", "#3F5560", "#B5601F"];

// ---------- Capability → tool registry ----------
// A capability activates a tool screen in the left nav. Programs gain
// capabilities from their TYPE; the nav is the union across all programs.
const CAP_TOOLS = {
  contractors:  { route: "wx",         label: "Weatherization", dot: "var(--calv-sage-65)" },
  pantry:       { route: "shfb",       label: "Pantry network", dot: "#8A6410" },
  attendance:   { route: "gnx",        label: "Attendance",     dot: "var(--calv-amber)" },
  seminars:     { route: "seminars",   label: "Seminars",       dot: "var(--calv-teal)" },
  construction: { route: "homes",      label: "Projects",       dot: "var(--calv-sage)" },
  volunteers:   { route: "volunteers", label: "Volunteers",     dot: "var(--calv-slate-35)" },
  loans:        { route: "loans",      label: "Loan servicing", dot: "var(--calv-teal-65)" },
};
const capLabel = (c) => (CAP_TOOLS[c] ? CAP_TOOLS[c].label : c);

// ---------- Program TYPES (the templates an admin picks from) ----------
const PROGRAM_TYPES = [
  { id: "case-mgmt",            name: "Case Management",      icon: "clipboard", caps: [],                        sources: [],
    blurb: "Core intake, eligibility, and service delivery. Every program includes this baseline." },
  { id: "weatherization",       name: "Weatherization",       icon: "home",      caps: ["contractors"],           sources: ["Hancock"],
    blurb: "Energy-efficiency program. Adds contractor credential tracking and an audit → QC job pipeline." },
  { id: "food-bank",            name: "Food Bank / Pantry",   icon: "hand",      caps: ["pantry", "volunteers"],  sources: ["Spreadsheet import"],
    blurb: "Food distribution. Adds member-agency pantry reporting, aggregate collection, and volunteer hours." },
  { id: "youth-ed",             name: "Youth / Education",    icon: "users",     caps: ["attendance"],            sources: [],
    blurb: "Classroom programs. Adds student rosters and session-by-session attendance." },
  { id: "housing-counseling",   name: "Housing Counseling",   icon: "doc",       caps: ["seminars"],              sources: ["RX Office"],
    blurb: "Counseling & education. Adds seminar scheduling and attendee-to-client intake." },
  { id: "housing-construction", name: "Housing Construction", icon: "building",  caps: ["construction"],          sources: [],
    blurb: "Affordable-housing development. Adds construction projects, milestones, and federal-compliance tracking." },
  { id: "loan-fund",            name: "Community Loan Fund",  icon: "chart",     caps: ["loans"],                 sources: [],
    blurb: "Micro-lending & business support. Adds a loan portfolio with balance and payment tracking." },
  { id: "outreach",             name: "Outreach & Volunteer", icon: "users",     caps: ["volunteers"],            sources: [],
    blurb: "Community development. Adds volunteer-hour tracking with the federally-required low-income split." },
  { id: "shelter",              name: "Emergency Shelter",    icon: "shield",    caps: [],                        sources: ["HMIS (PA-503)"],
    blurb: "Shelter & housing placement. Connects to HMIS for bed and outcome data; core case management." },
];
const programType = (id) => PROGRAM_TYPES.find(t => t.id === id) || PROGRAM_TYPES[0];

// ---------- Default organization (CALV) ----------
const DEFAULT_ORG = {
  name: "Community Action Lehigh Valley",
  short: "CALV",
  tagline: "Fighting For Good",
  region: "Lehigh & Northampton Counties, PA",
  accent: "#D14124",
  logoMode: "calv",     // 'calv' | 'wordmark' | 'upload'
  logoData: null,       // dataURL when logoMode === 'upload'
  fyStart: "October",
  csbgCeiling: 125,
};

// ---------- Default programs (CALV's nine) ----------
const PROGRAM_TYPE_BY_ID = {
  "cad-a": "outreach", "cad-b": "outreach", "homes": "housing-construction",
  "gnx": "youth-ed", "hc": "housing-counseling", "rtide": "loan-fund",
  "shfb": "food-bank", "sss": "shelter", "wx": "weatherization",
};
const DEFAULT_PROGRAMS = PROGRAMS.map(p => {
  const type = PROGRAM_TYPE_BY_ID[p.id] || "case-mgmt";
  const t = programType(type);
  return {
    id: p.id, name: p.name, short: p.short, color: p.color, type,
    caps: t.caps.slice(), sources: t.sources.slice(),
    enrolled: CLIENTS.filter(c => c.programs.includes(p.id)).length,
  };
});

// ---------- Loan portfolio (for loan-fund tool) ----------
const LOANS = [
  { id: "L-3041", borrower: "Hassan Farah",    purpose: "Halal food truck — equipment & buildout", principal: 18000, balance: 12480, rate: "4.5%", term: "48 mo", status: "current", next: "2026-06-20", srv: "SRV 3b" },
  { id: "L-3028", borrower: "Priya Raman",     clientId: "C-2415", purpose: "Home daycare — licensing & supplies", principal: 9500, balance: 3120, rate: "4.0%", term: "36 mo", status: "current", next: "2026-06-18", srv: "SRV 3b" },
  { id: "L-3015", borrower: "Marcus Okonkwo",  purpose: "Barbershop chair rental + tools", principal: 6000, balance: 5400, rate: "5.0%", term: "24 mo", status: "late", next: "2026-05-25", srv: "SRV 3b" },
  { id: "L-2990", borrower: "Lucia Ferraro",   purpose: "Seamstress studio — industrial machine", principal: 7200, balance: 0, rate: "4.5%", term: "30 mo", status: "paid", next: "—", srv: "SRV 3b" },
  { id: "L-3052", borrower: "Dwayne Ellis",    purpose: "Mobile auto-detailing startup", principal: 11000, balance: 10670, rate: "4.5%", term: "48 mo", status: "current", next: "2026-06-28", srv: "SRV 3b" },
  { id: "L-3009", borrower: "Aisha Rahman",    purpose: "Catering business — commercial kitchen deposit", principal: 14500, balance: 8990, rate: "4.0%", term: "42 mo", status: "current", next: "2026-06-15", srv: "SRV 3b" },
  { id: "L-2978", borrower: "Tomás Delgado",   purpose: "Landscaping equipment", principal: 8800, balance: 1450, rate: "5.0%", term: "36 mo", status: "late", next: "2026-05-30", srv: "SRV 3b" },
];

// ---------- Users, roles & access ----------
const ROLES = ["Case Worker", "Front Desk", "Program Manager", "Data Admin"];
const DEFAULT_USERS = [
  { id: "dr", name: "Dana Rivera",   role: "Case Worker",     initials: "DR", programs: ["cad-a", "shfb", "sss", "hc", "rtide"] },
  { id: "mk", name: "Marcus Kelly",  role: "Case Worker",     initials: "MK", programs: ["cad-a", "cad-b", "wx", "rtide"] },
  { id: "ls", name: "Luz Santiago",  role: "Case Worker",     initials: "LS", programs: ["cad-a", "cad-b", "gnx", "hc"] },
  { id: "rg", name: "Robin Garcia",  role: "Front Desk",      initials: "RG", programs: ["cad-a", "cad-b"] },
  { id: "jb", name: "Joan Bartos",   role: "Program Manager", initials: "JB", access: "all", programs: [] },
  { id: "tw", name: "Terrence Webb", role: "Data Admin",      initials: "TW", access: "all", programs: [] },
];

// access helpers — read live state set by the app (window.CURRENT_USER / ACTIVE_PROGRAMS)
function userCanSeeProgram(u, pid) {
  if (!u) return true;
  return u.access === "all" || (u.programs || []).includes(pid);
}
function clientVisible(u, c) { return c.programs.some(p => userCanSeeProgram(u, p)); }
function visibleClients() {
  const u = window.CURRENT_USER;
  return CLIENTS.filter(c => clientVisible(u, c));
}
function userHasCap(cap) {
  const u = window.CURRENT_USER;
  const progs = window.ACTIVE_PROGRAMS || [];
  return progs.some(p => (p.caps || []).includes(cap) && userCanSeeProgram(u, p.id));
}
function isAdminUser(u) { return !!u && (u.role === "Data Admin" || u.role === "Program Manager"); }

// short descriptions for tool cards on program pages
const CAP_DESCS = {
  contractors: "Contractor credentials & the audit → QC job pipeline",
  pantry: "Member-agency reports & monthly aggregates",
  attendance: "Rosters & session-by-session attendance",
  seminars: "Workshops, capacity & attendee-to-client intake",
  construction: "Projects, milestones & federal compliance",
  volunteers: "Hours with the federal low-income split",
  loans: "Loan portfolio, balances & payments",
};

// ---------- Federal Poverty Guidelines (admin-editable, versioned) ----------
const DEFAULT_FPL = { year: 2025, base: 15650, perAdditional: 5500 };
// guideline history — one schedule is active; archived years remain for
// point-in-time integrity (cases keep the schedule they were assessed under)
const DEFAULT_FPL_HISTORY = [
  { year: 2023, base: 14580, perAdditional: 5140, effective: "2023-01-19", status: "archived" },
  { year: 2024, base: 15060, perAdditional: 5380, effective: "2024-01-17", status: "archived" },
  { year: 2025, base: 15650, perAdditional: 5500, effective: "2025-01-15", status: "active" },
];
function fplSchedule(year) {
  const h = window.FPL_HISTORY || DEFAULT_FPL_HISTORY;
  return h.find(s => s.year === year) || h.find(s => s.status === "active") || h[h.length - 1];
}
function fplAnnualFor(size, year) {
  const s = fplSchedule(year);
  return s.base + s.perAdditional * (Math.max(1, size) - 1);
}
function fplPctFor(income, size, year) {
  return Math.round((income / fplAnnualFor(size, year)) * 100);
}

// ---------- Answer lists (CSBG dropdowns / checklists, admin-editable) ----------
const DEFAULT_LISTS = {
  sex:       { label: "Sex (C1)", values: ["Female", "Male"] },
  race:      { label: "Race & ethnicity (C6)", values: ["American Indian or Alaska Native", "Asian", "Black or African American", "Hispanic or Latino", "Middle Eastern or North African", "Native Hawaiian / Pacific Islander", "White", "Multiracial or Multiethnic"] },
  edu:       { label: "Education (C3)", values: ["Grades 0-8", "Grades 9-12 / Non-Graduate", "High School Graduate / GED", "12 grade + Some Post-Secondary", "2 or 4 year College Graduate", "Other post-secondary graduate"] },
  work:      { label: "Work status (C8)", values: ["Employed Full-Time", "Employed Part-Time", "Seasonal Farm Worker", "Unemployed (Short-Term)", "Unemployed (Long-Term)", "Unemployed (Not in Labor Force)", "Retired"] },
  insurance: { label: "Health insurance (C5)", values: ["Medicaid", "Medicare", "State Children's Health Insurance Program", "State Health Insurance for Adults", "Military Health Care", "Direct-Purchase", "Employment-Based", "None"] },
  military:  { label: "Military status (C7)", values: ["Veteran", "Active Military", "Never Served in the Military"] },
  hhType:    { label: "Household type (D9)", values: ["Single Person", "Two Adults no children", "Multiple adults no children", "Single Parent Female", "Single Parent Male", "Two Parent Household", "Non-related Adults with Children", "Multigenerational Household", "Other"] },
  housing:   { label: "Housing situation (D11)", values: ["Own", "Rent", "Other permanent housing", "Homeless", "Other"] },
  incomeSrc: { label: "Income sources (D13)", values: ["Employment Only", "Employment and Other Income Source", "Employment, Other Source, and Non-Cash Benefits", "Employment and Non-Cash Benefits", "Other Income Source Only", "Other Income Source and Non-Cash Benefits", "No Income", "Non-Cash Benefits Only"] },
  county:    { label: "County / service area", values: ["Lehigh", "Northampton", "Carbon", "Monroe", "Other"] },
};
function listValues(key) {
  const L = (window.ACTIVE_LISTS || DEFAULT_LISTS)[key];
  return L ? L.values : [];
}

// ---------- Intake form fields (characteristics step, admin-editable) ----------
// type: 'list' (standard answer list) | 'choice' (custom options) | 'yesno' | 'text' | 'number' | 'date'
const DEFAULT_FIELDS = [
  { id: "sex",        label: "Sex",               code: "C1", type: "list", list: "sex",       enabled: true, builtin: true },
  { id: "race",       label: "Race / ethnicity",  code: "C6", type: "list", list: "race",      enabled: true, builtin: true },
  { id: "edu",        label: "Education",         code: "C3", type: "list", list: "edu",       enabled: true, builtin: true },
  { id: "work",       label: "Work status",       code: "C8", type: "list", list: "work",      enabled: true, builtin: true },
  { id: "insurance",  label: "Health insurance",  code: "C5", type: "list", list: "insurance", enabled: true, builtin: true },
  { id: "military",   label: "Military status",   code: "C7", type: "list", list: "military",  enabled: true, builtin: true },
  { id: "disability", label: "Disability",        code: "C5", type: "yesno",                   enabled: true, builtin: true },
];
function enabledFields() { return (window.ACTIVE_FIELDS || DEFAULT_FIELDS).filter(f => f.enabled); }
const parseFieldOptions = (fd) => (fd.optionsText || "").split(",").map(s => s.trim()).filter(Boolean);
const FIELD_TYPE_LABELS = { list: "Standard list", choice: "Choice list", yesno: "Yes / No", text: "Text", number: "Number", date: "Date" };

Object.assign(window, {
  ACCENTS, PROGRAM_COLORS, CAP_TOOLS, capLabel, PROGRAM_TYPES, programType,
  DEFAULT_ORG, DEFAULT_PROGRAMS, LOANS,
  ROLES, DEFAULT_USERS, userCanSeeProgram, clientVisible, visibleClients, userHasCap, isAdminUser, CAP_DESCS,
  DEFAULT_FPL, DEFAULT_FPL_HISTORY, fplSchedule, fplAnnualFor, fplPctFor,
  DEFAULT_LISTS, listValues, DEFAULT_FIELDS, enabledFields, parseFieldOptions, FIELD_TYPE_LABELS,
});
