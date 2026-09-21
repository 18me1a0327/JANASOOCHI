"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  Database,
  FileSearch,
  Files,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { LanguageSwitcher } from "./language-switcher";
import { useLanguage, type TranslationKey } from "./language-provider";

const NAV_ITEMS = [
  { href: "/search", label: "navSearch" as TranslationKey, icon: Search, adminOnly: false },
  { href: "/documents", label: "navDocuments" as TranslationKey, icon: Files, adminOnly: false },
  { href: "/review", label: "navReview" as TranslationKey, icon: FileSearch, adminOnly: true },
  { href: "/data-quality", label: "navDataQuality" as TranslationKey, icon: ShieldCheck, adminOnly: true },
  { href: "/data-insights", label: "navDataInsights" as TranslationKey, icon: BarChart3, adminOnly: true },
  { href: "/administration", label: "navAdministration" as TranslationKey, icon: Users, adminOnly: true },
] as const;

export function AppShell({ children, role, email }: Readonly<{ children: ReactNode; role: "admin" | "viewer"; email: string }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setMobileMenuOpen(false), [pathname]);

  const visibleItems = useMemo(() => NAV_ITEMS.filter((item) => role === "admin" || !item.adminOnly), [role]);
  const activeItem = useMemo(
    () => visibleItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? visibleItems[0],
    [pathname, visibleItems],
  );

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className={`application-shell${collapsed ? " nav-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      {mobileMenuOpen && (
        <button
          className="navigation-scrim"
          type="button"
          aria-label={t("closeMenu")}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`side-navigation${mobileMenuOpen ? " is-open" : ""}`} aria-label="Primary navigation">
        <Link className="side-brand" href="/search">
          <img src="/janasoochi-logo-2026-512.png" width="48" height="48" alt="" />
          <span>
            <b>{t("brandNative")}</b>
            <strong>{t("brandName")}</strong>
          </span>
        </Link>

        <div className="workspace-identity">
          <Database aria-hidden="true" />
          <span>
            <b>{t("personalWorkspace")}</b>
            <small>{email || t("partsScope")}</small>
          </span>
        </div>

        <nav>
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} href={href} key={href}>
                <Icon aria-hidden="true" />
                <span>{t(label)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="side-navigation-footer">
          <Link href="/profile">
            <UserCircle aria-hidden="true" />
            <span>Profile</span>
          </Link>
          <button type="button" onClick={signOut}>
            <LogOut aria-hidden="true" />
            <span>{t("logout")}</span>
          </button>
          <button type="button" className="collapse-navigation" onClick={() => setCollapsed((value) => !value)}>
            <ChevronLeft aria-hidden="true" />
            <span>Collapse menu</span>
          </button>
        </div>
      </aside>

      <div className="application-main">
        <header className="top-header">
          <button
            className="mobile-menu-button"
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? t("closeMenu") : t("openMenu")}
            onClick={() => setMobileMenuOpen((value) => !value)}
          >
            {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <Link className="mobile-brand" href="/search" aria-label={`${t("brandNative")} ${t("brandName")}`}>
            <img src="/janasoochi-logo-2026-512.png" width="40" height="40" alt="" />
          </Link>
          <div className="route-context">
            <activeItem.icon aria-hidden="true" />
            <div>
              <strong>{t(activeItem.label)}</strong>
              <small>{t("partsScope")}</small>
            </div>
          </div>
          <div className="header-actions">
            <span className="role-chip">{role === "admin" ? "Admin" : "Viewer"}</span>
            <div className="canonical-chip">
              <ShieldCheck aria-hidden="true" />
              <span>{t("canonicalCount")}</span>
            </div>
            <LanguageSwitcher compact />
          </div>
        </header>

        <main id="main-content" className="workspace-main" tabIndex={-1}>
          {language === "ur" && (
            <section className="urdu-blocked-banner" role="status">
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>{t("urduBlockedTitle")}</strong>
                <p>{t("urduBlockedMessage")}</p>
              </div>
            </section>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
