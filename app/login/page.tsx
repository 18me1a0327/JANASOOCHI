"use client";

import { BookOpenCheck, LockKeyhole } from "lucide-react";
import { Suspense } from "react";
import { LanguageSwitcher } from "../../components/language-switcher";
import { LoginForm } from "../../components/login-form";
import { useLanguage } from "../../components/language-provider";

export default function LoginPage() {
  const { t } = useLanguage();

  return (
    <main className="login-page">
      <div className="login-language"><LanguageSwitcher /></div>
      <section className="login-shell" aria-labelledby="login-title">
        <aside className="login-brand-panel">
          <div className="login-brand">
            <img src="/janasoochi-logo-800.png" alt="జనసూచి — JANASOOCHI" />
          </div>
          <div className="login-scope">
            <BookOpenCheck aria-hidden="true" />
            <div>
              <strong>{t("canonicalCount")}</strong>
              <span>{t("partsScope")}</span>
            </div>
          </div>
        </aside>
        <div className="login-card">
          <span className="secure-kicker"><LockKeyhole aria-hidden="true" />{t("authorizedOnly")}</span>
          <h1 id="login-title">{t("loginTitle")}</h1>
          <p>{t("loginLead")}</p>
          <Suspense fallback={<p className="inline-notice">Loading secure sign-in…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
