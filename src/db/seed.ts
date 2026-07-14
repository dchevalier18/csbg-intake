import crypto from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as t from "./schema";
import * as schema from "./schema";
import { SERVICES, FNPIS } from "@/lib/csbg-catalog";
import { programType } from "@/lib/program-types";
import { prevMonthYm, todayIso } from "@/lib/format";

/* ============================================================
   Seed — realistic fictional Lehigh Valley demo data mapped to
   CSBG Annual Report 3.0 codes, ported from the approved design
   prototype. All people and records are fictional.
   Demo login password for every user: demo1234
   ============================================================ */

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

type DB = NodePgDatabase<typeof schema>;

export async function runSeed(db: DB): Promise<void> {
  const now = new Date().toISOString();

  // ---------- Organization (CALV defaults — white-labelable in Settings) ----------
  await db.insert(t.organization).values({
    id: 1,
    name: "Community Action Lehigh Valley",
    short: "CALV",
    tagline: "Fighting For Good",
    region: "Lehigh & Northampton Counties, PA",
    accent: "#D14124",
    logoMode: "calv",
    fyStart: "October",
    csbgCeiling: 125,
    contactLine: "(610) 691-5620 · Mon–Fri 8:30–4:30",
  });

  // ---------- FPL guideline history (versioned; 2026 active) ----------
  // Official HHS tables, 48 contiguous states + D.C. (src/lib/fpl-data.ts).
  // Earlier years stay for pinned cases — most demo records pin to 2025.
  await db.insert(t.fplSchedules).values([
    { year: 2023, base: 14580, perAdditional: 5140, effective: "2023-01-19", status: "archived", jurisdiction: "contiguous48" },
    { year: 2024, base: 15060, perAdditional: 5380, effective: "2024-01-17", status: "archived", jurisdiction: "contiguous48" },
    { year: 2025, base: 15650, perAdditional: 5500, effective: "2025-01-15", status: "archived", jurisdiction: "contiguous48" },
    { year: 2026, base: 15960, perAdditional: 5680, effective: "2026-01-13", status: "active", jurisdiction: "contiguous48" },
  ]);

  // ---------- Programs (CALV's nine) ----------
  const programs = [
    { id: "cad-a", name: "CA Development — Allentown", short: "CAD Allentown",   color: "#D14124", type: "outreach" },
    { id: "cad-b", name: "CA Development — Bethlehem", short: "CAD Bethlehem",   color: "#DD7461", type: "outreach" },
    { id: "homes", name: "Community Action Homes",     short: "CA Homes",        color: "#6FA287", type: "housing-construction" },
    { id: "gnx",   name: "Generation Next",            short: "Generation Next", color: "#F1B434", type: "youth-ed" },
    { id: "hc",    name: "Housing Counseling",         short: "Housing Couns.",  color: "#006269", type: "housing-counseling" },
    { id: "rtide", name: "Rising Tide Loan Fund",      short: "Rising Tide",     color: "#598E93", type: "loan-fund" },
    { id: "shfb",  name: "Second Harvest Food Bank",   short: "Second Harvest",  color: "#8A6410", type: "food-bank" },
    { id: "sss",   name: "Sixth Street Shelter",       short: "Sixth Street",    color: "#B5601F", type: "shelter" },
    // WX demonstrates the per-program ceiling — PA WAP qualifies households up to 200% FPL
    { id: "wx",    name: "Weatherization",             short: "Weatherization",  color: "#9EC1B0", type: "weatherization", fplCeiling: 200 },
  ];
  await db.insert(t.programs).values(programs.map((p, i) => ({
    ...p,
    sources: programType(p.type).sources.slice(),
    sort: i,
    active: 1,
  })));

  // ---------- Users (demo password for all: demo1234) ----------
  const pw = hashPassword("demo1234");
  await db.insert(t.users).values([
    { id: "dr", name: "Dana Rivera",   username: "dana",     passwordHash: pw, role: "Case Worker",     access: "assigned", initials: "DR" },
    { id: "mk", name: "Marcus Kelly",  username: "marcus",   passwordHash: pw, role: "Case Worker",     access: "assigned", initials: "MK" },
    { id: "ls", name: "Luz Santiago",  username: "luz",      passwordHash: pw, role: "Case Worker",     access: "assigned", initials: "LS" },
    { id: "rg", name: "Robin Garcia",  username: "robin",    passwordHash: pw, role: "Front Desk",      access: "assigned", initials: "RG" },
    { id: "jb", name: "Joan Bartos",   username: "joan",     passwordHash: pw, role: "Program Manager", access: "all",      initials: "JB" },
    { id: "tw", name: "Terrence Webb", username: "terrence", passwordHash: pw, role: "Data Admin",      access: "all",      initials: "TW" },
  ]);
  await db.insert(t.userPrograms).values([
    ...["cad-a", "shfb", "sss", "hc", "rtide"].map((p) => ({ userId: "dr", programId: p })),
    ...["cad-a", "cad-b", "wx", "rtide"].map((p) => ({ userId: "mk", programId: p })),
    ...["cad-a", "cad-b", "gnx", "hc"].map((p) => ({ userId: "ls", programId: p })),
    ...["cad-a", "cad-b"].map((p) => ({ userId: "rg", programId: p })),
  ]);

  // ---------- Required documents ----------
  await db.insert(t.docTypes).values([
    { key: "id",        label: "Photo ID (all adults)" },
    { key: "income",    label: "Income proof — 30 days (pay stubs / award letters)" },
    { key: "residency", label: "Proof of residency" },
    { key: "ssn",       label: "Social Security cards (all members)" },
    { key: "utility",   label: "Utility bill (most recent)" },
    { key: "deed",      label: "Deed or landlord agreement" },
    { key: "custody",   label: "Proof of custody / guardianship" },
    { key: "hmis",      label: "HMIS release of information" },
  ]);
  const programDocs: Record<string, string[]> = {
    "cad-a": ["id", "income", "residency"],
    "cad-b": ["id", "income", "residency"],
    "homes": ["id", "income", "residency", "ssn", "deed"],
    "gnx":   ["id", "income", "residency", "custody"],
    "hc":    ["id", "income", "residency"],
    "rtide": ["id", "income", "residency", "ssn"],
    "shfb":  ["id", "income", "residency"],
    "sss":   ["id", "income", "residency", "hmis"],
    "wx":    ["id", "income", "residency", "utility", "deed"],
  };
  await db.insert(t.programDocs).values(
    Object.entries(programDocs).flatMap(([programId, keys]) => keys.map((docKey) => ({ programId, docKey }))),
  );

  // ---------- Answer lists (admin-editable; CSBG 3.0 Section C/D values) ----------
  const lists: Record<string, { label: string; values: string[] }> = {
    sex:       { label: "Gender identity (C1)", values: ["Female", "Male", "Transgender, non-binary, or another gender"] },
    race:      { label: "Race & ethnicity (C6)", values: ["American Indian or Alaska Native", "Asian", "Black or African American", "Hispanic or Latino", "Middle Eastern or North African", "Native Hawaiian / Pacific Islander", "White", "Multiracial or Multiethnic"] },
    edu:       { label: "Education (C3)", values: ["Grades 0-8", "Grades 9-12 / Non-Graduate", "High School Graduate / GED", "12 grade + Some Post-Secondary", "2 or 4 year College Graduate", "Other post-secondary graduate"] },
    work:      { label: "Work status (C8)", values: ["Employed Full-Time", "Employed Part-Time", "Seasonal Farm Worker", "Unemployed (Short-Term)", "Unemployed (Long-Term)", "Unemployed (Not in Labor Force)", "Retired"] },
    insurance: { label: "Health insurance (C5)", values: ["Medicaid", "Medicare", "State Children's Health Insurance Program", "State Health Insurance for Adults", "Military Health Care", "Direct-Purchase", "Employment-Based", "None"] },
    military:  { label: "Military status (C7)", values: ["Veteran", "Active Military", "Never Served in the Military"] },
    hhType:    { label: "Household type (D9)", values: ["Single Person", "Two Adults no children", "Multiple adults no children", "Single Parent Female", "Single Parent Male", "Single Parent Non-Binary, Transgender, or Another Gender", "Two Parent Household", "Non-related Adults with Children", "Multigenerational Household", "Other"] },
    housing:   { label: "Housing situation (D11)", values: ["Own", "Rent", "Other permanent housing", "Homeless", "Other"] },
    incomeSrc: { label: "Income sources (D13)", values: ["Employment Only", "Employment and Other Income Source", "Employment, Other Source, and Non-Cash Benefits", "Employment and Non-Cash Benefits", "Other Income Source Only", "Other Income Source and Non-Cash Benefits", "No Income", "Non-Cash Benefits Only"] },
    county:    { label: "County / service area", values: ["Lehigh", "Northampton", "Carbon", "Monroe", "Pike", "Wayne", "Other"] },
  };
  await db.insert(t.lists).values(Object.entries(lists).map(([key, l]) => ({ key, label: l.label })));
  await db.insert(t.listValues).values(
    Object.entries(lists).flatMap(([listKey, l]) => l.values.map((value, sort) => ({ listKey, value, sort }))),
  );

  // ---------- Intake form fields (characteristics step) ----------
  await db.insert(t.intakeFields).values([
    { id: "sex",        label: "Gender identity",  code: "C1", type: "list",  listKey: "sex",       enabled: 1, builtin: 1, sort: 0 },
    { id: "race",       label: "Race / ethnicity", code: "C6", type: "list",  listKey: "race",      enabled: 1, builtin: 1, sort: 1 },
    { id: "edu",        label: "Education",        code: "C3", type: "list",  listKey: "edu",       enabled: 1, builtin: 1, sort: 2 },
    { id: "work",       label: "Work status",      code: "C8", type: "list",  listKey: "work",      enabled: 1, builtin: 1, sort: 3 },
    { id: "insurance",  label: "Health insurance", code: "C5", type: "list",  listKey: "insurance", enabled: 1, builtin: 1, sort: 4 },
    { id: "military",   label: "Military status",  code: "C7", type: "list",  listKey: "military",  enabled: 1, builtin: 1, sort: 5 },
    { id: "disability", label: "Disability",       code: "C5", type: "yesno", listKey: null,        enabled: 1, builtin: 1, sort: 6 },
    // C4 is a collected characteristic (not derivable from work/education) —
    // stored in the record's custom fields; the Section C rollup reads it there.
    { id: "disconnectedYouth", label: "Disconnected youth (14-24, not working or in school)",
      code: "C4", type: "yesno", listKey: null, enabled: 1, builtin: 0, sort: 7 },
  ]);

  // ---------- Service taxonomy (full CSBG 3.0 Module 3 Section A) ----------
  await db.insert(t.services).values(SERVICES.map((s, i) => ({
    code: s.code, domain: s.domain, label: s.label, active: 1, sort: i,
  })));

  // ---------- Clients ----------
  const clients = [
    { id: "C-2417", first: "Maribel", last: "Ortega", dob: "1989-03-14", sex: "Female",
      race: "Hispanic or Latino", address: "512 W Turner St, Allentown, PA 18102", county: "Lehigh",
      phone: "(610) 555-0142", hhType: "Single Parent Female", hhSize: 3, housing: "Rent",
      income: 24960, incomeSrc: "Employment and Non-Cash Benefits", work: "Employed Part-Time",
      edu: "High School Graduate / GED", insurance: "Medicaid", military: "Never Served in the Military", disability: 0,
      programs: ["cad-a", "shfb"], caseworkerId: "dr", enrolled: "2025-10-12", fplYear: 2025,
      flags: [] as string[], nextFollowUp: "2026-06-12" },
    { id: "C-2398", first: "James", last: "Holloway", dob: "1961-11-02", sex: "Male",
      race: "Black or African American", address: "77 E 4th St, Bethlehem, PA 18015", county: "Northampton",
      phone: "(610) 555-0177", hhType: "Single Person", hhSize: 1, housing: "Rent",
      income: 14820, incomeSrc: "Other Income Source Only", work: "Unemployed (Long-Term)",
      edu: "Grades 9-12 / Non-Graduate", insurance: "Medicare", military: "Veteran", disability: 1,
      programs: ["cad-b", "wx"], caseworkerId: "mk", enrolled: "2025-11-03", fplYear: 2025,
      flags: ["FNPI follow-up due"], nextFollowUp: "2026-06-10" },
    { id: "C-2431", first: "Soe", last: "Mya", dob: "1996-07-22", sex: "Female",
      race: "Asian", address: "1310 Hanover Ave, Allentown, PA 18109", county: "Lehigh",
      phone: "(484) 555-0119", hhType: "Two Parent Household", hhSize: 5, housing: "Rent",
      income: 39400, incomeSrc: "Employment and Other Income Source", work: "Employed Full-Time",
      edu: null, insurance: "Employment-Based", military: "Never Served in the Military", disability: 0,
      programs: ["cad-a", "gnx"], caseworkerId: "ls", enrolled: "2026-01-21", fplYear: 2025,
      flags: ["Missing: education level"], nextFollowUp: "2026-06-18" },
    { id: "C-2389", first: "Tasha", last: "Reid", dob: "1993-01-30", sex: "Female",
      race: "Black or African American", address: "Sixth Street Shelter, Allentown, PA 18101", county: "Lehigh",
      phone: "(610) 555-0163", hhType: "Single Parent Female", hhSize: 2, housing: "Homeless",
      income: 9100, incomeSrc: "Other Income Source and Non-Cash Benefits", work: "Unemployed (Short-Term)",
      edu: "High School Graduate / GED", insurance: "Medicaid", military: "Never Served in the Military", disability: 0,
      programs: ["sss", "shfb"], caseworkerId: "dr", enrolled: "2026-02-08", fplYear: 2025,
      flags: ["Housing placement in progress"], nextFollowUp: "2026-06-11" },
    { id: "C-2402", first: "Walter", last: "Gergar", dob: "1948-05-09", sex: "Male",
      race: "White", address: "212 Delaware Ave, Bangor, PA 18013", county: "Northampton",
      phone: "(570) 555-0131", hhType: "Two Adults no children", hhSize: 2, housing: "Own",
      income: 21640, incomeSrc: "Other Income Source Only", work: "Retired",
      edu: "High School Graduate / GED", insurance: "Medicare", military: "Veteran", disability: 1,
      programs: ["wx"], caseworkerId: "mk", enrolled: "2024-11-18", fplYear: 2024,
      flags: [], nextFollowUp: "2026-07-01" },
    { id: "C-2440", first: "Dariel", last: "Vásquez", dob: "2008-09-17", sex: "Male",
      race: "Hispanic or Latino", address: "839 Wyandotte St, Bethlehem, PA 18015", county: "Northampton",
      phone: "(484) 555-0188", hhType: "Single Parent Female", hhSize: 4, housing: "Rent",
      income: 31200, incomeSrc: "Employment and Non-Cash Benefits", work: null,
      edu: "Grades 9-12 / Non-Graduate", insurance: "State Children's Health Insurance Program", military: "Never Served in the Military", disability: 0,
      programs: ["gnx"], caseworkerId: "ls", enrolled: "2026-03-15", fplYear: 2025,
      flags: ["Attendance: 91% (Spring term)"], nextFollowUp: "2026-06-20" },
    { id: "C-2415", first: "Priya", last: "Raman", dob: "1985-12-05", sex: "Female",
      race: "Asian", address: "4520 Crackersport Rd, Allentown, PA 18104", county: "Lehigh",
      phone: "(610) 555-0150", hhType: "Two Parent Household", hhSize: 4, housing: "Rent",
      income: 36050, incomeSrc: "Employment Only", work: "Employed Full-Time",
      edu: "2 or 4 year College Graduate", insurance: "Employment-Based", military: "Never Served in the Military", disability: 0,
      programs: ["hc", "rtide"], caseworkerId: "dr", enrolled: "2025-10-28", fplYear: 2025,
      flags: ["First-time homebuyer seminar: complete"], nextFollowUp: "2026-06-25" },
    { id: "C-2369", first: "Robert", last: "Csencsits", dob: "1972-02-19", sex: "Male",
      race: "White", address: "118 S Main St, Slatington, PA 18080", county: "Lehigh",
      phone: "(610) 555-0125", hhType: "Single Person", hhSize: 1, housing: "Rent",
      income: 17890, incomeSrc: "Employment Only", work: "Seasonal Farm Worker",
      edu: null, insurance: null, military: "Never Served in the Military", disability: 0,
      programs: ["cad-a"], caseworkerId: "mk", enrolled: "2026-04-02", fplYear: 2025,
      flags: ["Missing: health insurance source", "Missing: education level"], nextFollowUp: "2026-06-09" },
    { id: "C-2422", first: "Aminata", last: "Diallo", dob: "1999-06-11", sex: "Female",
      race: "Black or African American", address: "926 E 5th St, Bethlehem, PA 18015", county: "Northampton",
      phone: "(484) 555-0171", hhType: "Single Person", hhSize: 1, housing: "Rent",
      income: 19560, incomeSrc: "Employment Only", work: "Employed Part-Time",
      edu: "12 grade + Some Post-Secondary", insurance: "Medicaid", military: "Never Served in the Military", disability: 0,
      programs: ["cad-b", "hc"], caseworkerId: "ls", enrolled: "2026-01-09", fplYear: 2025,
      flags: [], nextFollowUp: "2026-06-30" },
    { id: "C-2435", first: "Gene", last: "Kovach", dob: "1958-08-27", sex: "Male",
      race: "White", address: "23 Broadway, Bangor, PA 18013", county: "Northampton",
      phone: "(570) 555-0109", hhType: "Single Person", hhSize: 1, housing: "Own",
      income: 13975, incomeSrc: "Other Income Source and Non-Cash Benefits", work: "Retired",
      edu: "High School Graduate / GED", insurance: "Medicare", military: "Never Served in the Military", disability: 1,
      programs: ["shfb", "wx"], caseworkerId: "dr", enrolled: "2025-01-08", fplYear: 2024,
      flags: [], nextFollowUp: "2026-07-15" },
  ];
  await db.insert(t.clients).values(clients.map(({ programs: _p, ...c }) => ({ ...c, status: "active", createdAt: now })));
  await db.insert(t.clientPrograms).values(
    clients.flatMap((c) => c.programs.map((programId) => ({ clientId: c.id, programId }))),
  );

  // ---------- Applications (pre-enrollment pipeline) ----------
  const applications = [
    { id: "A-1180", first: "Yolanda", last: "Cruz", dob: "1991-04-08", hhSize: 4, income: 28900,
      programId: "sss", caseworkerId: "dr", stage: "review", applied: "2026-05-28", fplYear: 2025, county: "Lehigh",
      docs: { id: "verified", income: "verified", residency: "verified", hmis: "verified" },
      notes: "Family of 4, fleeing unsafe housing. All docs in — ready for PM review." },
    { id: "A-1183", first: "Samuel", last: "Adeyemi", dob: "1987-10-19", hhSize: 1, income: 16100,
      programId: "cad-b", caseworkerId: "ls", stage: "docs", applied: "2026-06-02", fplYear: 2025, county: "Northampton",
      docs: { id: "verified", income: "missing", residency: "submitted" },
      notes: "Pay stubs requested 6/3. Texted reminder 6/6." },
    { id: "A-1185", first: "Kateryna", last: "Bondar", dob: "1994-02-23", hhSize: 3, income: 30150,
      programId: "wx", caseworkerId: "mk", stage: "docs", applied: "2026-06-04", fplYear: 2025, county: "Lehigh",
      docs: { id: "verified", income: "verified", residency: "verified", utility: "submitted", deed: "missing" },
      notes: "Renter — landlord agreement form sent to property owner." },
    { id: "A-1178", first: "Devon", last: "Pierce", dob: "2009-01-12", hhSize: 5, income: 41300,
      programId: "gnx", caseworkerId: "ls", stage: "review", applied: "2026-05-22", fplYear: 2025, county: "Lehigh",
      docs: { id: "verified", income: "verified", residency: "verified", custody: "verified" },
      notes: "15 y/o, referred by Building 21 counselor. Income 117% FPL — eligible." },
    { id: "A-1186", first: "Rosa", last: "Mejía", dob: "1979-07-30", hhSize: 2, income: 26880,
      programId: "hc", caseworkerId: "dr", stage: "docs", applied: "2026-06-05", fplYear: 2025, county: "Lehigh",
      docs: { id: "submitted", income: "missing", residency: "missing" },
      notes: "Intake started at June 4 seminar. Self-service portal invite sent.",
      portalToken: "demo-rosa" },
    { id: "A-1174", first: "Hassan", last: "Farah", dob: "1983-12-03", hhSize: 6, income: 46210,
      programId: "rtide", caseworkerId: "mk", stage: "decision", applied: "2026-05-12", fplYear: 2025, county: "Northampton",
      docs: { id: "verified", income: "verified", residency: "verified", ssn: "verified" },
      notes: "Food-truck micro-loan. 97% FPL. Credit review complete — recommend approve." },
    { id: "A-1187", first: "Crystal", last: "Yoder", dob: "1990-09-25", hhSize: 3, income: 52400,
      programId: "cad-a", caseworkerId: "dr", stage: "decision", applied: "2026-05-18", fplYear: 2025, county: "Lehigh",
      docs: { id: "verified", income: "verified", residency: "verified" },
      notes: "Income 162% FPL — exceeds CSBG 125% ceiling. Recommend referral to United Way 211." },
    // Past denials — reviewable on /denials; reopenable there for re-enrollment.
    // Teresa was denied over-income (149% vs the 125% ceiling) — the demo path is
    // correcting her income after a job loss, watching the re-check flip, and reopening.
    { id: "A-1171", first: "Teresa", last: "Okafor", dob: "1988-03-14", hhSize: 3, income: 39800,
      programId: "cad-b", caseworkerId: "ls", stage: "denied", applied: "2026-04-21", fplYear: 2025, county: "Northampton",
      docs: { id: "verified", income: "verified", residency: "verified" },
      notes: "Income re-verified at review — second job pushed the household over the ceiling.",
      decisionNote: "Household income 149% of FPL exceeds the program's 125% ceiling. Referred to United Way 211 and LIHEAP.",
      decidedBy: "jb", decidedAt: "2026-05-06T15:20:00.000Z" },
    // Walter is income-eligible (91% FPL) but his paperwork never arrived — a
    // straight reopen back to the 'docs' stage once he resurfaces.
    { id: "A-1168", first: "Walter", last: "Hess", dob: "1961-11-02", hhSize: 1, income: 14300,
      programId: "wx", caseworkerId: "mk", stage: "denied", applied: "2026-03-09", fplYear: 2025, county: "Lehigh",
      docs: { id: "verified", income: "missing", residency: "submitted", utility: "missing", deed: "missing" },
      notes: "Left voicemails 3/12 and 3/19; letter mailed 3/26. No response.",
      decisionNote: "Required documents never received after three outreach attempts (3/12, 3/19, 3/26). Application closed — applicant may reapply when paperwork is available.",
      decidedBy: "jb", decidedAt: "2026-04-02T13:05:00.000Z" },
  ];
  await db.insert(t.applications).values(applications.map(({ docs: _d, ...a }) => a));
  // Supporting files + verification sign-offs for docs already submitted/verified, so the
  // review modal shows a full audit trail. One bypass example: Hassan's SSN card was sighted
  // in person (agency policy prohibits retaining copies), so it was verified without a file.
  await db.insert(t.applicationDocs).values(
    applications.flatMap((a) =>
      Object.entries(a.docs).map(([docKey, status]) => {
        const bypassed = a.id === "A-1174" && docKey === "ssn";
        const hasFile = (status === "submitted" || status === "verified") && !bypassed;
        return {
          applicationId: a.id, docKey, status, source: "staff", updatedAt: now,
          ...(hasFile ? {
            fileName: `${a.last}-${a.first[0]}_${docKey}.pdf`.toLowerCase().replace(/[^a-z0-9._-]/g, ""),
            fileBy: a.caseworkerId, fileAt: a.applied,
          } : {}),
          ...(status === "verified" ? { verifiedBy: a.caseworkerId, verifiedAt: a.applied } : {}),
          ...(bypassed ? {
            bypassBy: a.caseworkerId, bypassAt: a.applied,
            bypassReason: "SSN card sighted in person at intake — agency policy prohibits retaining copies.",
          } : {}),
        };
      }),
    ),
  );

  // ---------- Service log ----------
  await db.insert(t.serviceLog).values([
    { date: "2026-06-09", clientId: "C-2389", code: "SDA 1c", programId: "sss",   staffId: "dr", note: "Housing plan check-in; viewed 2 units on Linden St." },
    { date: "2026-06-09", clientId: "C-2417", code: "SRV 5r", programId: "shfb",  staffId: "dr", note: "Monthly distribution box — family of 3." },
    { date: "2026-06-08", clientId: "C-2398", code: "SRV 4e", programId: "cad-b", staffId: "mk", note: "UGI arrears — $214 paid via crisis fund." },
    { date: "2026-06-08", clientId: "C-2440", code: "SRV 2h", programId: "gnx",   staffId: "ls", note: "After-school session — robotics module, present." },
    { date: "2026-06-07", clientId: "C-2415", code: "SRV 3a", programId: "hc",    staffId: "dr", note: "Budget review + credit pull. Score up 22 pts since Jan." },
    { date: "2026-06-06", clientId: "C-2402", code: "SRV 4g", programId: "wx",    staffId: "mk", note: "Final inspection passed. Blower-door: 18% leakage reduction." },
    { date: "2026-06-06", clientId: "C-2422", code: "SDA 1b", programId: "cad-b", staffId: "ls", note: "Referred to LANTA shared-ride for work commute." },
    { date: "2026-06-05", clientId: "C-2369", code: "SRV 1c", programId: "cad-a", staffId: "mk", note: "Work boots + gloves voucher for orchard season." },
    { date: "2026-06-05", clientId: "C-2435", code: "SRV 5r", programId: "shfb",  staffId: "dr", note: "Senior box + fresh produce." },
    { date: "2026-06-04", clientId: "C-2431", code: "SRV 2q", programId: "cad-a", staffId: "ls", note: "Parenting workshop — session 3 of 6." },
  ]);

  // ---------- FNPI targets (full catalog; FY targets on the indicators CALV works) ----------
  // Targets are at client-level demo scale — served/actual come live from outcome_log.
  const fnpiTargets: Record<string, number> = {
    "FNPI 1b": 2,
    "FNPI 2b": 1,
    "FNPI 3a": 2,
    "FNPI 4a": 1,
    "FNPI 4b": 2,
    "FNPI 4f": 1,
    "FNPI 4g": 1,
    "FNPI 5j": 4,
  };
  await db.insert(t.fnpiProgress).values(FNPIS.map((f) => ({
    code: f.code,
    label: f.label,
    served: 0,
    target: fnpiTargets[f.code] ?? 0,
    actual: 0,
  })));

  // ---------- Outcome log (client-level FNPI recording — feeds Module 3 Section B) ----------
  await db.insert(t.outcomeLog).values([
    { date: "2026-03-18", clientId: "C-2417", code: "FNPI 1b", programId: "cad-a", staffId: "dr", status: "working",  note: "Job-readiness workshop complete; search ongoing." },
    { date: "2026-05-02", clientId: "C-2417", code: "FNPI 5j", programId: "shfb",  staffId: "dr", status: "achieved", note: "Monthly distribution + SNAP enrollment confirmed." },
    { date: "2026-06-08", clientId: "C-2398", code: "FNPI 4g", programId: "cad-b", staffId: "mk", status: "achieved", note: "UGI arrears cleared via crisis fund — service restored." },
    { date: "2026-06-06", clientId: "C-2402", code: "FNPI 4f", programId: "wx",    staffId: "mk", status: "achieved", note: "Weatherization job WX-2241 complete — blower-door verified." },
    { date: "2026-02-08", clientId: "C-2389", code: "FNPI 4a", programId: "sss",   staffId: "dr", status: "achieved", note: "Placed at Sixth Street Shelter on intake." },
    { date: "2026-04-10", clientId: "C-2389", code: "FNPI 5j", programId: "shfb",  staffId: "dr", status: "achieved", note: "Pantry access established + WIC referral complete." },
    { date: "2026-05-15", clientId: "C-2431", code: "FNPI 2b", programId: "gnx",   staffId: "ls", status: "achieved", note: "Spring skills assessment passed — Summer Bridge confirmed." },
    { date: "2026-05-30", clientId: "C-2440", code: "FNPI 2b", programId: "gnx",   staffId: "ls", status: "working",  note: "Robotics module on track — 91% attendance." },
    { date: "2026-06-07", clientId: "C-2415", code: "FNPI 3a", programId: "hc",    staffId: "dr", status: "achieved", note: "Credit score up 22 points since January." },
    { date: "2026-06-01", clientId: "C-2415", code: "FNPI 4b", programId: "hc",    staffId: "dr", status: "working",  note: "Homebuyer workshop complete — pre-approval pending." },
    { date: "2026-04-22", clientId: "C-2422", code: "FNPI 3a", programId: "hc",    staffId: "ls", status: "working",  note: "Budget plan drafted; savings goal set." },
    { date: "2026-03-12", clientId: "C-2435", code: "FNPI 5j", programId: "shfb",  staffId: "dr", status: "achieved", note: "Senior box program + produce delivery." },
    { date: "2026-05-12", clientId: "C-2435", code: "FNPI 4f", programId: "wx",    staffId: "mk", status: "working",  note: "Furnace replacement underway — job WX-2248." },
    { date: "2026-06-05", clientId: "C-2369", code: "FNPI 1b", programId: "cad-a", staffId: "mk", status: "achieved", note: "Work-gear voucher issued; orchard placement secured." },
  ]);

  // ---------- Integrations ----------
  await db.insert(t.integrations).values([
    { id: "rxoffice", name: "RX Office", kind: "API", status: "connected", lastSync: "Today 6:00 AM", records: "4,212 clients", detail: "Housing counseling CMS — nightly two-way sync" },
    { id: "hancock", name: "Hancock", kind: "API", status: "connected", lastSync: "Today 6:00 AM", records: "1,876 energy cases", detail: "Weatherization / LIHEAP case data" },
    { id: "hmis", name: "HMIS (PA-503)", kind: "API", status: "ready", lastSync: "—", records: "MOU signed", detail: "Eastern PA CoC — read-only client sync; awaiting vendor API setup" },
    { id: "cap60", name: "CAP60", kind: "Import", status: "connected", lastSync: "Jun 1", records: "FY25 archive", detail: "Legacy CSBG system — historical import complete" },
    { id: "sheets", name: "Spreadsheet import", kind: "CSV / XLSX", status: "ready", lastSync: "Jun 8", records: "3 templates", detail: "Pantry aggregates, seminar sign-ins, volunteer hours" },
  ]);

  // ---------- Agency-wide aggregates (history predating this system) ----------
  await db.insert(t.kv).values([
    { key: "agency", value: { individualsServed: 18244, householdsServed: 7491, newThisFY: 3120 } },
    { key: "srvByDomain", value: [
      { domain: "hn",  count: 11240 }, { domain: "hou", count: 3180 },
      { domain: "sda", count: 2890 },  { domain: "inc", count: 1430 },
      { domain: "edu", count: 1210 },  { domain: "emp", count: 640 },
      { domain: "tra", count: 410 },   { domain: "civ", count: 380 },
    ] },
    { key: "topServices", value: [
      { code: "SRV 5r", count: 8410 }, { code: "SRV 4e", count: 1890 }, { code: "SDA 1c", count: 1620 },
    ] },
    { key: "shfbStats", value: { agencies: 212, countiesServed: 6, lbsYTD: 14600000, mealsYTD: 8100000, reportsThisMonth: { received: 178, missing: 34 } } },
    { key: "volStats", value: { totalHoursFY: 11840, lowIncomeHoursFY: 4120, activeVolunteers: 386 } },
    // `awaiting` is computed live from the match_reviews queue — never stored
    { key: "matching", value: { auto: 6988, staff: 312, awaiting: 0, silent: 0 } },
    { key: "wxStats", value: { unitsCompletedFY: 96, avgDaysAuditToQc: 38 } },
  ]);

  /* ---------- Program tools ---------- */

  // Generation Next — classroom attendance
  await db.insert(t.classes).values([
    { id: "gnx-summer-bridge", programId: "gnx", name: "Summer Bridge — Robotics & Life Skills", site: "Allentown YMCA, Room 204", schedule: "Mon–Thu · 3:30–5:30 PM", srvCode: "SRV 2h" },
  ]);
  const gnxStudents = [
    { id: "G-101", name: "Dariel Vásquez", clientId: "C-2440", grade: "11th", school: "Liberty HS",   termPct: 91, marks: ["p", "p", "a", "p", null] },
    { id: "G-102", name: "Keily Rosario",  clientId: null,     grade: "10th", school: "Allen HS",     termPct: 96, marks: ["p", "p", "p", "p", null] },
    { id: "G-103", name: "Marcus Boyd",    clientId: null,     grade: "11th", school: "Dieruff HS",   termPct: 78, marks: ["a", "p", "p", "a", null] },
    { id: "G-104", name: "Lina Haddad",    clientId: null,     grade: "9th",  school: "Freedom HS",   termPct: 98, marks: ["p", "p", "p", "p", null] },
    { id: "G-105", name: "Tyrese Coleman", clientId: null,     grade: "12th", school: "Liberty HS",   termPct: 85, marks: ["p", "e", "p", "p", null] },
    { id: "G-106", name: "Yaritza Peña",   clientId: null,     grade: "10th", school: "Allen HS",     termPct: 89, marks: ["p", "p", "p", "a", null] },
    { id: "G-107", name: "Ethan Yoder",    clientId: null,     grade: "9th",  school: "Northeast MS", termPct: 93, marks: ["p", "p", "e", "p", null] },
    { id: "G-108", name: "Amara Diop",     clientId: null,     grade: "11th", school: "Dieruff HS",   termPct: 97, marks: ["p", "p", "p", "p", null] },
  ];
  await db.insert(t.students).values(gnxStudents.map(({ marks: _m, ...s }) => ({ ...s, classId: "gnx-summer-bridge" })));
  const sessions = [
    { id: "s1", date: "2026-06-02", label: "Jun 2", posted: 1 },
    { id: "s2", date: "2026-06-03", label: "Jun 3", posted: 1 },
    { id: "s3", date: "2026-06-04", label: "Jun 4", posted: 1 },
    { id: "s4", date: "2026-06-08", label: "Jun 8", posted: 1 },
    { id: "s5", date: "2026-06-09", label: "Jun 9", posted: 0 },
  ];
  await db.insert(t.classSessions).values(sessions.map((s) => ({ ...s, classId: "gnx-summer-bridge" })));
  await db.insert(t.attendanceMarks).values(
    gnxStudents.flatMap((st) => sessions.map((sess, i) => ({ sessionId: sess.id, studentId: st.id, mark: st.marks[i] }))),
  );

  // Weatherization — contractors & jobs
  await db.insert(t.contractors).values([
    { id: "W-01", programId: "wx", name: "Keystone Insulation Co.",   trade: "Insulation / air sealing", crews: 3, phone: "(610) 555-0201", insuranceExp: "2027-02-15", bpiExp: "2026-11-30", epaRrpExp: "2027-08-01", qcPass: 97 },
    { id: "W-02", programId: "wx", name: "Lehigh HVAC Partners",      trade: "Heating systems",          crews: 2, phone: "(610) 555-0233", insuranceExp: "2026-07-08", bpiExp: "2027-03-22", epaRrpExp: "2026-12-15", qcPass: 94 },
    { id: "W-03", programId: "wx", name: "Valley Window & Door",      trade: "Windows / doors",          crews: 1, phone: "(484) 555-0260", insuranceExp: "2027-01-20", bpiExp: "2026-06-30", epaRrpExp: "2027-05-10", qcPass: 91 },
    { id: "W-04", programId: "wx", name: "Pocono Energy Audits LLC",  trade: "Audits / blower door",     crews: 2, phone: "(570) 555-0274", insuranceExp: "2027-04-02", bpiExp: "2027-09-18", epaRrpExp: "2027-02-28", qcPass: 99 },
  ]);
  await db.insert(t.wxJobs).values([
    { id: "WX-2241", programId: "wx", clientName: "Walter Gergar",   clientId: "C-2402", address: "212 Delaware Ave, Bangor",    stage: "complete", contractorId: "W-01", funding: "DOE WAP",            measures: "Attic insulation, air sealing, CO detectors", started: "2026-04-21" },
    { id: "WX-2248", programId: "wx", clientName: "Gene Kovach",     clientId: "C-2435", address: "23 Broadway, Bangor",         stage: "qc",       contractorId: "W-02", funding: "LIHEAP Crisis",      measures: "Furnace replacement, smart thermostat", started: "2026-05-12" },
    { id: "WX-2252", programId: "wx", clientName: "Ana Reyes",       clientId: null,     address: "731 N 7th St, Allentown",     stage: "install",  contractorId: "W-01", funding: "DOE WAP",            measures: "Dense-pack walls, basement rim joist", started: "2026-05-26" },
    { id: "WX-2255", programId: "wx", clientName: "Earl Frantz",     clientId: null,     address: "44 Mauch Chunk St, Nazareth", stage: "install",  contractorId: "W-03", funding: "UGI partnership",    measures: "Window replacement (6), door sweep", started: "2026-06-01" },
    { id: "WX-2257", programId: "wx", clientName: "Marisol Núñez",   clientId: null,     address: "912 Ferry St, Easton",        stage: "audit",    contractorId: "W-04", funding: "DOE WAP",            measures: "Initial audit + blower door scheduled 6/12", started: "2026-06-08" },
    { id: "WX-2258", programId: "wx", clientName: "Kateryna Bondar", clientId: null,     address: "305 Tilghman St, Allentown",  stage: "audit",    contractorId: "W-04", funding: "Pending eligibility", measures: "Audit blocked — awaiting landlord agreement (see eligibility queue)", started: "2026-06-08" },
  ]);

  // Second Harvest — pantry member agencies + reports for the open cycle
  // (the month that just closed, so the demo story tracks the real calendar)
  const reportMonth = prevMonthYm(todayIso());
  const agencies = [
    { id: "P-014", name: "New Bethany Ministries",            town: "Bethlehem",   county: "Northampton", contact: "S. Alvarez",   phone: "(610) 555-0310", compliance: "current",        may: { status: "received", households: 412, lbs: 18240 } },
    { id: "P-022", name: "Easton Area Neighborhood Center",   town: "Easton",      county: "Northampton", contact: "D. Brooks",    phone: "(610) 555-0322", compliance: "current",        may: { status: "received", households: 367, lbs: 15910 } },
    { id: "P-031", name: "St. Paul's Food Pantry",            town: "Allentown",   county: "Lehigh",      contact: "Fr. M. Okafor", phone: "(610) 555-0339", compliance: "current",       may: { status: "missing", households: null, lbs: null } },
    { id: "P-008", name: "Slatington Food Bank",              town: "Slatington",  county: "Lehigh",      contact: "R. Hartman",   phone: "(610) 555-0344", compliance: "current",        may: { status: "received", households: 201, lbs: 8730 } },
    { id: "P-040", name: "Carbon County Friendship Pantry",   town: "Jim Thorpe",  county: "Carbon",      contact: "L. Gable",     phone: "(570) 555-0351", compliance: "site-visit-due", may: { status: "missing", households: null, lbs: null } },
    { id: "P-027", name: "Monroe Mobile Pantry",              town: "Stroudsburg", county: "Monroe",      contact: "T. Nguyen",    phone: "(570) 555-0368", compliance: "current",        may: { status: "received", households: 288, lbs: 12480 } },
  ];
  await db.insert(t.pantryAgencies).values(agencies.map(({ may: _m, ...a }) => ({ ...a, programId: "shfb" })));
  await db.insert(t.pantryReports).values(agencies.map((a) => ({
    agencyId: a.id, month: reportMonth, status: a.may.status, households: a.may.households, lbs: a.may.lbs,
  })));

  // Housing Counseling — seminars
  await db.insert(t.seminars).values([
    { id: "SEM-18", programId: "hc", title: "First-Time Homebuyer Workshop",   date: "2026-06-14", time: "9:00 AM – 1:00 PM",   site: "CALV Main Office, Allentown",      capacity: 30, registered: 26, srvCode: "SRV 3a" },
    { id: "SEM-19", programId: "hc", title: "Foreclosure Prevention Clinic",   date: "2026-06-21", time: "6:00 – 8:00 PM",      site: "Bethlehem Area Public Library",    capacity: 20, registered: 11, srvCode: "SRV 3a" },
    { id: "SEM-20", programId: "hc", title: "Renter Rights & Eviction Defense", date: "2026-06-28", time: "10:00 AM – 12:00 PM", site: "Easton Community Center",          capacity: 25, registered: 19, srvCode: "SRV 4d" },
  ]);
  await db.insert(t.seminarAttendees).values([
    { seminarId: "SEM-18", name: "Rosa Mejía",     applicationId: "A-1186", clientId: null,     intakeStatus: "in-progress" },
    { seminarId: "SEM-18", name: "Priya Raman",    applicationId: null,     clientId: "C-2415", intakeStatus: "enrolled" },
    { seminarId: "SEM-18", name: "Jordan Wells",   applicationId: null,     clientId: null,     intakeStatus: "not-started" },
    { seminarId: "SEM-18", name: "Fatima Al-Sayed", applicationId: null,    clientId: null,     intakeStatus: "not-started" },
  ]);

  // CA Homes — construction projects
  await db.insert(t.projects).values([
    { id: "H-07", programId: "homes", name: "417 N Jordan St — full rehab", town: "Allentown", buyer: "Matched — Ortega family (C-2417 waitlist)", budget: 218000, spent: 164000, pct: 74 },
    { id: "H-08", programId: "homes", name: "622 Pawnee St — new build",    town: "Bethlehem", buyer: "Buyer pool — 3 pre-approved",               budget: 264000, spent: 71000,  pct: 27 },
  ]);
  const h7 = ["Acquisition & title|1|0", "Permits (City of Allentown)|1|0", "Structural & roof|1|0", "MEP rough-in|1|0", "Insulation & drywall|0|1", "Finishes & appliances|0|0", "Final inspection / CO|0|0", "Settlement|0|0"];
  const h8 = ["Lot acquisition|1|0", "Permits (City of Bethlehem)|1|0", "Foundation|1|0", "Framing|0|1", "MEP rough-in|0|0", "Insulation & drywall|0|0", "Finishes|0|0", "Final inspection / CO|0|0", "Settlement|0|0"];
  await db.insert(t.projectMilestones).values([
    ...h7.map((m, i) => { const [label, done, current] = m.split("|"); return { projectId: "H-07", label, done: Number(done), current: Number(current), sort: i }; }),
    ...h8.map((m, i) => { const [label, done, current] = m.split("|"); return { projectId: "H-08", label, done: Number(done), current: Number(current), sort: i }; }),
  ]);
  await db.insert(t.projectRequirements).values([
    { projectId: "H-07", label: "Davis-Bacon payroll certs (HOME funds)", status: "current" },
    { projectId: "H-07", label: "Lead-safe certification (pre-1978)",     status: "current" },
    { projectId: "H-07", label: "Section 3 hiring report — Q2",           status: "due" },
    { projectId: "H-08", label: "NEPA environmental review",              status: "current" },
    { projectId: "H-08", label: "Energy Star v3.2 verification plan",     status: "current" },
    { projectId: "H-08", label: "CDBG draw #2 documentation",             status: "due" },
  ]);

  // Volunteers (Module 2, B.1 — low-income split)
  const vols = [
    { id: "V-201", name: "Carol Stauffer",   clientId: null,     lowIncome: 0, role: "Warehouse sort",       hoursFY: 184, lastShift: "2026-06-07", programs: ["shfb"] },
    { id: "V-188", name: "Maribel Ortega",   clientId: "C-2417", lowIncome: 1, role: "Pantry distribution",  hoursFY: 62,  lastShift: "2026-06-06", programs: ["shfb"] },
    { id: "V-214", name: "Hank Williams Jr.", clientId: null,    lowIncome: 0, role: "Outreach events",      hoursFY: 48,  lastShift: "2026-06-04", programs: ["cad-a"] },
    { id: "V-220", name: "Aminata Diallo",   clientId: "C-2422", lowIncome: 1, role: "Seminar greeter",      hoursFY: 35,  lastShift: "2026-06-05", programs: ["cad-b", "hc"] },
    { id: "V-198", name: "Pat Donchez",      clientId: null,     lowIncome: 0, role: "Build crew",           hoursFY: 122, lastShift: "2026-06-08", programs: ["homes"] },
    { id: "V-225", name: "Sofia Marrero",    clientId: null,     lowIncome: 1, role: "Tutoring",             hoursFY: 27,  lastShift: "2026-06-03", programs: ["gnx"] },
  ];
  await db.insert(t.volunteers).values(vols.map(({ programs: _p, ...v }) => v));
  await db.insert(t.volunteerPrograms).values(
    vols.flatMap((v) => v.programs.map((programId) => ({ volunteerId: v.id, programId }))),
  );

  // Rising Tide — loan portfolio
  await db.insert(t.loans).values([
    { id: "L-3041", programId: "rtide", borrower: "Hassan Farah",   clientId: null,     purpose: "Halal food truck — equipment & buildout",       principal: 18000, balance: 12480, rate: "4.5%", term: "48 mo", rateBps: 450, termMonths: 48, originated: "2025-03-20", status: "current", nextDue: "2026-06-20" },
    { id: "L-3028", programId: "rtide", borrower: "Priya Raman",    clientId: "C-2415", purpose: "Home daycare — licensing & supplies",           principal: 9500,  balance: 3120,  rate: "4.0%", term: "36 mo", rateBps: 400, termMonths: 36, originated: "2024-06-18", status: "current", nextDue: "2026-06-18" },
    { id: "L-3015", programId: "rtide", borrower: "Marcus Okonkwo", clientId: null,     purpose: "Barbershop chair rental + tools",               principal: 6000,  balance: 5400,  rate: "5.0%", term: "24 mo", rateBps: 500, termMonths: 24, originated: "2026-02-25", status: "late",    nextDue: "2026-05-25" },
    { id: "L-2990", programId: "rtide", borrower: "Lucia Ferraro",  clientId: null,     purpose: "Seamstress studio — industrial machine",        principal: 7200,  balance: 0,     rate: "4.5%", term: "30 mo", rateBps: 450, termMonths: 30, originated: "2023-11-01", status: "paid",    nextDue: null },
    { id: "L-3052", programId: "rtide", borrower: "Dwayne Ellis",   clientId: null,     purpose: "Mobile auto-detailing startup",                 principal: 11000, balance: 10670, rate: "4.5%", term: "48 mo", rateBps: 450, termMonths: 48, originated: "2026-03-28", status: "current", nextDue: "2026-06-28" },
    { id: "L-3009", programId: "rtide", borrower: "Aisha Rahman",   clientId: null,     purpose: "Catering business — commercial kitchen deposit", principal: 14500, balance: 8990, rate: "4.0%", term: "42 mo", rateBps: 400, termMonths: 42, originated: "2024-10-15", status: "current", nextDue: "2026-06-15" },
    { id: "L-2978", programId: "rtide", borrower: "Tomás Delgado",  clientId: null,     purpose: "Landscaping equipment",                          principal: 8800, balance: 1450,  rate: "5.0%", term: "36 mo", rateBps: 500, termMonths: 36, originated: "2023-12-30", status: "late",    nextDue: "2026-05-30" },
  ]);
  // Ledger history (most recent payments — older rows predate the system)
  await db.insert(t.loanPayments).values([
    { loanId: "L-3041", date: "2026-04-18", amount: 411, interest: 50, principal: 361, balanceAfter: 12843, staffId: "jb", note: "" },
    { loanId: "L-3041", date: "2026-05-18", amount: 411, interest: 48, principal: 363, balanceAfter: 12480, staffId: "jb", note: "" },
    { loanId: "L-3028", date: "2026-03-15", amount: 280, interest: 13, principal: 267, balanceAfter: 3657, staffId: "jb", note: "" },
    { loanId: "L-3028", date: "2026-04-15", amount: 280, interest: 12, principal: 268, balanceAfter: 3389, staffId: "jb", note: "" },
    { loanId: "L-3028", date: "2026-05-15", amount: 280, interest: 11, principal: 269, balanceAfter: 3120, staffId: "jb", note: "money order — receipt on file" },
  ]);

  // Weatherization — contractor expense vouchers
  await db.insert(t.wxVouchers).values([
    { id: "WXV-118", programId: "wx", contractorId: "W-01", jobId: "WX-2241", date: "2026-05-29", amount: 6840, memo: "Attic insulation + air sealing — final invoice", status: "paid",      createdBy: "jb", decidedBy: "tw", paidAt: "2026-06-05" },
    { id: "WXV-121", programId: "wx", contractorId: "W-02", jobId: "WX-2248", date: "2026-06-06", amount: 4425, memo: "Furnace replacement — progress billing 2 of 3",  status: "approved", createdBy: "jb", decidedBy: "tw", paidAt: null },
    { id: "WXV-122", programId: "wx", contractorId: "W-03", jobId: "WX-2255", date: "2026-06-08", amount: 1980, memo: "Window units (6) — materials on delivery",       status: "submitted", createdBy: "jb", decidedBy: null, paidAt: null },
  ]);
}
