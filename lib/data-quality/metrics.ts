export type CountValue = number | string | null | undefined;

export type QualitySummaryInput = {
  expected_slots: CountValue;
  active_logical_voters: CountValue;
  extracted_source_records: CountValue;
  linked_source_records: CountValue;
  missing_serials: CountValue;
  duplicate_serial_groups: CountValue;
  unexpected_serials: CountValue;
  duplicate_epic_groups: CountValue;
  expected_voter_cards: CountValue;
  extracted_voter_cards: CountValue;
  failed_pages: CountValue;
  partial_pages: CountValue;
  null_name_records: CountValue;
  null_relation_records: CountValue;
  null_house_records: CountValue;
  null_age_records: CountValue;
  null_epic_records: CountValue;
  reconciliation_conflicts: CountValue;
  critical_issues: CountValue;
  needs_review_issues: CountValue;
  informational_issues: CountValue;
  verified_logical_voters: CountValue;
  unverified_logical_voters: CountValue;
};

export type PartLanguageQualityInput = {
  part_number: number;
  source_language: "en" | "te" | "ur";
  expected_slots: CountValue;
  source_record_count: CountValue;
  linked_slot_count: CountValue;
  missing_slot_count: CountValue;
  unlinked_source_count: CountValue;
};

export type QualityBar = {
  key: string;
  value: number;
  total: number;
  percent: number;
};

export type QualityAnalytics = {
  expectedLogicalVoters: number;
  activeLogicalVoters: number;
  verifiedLogicalVoters: number;
  verifiedPercent: number;
  sourceRecordCount: number;
  sourceCoverage: QualityBar[];
  issueDistribution: QualityBar[];
  missingFieldRates: QualityBar[];
  goldenRevisionBlockers: string[];
};

export function count(value: CountValue): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function percent(value: CountValue, total: CountValue): number {
  const numerator = count(value);
  const denominator = count(total);
  if (!denominator) return 0;
  return Math.round(Math.min(100, (numerator / denominator) * 100) * 10) / 10;
}

function aggregateCoverage(
  rows: PartLanguageQualityInput[],
  language: "en" | "te",
  expectedLogicalVoters: number,
): QualityBar {
  const languageRows = rows.filter((row) => row.source_language === language);
  const value = languageRows.reduce((sum, row) => sum + count(row.linked_slot_count), 0);
  const total = expectedLogicalVoters;
  return { key: language, value, total, percent: percent(value, total) };
}

export function buildQualityAnalytics(
  summary: QualitySummaryInput | null,
  rows: PartLanguageQualityInput[],
): QualityAnalytics {
  const expected = count(summary?.expected_slots);
  const active = count(summary?.active_logical_voters);
  const verified = count(summary?.verified_logical_voters);
  const sourceRecords = count(summary?.extracted_source_records);
  const sourceCoverage = [
    aggregateCoverage(rows, "en", expected),
    aggregateCoverage(rows, "te", expected),
  ];

  const critical = count(summary?.critical_issues);
  const review = count(summary?.needs_review_issues);
  const informational = count(summary?.informational_issues);
  const issueTotal = critical + review + informational;
  const issueDistribution = [
    { key: "critical", value: critical, total: issueTotal, percent: percent(critical, issueTotal) },
    { key: "needs_review", value: review, total: issueTotal, percent: percent(review, issueTotal) },
    { key: "informational", value: informational, total: issueTotal, percent: percent(informational, issueTotal) },
  ];

  const missingFieldRates = [
    ["name", summary?.null_name_records],
    ["relation", summary?.null_relation_records],
    ["house", summary?.null_house_records],
    ["age", summary?.null_age_records],
    ["epic", summary?.null_epic_records],
  ].map(([key, value]) => ({
    key: String(key),
    value: count(value),
    total: sourceRecords,
    percent: percent(value, sourceRecords),
  }));

  const blockers: string[] = [];
  if (!expected || active !== expected) blockers.push("logical_structure_incomplete");
  for (const coverage of sourceCoverage) {
    if (!coverage.total || coverage.value !== expected) {
      blockers.push(`${coverage.key}_source_incomplete`);
    }
  }
  if (count(summary?.missing_serials)) blockers.push("missing_serials");
  if (count(summary?.duplicate_serial_groups)) blockers.push("duplicate_serials");
  if (count(summary?.unexpected_serials)) blockers.push("unexpected_serials");
  if (count(summary?.duplicate_epic_groups)) blockers.push("duplicate_epics");
  if (count(summary?.failed_pages)) blockers.push("failed_pages");
  if (count(summary?.partial_pages)) blockers.push("partial_pages");
  if (count(summary?.reconciliation_conflicts)) blockers.push("reconciliation_conflicts");
  if (critical) blockers.push("critical_issues");
  if (!expected || verified !== expected) blockers.push("verification_incomplete");

  return {
    expectedLogicalVoters: expected,
    activeLogicalVoters: active,
    verifiedLogicalVoters: verified,
    verifiedPercent: percent(verified, expected),
    sourceRecordCount: sourceRecords,
    sourceCoverage,
    issueDistribution,
    missingFieldRates,
    goldenRevisionBlockers: blockers,
  };
}

