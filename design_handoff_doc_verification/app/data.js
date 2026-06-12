/* ============================================================
   CSBG Client Intake System — Sample Data
   Fictional data. CSBG codes per Annual Report 3.0 (OMB 0970-0492).
   ============================================================ */

// ---------- Fiscal year ----------
const FY = {
  label: "FY 2026",
  range: "Oct 1, 2025 – Sep 30, 2026",
  pctElapsed: 69, // ~June 9 2026
};

// ---------- HHS Poverty Guidelines (48 contiguous states) ----------
const FPL = {
  year: 2025,
  base: 15650,      // household of 1
  perAdditional: 5500,
  csbgLimit: 125,   // % of FPL — CSBG eligibility ceiling (PA)
  annualFor(size) { return this.base + this.perAdditional * (Math.max(1, size) - 1); },
  pct(income, size) { return Math.round((income / this.annualFor(size)) * 100); },
};

// D12 income bands (% of FPL)
const FPL_BANDS = ["Up to 50%","51–75%","76–100%","101–125%","126–150%","151–175%","176–200%","201–250%","251%+"];
function fplBand(p){
  if (p <= 50) return 0; if (p <= 75) return 1; if (p <= 100) return 2;
  if (p <= 125) return 3; if (p <= 150) return 4; if (p <= 175) return 5;
  if (p <= 200) return 6; if (p <= 250) return 7; return 8;
}

// ---------- Programs ----------
const PROGRAMS = [
  { id:"cad-a",  name:"CA Development — Allentown",  short:"CAD Allentown",  color:"var(--calv-red)",      features:["intake","services","volunteers","outreach","referral"] },
  { id:"cad-b",  name:"CA Development — Bethlehem",  short:"CAD Bethlehem",  color:"var(--calv-red-65)",   features:["intake","services","volunteers","outreach","referral"] },
  { id:"homes",  name:"Community Action Homes",      short:"CA Homes",       color:"var(--calv-sage)",     features:["intake","services","construction"] },
  { id:"gnx",    name:"Generation Next",             short:"Generation Next",color:"var(--calv-amber)",    features:["intake","services","attendance"] },
  { id:"hc",     name:"Housing Counseling",          short:"Housing Couns.", color:"var(--calv-teal)",     features:["intake","services","seminars"] },
  { id:"rtide",  name:"Rising Tide Loan Fund",       short:"Rising Tide",    color:"var(--calv-teal-65)",  features:["intake","services","loans"] },
  { id:"shfb",   name:"Second Harvest Food Bank",    short:"Second Harvest", color:"#8A6410",              features:["intake","services","volunteers","agencies","aggregate"] },
  { id:"sss",    name:"Sixth Street Shelter",        short:"Sixth Street",   color:"var(--calv-amber)",    features:["intake","services","beds"] },
  { id:"wx",     name:"Weatherization",              short:"Weatherization", color:"var(--calv-sage-65)",  features:["intake","services","contractors"] },
];
const programById = (id) => ((typeof window !== "undefined" && window.ACTIVE_PROGRAMS) || PROGRAMS).find(p => p.id === id) || { name: "—", short: "—", color: "var(--calv-slate-35)" };

// ---------- CSBG service taxonomy (Module 3 Section A, condensed) ----------
const DOMAINS = [
  { id:"sda", code:"SDA",   name:"Service Delivery & Access" },
  { id:"emp", code:"SRV 1", name:"Employment" },
  { id:"edu", code:"SRV 2", name:"Education & Youth" },
  { id:"inc", code:"SRV 3", name:"Income & Asset Building" },
  { id:"hou", code:"SRV 4", name:"Housing" },
  { id:"hn",  code:"SRV 5", name:"Health & Nutrition" },
  { id:"civ", code:"SRV 6", name:"Civic Engagement" },
  { id:"tra", code:"SRV 7", name:"Transportation" },
];

const SERVICES = [
  { code:"SDA 1a",  domain:"sda", label:"Eligibility determination" },
  { code:"SDA 1b",  domain:"sda", label:"Referral provided" },
  { code:"SDA 1c",  domain:"sda", label:"Case management session" },
  { code:"SRV 1b",  domain:"emp", label:"Adult job-readiness skills training" },
  { code:"SRV 1c",  domain:"emp", label:"Employment supplies (uniforms, boots, tools)" },
  { code:"SRV 1d",  domain:"emp", label:"Employment retention & growth support" },
  { code:"SRV 2h",  domain:"edu", label:"Before / after-school activities" },
  { code:"SRV 2i",  domain:"edu", label:"Summer youth program session" },
  { code:"SRV 2j",  domain:"edu", label:"Youth life-skills & coaching" },
  { code:"SRV 2q",  domain:"edu", label:"Parenting supports / coaching" },
  { code:"SRV 3a",  domain:"inc", label:"Financial literacy / budgeting / VITA" },
  { code:"SRV 3b",  domain:"inc", label:"Business & self-employment services (micro-loan)" },
  { code:"SRV 3c",  domain:"inc", label:"Benefit coordination (SNAP, TANF, SSI…)" },
  { code:"SRV 4a",  domain:"hou", label:"Emergency rental payment assistance" },
  { code:"SRV 4c",  domain:"hou", label:"Rapid re-housing / housing placement" },
  { code:"SRV 4d",  domain:"hou", label:"Eviction prevention counseling" },
  { code:"SRV 4e",  domain:"hou", label:"Utility payment assistance" },
  { code:"SRV 4f",  domain:"hou", label:"Home maintenance & improvement" },
  { code:"SRV 4g",  domain:"hou", label:"Weatherization / energy efficiency" },
  { code:"SRV 5q",  domain:"hn",  label:"Prepared meals provided" },
  { code:"SRV 5r",  domain:"hn",  label:"Food distribution package" },
  { code:"SRV 5t",  domain:"hn",  label:"Hygiene kits / supplies" },
  { code:"SRV 6c",  domain:"civ", label:"Volunteer opportunity engagement" },
  { code:"SRV 7a",  domain:"tra", label:"Transit vouchers / bus passes" },
  { code:"SRV 7b",  domain:"tra", label:"Gas cards" },
];
const serviceByCode = (c) => SERVICES.find(s => s.code === c) || {};

// ---------- Staff ----------
const STAFF = [
  { id:"dr", name:"Dana Rivera",   role:"Case Worker",      initials:"DR" },
  { id:"mk", name:"Marcus Kelly",  role:"Case Worker",      initials:"MK" },
  { id:"ls", name:"Luz Santiago",  role:"Case Worker",      initials:"LS" },
  { id:"jb", name:"Joan Bartos",   role:"Program Manager",  initials:"JB" },
  { id:"tw", name:"Terrence Webb", role:"Data Admin",       initials:"TW" },
];
const CURRENT_USER_DEFAULT = STAFF[0];
var CURRENT_USER = CURRENT_USER_DEFAULT; // reassigned by the app when the active user switches

// ---------- Required documents by program ----------
const DOC_TYPES = {
  id:        "Photo ID (all adults)",
  income:    "Income proof — 30 days (pay stubs / award letters)",
  residency: "Proof of Lehigh Valley residency",
  ssn:       "Social Security cards (all members)",
  utility:   "Utility bill (most recent)",
  deed:      "Deed or landlord agreement",
  custody:   "Proof of custody / guardianship",
  hmis:      "HMIS release of information",
};
const PROGRAM_DOCS = {
  "cad-a": ["id","income","residency"],
  "cad-b": ["id","income","residency"],
  "homes": ["id","income","residency","ssn","deed"],
  "gnx":   ["id","income","residency","custody"],
  "hc":    ["id","income","residency"],
  "rtide": ["id","income","residency","ssn"],
  "shfb":  ["id","income","residency"],
  "sss":   ["id","income","residency","hmis"],
  "wx":    ["id","income","residency","utility","deed"],
};

// ---------- Clients (enrolled) ----------
// demo fields follow All Characteristics Report (Module 3 Sec C)
const CLIENTS = [
  { id:"C-2417", first:"Maribel", last:"Ortega", dob:"1989-03-14", age:37, sex:"Female",
    race:"Hispanic or Latino", address:"512 W Turner St, Allentown, PA 18102", county:"Lehigh",
    phone:"(610) 555-0142", hhType:"Single Parent Female", hhSize:3, housing:"Rent",
    income:24960, incomeSrc:"Employment and Non-Cash Benefits", work:"Employed Part-Time",
    edu:"High School Graduate / GED", insurance:"Medicaid", military:"Never Served", disability:false,
    programs:["cad-a","shfb"], caseworker:"dr", completeness:100, enrolled:"2025-10-12", fplYear:2025,
    flags:[], nextFollowUp:"2026-06-12" },
  { id:"C-2398", first:"James", last:"Holloway", dob:"1961-11-02", age:64, sex:"Male",
    race:"Black or African American", address:"77 E 4th St, Bethlehem, PA 18015", county:"Northampton",
    phone:"(610) 555-0177", hhType:"Single Person", hhSize:1, housing:"Rent",
    income:14820, incomeSrc:"Other Income Source Only", work:"Unemployed (Long-Term)",
    edu:"Grades 9-12 / Non-Graduate", insurance:"Medicare", military:"Veteran", disability:true,
    programs:["cad-b","wx"], caseworker:"mk", completeness:92, enrolled:"2025-11-03", fplYear:2025,
    flags:["FNPI follow-up due"], nextFollowUp:"2026-06-10" },
  { id:"C-2431", first:"Soe", last:"Mya", dob:"1996-07-22", age:29, sex:"Female",
    race:"Asian", address:"1310 Hanover Ave, Allentown, PA 18109", county:"Lehigh",
    phone:"(484) 555-0119", hhType:"Two Parent Household", hhSize:5, housing:"Rent",
    income:39400, incomeSrc:"Employment and Other Income Source", work:"Employed Full-Time",
    edu:"Grades 0-8", insurance:"Employment-Based", military:"Never Served", disability:false,
    programs:["cad-a","gnx"], caseworker:"ls", completeness:84, enrolled:"2026-01-21", fplYear:2025,
    flags:["Missing: education level (spouse)"], nextFollowUp:"2026-06-18" },
  { id:"C-2389", first:"Tasha", last:"Reid", dob:"1993-01-30", age:33, sex:"Female",
    race:"Black or African American", address:"Sixth Street Shelter, Allentown, PA 18101", county:"Lehigh",
    phone:"(610) 555-0163", hhType:"Single Parent Female", hhSize:2, housing:"Homeless",
    income:9100, incomeSrc:"Other Income Source and Non-Cash Benefits", work:"Unemployed (Short-Term)",
    edu:"High School Graduate / GED", insurance:"Medicaid", military:"Never Served", disability:false,
    programs:["sss","shfb"], caseworker:"dr", completeness:96, enrolled:"2026-02-08", fplYear:2025,
    flags:["Housing placement in progress"], nextFollowUp:"2026-06-11" },
  { id:"C-2402", first:"Walter", last:"Gergar", dob:"1948-05-09", age:78, sex:"Male",
    race:"White", address:"212 Delaware Ave, Bangor, PA 18013", county:"Northampton",
    phone:"(570) 555-0131", hhType:"Two Adults no children", hhSize:2, housing:"Own",
    income:21640, incomeSrc:"Other Income Source Only", work:"Retired",
    edu:"High School Graduate / GED", insurance:"Medicare", military:"Veteran", disability:true,
    programs:["wx"], caseworker:"mk", completeness:100, enrolled:"2024-11-18", fplYear:2024,
    flags:[], nextFollowUp:"2026-07-01" },
  { id:"C-2440", first:"Dariel", last:"Vásquez", dob:"2008-09-17", age:17, sex:"Male",
    race:"Hispanic or Latino", address:"839 Wyandotte St, Bethlehem, PA 18015", county:"Northampton",
    phone:"(484) 555-0188", hhType:"Single Parent Female", hhSize:4, housing:"Rent",
    income:31200, incomeSrc:"Employment and Non-Cash Benefits", work:"Unknown / Not Reported",
    edu:"Grades 9-12 / Non-Graduate", insurance:"State Children's Health Insurance Program", military:"Never Served", disability:false,
    programs:["gnx"], caseworker:"ls", completeness:88, enrolled:"2026-03-15", fplYear:2025,
    flags:["Attendance: 91% (Spring term)"], nextFollowUp:"2026-06-20" },
  { id:"C-2415", first:"Priya", last:"Raman", dob:"1985-12-05", age:40, sex:"Female",
    race:"Asian", address:"4520 Crackersport Rd, Allentown, PA 18104", county:"Lehigh",
    phone:"(610) 555-0150", hhType:"Two Parent Household", hhSize:4, housing:"Rent",
    income:36050, incomeSrc:"Employment Only", work:"Employed Full-Time",
    edu:"2 or 4 year College Graduate", insurance:"Employment-Based", military:"Never Served", disability:false,
    programs:["hc","rtide"], caseworker:"dr", completeness:100, enrolled:"2025-10-28", fplYear:2025,
    flags:["First-time homebuyer seminar: complete"], nextFollowUp:"2026-06-25" },
  { id:"C-2369", first:"Robert", last:"Csencsits", dob:"1972-02-19", age:54, sex:"Male",
    race:"White", address:"118 S Main St, Slatington, PA 18080", county:"Lehigh",
    phone:"(610) 555-0125", hhType:"Single Person", hhSize:1, housing:"Rent",
    income:17890, incomeSrc:"Employment Only", work:"Seasonal Farm Worker",
    edu:"Grades 9-12 / Non-Graduate", insurance:"Direct-Purchase", military:"Never Served", disability:false,
    programs:["cad-a"], caseworker:"mk", completeness:76, enrolled:"2026-04-02", fplYear:2025,
    flags:["Missing: health insurance source","Missing: education level"], nextFollowUp:"2026-06-09" },
  { id:"C-2422", first:"Aminata", last:"Diallo", dob:"1999-06-11", age:26, sex:"Female",
    race:"Black or African American", address:"926 E 5th St, Bethlehem, PA 18015", county:"Northampton",
    phone:"(484) 555-0171", hhType:"Single Person", hhSize:1, housing:"Rent",
    income:19560, incomeSrc:"Employment Only", work:"Employed Part-Time",
    edu:"12 grade + Some Post-Secondary", insurance:"Medicaid", military:"Never Served", disability:false,
    programs:["cad-b","hc"], caseworker:"ls", completeness:100, enrolled:"2026-01-09", fplYear:2025,
    flags:[], nextFollowUp:"2026-06-30" },
  { id:"C-2435", first:"Gene", last:"Kovach", dob:"1958-08-27", age:67, sex:"Male",
    race:"White", address:"23 Broadway, Bangor, PA 18013", county:"Northampton",
    phone:"(570) 555-0109", hhType:"Single Person", hhSize:1, housing:"Own",
    income:13975, incomeSrc:"Other Income Source and Non-Cash Benefits", work:"Retired",
    edu:"High School Graduate / GED", insurance:"Medicare", military:"Never Served", disability:true,
    programs:["shfb","wx"], caseworker:"dr", completeness:94, enrolled:"2025-01-08", fplYear:2024,
    flags:[], nextFollowUp:"2026-07-15" },
];

// ---------- Applicants (pre-enrollment eligibility pipeline) ----------
// stages: docs → review → decision  (then → enrolled, leaves queue)
const APPLICANTS = [
  { id:"A-1180", first:"Yolanda", last:"Cruz", dob:"1991-04-08", hhSize:4, income:28900,
    program:"sss", caseworker:"dr", stage:"review", applied:"2026-05-28", fplYear:2025, county:"Lehigh",
    docs:{ id:"verified", income:"verified", residency:"verified", hmis:"verified" },
    notes:"Family of 4, fleeing unsafe housing. All docs in — ready for PM review." },
  { id:"A-1183", first:"Samuel", last:"Adeyemi", dob:"1987-10-19", hhSize:1, income:16100,
    program:"cad-b", caseworker:"ls", stage:"docs", applied:"2026-06-02", fplYear:2025, county:"Northampton",
    docs:{ id:"verified", income:"missing", residency:"submitted" },
    notes:"Pay stubs requested 6/3. Texted reminder 6/6." },
  { id:"A-1185", first:"Kateryna", last:"Bondar", dob:"1994-02-23", hhSize:3, income:30150,
    program:"wx", caseworker:"mk", stage:"docs", applied:"2026-06-04", fplYear:2025, county:"Lehigh",
    docs:{ id:"verified", income:"verified", residency:"verified", utility:"submitted", deed:"missing" },
    notes:"Renter — landlord agreement form sent to property owner." },
  { id:"A-1178", first:"Devon", last:"Pierce", dob:"2009-01-12", hhSize:5, income:41300,
    program:"gnx", caseworker:"ls", stage:"review", applied:"2026-05-22", fplYear:2025, county:"Lehigh",
    docs:{ id:"verified", income:"verified", residency:"verified", custody:"verified" },
    notes:"15 y/o, referred by Building 21 counselor. Income 117% FPL — eligible." },
  { id:"A-1186", first:"Rosa", last:"Mejía", dob:"1979-07-30", hhSize:2, income:26880,
    program:"hc", caseworker:"dr", stage:"docs", applied:"2026-06-05", fplYear:2025, county:"Lehigh",
    docs:{ id:"submitted", income:"missing", residency:"missing" },
    notes:"Intake started at June 4 seminar. Self-service portal invite sent." },
  { id:"A-1174", first:"Hassan", last:"Farah", dob:"1983-12-03", hhSize:6, income:46210,
    program:"rtide", caseworker:"mk", stage:"decision", applied:"2026-05-12", fplYear:2025, county:"Northampton",
    docs:{ id:"verified", income:"verified", residency:"verified", ssn:"verified" },
    notes:"Food-truck micro-loan. 97% FPL. Credit review complete — recommend approve." },
  { id:"A-1187", first:"Crystal", last:"Yoder", dob:"1990-09-25", hhSize:3, income:52400,
    program:"cad-a", caseworker:"dr", stage:"decision", applied:"2026-05-18", fplYear:2025, county:"Lehigh",
    docs:{ id:"verified", income:"verified", residency:"verified" },
    notes:"Income 162% FPL — exceeds CSBG 125% ceiling. Recommend referral to United Way 211." },
];

// Seed supporting files + verification sign-offs for docs already submitted/verified, so the
// review modal shows a full audit trail. One bypass example: Hassan's SSN card was sighted
// in person (agency policy prohibits retaining copies), so it was verified without a file.
APPLICANTS.forEach(a => {
  a.files = {}; a.verifications = {}; a.bypass = {};
  Object.entries(a.docs).forEach(([k, st]) => {
    const bypassed = a.id === "A-1174" && k === "ssn";
    if ((st === "submitted" || st === "verified") && !bypassed) {
      a.files[k] = { name: (a.last + "-" + a.first[0] + "_" + k + ".pdf").toLowerCase().replace(/[^a-z0-9._-]/g, ""), by: a.caseworker, when: a.applied };
    }
    if (st === "verified") {
      a.verifications[k] = { by: a.caseworker, when: a.applied };
      if (bypassed) a.bypass[k] = { by: a.caseworker, when: a.applied, reason: "SSN card sighted in person at intake — agency policy prohibits retaining copies." };
    }
  });
});

const DOC_STATUS = { verified:"Verified", submitted:"Submitted — needs review", missing:"Missing" };

// ---------- Service log (recent entries) ----------
const SERVICE_LOG = [
  { id:1,  date:"2026-06-09", client:"C-2389", code:"SDA 1c", program:"sss",  staff:"dr", note:"Housing plan check-in; viewed 2 units on Linden St." },
  { id:2,  date:"2026-06-09", client:"C-2417", code:"SRV 5r", program:"shfb", staff:"dr", note:"Monthly distribution box — family of 3." },
  { id:3,  date:"2026-06-08", client:"C-2398", code:"SRV 4e", program:"cad-b",staff:"mk", note:"UGI arrears — $214 paid via crisis fund." },
  { id:4,  date:"2026-06-08", client:"C-2440", code:"SRV 2h", program:"gnx",  staff:"ls", note:"After-school session — robotics module, present." },
  { id:5,  date:"2026-06-07", client:"C-2415", code:"SRV 3a", program:"hc",   staff:"dr", note:"Budget review + credit pull. Score up 22 pts since Jan." },
  { id:6,  date:"2026-06-06", client:"C-2402", code:"SRV 4g", program:"wx",   staff:"mk", note:"Final inspection passed. Blower-door: 18% leakage reduction." },
  { id:7,  date:"2026-06-06", client:"C-2422", code:"SDA 1b", program:"cad-b",staff:"ls", note:"Referred to LANTA shared-ride for work commute." },
  { id:8,  date:"2026-06-05", client:"C-2369", code:"SRV 1c", program:"cad-a",staff:"mk", note:"Work boots + gloves voucher for orchard season." },
  { id:9,  date:"2026-06-05", client:"C-2435", code:"SRV 5r", program:"shfb", staff:"dr", note:"Senior box + fresh produce." },
  { id:10, date:"2026-06-04", client:"C-2431", code:"SRV 2q", program:"cad-a",staff:"ls", note:"Parenting workshop — session 3 of 6." },
];

// ---------- FNPI outcomes (FY-to-date, agency-wide) ----------
const FNPI = [
  { code:"FNPI 1b", label:"Unemployed adults who increased employment skills", served:142, target:120, actual:96 },
  { code:"FNPI 1d", label:"Adults who obtained employment", served:142, target:75, actual:61 },
  { code:"FNPI 3a", label:"Increased financial capability via training", served:210, target:160, actual:148 },
  { code:"FNPI 3d", label:"Increased public benefits for self-sufficiency", served:388, target:300, actual:296 },
  { code:"FNPI 4a", label:"Homeless individuals who obtained safe temporary shelter", served:301, target:280, actual:262 },
  { code:"FNPI 4b", label:"Obtained / maintained safe affordable housing", served:264, target:190, actual:151 },
  { code:"FNPI 4c", label:"Individuals who avoided eviction", served:188, target:150, actual:139 },
  { code:"FNPI 4f", label:"Households improved energy efficiency", served:96, target:90, actual:71 },
  { code:"FNPI 4g", label:"Avoided utility shut-off / restored service", served:412, target:350, actual:344 },
  { code:"FNPI 5j", label:"Improved food security via healthy food access", served:9120, target:8000, actual:7634 },
  { code:"FNPI 2b", label:"Youth improved skills via education programs", served:612, target:540, actual:431 },
];

// ---------- Integrations ----------
const INTEGRATIONS = [
  { id:"rxoffice", name:"RX Office", kind:"API", status:"connected", last:"Today 6:00 AM", records:"4,212 clients", detail:"Housing counseling CMS — nightly two-way sync" },
  { id:"hancock", name:"Hancock", kind:"API", status:"connected", last:"Today 6:00 AM", records:"1,876 energy cases", detail:"Weatherization / LIHEAP case data" },
  { id:"hmis", name:"HMIS (PA-503)", kind:"API", status:"attention", last:"Jun 6, 11:40 PM", records:"912 shelter records", detail:"Eastern PA CoC — 14 records failed de-dup, needs review" },
  { id:"cap60", name:"CAP60", kind:"Import", status:"connected", last:"Jun 1", records:"FY25 archive", detail:"Legacy CSBG system — historical import complete" },
  { id:"sheets", name:"Spreadsheet import", kind:"CSV / XLSX", status:"ready", last:"Jun 8", records:"3 templates", detail:"Pantry aggregates, seminar sign-ins, volunteer hours" },
];

// ---------- Aggregates for the Annual Report preview ----------
// (computed from CLIENTS where possible; some pre-tallied agency-wide numbers)
const AGENCY = {
  individualsServed: 18244, householdsServed: 7491,
  newThisFY: 3120, pendingApplications: APPLICANTS.length,
  srvByDomain: [
    { domain:"hn",  count:11240 }, { domain:"hou", count:3180 },
    { domain:"sda", count:2890 },  { domain:"inc", count:1430 },
    { domain:"edu", count:1210 },  { domain:"emp", count:640 },
    { domain:"tra", count:410 },   { domain:"civ", count:380 },
  ],
};

Object.assign(window, {
  FY, FPL, FPL_BANDS, fplBand, PROGRAMS, programById, DOMAINS, SERVICES, serviceByCode,
  STAFF, CURRENT_USER, DOC_TYPES, PROGRAM_DOCS, CLIENTS, APPLICANTS, DOC_STATUS,
  SERVICE_LOG, FNPI, INTEGRATIONS, AGENCY,
});
