import { describe, it, expect } from "vitest";
import { checkUpload, contentMatchesExtension, MAX_UPLOAD_BYTES } from "@/lib/uploads";

const PDF = Buffer.from("%PDF-1.7\nrest of file");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const TIFF_LE = Buffer.from([0x49, 0x49, 0x2a, 0x00, 9, 9]);
const TIFF_BE = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 9, 9]);
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(8)]);

describe("contentMatchesExtension", () => {
  it("accepts matching magic bytes", () => {
    expect(contentMatchesExtension(PDF, ".pdf")).toBe(true);
    expect(contentMatchesExtension(PNG, ".png")).toBe(true);
    expect(contentMatchesExtension(JPG, ".jpg")).toBe(true);
    expect(contentMatchesExtension(JPG, ".jpeg")).toBe(true);
    expect(contentMatchesExtension(TIFF_LE, ".tif")).toBe(true);
    expect(contentMatchesExtension(TIFF_BE, ".tiff")).toBe(true);
    expect(contentMatchesExtension(HEIC, ".heic")).toBe(true);
  });

  it("rejects content that doesn't match the claimed extension", () => {
    expect(contentMatchesExtension(PNG, ".pdf")).toBe(false);
    expect(contentMatchesExtension(PDF, ".png")).toBe(false);
    expect(contentMatchesExtension(Buffer.from("<script>alert(1)</script>"), ".jpg")).toBe(false);
  });
});

describe("checkUpload", () => {
  const b64 = (b: Buffer) => b.toString("base64");

  it("accepts a well-formed document", () => {
    const r = checkUpload("statement.pdf", b64(PDF));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ext).toBe(".pdf");
      expect(r.buf.equals(PDF)).toBe(true);
    }
  });

  it("rejects unsupported extensions", () => {
    const r = checkUpload("virus.exe", b64(PDF));
    expect(r.ok).toBe(false);
  });

  it("rejects empty payloads", () => {
    const r = checkUpload("scan.png", "");
    expect(r.ok).toBe(false);
  });

  it("rejects oversized payloads", () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x25);
    const r = checkUpload("big.pdf", b64(big));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("4 MB");
  });

  it("rejects spoofed content (html named .jpg)", () => {
    const r = checkUpload("photo.jpg", b64(Buffer.from("<html><body>hi</body></html>")));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("contents don't match");
  });

  it("is case-insensitive about the extension", () => {
    const r = checkUpload("SCAN.PDF", b64(PDF));
    expect(r.ok).toBe(true);
  });
});
