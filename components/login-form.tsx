"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { createClient, isSupabaseConfigured } from "../lib/supabase/client";
import { useLanguage } from "./language-provider";

export function LoginForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      setNotice("Supabase is not configured. Add the environment values before signing in.");
      return;
    }
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      const destination = searchParams.get("next");
      router.replace(destination?.startsWith("/") ? destination : "/search");
      router.refresh();
    } catch (error) {
      console.error("Sign-in failed", error);
      setNotice("Unable to sign in. Check the authorized email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label>
        <span>{t("email")}</span>
        <span className="input-with-icon">
          <Mail aria-hidden="true" />
          <input name="email" type="email" autoComplete="email" required />
        </span>
      </label>
      <label>
        <span>{t("password")}</span>
        <span className="input-with-icon">
          <LockKeyhole aria-hidden="true" />
          <input name="password" type="password" autoComplete="current-password" minLength={8} required />
        </span>
      </label>
      <button className="button primary large" type="submit" disabled={busy}>
        {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {busy ? "Signing in…" : t("signIn")}
      </button>
      {(notice || searchParams.get("error") === "configuration") && <p className="inline-notice" role="alert">{notice || "Supabase is not configured. Add the environment values before signing in."}</p>}
      <div className="protected-note">
        <ShieldCheck aria-hidden="true" />
        <span>{t("protectedNotice")}</span>
      </div>
    </form>
  );
}
