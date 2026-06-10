import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

/* ============================================================
   CSBG Client Intake System — database schema (SQLite / Drizzle)
   Dates are ISO strings ("YYYY-MM-DD"); timestamps are ISO datetime.
   ============================================================ */

// ---------- Organization (single row, id = 1) — white-label config ----------
export const organization = sqliteTable("organization", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  short: text("short").notNull(),
  tagline: text("tagline").notNull().default(""),
  region: text("region").notNull().default(""),
  accent: text("accent").notNull().default("#D14124"),
  logoMode: text("logo_mode").notNull().default("calv"), // 'calv' | 'wordmark' | 'upload'
  logoData: text("logo_data"),                            // data URL when logoMode = 'upload'
  fyStart: text("fy_start").notNull().default("October"),
  csbgCeiling: integer("csbg_ceiling").notNull().default(125), // % of FPL
});

// ---------- Users, sessions, program assignment ----------
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),                  // short slug, e.g. "dr"
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),                 // 'Case Worker' | 'Front Desk' | 'Program Manager' | 'Data Admin'
  access: text("access").notNull().default("assigned"), // 'all' | 'assigned'
  initials: text("initials").notNull(),
  active: integer("active").notNull().default(1),
});

export const userPrograms = sqliteTable("user_programs", {
  userId: text("user_id").notNull(),
  programId: text("program_id").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.programId] })]);

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
});

// ---------- Programs (configured per agency; type activates tools) ----------
export const programs = sqliteTable("programs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  short: text("short").notNull(),
  color: text("color").notNull(),
  type: text("type").notNull(),                 // program-type id from src/lib/program-types.ts
  sources: text("sources", { mode: "json" }).$type<string[]>().notNull().default([]),
  sort: integer("sort").notNull().default(0),
  active: integer("active").notNull().default(1),
});

// ---------- Required documents ----------
export const docTypes = sqliteTable("doc_types", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
});

export const programDocs = sqliteTable("program_docs", {
  programId: text("program_id").notNull(),
  docKey: text("doc_key").notNull(),
}, (t) => [primaryKey({ columns: [t.programId, t.docKey] })]);

// ---------- Clients (enrolled) ----------
export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),                  // "C-2417"
  first: text("first").notNull(),
  last: text("last").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex"),
  race: text("race"),
  edu: text("edu"),
  work: text("work"),
  insurance: text("insurance"),
  military: text("military"),
  disability: integer("disability"),            // 1 | 0 | null (unknown)
  phone: text("phone"),
  address: text("address"),
  county: text("county"),
  hhType: text("hh_type"),
  hhSize: integer("hh_size").notNull().default(1),
  housing: text("housing"),
  income: integer("income").notNull().default(0), // annual gross $
  incomeSrc: text("income_src"),
  caseworkerId: text("caseworker_id"),
  enrolled: text("enrolled").notNull(),         // date of first enrollment
  fplYear: integer("fpl_year").notNull(),       // pinned guideline year (point-in-time integrity)
  nextFollowUp: text("next_follow_up"),
  flags: text("flags", { mode: "json" }).$type<string[]>().notNull().default([]),
  custom: text("custom", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
  status: text("status").notNull().default("active"), // 'active' | 'closed'
  createdAt: text("created_at").notNull(),
});

export const clientPrograms = sqliteTable("client_programs", {
  clientId: text("client_id").notNull(),
  programId: text("program_id").notNull(),
}, (t) => [primaryKey({ columns: [t.clientId, t.programId] })]);

// ---------- Applications (pre-enrollment eligibility pipeline) ----------
// stage: 'docs' → 'review' → 'decision' → terminal 'approved' | 'denied'
export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),                  // "A-1180"
  first: text("first").notNull(),
  last: text("last").notNull(),
  dob: text("dob").notNull(),
  phone: text("phone"),
  address: text("address"),
  county: text("county"),
  sex: text("sex"),
  race: text("race"),
  edu: text("edu"),
  work: text("work"),
  insurance: text("insurance"),
  military: text("military"),
  disability: integer("disability"),
  hhType: text("hh_type"),
  hhSize: integer("hh_size").notNull().default(1),
  housing: text("housing"),
  income: integer("income").notNull().default(0),
  incomeSrc: text("income_src"),
  custom: text("custom", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
  programId: text("program_id").notNull(),
  caseworkerId: text("caseworker_id"),
  stage: text("stage").notNull().default("docs"),
  applied: text("applied").notNull(),
  fplYear: integer("fpl_year").notNull(),       // pinned guideline year at assessment
  notes: text("notes").notNull().default(""),
  decisionNote: text("decision_note"),
  decidedBy: text("decided_by"),
  decidedAt: text("decided_at"),
  clientId: text("client_id"),                  // set when approved → enrolled
  portalToken: text("portal_token").unique(),   // tokenized self-service link (no login wall)
});

export const applicationDocs = sqliteTable("application_docs", {
  applicationId: text("application_id").notNull(),
  docKey: text("doc_key").notNull(),
  status: text("status").notNull().default("missing"), // 'missing' | 'submitted' | 'verified'
  source: text("source"),                                // 'staff' | 'portal'
  updatedAt: text("updated_at"),
}, (t) => [primaryKey({ columns: [t.applicationId, t.docKey] })]);

// ---------- Service taxonomy + log ----------
export const services = sqliteTable("services", {
  code: text("code").primaryKey(),              // "SRV 4e"
  domain: text("domain").notNull(),             // domain id: sda|emp|edu|inc|hou|hn|civ|tra
  label: text("label").notNull(),
  active: integer("active").notNull().default(1),
  sort: integer("sort").notNull().default(0),
});

export const serviceLog = sqliteTable("service_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  clientId: text("client_id").notNull(),
  code: text("code").notNull(),
  programId: text("program_id").notNull(),
  staffId: text("staff_id").notNull(),
  note: text("note").notNull().default(""),
});

// ---------- Federal Poverty Guidelines (versioned, point-in-time pinning) ----------
export const fplSchedules = sqliteTable("fpl_schedules", {
  year: integer("year").primaryKey(),
  base: integer("base").notNull(),              // household of 1, annual $
  perAdditional: integer("per_additional").notNull(),
  effective: text("effective").notNull(),
  status: text("status").notNull().default("archived"), // 'active' | 'archived'
});

// ---------- Admin-editable answer lists + intake fields ----------
export const lists = sqliteTable("lists", {
  key: text("key").primaryKey(),                // 'sex' | 'race' | ...
  label: text("label").notNull(),
});

export const listValues = sqliteTable("list_values", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listKey: text("list_key").notNull(),
  value: text("value").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const intakeFields = sqliteTable("intake_fields", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  code: text("code").notNull().default(""),     // CSBG code, e.g. "C6"
  type: text("type").notNull(),                 // 'list' | 'choice' | 'yesno' | 'text' | 'number' | 'date'
  listKey: text("list_key"),                    // when type = 'list'
  optionsText: text("options_text"),            // when type = 'choice' (comma-separated)
  enabled: integer("enabled").notNull().default(1),
  builtin: integer("builtin").notNull().default(0),
  sort: integer("sort").notNull().default(0),
});

// ---------- FNPI outcomes (FY rollup) ----------
export const fnpiProgress = sqliteTable("fnpi_progress", {
  code: text("code").primaryKey(),              // "FNPI 4b"
  label: text("label").notNull(),
  served: integer("served").notNull().default(0),
  target: integer("target").notNull().default(0),
  actual: integer("actual").notNull().default(0),
});

// ---------- Integrations ----------
export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),                 // 'API' | 'Import' | 'CSV / XLSX'
  status: text("status").notNull(),             // 'connected' | 'attention' | 'ready'
  lastSync: text("last_sync").notNull().default(""),
  records: text("records").notNull().default(""),
  detail: text("detail").notNull().default(""),
});

// ---------- Audit log ----------
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: text("at").notNull(),                     // ISO datetime
  userId: text("user_id"),
  action: text("action").notNull(),             // e.g. 'application.approve', 'fpl.publish'
  entity: text("entity").notNull(),             // e.g. 'application'
  entityId: text("entity_id").notNull(),
  detail: text("detail").notNull().default(""),
});

// ---------- Misc demo aggregates (agency-wide stats that predate this system) ----------
export const kv = sqliteTable("kv", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
});

/* ============================================================
   Program-tool tables (activated by program type capabilities)
   ============================================================ */

// --- attendance (youth/education) ---
export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  programId: text("program_id").notNull(),
  name: text("name").notNull(),
  site: text("site").notNull().default(""),
  schedule: text("schedule").notNull().default(""),
  srvCode: text("srv_code").notNull().default("SRV 2h"),
});

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull(),
  name: text("name").notNull(),
  clientId: text("client_id"),
  grade: text("grade").notNull().default(""),
  school: text("school").notNull().default(""),
  termPct: integer("term_pct").notNull().default(100),
});

export const classSessions = sqliteTable("class_sessions", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull(),
  date: text("date").notNull(),
  label: text("label").notNull(),
  posted: integer("posted").notNull().default(0),
});

export const attendanceMarks = sqliteTable("attendance_marks", {
  sessionId: text("session_id").notNull(),
  studentId: text("student_id").notNull(),
  mark: text("mark"),                           // 'p' | 'a' | 'e' | null
}, (t) => [primaryKey({ columns: [t.sessionId, t.studentId] })]);

// --- contractors / jobs (weatherization) ---
export const contractors = sqliteTable("contractors", {
  id: text("id").primaryKey(),
  programId: text("program_id").notNull(),
  name: text("name").notNull(),
  trade: text("trade").notNull().default(""),
  crews: integer("crews").notNull().default(1),
  phone: text("phone").notNull().default(""),
  insuranceExp: text("insurance_exp").notNull(),
  bpiExp: text("bpi_exp").notNull(),
  epaRrpExp: text("epa_rrp_exp").notNull(),
  qcPass: integer("qc_pass").notNull().default(100),
});

export const wxJobs = sqliteTable("wx_jobs", {
  id: text("id").primaryKey(),
  programId: text("program_id").notNull(),
  clientName: text("client_name").notNull(),
  clientId: text("client_id"),
  address: text("address").notNull().default(""),
  stage: text("stage").notNull().default("audit"), // 'audit' | 'install' | 'qc' | 'complete'
  contractorId: text("contractor_id"),
  funding: text("funding").notNull().default(""),
  measures: text("measures").notNull().default(""),
  started: text("started").notNull(),
});

// --- pantry network (food bank) ---
export const pantryAgencies = sqliteTable("pantry_agencies", {
  id: text("id").primaryKey(),
  programId: text("program_id").notNull(),
  name: text("name").notNull(),
  town: text("town").notNull().default(""),
  county: text("county").notNull().default(""),
  contact: text("contact").notNull().default(""),
  phone: text("phone").notNull().default(""),
  compliance: text("compliance").notNull().default("current"), // 'current' | 'site-visit-due'
});

export const pantryReports = sqliteTable("pantry_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agencyId: text("agency_id").notNull(),
  month: text("month").notNull(),               // "2026-05"
  status: text("status").notNull().default("missing"), // 'received' | 'missing'
  households: integer("households"),
  lbs: integer("lbs"),
});

// --- seminars (housing counseling) ---
export const seminars = sqliteTable("seminars", {
  id: text("id").primaryKey(),
  programId: text("program_id").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull().default(""),
  site: text("site").notNull().default(""),
  capacity: integer("capacity").notNull().default(0),
  registered: integer("registered").notNull().default(0),
  srvCode: text("srv_code").notNull().default("SRV 3a"),
});

export const seminarAttendees = sqliteTable("seminar_attendees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  seminarId: text("seminar_id").notNull(),
  name: text("name").notNull(),
  clientId: text("client_id"),
  applicationId: text("application_id"),
  intakeStatus: text("intake_status").notNull().default("not-started"), // 'enrolled' | 'in-progress' | 'not-started'
});

// --- construction projects (housing construction) ---
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  programId: text("program_id").notNull(),
  name: text("name").notNull(),
  town: text("town").notNull().default(""),
  buyer: text("buyer").notNull().default(""),
  budget: integer("budget").notNull().default(0),
  spent: integer("spent").notNull().default(0),
  pct: integer("pct").notNull().default(0),
});

export const projectMilestones = sqliteTable("project_milestones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  label: text("label").notNull(),
  done: integer("done").notNull().default(0),
  current: integer("current").notNull().default(0),
  sort: integer("sort").notNull().default(0),
});

export const projectRequirements = sqliteTable("project_requirements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull().default("current"), // 'current' | 'due'
});

// --- volunteers (outreach / food bank) ---
export const volunteers = sqliteTable("volunteers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  clientId: text("client_id"),
  lowIncome: integer("low_income").notNull().default(0),
  role: text("role").notNull().default(""),
  hoursFY: integer("hours_fy").notNull().default(0),
  lastShift: text("last_shift"),
});

export const volunteerPrograms = sqliteTable("volunteer_programs", {
  volunteerId: text("volunteer_id").notNull(),
  programId: text("program_id").notNull(),
}, (t) => [primaryKey({ columns: [t.volunteerId, t.programId] })]);

// --- loans (community loan fund) ---
export const loans = sqliteTable("loans", {
  id: text("id").primaryKey(),
  programId: text("program_id").notNull(),
  borrower: text("borrower").notNull(),
  clientId: text("client_id"),
  purpose: text("purpose").notNull().default(""),
  principal: integer("principal").notNull().default(0),
  balance: integer("balance").notNull().default(0),
  rate: text("rate").notNull().default(""),
  term: text("term").notNull().default(""),
  status: text("status").notNull().default("current"), // 'current' | 'late' | 'paid'
  nextDue: text("next_due"),
  srvCode: text("srv_code").notNull().default("SRV 3b"),
});

// Type exports for convenience
export type Organization = typeof organization.$inferSelect;
export type User = typeof users.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type ApplicationDoc = typeof applicationDocs.$inferSelect;
export type ServiceLogEntry = typeof serviceLog.$inferSelect;
export type FplSchedule = typeof fplSchedules.$inferSelect;
export type IntakeField = typeof intakeFields.$inferSelect;
