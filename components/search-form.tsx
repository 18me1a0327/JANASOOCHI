"use client";

import { useMemo, useState, type FormEvent } from "react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useLanguage } from "./language-provider";

const EMPTY_FILTERS = {
  part: "",
  name: "",
  relationName: "",
  relationType: "",
  houseNumber: "",
  age: "",
  gender: "",
  epic: "",
  serial: "",
};

type FilterState = typeof EMPTY_FILTERS;

export function SearchForm() {
  const { language, t } = useLanguage();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [notice, setNotice] = useState("");
  const populatedFilters = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(t("searchReady"));
  }

  function reset() {
    setFilters(EMPTY_FILTERS);
    setNotice("");
  }

  return (
    <form className="search-form" onSubmit={submit} onReset={reset}>
      <div className="filter-heading">
        <span><SlidersHorizontal aria-hidden="true" />{populatedFilters} active</span>
        <div className="search-help"><span>{t("exactMatchHelp")}</span><span>{t("fuzzyMatchHelp")}</span></div>
      </div>
      <div className="filter-grid">
        <label>
          <span>{t("sourceLanguage")}</span>
          <select value={language} disabled aria-readonly="true">
            <option value="en">{t("englishSource")}</option>
            <option value="te">{t("teluguSource")}</option>
            <option value="ur">{t("urduSource")}</option>
          </select>
        </label>
        <label>
          <span>{t("part")}</span>
          <select value={filters.part} onChange={(event) => updateFilter("part", event.target.value)}>
            <option value="">{t("allSupportedParts")}</option>
            <option value="227">227</option><option value="228">228</option><option value="229">229</option><option value="230">230</option>
          </select>
        </label>
        <label className="span-two">
          <span>{t("name")}</span>
          <input value={filters.name} onChange={(event) => updateFilter("name", event.target.value)} autoComplete="off" />
        </label>
        <label className="span-two">
          <span>{t("relationName")}</span>
          <input value={filters.relationName} onChange={(event) => updateFilter("relationName", event.target.value)} autoComplete="off" />
        </label>
        <label>
          <span>{t("relationType")}</span>
          <select value={filters.relationType} onChange={(event) => updateFilter("relationType", event.target.value)}>
            <option value="">{t("allRelationTypes")}</option>
            <option value="father">{t("father")}</option><option value="mother">{t("mother")}</option><option value="husband">{t("husband")}</option><option value="guardian">{t("guardian")}</option><option value="other">{t("other")}</option><option value="unknown">{t("unknown")}</option>
          </select>
        </label>
        <label>
          <span>{t("houseNumber")}</span>
          <input value={filters.houseNumber} onChange={(event) => updateFilter("houseNumber", event.target.value)} autoComplete="off" />
        </label>
        <label>
          <span>{t("age")}</span>
          <input value={filters.age} onChange={(event) => updateFilter("age", event.target.value)} inputMode="numeric" pattern="[0-9]*" />
        </label>
        <label>
          <span>{t("gender")}</span>
          <select value={filters.gender} onChange={(event) => updateFilter("gender", event.target.value)}>
            <option value="">{t("allGenders")}</option>
            <option value="male">{t("male")}</option><option value="female">{t("female")}</option><option value="third_gender">{t("thirdGender")}</option>
          </select>
        </label>
        <label>
          <span>{t("epic")}</span>
          <input value={filters.epic} onChange={(event) => updateFilter("epic", event.target.value.toUpperCase())} autoCapitalize="characters" />
        </label>
        <label>
          <span>{t("serial")}</span>
          <input value={filters.serial} onChange={(event) => updateFilter("serial", event.target.value)} inputMode="numeric" pattern="[0-9]*" />
        </label>
      </div>
      <div className="form-actions">
        <button className="button secondary" type="reset"><RotateCcw aria-hidden="true" />{t("clearFilters")}</button>
        <button className="button primary" type="submit"><Search aria-hidden="true" />{t("searchButton")}</button>
      </div>
      {notice && <p className="inline-notice" role="status">{notice}</p>}
    </form>
  );
}
