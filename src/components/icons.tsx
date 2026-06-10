/* Tiny lucide-style icon set (1.8px stroke) — safe in server and client components. */
import type { CSSProperties } from "react";

export const ICONS: Record<string, string> = {
  search: "M21 21l-4.3-4.3|M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  home: "M3 10.5L12 3l9 7.5|M5 9.5V21h14V9.5",
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M22 21v-2a4 4 0 0 0-3-3.9|M16 3.1a4 4 0 0 1 0 7.8",
  clipboard: "M9 5h6a1 1 0 0 0 1-1 1 1 0 0 0-1-1H9a1 1 0 0 0-1 1 1 1 0 0 0 1 1z|M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2|M9 12h6|M9 16h4",
  check: "M20 6L9 17l-5-5",
  shield: "M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z|M9 12l2 2 4-4",
  chart: "M3 3v18h18|M7 14v3|M11 9v8|M15 12v5|M19 6v11",
  plug: "M9 7V3|M15 7V3|M6 7h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V7z|M12 17v4",
  hand: "M12 3v9|M8 6v7|M16 6v7|M4.5 12.5l2 4A6 6 0 0 0 12 20a6 6 0 0 0 6-6V8",
  plus: "M12 5v14|M5 12h14",
  alert: "M12 9v4|M12 17h.01|M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M9 13h6|M9 17h6",
  arrow: "M5 12h14|M13 6l6 6-6 6",
  x: "M18 6L6 18|M6 6l12 12",
  cal: "M8 2v4|M16 2v4|M3 8h18|M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.5 2.8.7a2 2 0 0 1 1.7 2z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9|M10.3 21a1.9 1.9 0 0 0 3.4 0",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M17 8l-5-5-5 5|M12 3v12",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  building: "M3 21h18|M5 21V7l8-4v18|M19 21V11l-6-4|M9 9v.01|M9 13v.01|M9 17v.01",
  edit: "M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z",
  trash: "M3 6h18|M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6|M10 11v6|M14 11v6",
  layers: "M12 2l9 5-9 5-9-5 9-5z|M3 12l9 5 9-5|M3 17l9 5 9-5",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9",
};

export function I({ name, size = 16, style }: { name: string; size?: number; style?: CSSProperties }) {
  const d = ICONS[name] ?? ICONS.doc;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", ...style }}>
      {d.split("|").map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
