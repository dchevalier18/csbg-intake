/* ============================================================
   Spreadsheet import templates (Data & integrations).
   The recurring CSV/XLSX templates named on the seeded
   "Spreadsheet import" source: client migration, pantry member
   agencies, pantry aggregates, seminar sign-ins, volunteer
   hours. Plain data — safe to import from client components;
   the server action re-validates everything.
   ============================================================ */

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  hint: string;          // shown under the mapping select
  aliases: string[];     // header spellings auto-matched on upload
  example: string;       // downloadable-template example-row value
  /* When a field has no matching column, the client-migration import lets you
     set one fixed value for the whole file. `fixed` picks the widget:
     "program" = program dropdown, "year" = FPL-schedule-year dropdown,
     "text" (default) = free text. Only surfaced for the clients template. */
  fixed?: "text" | "program" | "year";
}

export interface ImportTemplate {
  id: "pantry" | "pantry-agencies" | "seminars" | "volunteers" | "clients";
  name: string;
  blurb: string;         // template-picker card copy
  target: string;        // where the rows land, for the result message
  fields: ImportField[];
}

/* The example row in each downloadable template is engineered to be SKIPPED
   if staff forget to delete it: the field the importer matches against
   existing data says "DELETE THIS EXAMPLE ROW" (which never matches), and
   the roster template that CREATES rows leaves its required name blank. */
const SENTINEL = "DELETE THIS EXAMPLE ROW";

export const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    id: "clients",
    name: "Client migration",
    blurb: "Bring enrolled clients over from a legacy system (CAP60, empowOR, spreadsheets) — one row per person.",
    target: "the client directory",
    fields: [
      { key: "first", label: "First name", required: true, hint: "Given name",
        aliases: ["first", "first name", "fname", "given name"], example: "Jordan" },
      { key: "last", label: "Last name", required: true, hint: "Family name",
        aliases: ["last", "last name", "lname", "surname", "family name"], example: "Wells" },
      { key: "dob", label: "Date of birth", required: true, hint: "2001-05-14 or 5/14/2001",
        aliases: ["dob", "date of birth", "birth date", "birthdate", "born"], example: "2001-05-14" },
      { key: "program", label: "Program", required: true, hint: "Program name or id to enroll into",
        aliases: ["program", "program id", "program name", "enrolled program"], example: SENTINEL, fixed: "program" },
      { key: "income", label: "Annual income ($)", required: false, hint: "Gross household income",
        aliases: ["income", "annual income", "household income", "gross income", "yearly income"], example: "18500" },
      { key: "hhSize", label: "Household size", required: false, hint: "Defaults to 1",
        aliases: ["hh size", "hhsize", "household size", "family size", "size"], example: "3" },
      { key: "phone", label: "Phone", required: false, hint: "",
        aliases: ["phone", "phone number", "telephone", "cell", "mobile"], example: "(610) 555-0100" },
      { key: "address", label: "Address", required: false, hint: "",
        aliases: ["address", "street", "street address", "address 1"], example: "123 Main St, Allentown, PA 18102" },
      { key: "enrolled", label: "Enrollment date", required: false, hint: "Defaults to today",
        aliases: ["enrolled", "enrollment date", "enroll date", "intake date", "start date"], example: "2026-01-15" },
      { key: "sex", label: "Sex (C1)", required: false, hint: "Instrument answer or close variant",
        aliases: ["sex", "gender"], example: "Female" },
      { key: "race", label: "Race/ethnicity (C6)", required: false, hint: "Instrument answer or close variant",
        aliases: ["race", "ethnicity", "race ethnicity", "race/ethnicity"], example: "Hispanic or Latino" },
      { key: "housing", label: "Housing (D11)", required: false, hint: "Own / Rent / Homeless / Other",
        aliases: ["housing", "housing status", "housing situation", "tenure"], example: "Rent" },
      { key: "hhType", label: "Household type (D9)", required: false, hint: "Instrument answer or close variant",
        aliases: ["hh type", "hhtype", "household type", "family type"], example: "Single Parent Female" },
      { key: "fplYear", label: "Poverty-guideline year", required: false,
        hint: "Year income was assessed — must match a configured FPL schedule. Blank uses the active schedule.",
        aliases: ["fpl year", "poverty year", "guideline year", "poverty guideline year", "assessment year", "fpl"],
        example: "2025", fixed: "year" },
    ],
  },
  {
    id: "pantry-agencies",
    name: "Pantry member agencies",
    blurb: "Member-agency roster — build or refresh the pantry network from Primarius 2.0's agency export or any agency list.",
    target: "the pantry network roster",
    fields: [
      { key: "id", label: "Agency ID", required: false, hint: "Existing ID (P-014) or Primarius agency ref — matched before name",
        aliases: ["id", "agency id", "agency ref", "agency #", "agency number", "acct #", "account number", "account #", "ref"], example: "P-001" },
      // blank on purpose: a row without a name is skipped, so the example can't create an agency
      { key: "name", label: "Agency name", required: true, hint: "Matched against existing agencies to update instead of duplicate",
        aliases: ["name", "agency", "agency name", "account name", "organization", "member agency", "site"], example: "" },
      { key: "town", label: "Town", required: false, hint: "",
        aliases: ["town", "city", "municipality"], example: "Allentown" },
      { key: "county", label: "County", required: false, hint: "",
        aliases: ["county", "county name"], example: "Lehigh" },
      { key: "contact", label: "Contact", required: false, hint: "",
        aliases: ["contact", "contact name", "primary contact", "coordinator", "director"], example: "M. Rivera" },
      { key: "phone", label: "Phone", required: false, hint: "",
        aliases: ["phone", "phone number", "telephone", "contact phone"], example: "(610) 555-0100" },
    ],
  },
  {
    id: "pantry",
    name: "Pantry aggregates",
    blurb: "Monthly member-agency totals — households served and pounds distributed.",
    target: "the pantry network's monthly reports",
    fields: [
      { key: "agency", label: "Member agency", required: true, hint: "Agency name or ID (e.g. P-014)",
        aliases: ["agency", "agency name", "agency id", "pantry", "member agency", "site"], example: SENTINEL },
      { key: "month", label: "Report month", required: true, hint: "2026-05, 5/2026, or May 2026",
        aliases: ["month", "report month", "period", "reporting month"], example: "2026-05" },
      { key: "households", label: "Households served", required: true, hint: "Whole number",
        aliases: ["households", "households served", "hh", "families", "families served"], example: "240" },
      { key: "lbs", label: "Pounds distributed", required: true, hint: "Whole number",
        aliases: ["lbs", "pounds", "pounds distributed", "lbs distributed", "weight", "weight lbs"], example: "9800" },
    ],
  },
  {
    id: "seminars",
    name: "Seminar sign-ins",
    blurb: "Workshop sign-in sheets — attendees matched to client records by exact name.",
    target: "seminar attendee lists",
    fields: [
      { key: "seminar", label: "Seminar", required: true, hint: "Seminar ID (SEM-18) or exact title",
        aliases: ["seminar", "seminar id", "workshop", "session", "event", "title", "seminar title"], example: SENTINEL },
      { key: "name", label: "Attendee name", required: true, hint: "First and last name",
        aliases: ["name", "attendee", "attendee name", "participant", "participant name", "full name"], example: "Jordan Wells" },
    ],
  },
  {
    id: "volunteers",
    name: "Volunteer hours",
    blurb: "Shift logs — hours roll into the Module 2 totals with the low-income split.",
    target: "volunteer hour totals",
    fields: [
      { key: "name", label: "Volunteer name", required: true, hint: "Matches existing volunteers by name",
        aliases: ["name", "volunteer", "volunteer name", "full name"], example: "Jordan Wells" },
      { key: "hours", label: "Hours", required: true, hint: "Hours donated (whole number)",
        aliases: ["hours", "hours donated", "hrs", "time", "shift hours"], example: "4" },
      { key: "date", label: "Shift date", required: false, hint: "2026-06-08 or 6/8/2026",
        aliases: ["date", "shift date", "last shift", "day"], example: "2026-06-08" },
      { key: "role", label: "Role", required: false, hint: "Used for new volunteers",
        aliases: ["role", "position", "assignment", "duty"], example: "Warehouse sort" },
      { key: "lowIncome", label: "Low-income", required: false, hint: "Yes/No — drives the B.1a.1 split",
        aliases: ["low income", "low-income", "li", "income eligible", "low income status"], example: "Yes" },
      // sentinel: a NEW volunteer whose program never matches is skipped with a reason
      { key: "program", label: "Program", required: false, hint: "Required for NEW volunteers (name or id)",
        aliases: ["program", "program id", "program name", "site", "location"], example: SENTINEL },
    ],
  },
];

export const importTemplate = (id: string): ImportTemplate | undefined =>
  IMPORT_TEMPLATES.find((t) => t.id === id);

const csvCell = (v: string): string =>
  /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;

/** Downloadable blank template: exact header row (auto-maps on upload) plus
    one example row that the importer is guaranteed to skip if left in. */
export function templateCsv(tpl: ImportTemplate): string {
  const header = tpl.fields.map((f) => csvCell(f.label)).join(",");
  const example = tpl.fields.map((f) => csvCell(f.example)).join(",");
  return header + "\r\n" + example + "\r\n";
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Best-guess column index per template field from the uploaded header row (-1 = unmapped). */
export function autoMapColumns(tpl: ImportTemplate, headers: string[]): Record<string, number> {
  const normalized = headers.map(norm);
  const mapping: Record<string, number> = {};
  const taken = new Set<number>();
  for (const f of tpl.fields) {
    const candidates = [norm(f.label), norm(f.key), ...f.aliases.map(norm)];
    let idx = -1;
    for (const c of candidates) {
      const exact = normalized.findIndex((h, i) => h === c && !taken.has(i));
      if (exact !== -1) { idx = exact; break; }
    }
    if (idx === -1) {
      // fall back to a contains-match ("Total pounds distributed" → lbs)
      idx = normalized.findIndex((h, i) =>
        !taken.has(i) && h.length > 0 && candidates.some((c) => c.length > 2 && h.includes(c)));
    }
    mapping[f.key] = idx;
    if (idx !== -1) taken.add(idx);
  }
  return mapping;
}
