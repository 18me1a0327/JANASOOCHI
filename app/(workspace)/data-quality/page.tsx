"use client";

import { useLanguage } from "../../../components/language-provider";
import { DataQualityDashboard } from "../../../components/data-quality-dashboard";
import { PageHeader } from "../../../components/ui-shell";

export default function DataQualityPage() {
  const { t } = useLanguage();
  return (
    <>
      <PageHeader
        eyebrow={t("expectedRegister")}
        title={t("pageQualityTitle")}
        description={t("pageQualityLead")}
      />
      <DataQualityDashboard />
    </>
  );
}
