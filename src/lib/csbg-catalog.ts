// CSBG Annual Report 3.0 taxonomy (OMB 0970-0492) — extracted from the official form.
//
// Source: Module 3 (Individual and Family Level) of the CSBG Annual Report 3.0:
//   Section A — Individual and Family Services (SDA / SRV codes)
//   Section B — Individual and Family National Performance Indicators (FNPI codes)
//   Section C — All Characteristics Report (C1–C8 individual, D9–D13 household)
// Note: the 3.0 form has no FNPI 7 series and no D14 category; the domain for
// SRV 7 is "Transportation" in the 3.0 form (id kept as "tra" by contract).

export interface ServiceDomain { id: string; code: string; name: string }
export interface ServiceDef { code: string; domain: string; label: string }
export interface FnpiDef { code: string; label: string; domain: string }
export interface CharacteristicCategory {
  code: string;                       // e.g. "C6", "D12"
  scope: "individual" | "household";
  label: string;                      // e.g. "Race & Ethnicity"
  options: string[];                  // exact answer values from the form (omit "Unknown/Not Reported" — the system adds it implicitly)
}

export const DOMAINS: ServiceDomain[] = [
  { id: "sda", code: "SDA",   name: "Service Delivery and Access" },
  { id: "emp", code: "SRV 1", name: "Employment" },
  { id: "edu", code: "SRV 2", name: "Education and Youth Development" },
  { id: "inc", code: "SRV 3", name: "Income and Asset Building" },
  { id: "hou", code: "SRV 4", name: "Housing" },
  { id: "hn",  code: "SRV 5", name: "Health and Nutrition" },
  { id: "civ", code: "SRV 6", name: "Civic Engagement and Community Involvement" },
  { id: "tra", code: "SRV 7", name: "Transportation" },
];

export const SERVICES: ServiceDef[] = [
  // Service Delivery and Access
  { code: "SDA 1a", domain: "sda", label: "Eligibility determinations" },
  { code: "SDA 1b", domain: "sda", label: "Referrals" },
  { code: "SDA 1c", domain: "sda", label: "Case management services" },

  // Employment Services (SRV 1)
  { code: "SRV 1a", domain: "emp", label: "Skills training and job readiness opportunities for youth (e.g., vocational training, apprenticeship, self-employment)" },
  { code: "SRV 1b", domain: "emp", label: "Skills training and job readiness opportunities for adults (e.g., vocational training, apprenticeship, self-employment)" },
  { code: "SRV 1c", domain: "emp", label: "Employment supplies for employment readiness or sustainment (e.g., uniforms, work boots, equipment)" },
  { code: "SRV 1d", domain: "emp", label: "Employment retention and growth services (e.g., referrals, employer interaction, career pathways)" },
  { code: "SRV 1e", domain: "emp", label: "Other employment services" },

  // Education and Youth Development Services (SRV 2)
  { code: "SRV 2a", domain: "edu", label: "Head Start services (ages 0-5)" },
  { code: "SRV 2b", domain: "edu", label: "Childcare subsidies or payments" },
  { code: "SRV 2c", domain: "edu", label: "Early childhood education (0-5), outside of Early Head Start and Head Start" },
  { code: "SRV 2d", domain: "edu", label: "K-12 education support services (e.g., English, literacy)" },
  { code: "SRV 2e", domain: "edu", label: "Young adult literacy classes" },
  { code: "SRV 2f", domain: "edu", label: "College or post-secondary readiness support (e.g., applications, scholarships, textbooks, computers)" },
  { code: "SRV 2g", domain: "edu", label: "School supplies and equipment" },
  { code: "SRV 2h", domain: "edu", label: "Before and after school activities for youth" },
  { code: "SRV 2i", domain: "edu", label: "Summer youth programs (e.g., recreational and educational)" },
  { code: "SRV 2j", domain: "edu", label: "Life skills and coaching services for youth" },
  { code: "SRV 2k", domain: "edu", label: "Educational financial assistance for post-secondary education (e.g., scholarships, stipends, grants)" },
  { code: "SRV 2l", domain: "edu", label: "Adult literacy classes" },
  { code: "SRV 2m", domain: "edu", label: "English Language classes (e.g., English for Speakers of Other Languages)" },
  { code: "SRV 2n", domain: "edu", label: "High school equivalency classes" },
  { code: "SRV 2o", domain: "edu", label: "Applied technology classes" },
  { code: "SRV 2p", domain: "edu", label: "Life skills and coaching services for adults" },
  { code: "SRV 2q", domain: "edu", label: "Parenting supports (e.g., parent coaching, skills)" },
  { code: "SRV 2r", domain: "edu", label: "Adult basic education classes" },
  { code: "SRV 2s", domain: "edu", label: "Home visiting program participation (households)" },
  { code: "SRV 2t", domain: "edu", label: "Other education, childcare, and youth development services" },

  // Income and Asset Building Services (SRV 3)
  { code: "SRV 3a", domain: "inc", label: "Training and counseling for income management and asset building (e.g., VITA, tax preparation, credit repair, financial literacy, budgeting, homebuying, foreclosure avoidance)" },
  { code: "SRV 3b", domain: "inc", label: "Business or self-employment services (e.g., micro-loans, business development loans, entrepreneurial support)" },
  { code: "SRV 3c", domain: "inc", label: "Benefit coordination services (e.g., child support, health insurance, SSI, Veterans, TANF, SNAP)" },
  { code: "SRV 3d", domain: "inc", label: "Other income and asset building services" },

  // Housing Services (SRV 4)
  { code: "SRV 4a", domain: "hou", label: "Rental payment assistance (e.g., emergency rental payments and deposits)" },
  { code: "SRV 4b", domain: "hou", label: "Housing payment assistance (e.g., down payments and emergency mortgage payments)" },
  { code: "SRV 4c", domain: "hou", label: "Rapid re-housing and housing placement services (e.g., temporary, transitional, and permanent housing placements)" },
  { code: "SRV 4d", domain: "hou", label: "Eviction prevention services (e.g., housing counseling, eviction counseling, landlord or tenant mediations and rights)" },
  { code: "SRV 4e", domain: "hou", label: "Utility payment assistance (including deposits, arrears, and assistance)" },
  { code: "SRV 4f", domain: "hou", label: "Housing maintenance and improvement services (e.g., structural, accessibility improvements, emergency home repairs, water safety, healthy home)" },
  { code: "SRV 4g", domain: "hou", label: "Weatherization or energy efficiency services" },
  { code: "SRV 4h", domain: "hou", label: "Other housing services" },

  // Health and Nutrition Services (SRV 5)
  { code: "SRV 5a", domain: "hn", label: "Immunizations" },
  { code: "SRV 5b", domain: "hn", label: "Health screenings (e.g., physicals, chronic health screenings)" },
  { code: "SRV 5c", domain: "hn", label: "Developmental delay screening" },
  { code: "SRV 5d", domain: "hn", label: "Healthcare payment assistance (e.g., prescription payments, doctor visit payments)" },
  { code: "SRV 5e", domain: "hn", label: "Health insurance options counseling" },
  { code: "SRV 5f", domain: "hn", label: "Reproductive health services (e.g., family planning, contraceptives, STI or HIV prevention)" },
  { code: "SRV 5g", domain: "hn", label: "Maternal and child health services (e.g., breastfeeding support, safe sleeping, postpartum support)" },
  { code: "SRV 5h", domain: "hn", label: "General wellness services (e.g., medication management, mindfulness, exercise, fitness)" },
  { code: "SRV 5i", domain: "hn", label: "Home visits for older adults and individuals with disabilities (e.g., nursing, chores, personal care services)" },
  { code: "SRV 5j", domain: "hn", label: "Elder day center or senior center participation" },
  { code: "SRV 5k", domain: "hn", label: "Substance use or misuse services (e.g., intake, screening, counseling, support groups, hotline or crisis response)" },
  { code: "SRV 5l", domain: "hn", label: "Mental health services (e.g., intake, screening, counseling, support group, hotline or crisis response)" },
  { code: "SRV 5m", domain: "hn", label: "Domestic violence prevention and support services (e.g., support groups, hotline or crisis response)" },
  { code: "SRV 5n", domain: "hn", label: "Dental services for adults (e.g., screenings, exams, procedures)" },
  { code: "SRV 5o", domain: "hn", label: "Dental services for children (e.g., screenings, exams, procedures)" },
  { code: "SRV 5p", domain: "hn", label: "Food or nutrition skills classes (cooking, nutrition)" },
  { code: "SRV 5q", domain: "hn", label: "Prepared meals provided (e.g., congregate nutrition site, Meals on Wheels, prepared food delivery or pickup program)" },
  { code: "SRV 5r", domain: "hn", label: "Food distribution packages provided (bags, boxes, food share, groceries)" },
  { code: "SRV 5s", domain: "hn", label: "Community gardening activities" },
  { code: "SRV 5t", domain: "hn", label: "Hygiene kits or supplies provided (e.g., toothpaste, soap, deodorant, menstrual products)" },
  { code: "SRV 5u", domain: "hn", label: "Diapers or diapering supplies provided (e.g., diapers, wipes)" },
  { code: "SRV 5v", domain: "hn", label: "Hygiene utilization services (e.g., showers, toilets, sinks, laundry facilities)" },
  { code: "SRV 5w", domain: "hn", label: "Clothing assistance" },
  { code: "SRV 5x", domain: "hn", label: "Other health and nutrition services" },

  // Civic Engagement and Community Involvement Services (SRV 6)
  { code: "SRV 6a", domain: "civ", label: "Voter education and access services" },
  { code: "SRV 6b", domain: "civ", label: "Participation in a tri-partite board" },
  { code: "SRV 6c", domain: "civ", label: "Engagement in volunteer opportunities" },
  { code: "SRV 6d", domain: "civ", label: "Other civic engagement and community involvement services" },

  // Transportation Services (SRV 7)
  { code: "SRV 7a", domain: "tra", label: "Public transportation vouchers or passes" },
  { code: "SRV 7b", domain: "tra", label: "Gas cards" },
  { code: "SRV 7c", domain: "tra", label: "Non-medical transportation rides" },
  { code: "SRV 7d", domain: "tra", label: "Medical transportation rides" },
  { code: "SRV 7e", domain: "tra", label: "Rideshare or taxi vouchers" },
  { code: "SRV 7f", domain: "tra", label: "Transportation repair services (includes both automotive and non-automotive transportation)" },
  { code: "SRV 7g", domain: "tra", label: "Automotive support (e.g., insurance premiums, car payment assistance)" },
  { code: "SRV 7h", domain: "tra", label: "Other transportation services" },
];

export const FNPIS: FnpiDef[] = [
  // Employment (FNPI 1)
  { code: "FNPI 1a", domain: "emp", label: "Unemployed youth who increased skills to obtain employment" },
  { code: "FNPI 1b", domain: "emp", label: "Unemployed adults who increased skills to obtain employment" },
  { code: "FNPI 1c", domain: "emp", label: "Youth who obtained employment" },
  { code: "FNPI 1d", domain: "emp", label: "Adults who obtained employment" },
  { code: "FNPI 1e", domain: "emp", label: "Employed individuals who increased wage or salary income from employment" },
  { code: "FNPI 1f", domain: "emp", label: "Other employment outcome" },

  // Education and Youth Development (FNPI 2)
  { code: "FNPI 2a", domain: "edu", label: "Children (0-5) who showed developmental progress, including school readiness, after early childhood education or childcare services" },
  { code: "FNPI 2b", domain: "edu", label: "Youth who improved skills or competencies through education and skills development programs" },
  { code: "FNPI 2c", domain: "edu", label: "Adults who improved their basic education skills" },
  { code: "FNPI 2d", domain: "edu", label: "Individuals who increased their education by obtaining a high school diploma or an equivalency certificate or diploma" },
  { code: "FNPI 2e", domain: "edu", label: "Individuals who increased their education by obtaining a recognized credential or certificate that improved educational or vocational skills" },
  { code: "FNPI 2f", domain: "edu", label: "Individuals who increased their education by obtaining a post-secondary degree (e.g., associates, bachelors)" },
  { code: "FNPI 2g", domain: "edu", label: "Other education outcome" },

  // Income and Asset Building (FNPI 3)
  { code: "FNPI 3a", domain: "inc", label: "Individuals who increased their financial capability, knowledge, or skills as a result of income and asset building training" },
  { code: "FNPI 3b", domain: "inc", label: "Individuals who increased one or more assets (e.g., savings account, IDA, home purchase, reduced debt)" },
  { code: "FNPI 3c", domain: "inc", label: "Individuals who started a business" },
  { code: "FNPI 3d", domain: "inc", label: "Eligible individuals with increased public benefits to assist with economic self-sufficiency (e.g., child support, health insurance, SSI, Veterans, TANF, SNAP, WIC)" },
  { code: "FNPI 3e", domain: "inc", label: "Other income and asset building outcome" },

  // Housing (FNPI 4)
  { code: "FNPI 4a", domain: "hou", label: "Individuals experiencing homelessness who obtained safe temporary shelter" },
  { code: "FNPI 4b", domain: "hou", label: "Individuals who obtained and/or maintained safe and affordable housing" },
  { code: "FNPI 4c", domain: "hou", label: "Individuals who avoided eviction" },
  { code: "FNPI 4d", domain: "hou", label: "Individuals who avoided foreclosure" },
  { code: "FNPI 4e", domain: "hou", label: "Households who improved home health and safety through home improvements (e.g., water safety, lead reduction or elimination, radon abatement, carbon monoxide, fire hazards, or electrical issues)" },
  { code: "FNPI 4f", domain: "hou", label: "Households who improved energy efficiency (e.g., weatherization, energy efficiency enhancements)" },
  { code: "FNPI 4g", domain: "hou", label: "Households who avoided utility shut-off, had utility service restored, or had reduced utility costs" },
  { code: "FNPI 4h", domain: "hou", label: "Other housing outcome" },

  // Health and Nutrition (FNPI 5)
  { code: "FNPI 5a", domain: "hn", label: "Individuals who improved their health and well-being through preventative measures" },
  { code: "FNPI 5b", domain: "hn", label: "Individuals with increased access to health coverage" },
  { code: "FNPI 5c", domain: "hn", label: "Individuals whose health issue was treated by receiving health services" },
  { code: "FNPI 5d", domain: "hn", label: "Individuals who improved their reproductive health through access to reproductive wellness services" },
  { code: "FNPI 5e", domain: "hn", label: "Individuals who improved wellness through wellness services (e.g., exercise, meditation, stress reduction, healthy aging)" },
  { code: "FNPI 5f", domain: "hn", label: "Older adults who maintained an independent living situation through increased access to home visiting services" },
  { code: "FNPI 5g", domain: "hn", label: "Individuals who improved their mental health, behavioral health, or well-being" },
  { code: "FNPI 5h", domain: "hn", label: "Adults who improved their oral health through participation in oral health services" },
  { code: "FNPI 5i", domain: "hn", label: "Children who improved their oral health through participation in oral health services" },
  { code: "FNPI 5j", domain: "hn", label: "Individuals who improved food security through increased access to healthy food options" },
  { code: "FNPI 5k", domain: "hn", label: "Other health and nutrition outcome" },

  // Civic Engagement and Community Involvement (FNPI 6)
  { code: "FNPI 6a", domain: "civ", label: "Individuals with low incomes who increased skills, knowledge, and abilities to help improve conditions in their community" },
  { code: "FNPI 6b", domain: "civ", label: "Other civic engagement and community involvement outcome" },
];

export const CHARACTERISTICS: CharacteristicCategory[] = [
  // INDIVIDUAL LEVEL CHARACTERISTICS
  {
    code: "C1",
    scope: "individual",
    label: "Sex",
    options: ["Male", "Female"],
  },
  {
    code: "C2",
    scope: "individual",
    label: "Age",
    options: ["0-4", "5-17", "18-24", "25-34", "35-44", "45-64", "65-84", "85 and older"],
  },
  {
    code: "C3",
    scope: "individual",
    label: "Education levels", // form tallies separately for ages 5-24 and ages 25+
    options: [
      "Grades 0-8",
      "Grades 9-12 or Non-Graduate",
      "High School Graduate, GED, or Equivalency Diploma",
      "12 grade + Some Post-Secondary",
      "2 or 4 year College Graduate",
      "Graduate of other post-secondary school",
    ],
  },
  {
    code: "C4",
    scope: "individual",
    label: "Disconnected youth (ages 14-24 who are neither working nor in school)",
    options: ["Yes", "No"],
  },
  {
    code: "C5a",
    scope: "individual",
    label: "Disability",
    options: ["Yes", "No"],
  },
  {
    code: "C5b",
    scope: "individual",
    label: "Health insurance",
    options: ["Yes", "No"],
  },
  {
    // Form items C5 b.1-b.7 — collected only when C5b is "Yes"
    code: "C5b-source",
    scope: "individual",
    label: "Health insurance source",
    options: [
      "Medicaid",
      "Medicare",
      "State Children's Health Insurance Program",
      "State Health Insurance for Adults",
      "Military Health Care",
      "Direct-Purchase",
      "Employment-Based",
    ],
  },
  {
    code: "C6",
    scope: "individual",
    label: "Race and ethnicity",
    options: [
      "American Indian or Alaska Native",
      "Asian",
      "Black or African American",
      "Hispanic or Latino",
      "Middle Eastern or North African",
      "Native Hawaiian and Pacific Islander",
      "White",
      "Multiracial or Multiethnic (two or more of the above)",
    ],
  },
  {
    code: "C7",
    scope: "individual",
    label: "Military status",
    options: ["Veteran", "Active Military", "Never Served in the Military"],
  },
  {
    code: "C8",
    scope: "individual",
    label: "Work status (individuals 18+)",
    options: [
      "Employed Full-Time",
      "Employed Part-Time",
      "Seasonal Farm Worker",
      "Unemployed (Short-Term, 6 months or less)",
      "Unemployed (Long-Term, more than 6 months)",
      "Unemployed (Not in Labor Force)",
      "Retired",
    ],
  },

  // HOUSEHOLD LEVEL CHARACTERISTICS
  {
    code: "D9",
    scope: "household",
    label: "Household type",
    options: [
      "Single Person",
      "Two Adults no children",
      "Household with multiple adults with no children",
      "Single Parent Female",
      "Single Parent Male",
      "Two Parent Household",
      "Non-related Adults with Children",
      "Multigenerational Household",
      "Other",
    ],
  },
  {
    code: "D10",
    scope: "household",
    label: "Household size",
    options: ["Single Person", "Two", "Three", "Four", "Five", "Six or more"],
  },
  {
    code: "D11",
    scope: "household",
    label: "Housing",
    options: ["Own", "Rent", "Other permanent housing", "Homeless", "Other"],
  },
  {
    code: "D12",
    scope: "household",
    label: "Level of household income (% of federal poverty line)",
    options: [
      "Up to 50%",
      "51% to 75%",
      "76% to 100%",
      "101% to 125%",
      "126% to 150%",
      "151% to 175%",
      "176% to 200%",
      "201% to 250%",
      "251% and over",
    ],
  },
  {
    code: "D13",
    scope: "household",
    label: "Sources of household income",
    options: [
      "Income from Employment Only",
      "Income from Employment and Other Income Source",
      "Income from Employment, Other Income Source, and Non-Cash Benefits",
      "Income from Employment and Non-Cash Benefits",
      "Other Income Source Only",
      "Other Income Source and Non-Cash Benefits",
      "No Income",
      "Non-Cash Benefits Only",
    ],
  },
];

// D12 income bands as a percentage of the federal poverty line, lowest to highest.
export const FPL_BANDS: string[] = [
  "Up to 50%",
  "51% to 75%",
  "76% to 100%",
  "101% to 125%",
  "126% to 150%",
  "151% to 175%",
  "176% to 200%",
  "201% to 250%",
  "251% and over",
];

// Maps a % of FPL to an index into FPL_BANDS (anything above 250% maps to the last band).
export function fplBand(pct: number): number {
  const i = [50, 75, 100, 125, 150, 175, 200, 250].findIndex((t) => pct <= t);
  return i === -1 ? FPL_BANDS.length - 1 : i;
}

export const serviceByCode = (c: string) => SERVICES.find(s => s.code === c);
export const domainById = (id: string) => DOMAINS.find(d => d.id === id);
export const fnpiByCode = (c: string) => FNPIS.find(f => f.code === c);
