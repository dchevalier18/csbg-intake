"use client";
/* ============================================================
   Staff-app internationalization — the same colocated-dictionary
   pattern the client portal established, lifted to a context so
   every screen reads one user-level language preference.

   Usage in a client component:
     const lang = useLang();                  // 'en' | 'es'
     const s = pick(lang, { en: {...}, es: {...} });
   Server components pass `user.locale` into <LangProvider>.
   Adding a language = extending Lang + each screen's dictionary.
   ============================================================ */
import { createContext, useContext, type ReactNode } from "react";

export type Lang = "en" | "es";

export const LANGS: Array<{ id: Lang; label: string }> = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
];

export const normalizeLang = (v: string | null | undefined): Lang => (v === "es" ? "es" : "en");

const LangContext = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: string; children: ReactNode }) {
  return <LangContext.Provider value={normalizeLang(lang)}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

/** Select a screen's dictionary for the active language. */
export function pick<T>(lang: Lang, dict: Record<Lang, T>): T {
  return dict[lang] ?? dict.en;
}
