import { describe, expect, it } from "vitest";
import { readSheet } from "../src/lib/spreadsheet";
import { IMPORT_TEMPLATES, autoMapColumns, templateCsv } from "../src/lib/import-templates";

describe("downloadable import templates", () => {
  it("covers every template in the picker", () => {
    expect(IMPORT_TEMPLATES.map((t) => t.id).sort()).toEqual(
      ["clients", "pantry", "pantry-agencies", "seminars", "volunteers", "services"].sort());
  });

  it("client migration carries every All Characteristics Report field (C1-C8, D9-D13)", () => {
    const clients = IMPORT_TEMPLATES.find((t) => t.id === "clients")!;
    const keys = new Set(clients.fields.map((f) => f.key));
    // report characteristic → import field that feeds it (C2 derives from dob,
    // D10 from hhSize, D12 from income + hhSize + the pinned guideline year)
    const feeds: Record<string, string> = {
      C1: "sex", C2: "dob", C3: "edu", C4: "disconnectedYouth", C5a: "disability",
      C5b: "insurance", C6: "race", C7: "military", C8: "work",
      D9: "hhType", D10: "hhSize", D11: "housing", D12: "income", D13: "incomeSrc",
    };
    for (const [code, key] of Object.entries(feeds)) {
      expect(keys.has(key), `${code} needs the “${key}” import column`).toBe(true);
    }
  });

  it("client migration carries the full client record beyond the report fields", () => {
    const clients = IMPORT_TEMPLATES.find((t) => t.id === "clients")!;
    const keys = new Set(clients.fields.map((f) => f.key));
    // record-completeness columns: residence county, caseworker assignment,
    // and the legacy-system ID pair that feeds client_external_ids linkage
    for (const key of ["county", "caseworker", "legacyId", "legacySystem"]) {
      expect(keys.has(key), `client migration needs the “${key}” column`).toBe(true);
    }
    // ClientTrack's own export headers must auto-map onto the legacy pair
    const legacy = clients.fields.find((f) => f.key === "legacyId")!;
    expect(legacy.aliases).toContain("clientid");
  });

  for (const tpl of IMPORT_TEMPLATES) {
    describe(tpl.name, () => {
      it("round-trips through the upload parser with a full auto-map", async () => {
        const sheet = await readSheet(Buffer.from("\uFEFF" + templateCsv(tpl)));
        expect(sheet).not.toBeNull();
        expect(sheet!.rows).toHaveLength(1); // the example row
        const mapping = autoMapColumns(tpl, sheet!.headers);
        for (const f of tpl.fields) {
          // every column of our own template must auto-map — no manual mapping
          expect(mapping[f.key], `field ${f.key} should auto-map`).toBeGreaterThanOrEqual(0);
          expect(sheet!.headers[mapping[f.key]]).toBe(f.label);
        }
      });

      it("has an example row the importer is guaranteed to skip", () => {
        const byKey = Object.fromEntries(tpl.fields.map((f) => [f.key, f.example]));
        // each template's match-or-create guard: the cell the importer keys on
        // either never matches existing data or is blank (both skip with a reason)
        if (tpl.id === "clients") expect(byKey.program).toBe("DELETE THIS EXAMPLE ROW");
        if (tpl.id === "services") { expect(byKey.legacyId).toBe("DELETE THIS EXAMPLE ROW"); expect(byKey.name).toBe(""); }
        if (tpl.id === "pantry") expect(byKey.agency).toBe("DELETE THIS EXAMPLE ROW");
        if (tpl.id === "seminars") expect(byKey.seminar).toBe("DELETE THIS EXAMPLE ROW");
        if (tpl.id === "volunteers") expect(byKey.program).toBe("DELETE THIS EXAMPLE ROW");
        if (tpl.id === "pantry-agencies") expect(byKey.name).toBe(""); // missing name → skipped
      });
    });
  }
});
