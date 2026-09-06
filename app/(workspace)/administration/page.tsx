"use client";

import { useLanguage } from "../../../components/language-provider";
import { AdminConsole } from "../../../components/admin-console";
import { PageHeader } from "../../../components/ui-shell";

export default function AdministrationPage() {
  const { t } = useLanguage();
  return (
    <>
      <PageHeader
        eyebrow={t("adminAction")}
        title={t("pageAdminTitle")}
        description={t("pageAdminLead")}
      />
      <AdminConsole />
    </>
  );
}
