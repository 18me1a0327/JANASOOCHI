import { describe, expect, it } from "vitest";

import {
  buildQualityAnalytics,
  percent,
  type PartLanguageQualityInput,
  type QualitySummaryInput,
} from "./metrics";

const summary: QualitySummaryInput = {
  expected_slots: 3454,
  active_logical_voters: 3454,
  extracted_source_records: 6727,
  linked_source_records: 5142,
  missing_serials: 0,
  duplicate_serial_groups: 0,
  unexpected_serials: 0,
  duplicate_epic_groups: 0,
  expected_voter_cards: 0,
  extracted_voter_cards: 0,
  failed_pages: 0,
  partial_pages: 0,
  null_name_records: 67,
  null_relation_records: 0,
  null_house_records: 0,
  null_age_records: 0,
  null_epic_records: 0,
  reconciliation_conflicts: 0,
  critical_issues: 10,
  needs_review_issues: 20,
  informational_issues: 70,
  verified_logical_voters: 0,
  unverified_logical_voters: 3454,
};

const coverage: PartLanguageQualityInput[] = [
  { part_number: 227, source_language: "en", expected_slots: 1014, source_record_count: 1014, linked_slot_count: 1014, missing_slot_count: 0, unlinked_source_count: 0 },
  { part_number: 227, source_language: "te", expected_slots: 1014, source_record_count: 900, linked_slot_count: 900, missing_slot_count: 114, unlinked_source_count: 0 },
];

describe("Phase 4 data-quality analytics", () => {
  it("calculates stable percentages and handles empty denominators", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(1, 0)).toBe(0);
    expect(percent(5, 4)).toBe(100);
  });

  it("does not count EN and TE source representations as extra logical voters", () => {
    const analytics = buildQualityAnalytics(summary, coverage);
    expect(analytics.expectedLogicalVoters).toBe(3454);
    expect(analytics.sourceRecordCount).toBe(6727);
  });

  it("calculates coverage independently for each source language", () => {
    const analytics = buildQualityAnalytics(
      {
        ...summary,
        expected_slots: 1014,
        active_logical_voters: 1014,
        unverified_logical_voters: 1014,
      },
      coverage,
    );
    expect(analytics.sourceCoverage[0]).toMatchObject({ key: "en", percent: 100 });
    expect(analytics.sourceCoverage[1]).toMatchObject({ key: "te", percent: 88.8 });
  });

  it("includes every issue in the distribution denominator", () => {
    const analytics = buildQualityAnalytics(summary, coverage);
    expect(analytics.issueDistribution.map((item) => item.percent)).toEqual([10, 20, 70]);
  });

  it("reports explicit Golden Revision blockers without inventing readiness", () => {
    const analytics = buildQualityAnalytics({
      ...summary,
      duplicate_epic_groups: 2,
      failed_pages: 1,
      partial_pages: 3,
    }, coverage);
    expect(analytics.goldenRevisionBlockers).toContain("te_source_incomplete");
    expect(analytics.goldenRevisionBlockers).toContain("duplicate_epics");
    expect(analytics.goldenRevisionBlockers).toContain("failed_pages");
    expect(analytics.goldenRevisionBlockers).toContain("partial_pages");
    expect(analytics.goldenRevisionBlockers).toContain("critical_issues");
    expect(analytics.goldenRevisionBlockers).toContain("verification_incomplete");
    expect(analytics.verifiedPercent).toBe(0);
  });

  it("allows readiness only for complete EN/TE coverage and verification", () => {
    const readySummary = {
      ...summary,
      expected_slots: 1014,
      active_logical_voters: 1014,
      critical_issues: 0,
      verified_logical_voters: 1014,
      unverified_logical_voters: 0,
    };
    const readyRows = coverage.map((row) => ({
      ...row,
      source_record_count: row.expected_slots,
      linked_slot_count: row.expected_slots,
      missing_slot_count: 0,
    }));
    expect(buildQualityAnalytics(readySummary, readyRows).goldenRevisionBlockers).toEqual([]);
  });
});

