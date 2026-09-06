"use client";

import { Languages } from "lucide-react";
import { useLanguage, type UiLanguage } from "./language-provider";

const OPTIONS: ReadonlyArray<{ code: UiLanguage; short: string }> = [
  { code: "en", short: "EN" },
  { code: "te", short: "తె" },
  { code: "ur", short: "اردو" },
];

export function LanguageSwitcher({ compact = false }: Readonly<{ compact?: boolean }>) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={`language-switcher${compact ? " is-compact" : ""}`} aria-label={t("languageLabel")}>
      {!compact && <Languages aria-hidden="true" />}
      {OPTIONS.map((option) => (
        <button
          type="button"
          key={option.code}
          className={language === option.code ? "is-active" : undefined}
          aria-pressed={language === option.code}
          aria-label={option.code === "en" ? t("english") : option.code === "te" ? t("telugu") : t("urdu")}
          onClick={() => setLanguage(option.code)}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}
