import path from "node:path";

/* ============================================================
   Upload validation shared by every file-accepting action.
   Extension allow-list + content (magic byte) sniffing: a file
   must both claim and BE one of the supported document formats.
   ============================================================ */

export const UPLOAD_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".tif", ".tiff"];
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const startsWith = (buf: Buffer, bytes: number[], offset = 0): boolean =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

/** True when the buffer's leading bytes match the format the extension claims. */
export function contentMatchesExtension(buf: Buffer, ext: string): boolean {
  switch (ext) {
    case ".pdf":
      return startsWith(buf, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case ".jpg":
    case ".jpeg":
      return startsWith(buf, [0xff, 0xd8, 0xff]);
    case ".png":
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case ".heic":
      // ISO-BMFF: size (4 bytes) + 'ftyp' + brand (heic/heix/hevc/mif1…)
      return startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4);
    case ".tif":
    case ".tiff":
      return startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a]);
    default:
      return false;
  }
}

export type UploadCheck =
  | { ok: true; ext: string; buf: Buffer }
  | { ok: false; message: string };

/** Decode + validate an uploaded document (filename + base64 payload).
    Rejects unsupported extensions, empty/oversized payloads, and files whose
    contents don't match the extension they claim. */
export function checkUpload(filename: string, base64: string): UploadCheck {
  const ext = path.extname(filename ?? "").toLowerCase();
  if (!UPLOAD_EXTENSIONS.includes(ext)) {
    return { ok: false, message: "That file type isn't supported — upload a PDF or a scanned image (JPG, PNG, HEIC, TIFF)." };
  }
  const buf = Buffer.from(String(base64 ?? ""), "base64");
  if (buf.length === 0) return { ok: false, message: "That file looks empty — rescan the document and try again." };
  if (buf.length > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "Files up to 4 MB are supported — scan at a lower resolution or split the document." };
  }
  if (!contentMatchesExtension(buf, ext)) {
    return { ok: false, message: "That file's contents don't match its type — rescan and upload the original PDF or image." };
  }
  return { ok: true, ext, buf };
}
