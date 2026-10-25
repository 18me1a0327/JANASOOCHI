"use client";

import { Languages, ShieldCheck } from "lucide-react";
import { useLanguage } from "../../../components/language-provider";
import { VoterSearch } from "../../../components/voter-search";
import { MetricCard, PageHeader } from "../../../components/ui-shell";

export default function SearchPage() {
  const { t } = useLanguage();
  return (
    <>
      <PageHeader eyebrow={t("partsScope")} title={t("pageSearchTitle")} description={t("pageSearchLead")} />
      <div className="metric-grid metric-grid-compact">
        <MetricCard label="Pilot logical slots" value="3,454" note="Parts 227-230 reference scope" tone="positive" />
        <MetricCard label="Statewide geography" value="25 PCs · 175 ACs" note="Select a verified Part to query records" />
        <MetricCard label={t("sourceLanguage")} value="EN · TE · UR" note={t("resultLanguageRule")} />
      </div>
      <VoterSearch />
      <div className="assurance-strip">
        <span><ShieldCheck aria-hidden="true" />Exact source evidence</span>
        <span><Languages aria-hidden="true" />{t("resultLanguageRule")}</span>
      </div>
    </>
  );
}
