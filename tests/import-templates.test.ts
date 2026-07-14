import { describe, expect, it } from "vitest";
import { readSheet } from "../src/lib/spreadsheet";
import { IMPORT_TEMPLATES, autoMapColumns, templateCsv } from "../src/lib/import-templates";

describe("downloadable import templates", () => {
  it("covers every template in the picker", () => {
    expect(IMPORT_TEMPLATES.map((t) => t.id).sort()).toEqual(
      ["clients", "pantry", "pantry-agencies", "seminars", "volunteers"].sort());
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
        if (tpl.id === "pantry") expect(byKey.agency).toBe("DELETE THIS EXAMPLE ROW");
        if (tpl.id === "seminars") expect(byKey.seminar).toBe("DELETE THIS EXAMPLE ROW");
        if (tpl.id === "volunteers") expect(byKey.program).toBe("DELETE THIS EXAMPLE ROW");
        if (tpl.id === "pantry-agencies") expect(byKey.name).toBe(""); // missing name → skipped
      });
    });
  }
});
