import { describe, it, expect } from "vitest";
import { canonicalCharacteristic, characteristicByCode, CHARACTERISTICS, CATALOG_VERSION } from "@/lib/csbg-catalog";

describe("characteristic canonicalization (instrument-exact report labels)", () => {
  it("catalog is versioned", () => {
    expect(CATALOG_VERSION).toBe("AR-3.0");
  });

  it("passes canonical options through unchanged", () => {
    for (const c of CHARACTERISTICS) {
      for (const opt of c.options) {
        expect(canonicalCharacteristic(c.code, opt)).toBe(opt);
      }
    }
  });

  it("maps the seed's shortened display strings to instrument canon", () => {
    expect(canonicalCharacteristic("C3", "High School Graduate / GED"))
      .toBe("High School Graduate, GED, or Equivalency Diploma");
    expect(canonicalCharacteristic("C3", "Grades 9-12 / Non-Graduate"))
      .toBe("Grades 9-12 or Non-Graduate");
    expect(canonicalCharacteristic("C3", "Other post-secondary graduate"))
      .toBe("Graduate of other post-secondary school");
    expect(canonicalCharacteristic("C6", "Native Hawaiian / Pacific Islander"))
      .toBe("Native Hawaiian and Pacific Islander");
    expect(canonicalCharacteristic("C6", "Multiracial or Multiethnic"))
      .toBe("Multiracial or Multiethnic (two or more of the above)");
    expect(canonicalCharacteristic("C8", "Unemployed (Long-Term)"))
      .toBe("Unemployed (Long-Term, more than 6 months)");
    expect(canonicalCharacteristic("C8", "Unemployed (Short-Term)"))
      .toBe("Unemployed (Short-Term, 6 months or less)");
    expect(canonicalCharacteristic("D9", "Multiple adults no children"))
      .toBe("Household with multiple adults with no children");
    expect(canonicalCharacteristic("D13", "Employment and Non-Cash Benefits"))
      .toBe("Income from Employment and Non-Cash Benefits");
    expect(canonicalCharacteristic("D13", "Employment, Other Source, and Non-Cash Benefits"))
      .toBe("Income from Employment, Other Income Source, and Non-Cash Benefits");
  });

  it("is punctuation- and case-tolerant", () => {
    expect(canonicalCharacteristic("C6", "black or african american")).toBe("Black or African American");
    expect(canonicalCharacteristic("D11", "OWN")).toBe("Own");
  });

  it("returns null for unmappable values (they report as Unknown + drift)", () => {
    expect(canonicalCharacteristic("C6", "Klingon")).toBeNull();
    expect(canonicalCharacteristic("C6", "")).toBeNull();
    expect(canonicalCharacteristic("C6", null)).toBeNull();
    expect(canonicalCharacteristic("ZZ", "Own")).toBeNull();
  });

  it("insurance sources canonicalize under C5b-source", () => {
    const src = characteristicByCode("C5b-source")!;
    for (const opt of src.options) {
      expect(canonicalCharacteristic("C5b-source", opt)).toBe(opt);
    }
    // "None" is the C5b=No sentinel, not a source
    expect(canonicalCharacteristic("C5b-source", "None")).toBeNull();
  });
});
