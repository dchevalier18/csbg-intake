"use client";
/* Interactive primitives — client components. */
import { type ReactNode } from "react";
import { I } from "./icons";

export function Seg({ options, value, onChange }: {
  options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o} type="button" className={value === o ? "on" : ""} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, width, children }: {
  title: string; onClose: () => void; width?: number; children: ReactNode;
}) {
  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={width ? { maxWidth: width } : undefined}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 className="ptitle" style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onClose}><I name="x" size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
