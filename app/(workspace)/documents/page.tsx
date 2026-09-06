"use client";

import { FileKey2 } from "lucide-react";
import { DocumentsManager } from "../../../components/documents-manager";
import { useLanguage } from "../../../components/language-provider";
import { PageHeader } from "../../../components/ui-shell";

export default function DocumentsPage() {
  const { t } = useLanguage();
  return (
    <>
      <PageHeader
        eyebrow={t("adminAction")}
        title={t("pageDocumentsTitle")}
        description={t("pageDocumentsLead")}
        actions={<span className="role-chip"><FileKey2 aria-hidden="true" />Admin</span>}
      />
      <DocumentsManager />
    </>
  );
}
