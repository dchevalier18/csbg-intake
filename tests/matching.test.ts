import { describe, it, expect } from "vitest";
import { classifyMatches, matchKey, normName, normPhone, type MatchCandidate } from "@/lib/matching";

const clients: MatchCandidate[] = [
  { id: "C-1", first: "Maria", last: "Santos", dob: "1988-04-02", phone: "610-555-0101" },
  { id: "C-2", first: "Mariana", last: "Santos", dob: "1991-09-17", phone: null },
  { id: "C-3", first: "Jose", last: "Santos", dob: "1988-04-02", phone: "484-555-0202" },
  { id: "C-4", first: "Dawn", last: "Chevalier", dob: "1975-01-30", phone: null },
];

describe("normalization", () => {
  it("normName trims, casefolds, collapses whitespace", () => {
    expect(normName("  Maria   Elena ")).toBe("maria elena");
  });
  it("normPhone keeps digits and drops a leading US country code", () => {
    expect(normPhone("(610) 555-0101")).toBe("6105550101");
    expect(normPhone("1-610-555-0101")).toBe("6105550101");
    expect(normPhone(null)).toBe("");
  });
  it("matchKey is case- and whitespace-insensitive", () => {
    expect(matchKey({ first: " MARIA ", last: "santos", dob: "1988-04-02" }))
      .toBe(matchKey({ first: "Maria", last: "Santos", dob: "1988-04-02" }));
  });
});

describe("classifyMatches", () => {
  it("finds an exact match on normalized name + DOB", () => {
    const r = classifyMatches({ first: "MARIA", last: "santos", dob: "1988-04-02" }, clients);
    expect(r.exact.map((c) => c.id)).toEqual(["C-1"]);
    expect(r.possible.map((m) => m.client.id)).not.toContain("C-1");
  });

  it("flags same last name + DOB as possible, not exact", () => {
    const r = classifyMatches({ first: "Josefina", last: "Santos", dob: "1988-04-02" }, clients);
    expect(r.exact).toHaveLength(0);
    const ids = r.possible.map((m) => m.client.id);
    expect(ids).toContain("C-1"); // same last + dob
    expect(ids).toContain("C-3"); // same last + dob + similar first ("Jos…")
  });

  it("flags similar first name with same last name", () => {
    const r = classifyMatches({ first: "Mari", last: "Santos", dob: "2000-01-01" }, clients);
    const ids = r.possible.map((m) => m.client.id);
    expect(ids).toContain("C-1");
    expect(ids).toContain("C-2");
  });

  it("does not match on last name alone", () => {
    const r = classifyMatches({ first: "Zoe", last: "Santos", dob: "2000-01-01" }, clients);
    expect(r.exact).toHaveLength(0);
    expect(r.possible).toHaveLength(0);
  });

  it("ranks a phone tiebreak first", () => {
    const r = classifyMatches(
      { first: "Mari", last: "Santos", dob: "2000-01-01", phone: "16105550101" }, clients);
    expect(r.possible[0].client.id).toBe("C-1");
    expect(r.possible[0].reasons[0]).toContain("phone");
  });

  it("returns nothing for too-short names", () => {
    const r = classifyMatches({ first: "M", last: "Santos", dob: "1988-04-02" }, clients);
    expect(r.exact).toHaveLength(0);
    expect(r.possible).toHaveLength(0);
  });
});
