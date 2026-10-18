import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AppData } from "../src/types/data";
import { cohortRows, initialFilters, merchantViews, retentionSummary, rootCauseRows, rowsByMonth } from "../src/utils/metrics";

const appData = JSON.parse(readFileSync(resolve("public/data/generatedData.json"), "utf8")) as AppData;

const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const merchants = merchantViews(appData, initialFilters);
const summary = retentionSummary(merchants);
const delayed = merchants.find((merchant) => merchant.merchant_id === "M187");

assert(merchants.length === 308, "Expected exactly 308 merchants");
assert(Boolean(delayed), "Expected delayed-activation merchant M187");
assert(!delayed!.eligible_for_3m_retention, "M187 must not qualify for activation-based retention after a 48-day first transaction");
assert(summary.m3.numerator <= summary.m3.denominator, "M3 retained merchants cannot exceed eligible merchants");
assert(summary.m6.numerator <= summary.m6.denominator, "M6 retained merchants cannot exceed eligible merchants");
assert(summary.primary.numerator <= summary.primary.denominator, "Primary-channel conversion cannot exceed eligible merchants");
assert(merchants.filter((merchant) => !merchant.eligible_for_final_outcome).every((merchant) => merchant.outcome.final_usage_status !== "Churned"), "Right-censored merchants must not be Stopped Using");
assert(cohortRows(merchants).filter((cohort) => cohort.month >= "2025-10").every((cohort) => cohort.m6.value === null), "Recent cohorts must show N/A for M6 retention");
assert(summary.stopped.denominator === merchants.filter((merchant) => merchant.eligible_for_final_outcome).length, "Stopped-use denominator must use final-outcome eligibility");
assert(rootCauseRows(merchants).reduce((sum, cause) => sum + cause.value, 0) === summary.stopped.numerator, "Primary root causes must sum to observed Stopped Using merchants");
const cohortTotals = cohortRows(merchants).reduce((totals, cohort) => ({ m3Numerator: totals.m3Numerator + cohort.m3.numerator, m3Denominator: totals.m3Denominator + cohort.m3.denominator, m6Numerator: totals.m6Numerator + cohort.m6.numerator, m6Denominator: totals.m6Denominator + cohort.m6.denominator }), { m3Numerator: 0, m3Denominator: 0, m6Numerator: 0, m6Denominator: 0 });
assert(cohortTotals.m3Numerator === summary.m3.numerator && cohortTotals.m3Denominator === summary.m3.denominator, "Portfolio M3 KPI must equal merchant-weighted cohort aggregation");
assert(cohortTotals.m6Numerator === summary.m6.numerator && cohortTotals.m6Denominator === summary.m6.denominator, "Portfolio M6 KPI must equal merchant-weighted cohort aggregation");
const stoppedUsing = merchants.filter((merchant) => merchant.eligible_for_final_outcome && merchant.outcome.final_usage_status === "Churned");
const contributingCounts = [
  stoppedUsing.filter((merchant) => merchant.pricing.pricing_expectation_gap > 0).length,
  stoppedUsing.filter((merchant) => merchant.pricing.affected_by_rate_change && !merchant.pricing.merchant_understood_rate_change).length,
  stoppedUsing.filter((merchant) => merchant.outcome.promotion_driven_tag).length,
  stoppedUsing.filter((merchant) => merchant.primary_channel_before === "WeChat Pay").length,
  stoppedUsing.filter((merchant) => merchant.settlement_account_usage === "Rarely Used, Requires Transfer Out").length,
  stoppedUsing.filter((merchant) => merchant.outcome.speaker_issue_count > 0).length
];
assert(contributingCounts.every((count) => count <= summary.stopped.numerator), "Contributing-factor counts cannot exceed observed Stopped Using merchants");
assert(rowsByMonth(merchants).reduce((sum, row) => sum + row.onboarded, 0) === 308, "Monthly onboarding must sum to 308");
assert(appData.monthlyUsage.every((row) => row.merchant_age_month >= 0), "Merchant lifecycle age must be non-negative");

console.log(`Retention validation passed. Activation ${summary.activation.numerator}/${summary.activation.denominator}; M3 ${summary.m3.numerator}/${summary.m3.denominator}; M6 ${summary.m6.numerator}/${summary.m6.denominator}; Stopped use ${summary.stopped.numerator}/${summary.stopped.denominator}.`);
