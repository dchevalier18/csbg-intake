import { describe, it, expect } from "vitest";
import { DOMAINS, SERVICES, FNPIS, CHARACTERISTICS, serviceByCode, domainById, fnpiByCode } from "@/lib/csbg-catalog";

describe("CSBG catalog invariants", () => {
  it("service codes are unique", () => {
    const codes = SERVICES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every service belongs to a declared domain", () => {
    const domainIds = new Set(DOMAINS.map((d) => d.id));
    for (const s of SERVICES) {
      expect(domainIds.has(s.domain), `service ${s.code} references unknown domain ${s.domain}`).toBe(true);
    }
  });

  it("FNPI codes are unique", () => {
    const codes = FNPIS.map((f) => f.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("SRV/SDA code prefixes are well-formed", () => {
    for (const s of SERVICES) {
      expect(s.code).toMatch(/^(SRV|SDA) \d+[a-z]+$/);
    }
    for (const f of FNPIS) {
      expect(f.code).toMatch(/^FNPI \d+[a-z]+(\.\d+)?$/);
    }
  });

  it("characteristics carry non-empty option lists and well-formed codes", () => {
    for (const c of CHARACTERISTICS) {
      expect(c.options.length, `characteristic ${c.code} has no options`).toBeGreaterThan(0);
      // e.g. "C2", "C5b", "D12" — plus the two-level insurance follow-up "C5b-source"
      expect(c.code).toMatch(/^[CD]\d+[a-z]?(-[a-z]+)?$/);
      expect(["individual", "household"]).toContain(c.scope);
    }
  });

  it("lookup helpers resolve known codes", () => {
    expect(serviceByCode(SERVICES[0].code)?.code).toBe(SERVICES[0].code);
    expect(domainById(DOMAINS[0].id)?.id).toBe(DOMAINS[0].id);
    expect(fnpiByCode(FNPIS[0].code)?.code).toBe(FNPIS[0].code);
    expect(serviceByCode("SRV 99zz")).toBeUndefined();
  });
});
