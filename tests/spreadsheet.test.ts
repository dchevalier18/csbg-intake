import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseCsv, looksLikeXlsx, readSheet } from "@/lib/spreadsheet";

describe("parseCsv", () => {
  it("splits simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("handles quoted fields with commas, quotes, and newlines", () => {
    const text = 'name,note\n"Mejía, Rosa","She said ""hi""\nsecond line"';
    expect(parseCsv(text)).toEqual([
      ["name", "note"],
      ['Mejía, Rosa', 'She said "hi"\nsecond line'],
    ]);
  });

  it("handles CRLF and lone CR line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r3,4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(parseCsv("﻿h1,h2\nx,y")[0]).toEqual(["h1", "h2"]);
  });

  it("keeps empty trailing fields in a row", () => {
    expect(parseCsv("a,b,\n1,,")).toEqual([["a", "b", ""], ["1", "", ""]]);
  });

  it("does not emit a phantom row for a trailing newline", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("looksLikeXlsx", () => {
  it("detects ZIP containers and rejects text", () => {
    expect(looksLikeXlsx(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(true);
    expect(looksLikeXlsx(Buffer.from("name,age\n"))).toBe(false);
    expect(looksLikeXlsx(Buffer.alloc(0))).toBe(false);
  });
});

describe("readSheet", () => {
  it("reads a CSV buffer into headers + rows, dropping blank lines", async () => {
    const sheet = await readSheet(Buffer.from("Agency,Month,Households\n\nSecond Harvest,2026-05,120\n"));
    expect(sheet).not.toBeNull();
    expect(sheet!.headers).toEqual(["Agency", "Month", "Households"]);
    expect(sheet!.rows).toEqual([["Second Harvest", "2026-05", "120"]]);
  });

  it("round-trips an xlsx workbook written by ExcelJS", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["Volunteer", "Hours", "Date"]);
    ws.addRow(["Pat Q. Public", 12, new Date(Date.UTC(2026, 5, 8))]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const sheet = await readSheet(buf);
    expect(sheet).not.toBeNull();
    expect(sheet!.headers).toEqual(["Volunteer", "Hours", "Date"]);
    expect(sheet!.rows[0][0]).toBe("Pat Q. Public");
    expect(sheet!.rows[0][1]).toBe("12");
    expect(sheet!.rows[0][2]).toBe("2026-06-08"); // dates render as ISO days
  });

  it("rejects binary garbage that is neither ZIP nor text", async () => {
    const junk = Buffer.from([0x00, 0x01, 0x02, 0x00, 0xff, 0xfe, 0x00, 0x10]);
    expect(await readSheet(junk)).toBeNull();
  });

  it("returns empty rows for a header-only sheet", async () => {
    const sheet = await readSheet(Buffer.from("OnlyHeader,Cols\n"));
    expect(sheet!.headers).toEqual(["OnlyHeader", "Cols"]);
    expect(sheet!.rows).toEqual([]);
  });
});
