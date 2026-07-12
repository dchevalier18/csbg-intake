"use client";
/* Interactive primitives — client components. */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { I } from "./icons";

export function Seg({ options, value, onChange, label }: {
  options: string[]; value: string; onChange: (v: string) => void; label?: string;
}) {
  // Radiogroup semantics: one choice among a small fixed set; arrow keys move
  // the selection, matching the native radio pattern screen readers expect.
  function onKeyDown(e: React.KeyboardEvent) {
    const idx = options.indexOf(value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(options[(idx + 1) % options.length]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(options[(idx - 1 + options.length) % options.length]);
    }
  }
  return (
    <div className="seg" role="radiogroup" aria-label={label ?? "View"} onKeyDown={onKeyDown}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          tabIndex={value === o ? 0 : -1}
          className={value === o ? "on" : ""}
          onClick={() => onChange(o)}
        >{o}</button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, width, children }: {
  title: string; onClose: () => void; width?: number; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    // initial focus: the first field if there is one, else the close button
    (focusables().find((el) => el.tagName !== "BUTTON") ?? focusables()[0])?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // focus trap — Tab cycles inside the dialog
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus(); // restore focus to whatever opened the dialog
    };
  }, [onClose]);

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}
        style={width ? { maxWidth: width } : undefined}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 className="ptitle" style={{ margin: 0 }} id={titleId}>{title}</h3>
          <button type="button" className="calv-btn calv-btn--quiet calv-btn--sm" onClick={onClose} aria-label="Close dialog">
            <I name="x" size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
