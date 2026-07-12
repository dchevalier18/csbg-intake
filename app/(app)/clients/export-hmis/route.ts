import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";
import { canonicalCharacteristic } from "@/lib/csbg-catalog";
import { todayIso } from "@/lib/format";

/* ============================================================
   GET /clients/export-hmis — HMIS-aligned client CSV.
   Column names and coding follow the HUD HMIS CSV Client file
   conventions (race booleans, 0/1 + 99 "data not collected")
   so a CoC HMIS admin can map it on sight. This is an ALIGNMENT
   AID for de-duplication/coordination — not a certified HMIS
   export; see docs/compliance/ar-3.0.md for scope notes.
   Admin-only; the download is audited.
   ============================================================ */

export const dynamic = "force-dynamic";

const esc = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// HUD list 1.8-style: 0 = No, 1 = Yes, 99 = Data not collected
const NOT_COLLECTED = 99;

export async function GET(): Promise<Response> {
  const user = await requireAdmin();
  const clients = (await db.select().from(t.clients)).filter((c) => c.status === "active");

  const header = [
    "PersonalID", "FirstName", "LastName", "DOB",
    "AmIndAKNative", "Asian", "BlackAfAmerican", "HispanicLatinaeo",
    "MidEastNAfrican", "NativeHIPacific", "White", "RaceNone",
    "Woman", "Man", "GenderNone",
    "VeteranStatus", "DateCreated",
  ];

  const RACE_COLUMNS: Record<string, number> = {
    "American Indian or Alaska Native": 0,
    "Asian": 1,
    "Black or African American": 2,
    "Hispanic or Latino": 3,
    "Middle Eastern or North African": 4,
    "Native Hawaiian and Pacific Islander": 5,
    "White": 6,
  };

  const lines = [header.join(",")];
  for (const c of clients) {
    const race = canonicalCharacteristic("C6", c.race);
    const raceFlags = [0, 0, 0, 0, 0, 0, 0];
    let raceNone: number | "" = "";
    if (race && race in RACE_COLUMNS) {
      raceFlags[RACE_COLUMNS[race]] = 1;
    } else if (race?.startsWith("Multiracial")) {
      // combined single-select can't decompose into component races —
      // flag as data-not-collected rather than guessing
      raceNone = NOT_COLLECTED;
    } else {
      raceNone = NOT_COLLECTED;
    }

    const sex = canonicalCharacteristic("C1", c.sex);
    const woman = sex === "Female" ? 1 : 0;
    const man = sex === "Male" ? 1 : 0;
    const genderNone = sex ? "" : NOT_COLLECTED;

    const veteran = c.military === "Veteran" ? 1
      : c.military === "Never Served in the Military" || c.military === "Active Military" ? 0
        : NOT_COLLECTED;

    lines.push([
      esc(c.id), esc(c.first), esc(c.last), esc(c.dob),
      ...raceFlags.map(String), String(raceNone),
      String(woman), String(man), String(genderNone),
      String(veteran), esc(c.createdAt.slice(0, 10)),
    ].join(","));
  }

  await audit(user.id, "clients.export-hmis", "report", "hmis-csv", `${clients.length} active clients`);

  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hmis-aligned-clients-${todayIso()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
