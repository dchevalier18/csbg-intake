/* ============================================================
   CSBG Client Intake System — Program-module sample data
   Fictional data for Generation Next, Weatherization, Second Harvest,
   Housing Counseling, CA Homes, and volunteer tracking.
   ============================================================ */

// ---------- Generation Next: classroom attendance ----------
const GNX_SESSIONS = [
  { id:"s1", date:"2026-06-02", label:"Jun 2" },
  { id:"s2", date:"2026-06-03", label:"Jun 3" },
  { id:"s3", date:"2026-06-04", label:"Jun 4" },
  { id:"s4", date:"2026-06-08", label:"Jun 8" },
  { id:"s5", date:"2026-06-09", label:"Today" },
];
// status per session: p = present, a = absent, e = excused, null = not yet taken
const GNX_STUDENTS = [
  { id:"G-101", name:"Dariel Vásquez",  clientId:"C-2440", grade:"11th", school:"Liberty HS",   term:91, marks:{ s1:"p", s2:"p", s3:"a", s4:"p", s5:null } },
  { id:"G-102", name:"Keily Rosario",   clientId:null,     grade:"10th", school:"Allen HS",     term:96, marks:{ s1:"p", s2:"p", s3:"p", s4:"p", s5:null } },
  { id:"G-103", name:"Marcus Boyd",     clientId:null,     grade:"11th", school:"Dieruff HS",   term:78, marks:{ s1:"a", s2:"p", s3:"p", s4:"a", s5:null } },
  { id:"G-104", name:"Lina Haddad",     clientId:null,     grade:"9th",  school:"Freedom HS",   term:98, marks:{ s1:"p", s2:"p", s3:"p", s4:"p", s5:null } },
  { id:"G-105", name:"Tyrese Coleman",  clientId:null,     grade:"12th", school:"Liberty HS",   term:85, marks:{ s1:"p", s2:"e", s3:"p", s4:"p", s5:null } },
  { id:"G-106", name:"Yaritza Peña",    clientId:null,     grade:"10th", school:"Allen HS",     term:89, marks:{ s1:"p", s2:"p", s3:"p", s4:"a", s5:null } },
  { id:"G-107", name:"Ethan Yoder",     clientId:null,     grade:"9th",  school:"Northeast MS", term:93, marks:{ s1:"p", s2:"p", s3:"e", s4:"p", s5:null } },
  { id:"G-108", name:"Amara Diop",      clientId:null,     grade:"11th", school:"Dieruff HS",   term:97, marks:{ s1:"p", s2:"p", s3:"p", s4:"p", s5:null } },
];
const GNX_CLASS = { name:"Summer Bridge — Robotics & Life Skills", site:"Allentown YMCA, Room 204", schedule:"Mon–Thu · 3:30–5:30 PM", srv:"SRV 2h" };

// ---------- Weatherization: contractors & jobs ----------
const WX_CONTRACTORS = [
  { id:"W-01", name:"Keystone Insulation Co.", trade:"Insulation / air sealing", crews:3, phone:"(610) 555-0201",
    insurance:"2027-02-15", bpi:"2026-11-30", epaRrp:"2027-08-01", activeJobs:4, qcPass:97, status:"good" },
  { id:"W-02", name:"Lehigh HVAC Partners", trade:"Heating systems", crews:2, phone:"(610) 555-0233",
    insurance:"2026-07-08", bpi:"2027-03-22", epaRrp:"2026-12-15", activeJobs:3, qcPass:94, status:"expiring" },
  { id:"W-03", name:"Valley Window & Door", trade:"Windows / doors", crews:1, phone:"(484) 555-0260",
    insurance:"2027-01-20", bpi:"2026-06-30", epaRrp:"2027-05-10", activeJobs:2, qcPass:91, status:"expiring" },
  { id:"W-04", name:"Pocono Energy Audits LLC", trade:"Audits / blower door", crews:2, phone:"(570) 555-0274",
    insurance:"2027-04-02", bpi:"2027-09-18", epaRrp:"2027-02-28", activeJobs:6, qcPass:99, status:"good" },
];
// stages: audit → install → qc → complete
const WX_JOBS = [
  { id:"WX-2241", client:"Walter Gergar", clientId:"C-2402", address:"212 Delaware Ave, Bangor", stage:"complete", contractor:"W-01", funding:"DOE WAP", measures:"Attic insulation, air sealing, CO detectors", started:"2026-04-21" },
  { id:"WX-2248", client:"Gene Kovach", clientId:"C-2435", address:"23 Broadway, Bangor", stage:"qc", contractor:"W-02", funding:"LIHEAP Crisis", measures:"Furnace replacement, smart thermostat", started:"2026-05-12" },
  { id:"WX-2252", client:"Ana Reyes", clientId:null, address:"731 N 7th St, Allentown", stage:"install", contractor:"W-01", funding:"DOE WAP", measures:"Dense-pack walls, basement rim joist", started:"2026-05-26" },
  { id:"WX-2255", client:"Earl Frantz", clientId:null, address:"44 Mauch Chunk St, Nazareth", stage:"install", contractor:"W-03", funding:"UGI partnership", measures:"Window replacement (6), door sweep", started:"2026-06-01" },
  { id:"WX-2257", client:"Marisol Núñez", clientId:null, address:"912 Ferry St, Easton", stage:"audit", contractor:"W-04", funding:"DOE WAP", measures:"Initial audit + blower door scheduled 6/12", started:"2026-06-08" },
  { id:"WX-2258", client:"Kateryna Bondar", clientId:null, address:"305 Tilghman St, Allentown", stage:"audit", contractor:"W-04", funding:"Pending eligibility", measures:"Audit blocked — awaiting landlord agreement (see eligibility queue)", started:"2026-06-08" },
];
const WX_STAGES = [
  { id:"audit", label:"Energy audit" }, { id:"install", label:"Installation" },
  { id:"qc", label:"QC inspection" }, { id:"complete", label:"Complete" },
];

// ---------- Second Harvest: pantry member agencies ----------
const PANTRY_AGENCIES = [
  { id:"P-014", name:"New Bethany Ministries", town:"Bethlehem", county:"Northampton", contact:"S. Alvarez", phone:"(610) 555-0310", mayReport:"received", households:412, lbs:18240, compliance:"current" },
  { id:"P-022", name:"Easton Area Neighborhood Center", town:"Easton", county:"Northampton", contact:"D. Brooks", phone:"(610) 555-0322", mayReport:"received", households:367, lbs:15910, compliance:"current" },
  { id:"P-031", name:"St. Paul's Food Pantry", town:"Allentown", county:"Lehigh", contact:"Fr. M. Okafor", phone:"(610) 555-0339", mayReport:"missing", households:null, lbs:null, compliance:"current" },
  { id:"P-008", name:"Slatington Food Bank", town:"Slatington", county:"Lehigh", contact:"R. Hartman", phone:"(610) 555-0344", mayReport:"received", households:201, lbs:8730, compliance:"current" },
  { id:"P-040", name:"Carbon County Friendship Pantry", town:"Jim Thorpe", county:"Carbon", contact:"L. Gable", phone:"(570) 555-0351", mayReport:"missing", households:null, lbs:null, compliance:"site-visit-due" },
  { id:"P-027", name:"Monroe Mobile Pantry", town:"Stroudsburg", county:"Monroe", contact:"T. Nguyen", phone:"(570) 555-0368", mayReport:"received", households:288, lbs:12480, compliance:"current" },
];
const SHFB_STATS = { agencies:212, countiesServed:6, lbsYTD:14600000, mealsYTD:8100000, reportsThisMonth:{ received:178, missing:34 } };

// ---------- Volunteers (Module 2, B.1) ----------
const VOLUNTEERS = [
  { id:"V-201", name:"Carol Stauffer", programs:["shfb"], hoursFY:184, lowIncome:false, lastShift:"2026-06-07", role:"Warehouse sort" },
  { id:"V-188", name:"Maribel Ortega", programs:["shfb"], clientId:"C-2417", hoursFY:62, lowIncome:true, lastShift:"2026-06-06", role:"Pantry distribution" },
  { id:"V-214", name:"Hank Williams Jr.", programs:["cad-a"], hoursFY:48, lowIncome:false, lastShift:"2026-06-04", role:"Outreach events" },
  { id:"V-220", name:"Aminata Diallo", programs:["cad-b","hc"], clientId:"C-2422", hoursFY:35, lowIncome:true, lastShift:"2026-06-05", role:"Seminar greeter" },
  { id:"V-198", name:"Pat Donchez", programs:["homes"], hoursFY:122, lowIncome:false, lastShift:"2026-06-08", role:"Build crew" },
  { id:"V-225", name:"Sofia Marrero", programs:["gnx"], hoursFY:27, lowIncome:true, lastShift:"2026-06-03", role:"Tutoring" },
];
const VOL_STATS = { totalHoursFY:11840, lowIncomeHoursFY:4120, activeVolunteers:386 };

// ---------- Housing Counseling: seminars ----------
const SEMINARS = [
  { id:"SEM-18", title:"First-Time Homebuyer Workshop", date:"2026-06-14", time:"9:00 AM – 1:00 PM", site:"CALV Main Office, Allentown", capacity:30, registered:26, srv:"SRV 3a",
    attendees:[
      { name:"Rosa Mejía", applicantId:"A-1186", intake:"in-progress" },
      { name:"Priya Raman", clientId:"C-2415", intake:"enrolled" },
      { name:"Jordan Wells", intake:"not-started" },
      { name:"Fatima Al-Sayed", intake:"not-started" },
    ]},
  { id:"SEM-19", title:"Foreclosure Prevention Clinic", date:"2026-06-21", time:"6:00 – 8:00 PM", site:"Bethlehem Area Public Library", capacity:20, registered:11, srv:"SRV 3a", attendees:[] },
  { id:"SEM-20", title:"Renter Rights & Eviction Defense", date:"2026-06-28", time:"10:00 AM – 12:00 PM", site:"Easton Community Center", capacity:25, registered:19, srv:"SRV 4d", attendees:[] },
];

// ---------- CA Homes: construction projects ----------
const HOMES_PROJECTS = [
  { id:"H-07", name:"417 N Jordan St — full rehab", town:"Allentown", buyer:"Matched — Ortega family (C-2417 waitlist)", budget:218000, spent:164000, pct:74,
    milestones:[
      { label:"Acquisition & title", done:true }, { label:"Permits (City of Allentown)", done:true },
      { label:"Structural & roof", done:true }, { label:"MEP rough-in", done:true },
      { label:"Insulation & drywall", done:false, current:true }, { label:"Finishes & appliances", done:false },
      { label:"Final inspection / CO", done:false }, { label:"Settlement", done:false },
    ],
    requirements:[
      { label:"Davis-Bacon payroll certs (HOME funds)", status:"current" },
      { label:"Lead-safe certification (pre-1978)", status:"current" },
      { label:"Section 3 hiring report — Q2", status:"due" },
    ]},
  { id:"H-08", name:"622 Pawnee St — new build", town:"Bethlehem", buyer:"Buyer pool — 3 pre-approved", budget:264000, spent:71000, pct:27,
    milestones:[
      { label:"Lot acquisition", done:true }, { label:"Permits (City of Bethlehem)", done:true },
      { label:"Foundation", done:true }, { label:"Framing", done:false, current:true },
      { label:"MEP rough-in", done:false }, { label:"Insulation & drywall", done:false },
      { label:"Finishes", done:false }, { label:"Final inspection / CO", done:false }, { label:"Settlement", done:false },
    ],
    requirements:[
      { label:"NEPA environmental review", status:"current" },
      { label:"Energy Star v3.2 verification plan", status:"current" },
      { label:"CDBG draw #2 documentation", status:"due" },
    ]},
];

// ---------- Client portal (self-service) ----------
const PORTAL_USER = {
  name:"Rosa Mejía", applicantId:"A-1186", program:"hc",
  status:"Waiting on your documents",
  steps:[
    { label:"Application started", done:true, date:"Jun 5" },
    { label:"Documents", done:false, current:true },
    { label:"Eligibility review", done:false },
    { label:"Enrollment decision", done:false },
  ],
  docs:[
    { key:"id", label:"Photo ID", status:"submitted", hint:"Received — being reviewed" },
    { key:"income", label:"Proof of income (30 days)", status:"missing", hint:"Pay stubs or award letter" },
    { key:"residency", label:"Proof of residency", status:"missing", hint:"Lease, utility bill, or PA ID" },
  ],
  appointment:{ what:"First-Time Homebuyer Workshop", when:"Saturday, June 14 · 9:00 AM", where:"CALV Main Office — 1337 E 5th St, Allentown" },
  caseworker:{ name:"Dana Rivera", phone:"(610) 691-5620" },
};

Object.assign(window, {
  GNX_SESSIONS, GNX_STUDENTS, GNX_CLASS,
  WX_CONTRACTORS, WX_JOBS, WX_STAGES,
  PANTRY_AGENCIES, SHFB_STATS, VOLUNTEERS, VOL_STATS,
  SEMINARS, HOMES_PROJECTS, PORTAL_USER,
});
