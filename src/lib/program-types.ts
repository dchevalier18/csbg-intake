/* ============================================================
   Program TYPE catalog — the templates an admin picks from.
   A program's type activates capabilities (tools) and suggests
   data-source connections. Static platform catalog, not per-agency.
   ============================================================ */

export type Capability =
  | "contractors" | "pantry" | "attendance" | "seminars"
  | "construction" | "volunteers" | "loans";

export interface CapTool {
  route: string;   // app route under /tools
  label: string;
  dot: string;     // nav/legend dot color
  desc: string;    // short description for program-page tool cards
}

export const CAP_TOOLS: Record<Capability, CapTool> = {
  contractors:  { route: "/tools/weatherization", label: "Weatherization", dot: "var(--calv-sage-65)",  desc: "Contractor credentials & the audit → QC job pipeline" },
  pantry:       { route: "/tools/pantry",         label: "Pantry network", dot: "#8A6410",              desc: "Member-agency reports & monthly aggregates" },
  attendance:   { route: "/tools/attendance",     label: "Attendance",     dot: "var(--calv-amber)",    desc: "Rosters & session-by-session attendance" },
  seminars:     { route: "/tools/seminars",       label: "Seminars",       dot: "var(--calv-teal)",     desc: "Workshops, capacity & attendee-to-client intake" },
  construction: { route: "/tools/projects",       label: "Projects",       dot: "var(--calv-sage)",     desc: "Projects, milestones & federal compliance" },
  volunteers:   { route: "/tools/volunteers",     label: "Volunteers",     dot: "var(--calv-slate-35)", desc: "Hours with the federal low-income split" },
  loans:        { route: "/tools/loans",          label: "Loan servicing", dot: "var(--calv-teal-65)",  desc: "Loan portfolio, balances & payments" },
};

export const capLabel = (c: string) =>
  (CAP_TOOLS as Record<string, CapTool>)[c]?.label ?? c;

export interface ProgramType {
  id: string;
  name: string;
  icon: string;
  caps: Capability[];
  sources: string[];
  blurb: string;
}

export const PROGRAM_TYPES: ProgramType[] = [
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

export const programType = (id: string): ProgramType =>
  PROGRAM_TYPES.find((t) => t.id === id) ?? PROGRAM_TYPES[0];

// Brand accent presets (white-label)
export const ACCENTS = [
  { id: "red",    name: "Action Red",   hex: "#D14124" },
  { id: "teal",   name: "Deep Teal",    hex: "#006269" },
  { id: "green",  name: "Forest Green", hex: "#2F7D4F" },
  { id: "blue",   name: "Civic Blue",   hex: "#2A5DB0" },
  { id: "indigo", name: "Indigo",       hex: "#4B3F9E" },
  { id: "plum",   name: "Plum",         hex: "#7A3E6B" },
  { id: "rust",   name: "Rust",         hex: "#B5601F" },
  { id: "slate",  name: "Steel",        hex: "#3F5560" },
];

// palette offered when assigning a per-program color
export const PROGRAM_COLORS = [
  "#D14124", "#006269", "#6FA287", "#F1B434", "#8A6410",
  "#598E93", "#7A3E6B", "#2A5DB0", "#3F5560", "#B5601F",
];

// data sources offered in the program editor
export const DATA_SOURCES = ["Spreadsheet import", "CAP60", "HMIS (PA-503)", "RX Office", "Hancock"];

export const ROLES = ["Case Worker", "Front Desk", "Program Manager", "Data Admin"] as const;
export type Role = (typeof ROLES)[number];
