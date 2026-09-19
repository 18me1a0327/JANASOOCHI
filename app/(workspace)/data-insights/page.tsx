"use client";

import { DataQualityDashboard } from "../../../components/data-quality-dashboard";
import { useLanguage } from "../../../components/language-provider";
import { PageHeader } from "../../../components/ui-shell";

export default function DataInsightsPage() {
  const { t } = useLanguage();
  return <><PageHeader eyebrow={t("expectedRegister")} title={t("pageQualityTitle")} description={t("pageQualityLead")} /><DataQualityDashboard /></>;
}

