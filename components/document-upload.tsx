"use client";

import { useRef, useState } from "react";
import { FileCheck2, UploadCloud, X } from "lucide-react";
import { useLanguage } from "./language-provider";

export function DocumentUpload() {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");

  function chooseFile(selected: File | undefined) {
    if (!selected) return;
    if (selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) {
      setFile(null);
      setNotice(t("invalidPdf"));
      return;
    }
    setFile(selected);
    setNotice("");
  }

  function clearFile() {
    setFile(null);
    setNotice("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="document-upload">
      <button className="drop-zone" type="button" onClick={() => inputRef.current?.click()}>
        <UploadCloud aria-hidden="true" />
        <strong>{t("uploadPdf")}</strong>
        <span>{t("pdfOnly")}</span>
      </button>
      <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => chooseFile(event.target.files?.[0])} />
      <div className="selected-document" aria-live="polite">
        <FileCheck2 aria-hidden="true" />
        <span><small>{t("selectedFile")}</small><strong>{file?.name ?? t("noFileSelected")}</strong></span>
        {file && <button type="button" aria-label="Remove selected file" onClick={clearFile}><X aria-hidden="true" /></button>}
      </div>
      <button className="button primary" type="button" disabled={!file} onClick={() => setNotice(t("uploadReady"))}>{t("uploadAndValidate")}</button>
      {notice && <p className="inline-notice" role="status">{notice}</p>}
    </div>
  );
}
