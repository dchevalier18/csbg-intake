/* ============================================================
   Spreadsheet import templates (Data & integrations).
   The three recurring CSV/XLSX templates named on the seeded
   "Spreadsheet import" source: pantry aggregates, seminar
   sign-ins, volunteer hours. Plain data — safe to import from
   client components; the server action re-validates everything.
   ============================================================ */

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  hint: string;          // shown under the mapping select
  aliases: string[];     // header spellings auto-matched on upload
}

export interface ImportTemplate {
  id: "pantry" | "seminars" | "volunteers" | "clients";
  name: string;
  blurb: string;         // template-picker card copy
  target: string;        // where the rows land, for the result message
  fields: ImportField[];
}

export const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    id: "clients",
    name: "Client migration",
    blurb: "Bring enrolled clients over from a legacy system (CAP60, empowOR, spreadsheets) — one row per person.",
    target: "the client directory",
    fields: [
      { key: "first", label: "First name", required: true, hint: "Given name",
        aliases: ["first", "first name", "fname", "given name"] },
      { key: "last", label: "Last name", required: true, hint: "Family name",
        aliases: ["last", "last name", "lname", "surname", "family name"] },
      { key: "dob", label: "Date of birth", required: true, hint: "2001-05-14 or 5/14/2001",
        aliases: ["dob", "date of birth", "birth date", "birthdate", "born"] },
      { key: "program", label: "Program", required: true, hint: "Program name or id to enroll into",
        aliases: ["program", "program id", "program name", "enrolled program"] },
      { key: "income", label: "Annual income ($)", required: false, hint: "Gross household income",
        aliases: ["income", "annual income", "household income", "gross income", "yearly income"] },
      { key: "hhSize", label: "Household size", required: false, hint: "Defaults to 1",
        aliases: ["hh size", "hhsize", "household size", "family size", "size"] },
      { key: "phone", label: "Phone", required: false, hint: "",
        aliases: ["phone", "phone number", "telephone", "cell", "mobile"] },
      { key: "address", label: "Address", required: false, hint: "",
        aliases: ["address", "street", "street address", "address 1"] },
      { key: "enrolled", label: "Enrollment date", required: false, hint: "Defaults to today",
        aliases: ["enrolled", "enrollment date", "enroll date", "intake date", "start date"] },
      { key: "sex", label: "Sex (C1)", required: false, hint: "Instrument answer or close variant",
        aliases: ["sex", "gender"] },
      { key: "race", label: "Race/ethnicity (C6)", required: false, hint: "Instrument answer or close variant",
        aliases: ["race", "ethnicity", "race ethnicity", "race/ethnicity"] },
      { key: "housing", label: "Housing (D11)", required: false, hint: "Own / Rent / Homeless / Other",
        aliases: ["housing", "housing status", "housing situation", "tenure"] },
      { key: "hhType", label: "Household type (D9)", required: false, hint: "Instrument answer or close variant",
        aliases: ["hh type", "hhtype", "household type", "family type"] },
    ],
  },
  {
    id: "pantry",
    name: "Pantry aggregates",
    blurb: "Monthly member-agency totals — households served and pounds distributed.",
    target: "the pantry network's monthly reports",
    fields: [
      { key: "agency", label: "Member agency", required: true, hint: "Agency name or ID (e.g. P-014)",
        aliases: ["agency", "agency name", "agency id", "pantry", "member agency", "site"] },
      { key: "month", label: "Report month", required: true, hint: "2026-05, 5/2026, or May 2026",
        aliases: ["month", "report month", "period", "reporting month"] },
      { key: "households", label: "Households served", required: true, hint: "Whole number",
        aliases: ["households", "households served", "hh", "families", "families served"] },
      { key: "lbs", label: "Pounds distributed", required: true, hint: "Whole number",
        aliases: ["lbs", "pounds", "pounds distributed", "lbs distributed", "weight", "weight lbs"] },
    ],
  },
  {
    id: "seminars",
    name: "Seminar sign-ins",
    blurb: "Workshop sign-in sheets — attendees matched to client records by exact name.",
    target: "seminar attendee lists",
    fields: [
      { key: "seminar", label: "Seminar", required: true, hint: "Seminar ID (SEM-18) or exact title",
        aliases: ["seminar", "seminar id", "workshop", "session", "event", "title", "seminar title"] },
      { key: "name", label: "Attendee name", required: true, hint: "First and last name",
        aliases: ["name", "attendee", "attendee name", "participant", "participant name", "full name"] },
    ],
  },
  {
    id: "volunteers",
    name: "Volunteer hours",
    blurb: "Shift logs — hours roll into the Module 2 totals with the low-income split.",
    target: "volunteer hour totals",
    fields: [
      { key: "name", label: "Volunteer name", required: true, hint: "Matches existing volunteers by name",
        aliases: ["name", "volunteer", "volunteer name", "full name"] },
      { key: "hours", label: "Hours", required: true, hint: "Hours donated (whole number)",
        aliases: ["hours", "hours donated", "hrs", "time", "shift hours"] },
      { key: "date", label: "Shift date", required: false, hint: "2026-06-08 or 6/8/2026",
        aliases: ["date", "shift date", "last shift", "day"] },
      { key: "role", label: "Role", required: false, hint: "Used for new volunteers",
        aliases: ["role", "position", "assignment", "duty"] },
      { key: "lowIncome", label: "Low-income", required: false, hint: "Yes/No — drives the B.1a.1 split",
        aliases: ["low income", "low-income", "li", "income eligible", "low income status"] },
      { key: "program", label: "Program", required: false, hint: "Required for NEW volunteers (name or id)",
        aliases: ["program", "program id", "program name", "site", "location"] },
    ],
  },
];

export const importTemplate = (id: string): ImportTemplate | undefined =>
  IMPORT_TEMPLATES.find((t) => t.id === id);

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
