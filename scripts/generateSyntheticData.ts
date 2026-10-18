import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRICING_REGIMES, SYNTHETIC_EXCESS_RATE, pricingRegimeForMonth, totalFreeTransactionAllowance } from "../src/config/pricingRegimes";
import type { AppData, FinalStatus, MerchantMaster, MerchantOutcome, MerchantPricingProfile, MonthlyUsage, OnboardingRecord, Priority, SupportRecord } from "../src/types/data";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../src/data/generatedData.ts");
const PORTFOLIO_START = new Date(2024, 0, 1);
const PORTFOLIO_END = new Date(2025, 11, 31);
const PORTFOLIO_MONTHS = 24;

let seed = 20260724;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)];
const bool = (p: number) => rand() < p;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const pct = (value: number) => Number(value.toFixed(4));
const monthDate = (offset: number) => new Date(PORTFOLIO_START.getFullYear(), PORTFOLIO_START.getMonth() + offset, 1);

const industries = [...Array(99).fill("Catering"), ...Array(132).fill("Fruit Retail & Wholesale"), ...Array(9).fill("Education & Training"), ...Array(25).fill("Apparel & Daily Goods"), ...Array(22).fill("Pharmacy"), ...Array(21).fill("Other")].sort(() => rand() - 0.5);
const sizes = [...Array(52).fill("Micro"), ...Array(247).fill("Small"), ...Array(9).fill("Medium")].sort(() => rand() - 0.5) as MerchantMaster["merchant_size"][];
const onboardingMonthCounts = [31, 25, 23, 17, 12, 8, 11, 7, 10, 8, 12, 9, 7, 11, 8, 10, 6, 12, 7, 9, 11, 8, 24, 22];
const onboardingOffsets = onboardingMonthCounts.flatMap((count, offset) => Array(count).fill(offset)).sort(() => rand() - 0.5);
const eligibleStatuses = [...Array(154).fill("Churned"), ...Array(42).fill("Primary User"), ...Array(17).fill("Secondary User"), ...Array(14).fill("Backup User")].sort(() => rand() - 0.5) as FinalStatus[];
const churnAges = [...Array(32).fill(3), ...Array(44).fill(4), ...Array(48).fill(5), ...Array(36).fill(6)].sort(() => rand() - 0.5) as number[];

const districts = ["Shenhe District", "Dadong District"];
const areas = ["Shenhe Core", "Dadong Market", "Near Dongling Road", "Near Dongmao Road"];
const settlementOptions = ["Primary Operating Account", "Occasional Use", "Rarely Used, Requires Transfer Out"];
const speakerIssues = ["None", "Speaker No Broadcast", "Speaker Broadcast Delay", "Speaker Disconnected", "Speaker Rebinding Required"];
const settlementQueries = ["None", "Settlement Timing Inquiry", "Weekend Settlement Query", "Cannot Locate Receipt", "Unsure Which Account Received Funds"];
const rootCauses = ["Pricing Increase", "Pricing Expectation Gap", "Rate Notification Not Understood", "Promotion Ended", "Existing WeChat Habit", "Settlement Account Inconvenience", "Repeated Speaker Failure", "Settlement Information Uncertainty", "Bank QR Remained Non-primary"];
const pricingChurnTypes = ["Rate-sensitive Churn", "Promotion-to-Standard-Rate Churn", "Delayed-use Pricing Shock", "Communication-gap Churn", "Multi-factor Churn"];

function campaignForOffset(offset: number) {
  if (offset >= 0 && offset <= 2) return { period: "2024_Q1", name: "2024 Q1 Merchant Acquisition Campaign", isCampaign: true };
  if (offset >= 22 && offset <= 23) return { period: "2025_YE", name: "2025 Year-end Merchant Acquisition Campaign", isCampaign: true };
  return { period: "Non-campaign", name: "Business-as-usual onboarding", isCampaign: false };
}

function seasonalityFor(industry: string, month: number) {
  const fruitPeak = industry.includes("Fruit") && [12, 1, 2, 3].includes(month);
  const cateringPreHoliday = industry === "Catering" && [1, 2, 9].includes(month);
  const cateringPostHoliday = industry === "Catering" && month === 3;
  return { peak: fruitPeak, multiplier: fruitPeak ? 1.62 : cateringPreHoliday ? 1.14 : cateringPostHoliday ? 1.06 : 1, preHoliday: fruitPeak || cateringPreHoliday, postHoliday: cateringPostHoliday };
}

const makeId = (index: number) => `M${String(index).padStart(3, "0")}`;
const chooseDistance = (status: FinalStatus) => { const nearBias = status === "Primary User" ? 0.72 : 0.36; if (bool(nearBias)) return Number((0.3 + rand() * 1.7).toFixed(1)); if (bool(0.45)) return Number((2.1 + rand() * 2.9).toFixed(1)); return Number((5.1 + rand() * 5.5).toFixed(1)); };
const proximity = (distance: number): MerchantMaster["branch_proximity"] => distance <= 2 ? "Near" : distance <= 5 ? "Medium" : "Far";
const primaryBefore = () => { const r = rand(); return r < 0.84 ? "WeChat Pay" : r < 0.95 ? "Alipay" : "Other Bank QR"; };
function actionFor(root: string) { if (root.includes("Pricing")) return "Pricing clarification and signed rate acknowledgement"; if (root.includes("Rate Notification")) return "Rate-change acknowledgement follow-up"; if (root.includes("Speaker")) return "Speaker replacement and on-site verification"; if (root.includes("Settlement")) return "Settlement account walkthrough"; if (root.includes("Promotion")) return "Post-promotion value review"; if (root.includes("WeChat")) return "Alternative-channel migration coaching"; return "Low-intent exit or light-touch monitoring"; }

const masters: MerchantMaster[] = [];
const onboardings: OnboardingRecord[] = [];
const monthly: MonthlyUsage[] = [];
const supports: SupportRecord[] = [];
const pricing: MerchantPricingProfile[] = [];
const outcomes: MerchantOutcome[] = [];
let statusIndex = 0;
let churnIndex = 0;

for (let index = 1; index <= 308; index += 1) {
  const id = makeId(index);
  const onboardingOffset = onboardingOffsets[index - 1];
  const onboardingDate = addDays(monthDate(onboardingOffset), Math.floor(rand() * 24));
  const onboardingMonth = monthKey(onboardingDate);
  const observableMonths = PORTFOLIO_MONTHS - onboardingOffset;
  const activationDate = addDays(onboardingDate, pick([1, 2, 3, 4]));
  const firstTxDate = id === "M187" ? addDays(onboardingDate, 48) : addDays(activationDate, pick([1, 2, 3, 5, 8]));
  const activationDaysAfterOnboarding = Math.round((firstTxDate.getTime() - onboardingDate.getTime()) / 86400000);
  const daysObservableAfterFirstTransaction = Math.floor((PORTFOLIO_END.getTime() - firstTxDate.getTime()) / 86400000);
  const eligible30dActivation = daysObservableAfterFirstTransaction >= 30;
  const eligible3m = activationDaysAfterOnboarding <= 30 && daysObservableAfterFirstTransaction >= 90 && observableMonths > 3;
  const eligible6m = activationDaysAfterOnboarding <= 30 && daysObservableAfterFirstTransaction >= 180 && observableMonths > 6;
  const eligiblePrimaryConversion = observableMonths > 3;
  const eligibleFinalOutcome = observableMonths > 6;
  const rightCensored = !eligibleFinalOutcome;
  const status: FinalStatus = rightCensored ? "Insufficient Observation" : id === "M187" ? "Churned" : eligibleStatuses[statusIndex++];
  const churnMonth = status === "Churned" ? id === "M187" ? 5 : churnAges[churnIndex++ % churnAges.length] : null;
  const industry = industries[index - 1];
  const campaign = campaignForOffset(onboardingOffset);
  const merchantSize = sizes[index - 1];
  const distance = chooseDistance(status);
  const branchProximity = proximity(distance);
  const settlement = status === "Primary User" && bool(0.7) ? "Primary Operating Account" : pick(settlementOptions);
  const accountScore = settlement === "Primary Operating Account" ? 78 + rand() * 20 : settlement === "Occasional Use" ? 45 + rand() * 30 : 18 + rand() * 30;
  const campaignDrivenOnboarding = campaign.isCampaign && bool(onboardingOffset <= 2 ? 0.58 : 0.62);
  const promotionOrGiftMotivated = campaign.isCampaign ? bool(0.50) : bool(0.23);
  const promotionDriven = campaignDrivenOnboarding || promotionOrGiftMotivated || (id === "M187") || bool(status === "Churned" ? 0.38 : 0.16);
  const onboardingQualityScore = Math.round(clamp((campaignDrivenOnboarding ? 48 : 72) + (promotionOrGiftMotivated ? -12 : 8) + (rand() - 0.5) * 28, 20, 96));
  const observedRegimes = new Set(Array.from({ length: observableMonths }, (_, age) => pricingRegimeForMonth(monthKey(monthDate(onboardingOffset + age))).id));
  const affectedByRate = observedRegimes.size > 1;
  const sensitivityBase = industry.includes("Fruit") || industry === "Catering" ? 2 : 1;
  const rateSensitivity = clamp(Math.round(sensitivityBase + (merchantSize === "Medium" ? 1 : 0) + rand() * 3), 1, 5);
  const merchantNotificationReceived = affectedByRate && bool(branchProximity === "Near" ? 0.74 : 0.55);
  const merchantNotificationAck = merchantNotificationReceived && bool(0.72 - rateSensitivity * 0.06);
  const merchantUnderstood = merchantNotificationAck && bool(0.78);
  const followUpAnswered = id === "M187" ? false : bool(branchProximity === "Near" ? 0.78 : 0.56);
  const expectedRate = id === "M187" ? 0.0015 : promotionDriven ? 0.0015 : 0.002;
  const currentRate = pricingRegimeForMonth(monthKey(monthDate(onboardingOffset + observableMonths - 1))).flatRate || SYNTHETIC_EXCESS_RATE;
  const pricingGap = pct(currentRate - expectedRate);
  const pricingComplaint = id === "M187" || (affectedByRate && bool(status === "Churned" ? 0.48 : 0.16));
  const pricingRelatedChurn = status === "Churned" && bool(0.68);
  const root = id === "M187" ? "Pricing Expectation Gap" : pricingRelatedChurn ? pick(["Pricing Increase", "Pricing Expectation Gap", "Rate Notification Not Understood"]) : pick(rootCauses.slice(3));
  const priority: Priority = status === "Primary User" ? "Low" : pricingRelatedChurn || pricingComplaint || branchProximity === "Near" ? "High" : "Medium";
  const finalShare = status === "Primary User" ? 0.58 + rand() * 0.25 : status === "Secondary User" ? 0.22 + rand() * 0.2 : status === "Backup User" ? 0.04 + rand() * 0.11 : status === "Churned" ? rand() * 0.04 : 0.08 + rand() * 0.12;
  const promoMonths = promotionDriven ? pick([2, 3]) : 1;
  const applicationDate = addDays(onboardingDate, -pick([2, 3, 4]));
  const promotionEnd = addDays(onboardingDate, promoMonths * 30);
  const complaintDate = pricingComplaint ? addDays(onboardingDate, Math.min(115 + Math.floor(rand() * 35), Math.max(20, observableMonths * 28))) : null;
  const depositBase = (industry.includes("Fruit") ? 70000 : industry === "Catering" ? 50000 : 35000) * (merchantSize === "Medium" ? 2.2 : merchantSize === "Small" ? 1.15 : 0.65);
  const pricingResponseMode = pick(["Immediate", "Delayed one month", "Delayed two months", "No material response", "Temporary decline and recovery"]);

  masters.push({ merchant_id: id, synthetic_merchant_name: `Synthetic Merchant ${id}`, district: pick(districts), area: pick(areas), distance_to_branch_km: distance, branch_proximity: branchProximity, industry, merchant_size: merchantSize, onboarding_date: iso(onboardingDate), onboarding_month: onboardingMonth, observation_end_date: iso(PORTFOLIO_END), observable_months: observableMonths, eligible_for_30d_activation: eligible30dActivation, eligible_for_3m_retention: eligible3m, eligible_for_6m_retention: eligible6m, eligible_for_primary_conversion: eligiblePrimaryConversion, eligible_for_final_outcome: eligibleFinalOutcome, right_censored: rightCensored, relationship_manager: "RM01", rm_wechat_available: true, existing_wechat_qr: true, existing_alipay_qr: bool(0.94), existing_other_bank_qr: bool(0.42), primary_channel_before: primaryBefore(), settlement_account_usage: settlement, account_match_score: Math.round(accountScore), business_status: "Operating", synthetic_flag: true });
  onboardings.push({ merchant_id: id, application_date: iso(applicationDate), approval_date: iso(addDays(applicationDate, 1)), qr_activated_date: iso(activationDate), speaker_installed: bool(0.88), training_completed: true, test_transaction_completed: true, first_real_transaction_date: iso(firstTxDate), activation_days: Math.max(1, Math.round((firstTxDate.getTime() - applicationDate.getTime()) / 86400000)), promotion_enrolled: promotionDriven, promotion_duration_months: promoMonths, first_follow_up_date: iso(addDays(firstTxDate, 7)), follow_up_count: 2 + Math.floor(rand() * 5), onboarding_status: "Activated", campaign_period: campaign.period, campaign_name: campaign.name, campaign_driven_onboarding: campaignDrivenOnboarding, promotion_or_gift_motivated: promotionOrGiftMotivated, onboarding_quality_score: onboardingQualityScore });
  pricing.push({ merchant_id: id, onboarding_rate: expectedRate, promotional_rate: expectedRate, expected_rate: expectedRate, current_applied_rate: currentRate, rate_change_count_since_onboarding: Math.max(0, observedRegimes.size - 1), first_rate_change_date: affectedByRate ? PRICING_REGIMES.find((regime) => regime.startDate > iso(onboardingDate))?.startDate ?? null : null, second_rate_change_date: null, promotion_end_date: iso(promotionEnd), rate_notification_sent: affectedByRate, notification_channel: affectedByRate ? pick(["WeChat Service Message", "SMS", "RM Phone Follow-up", "In-app Notice"]) : "Not Applicable", notification_received: merchantNotificationReceived, notification_acknowledged: merchantNotificationAck, merchant_understood_rate_change: merchantUnderstood, follow_up_call_answered: followUpAnswered, pricing_expectation_gap: pricingGap, pricing_complaint: pricingComplaint, pricing_complaint_date: complaintDate ? iso(complaintDate) : null, complaint_resolved: pricingComplaint && bool(0.48), pricing_related_churn: pricingRelatedChurn, rate_sensitivity_score: id === "M187" ? 5 : rateSensitivity, affected_by_rate_change: affectedByRate, pricing_churn_type: pricingRelatedChurn ? pick(pricingChurnTypes) : "Not pricing-related", recommended_pricing_action: actionFor(root) });

  const speakerCount = Math.min(4, Math.floor(rand() * (industry === "Catering" || industry.includes("Fruit") ? 3.4 : 2.1)));
  const settlementCount = Math.floor(rand() * (settlement === "Primary Operating Account" ? 2 : 4));
  const supportCount = Math.min(4, speakerCount + settlementCount + (pricingComplaint ? 1 : 0));
  for (let ticket = 0; ticket < supportCount; ticket += 1) {
    const issueType = pricingComplaint && ticket === 0 ? "Pricing complaint" : speakerCount > ticket ? pick(speakerIssues.slice(1)) : pick(settlementQueries.slice(1));
    const issueDate = addDays(onboardingDate, Math.min(25 + ticket * 28 + Math.floor(rand() * 10), Math.max(7, observableMonths * 28)));
    const resolved = id === "M187" ? false : bool(branchProximity === "Near" ? 0.78 : 0.56);
    supports.push({ ticket_id: `T${id.slice(1)}-${ticket + 1}`, merchant_id: id, issue_date: iso(issueDate), issue_type: issueType, issue_category: issueType.includes("Pricing") ? "Pricing" : issueType.includes("Speaker") ? "Speaker" : "Settlement Information", severity: issueType.includes("Pricing") || speakerCount >= 2 ? "High" : "Medium", first_response_date: iso(addDays(issueDate, 1)), resolution_date: resolved ? iso(addDays(issueDate, pick([1, 2, 3, 5]))) : null, resolution_days: resolved ? pick([1, 2, 3, 5]) : null, issue_resolved: resolved, follow_up_count: 1 + Math.floor(rand() * 3), merchant_feedback: resolved ? "Issue clarified or resolved" : "Merchant remained uncertain", transaction_impact: issueType.includes("Pricing") ? "Usage declined after rate expectation gap" : "Temporary usage disruption", reactivated_after_resolution: resolved && bool(0.38) });
  }

  let previousRegimeId: string | null = null;
  let latestPricingTransitionAge = -99;
  for (let age = 0; age < observableMonths; age += 1) {
    const portfolioDate = monthDate(onboardingOffset + age);
    const portfolioMonth = monthKey(portfolioDate);
    const seasonality = seasonalityFor(industry, portfolioDate.getMonth() + 1);
    const regime = pricingRegimeForMonth(portfolioMonth);
    const experiencedRegimeChange = previousRegimeId !== null && previousRegimeId !== regime.id;
    if (experiencedRegimeChange) latestPricingTransitionAge = age;
    const notificationSent = experiencedRegimeChange;
    const notificationReceived = notificationSent && merchantNotificationReceived;
    const notificationAcknowledged = notificationReceived && merchantNotificationAck;
    const notificationUnderstood = notificationAcknowledged && merchantUnderstood;
    const active = status !== "Churned" || age < (churnMonth ?? 0);
    const promoActive = promotionDriven && age < promoMonths;
    const baseShare = status === "Primary User" ? 0.4 + age * 0.035 : status === "Secondary User" ? 0.16 + age * 0.018 : status === "Backup User" || status === "Insufficient Observation" ? 0.07 + age * 0.005 : Math.max(0, 0.2 - age * 0.03);
    const responseLag = pricingResponseMode === "Immediate" ? 0 : pricingResponseMode === "Delayed one month" ? 1 : pricingResponseMode === "Delayed two months" ? 2 : -1;
    const transitionResponse = responseLag >= 0 && age - latestPricingTransitionAge === responseLag && (!notificationUnderstood || rateSensitivity >= 4 || (seasonality.peak && rateSensitivity >= 3));
    const temporaryRecovery = pricingResponseMode === "Temporary decline and recovery" && age - latestPricingTransitionAge === 0 && (!notificationUnderstood || rateSensitivity >= 4);
    const temporaryShock = (transitionResponse || temporaryRecovery) ? 0.05 + rateSensitivity * 0.012 : 0;
    const pricingDecline = ((transitionResponse || temporaryRecovery) && bool(0.28 + rateSensitivity * 0.07)) || (pricingRelatedChurn && age === Math.max(1, (churnMonth ?? 1) - 1));
    const seasonalShareEffect = industry.includes("Fruit") && seasonality.peak ? -0.008 : 0;
    const share = active ? clamp(baseShare + (promoActive ? 0.08 : 0) + seasonalShareEffect - temporaryShock - (pricingDecline ? 0.07 : 0) + (rand() - 0.5) * 0.05, 0.01, 0.86) : 0;
    const allReceipts = Math.round((industry.includes("Fruit") ? 120000 : industry === "Catering" ? 80000 : 52000) * (0.7 + rand() * 0.7) * seasonality.multiplier);
    const bankValue = active ? Math.round(allReceipts * share) : 0;
    const previousDeposit = Math.round(depositBase * (0.65 + rand() * 0.7));
    const baseFreeQuota = regime.baseFreeQuota;
    const depositLinkedFreeQuota = previousDeposit * regime.depositMultiplier;
    const totalFreeQuota = totalFreeTransactionAllowance(baseFreeQuota, depositLinkedFreeQuota);
    const chargeableValue = regime.model === "quota" ? Math.max(bankValue - totalFreeQuota, 0) : bankValue;
    const estimatedFee = regime.model === "quota" ? chargeableValue * SYNTHETIC_EXCESS_RATE : bankValue * regime.flatRate;
    const merchantExpectedFee = bankValue * expectedRate;
    const effectiveFeeRate = bankValue === 0 ? 0 : estimatedFee / bankValue;
    const expectationGap = effectiveFeeRate - expectedRate;
    const monthlyComplaint = pricingComplaint && (pricingDecline || (experiencedRegimeChange && expectationGap > 0));
    monthly.push({ merchant_id: id, portfolio_month: portfolioMonth, merchant_age_month: age, all_channel_receipts: allReceipts, bank_qr_transaction_count: active ? Math.round((10 + share * 260 + rand() * 40) * (seasonality.peak ? 1.24 : seasonality.multiplier)) : 0, bank_qr_transaction_value: bankValue, bank_qr_share: pct(share), active_days: active ? Math.min(31, Math.round((3 + share * 25) * (seasonality.peak ? 1.16 : seasonality.multiplier))) : 0, promotion_active: promoActive, speaker_issue: active && bool((speakerCount / 10) * (seasonality.peak ? 1.65 : 1)) ? pick(speakerIssues.slice(1)) : "None", settlement_query: active && bool(settlementCount / 10) ? pick(settlementQueries.slice(1)) : "None", follow_up_this_month: bool(0.64), usage_level: !active ? "None" : share >= 0.5 ? "Primary" : share >= 0.18 ? "Secondary" : "Backup", active_at_month_end: active, pricing_regime_id: regime.id, previous_month_average_daily_deposit: previousDeposit, base_free_quota: baseFreeQuota, deposit_linked_free_quota: depositLinkedFreeQuota, total_free_quota: totalFreeQuota, chargeable_transaction_value: chargeableValue, applicable_flat_rate: regime.flatRate, estimated_monthly_fee: Math.round(estimatedFee * 100) / 100, merchant_expected_fee: Math.round(merchantExpectedFee * 100) / 100, merchant_expected_rate: expectedRate, effective_fee_rate: pct(effectiveFeeRate), pricing_expectation_gap: pct(expectationGap), experienced_regime_change: experiencedRegimeChange, pricing_notification_sent: notificationSent, pricing_notification_received: notificationReceived, pricing_notification_acknowledged: notificationAcknowledged, pricing_notification_understood: notificationUnderstood, pricing_complaint: monthlyComplaint, pricing_related_usage_decline: pricingDecline, rate_sensitivity_score: id === "M187" ? 5 : rateSensitivity, seasonal_peak_flag: seasonality.peak, industry_seasonality_multiplier: seasonality.multiplier, pre_holiday_peak: seasonality.preHoliday, post_holiday_peak: seasonality.postHoliday });
    previousRegimeId = regime.id;
  }

  outcomes.push({ merchant_id: id, promotion_driven_tag: promotionDriven, backup_usage_ever: true, secondary_usage_ever: status !== "Backup User" && status !== "Insufficient Observation" || bool(0.4), primary_usage_ever: status === "Primary User" || bool(0.06), final_usage_status: status, churn_month: churnMonth, retained_3m: eligible3m ? status !== "Churned" || (churnMonth ?? 0) > 3 : null, retained_6m: eligible6m ? status !== "Churned" || (churnMonth ?? 0) > 6 : null, final_bank_qr_share: pct(finalShare), speaker_issue_count: speakerCount, settlement_query_count: settlementCount, issue_resolution_rate: Number((0.45 + rand() * 0.5).toFixed(2)), likely_root_cause: root, cause_confidence: Number((0.62 + rand() * 0.28).toFixed(2)), priority, recommended_action: actionFor(root) });
}

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
const onboardingDistribution = masters.reduce<Record<string, number>>((counts, merchant) => ({ ...counts, [merchant.onboarding_month]: (counts[merchant.onboarding_month] ?? 0) + 1 }), {});
if (masters.length !== 308) {
  throw new Error("Merchant portfolio must contain exactly 308 merchants");
}
assert(monthly.every((row) => row.portfolio_month >= "2024-01" && row.portfolio_month <= "2025-12"), "Monthly records must remain within 2024-01 to 2025-12");
assert(monthly.every((row) => row.merchant_age_month >= 0), "merchant_age_month must not be negative");
assert(onboardingMonthCounts.reduce((sum, count) => sum + count, 0) === 308, "Monthly onboarding totals must equal 308");
assert(masters.every((merchant) => merchant.right_censored === !merchant.eligible_for_final_outcome), "Right-censoring flags must match final-outcome eligibility");
assert(outcomes.filter((outcome) => outcome.final_usage_status === "Insufficient Observation").every((outcome) => { const merchant = masters.find((item) => item.merchant_id === outcome.merchant_id)!; return merchant.right_censored && outcome.churn_month === null; }), "Insufficient-observation merchants must be correctly marked");
assert(outcomes.filter((outcome) => outcome.final_usage_status === "Churned").every((outcome) => masters.find((merchant) => merchant.merchant_id === outcome.merchant_id)!.eligible_for_final_outcome), "Right-censored merchants must not be churned");
assert(monthly.every((row) => PRICING_REGIMES.some((regime) => regime.id === row.pricing_regime_id)), "Every monthly row must have a configured pricing regime");
assert(monthly.filter((row) => row.pricing_regime_id === "REGIME_A" || row.pricing_regime_id === "REGIME_B").every((row) => row.applicable_flat_rate === 0 && row.estimated_monthly_fee === Math.round(row.chargeable_transaction_value * SYNTHETIC_EXCESS_RATE * 100) / 100), "Quota regimes must not be represented as flat rates");
const sufficientlyObservedChurned = outcomes.filter((outcome) => outcome.final_usage_status === "Churned" && masters.find((merchant) => merchant.merchant_id === outcome.merchant_id)!.eligible_for_final_outcome);
assert(sufficientlyObservedChurned.filter((outcome) => pricing.find((profile) => profile.merchant_id === outcome.merchant_id)!.pricing_related_churn).length > sufficientlyObservedChurned.length / 2, "More than half of sufficiently observed churn must have a pricing-related pathway");
assert(onboardingMonthCounts[0] > onboardingMonthCounts[5] && onboardingMonthCounts[1] > onboardingMonthCounts[5] && onboardingMonthCounts[2] > onboardingMonthCounts[5], "2024 Q1 must be a visible campaign peak");
assert(onboardingMonthCounts[3] > onboardingMonthCounts[4] && onboardingMonthCounts[4] > onboardingMonthCounts[5], "2024 April and May must step down after the campaign peak");
assert(onboardingMonthCounts[22] > onboardingMonthCounts[21] && onboardingMonthCounts[23] > onboardingMonthCounts[21], "2025 year-end must be a visible campaign peak");
assert(masters.filter((merchant) => merchant.onboarding_month >= "2025-11").every((merchant) => merchant.right_censored), "2025 year-end campaign merchants must be right-censored");
const monthlyKeys = monthly.map((row) => `${row.merchant_id}-${row.portfolio_month}`);
assert(new Set(monthlyKeys).size === monthlyKeys.length, "Monthly active merchant counts must use unique merchant IDs");
const fruitPeakRows = monthly.filter((row) => row.seasonal_peak_flag && masters.find((merchant) => merchant.merchant_id === row.merchant_id)!.industry.includes("Fruit"));
const fruitNormalRows = monthly.filter((row) => !row.seasonal_peak_flag && masters.find((merchant) => merchant.merchant_id === row.merchant_id)!.industry.includes("Fruit"));
assert(fruitPeakRows.reduce((sum, row) => sum + row.all_channel_receipts, 0) / fruitPeakRows.length > fruitNormalRows.reduce((sum, row) => sum + row.all_channel_receipts, 0) / fruitNormalRows.length, "Fruit peak receipts must exceed ordinary-month receipts");

const data: AppData = { merchantMaster: masters, onboardingRecords: onboardings, monthlyUsage: monthly, supportRecords: supports, merchantPricingProfiles: pricing, merchantOutcomes: outcomes };
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `import type { AppData } from "../types/data";\n\nexport const appData: AppData = JSON.parse(${JSON.stringify(JSON.stringify(data))});\n`, "utf8");
console.log(`Generated ${masters.length} merchants, ${monthly.length} monthly rows, ${supports.length} support tickets.`);
console.log(`Onboarding distribution: ${Object.entries(onboardingDistribution).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => `${month}:${count}`).join(", ")}`);
console.log(`Eligible 3m: ${masters.filter((merchant) => merchant.eligible_for_3m_retention).length}; Eligible 6m: ${masters.filter((merchant) => merchant.eligible_for_6m_retention).length}; Insufficient observation: ${outcomes.filter((outcome) => outcome.final_usage_status === "Insufficient Observation").length}.`);
console.log(`Pricing regime rows: ${PRICING_REGIMES.map((regime) => `${regime.id}:${monthly.filter((row) => row.pricing_regime_id === regime.id).length}`).join(", ")}.`);
console.log(`Average effective fee rate: ${pct(monthly.reduce((sum, row) => sum + row.effective_fee_rate, 0) / monthly.length)}; experienced regime change merchants: ${pricing.filter((profile) => profile.affected_by_rate_change).length}; expectation-gap merchants: ${monthly.filter((row) => row.pricing_expectation_gap !== 0).map((row) => row.merchant_id).filter((id, index, ids) => ids.indexOf(id) === index).length}; pricing-related usage decline merchants: ${monthly.filter((row) => row.pricing_related_usage_decline).map((row) => row.merchant_id).filter((id, index, ids) => ids.indexOf(id) === index).length}.`);
const campaignOnboardings = onboardings.filter((record) => record.campaign_period !== "Non-campaign");
const nonCampaignOnboardings = onboardings.filter((record) => record.campaign_period === "Non-campaign");
console.log(`Campaign average monthly onboarding: ${(campaignOnboardings.length / 5).toFixed(1)}; non-campaign average monthly onboarding: ${(nonCampaignOnboardings.length / 19).toFixed(1)}; campaign promotion-driven: ${(campaignOnboardings.filter((record) => record.promotion_enrolled).length / campaignOnboardings.length).toFixed(4)}.`);
console.log(`Fruit peak average receipts: ${Math.round(fruitPeakRows.reduce((sum, row) => sum + row.all_channel_receipts, 0) / fruitPeakRows.length)}; fruit ordinary-month average receipts: ${Math.round(fruitNormalRows.reduce((sum, row) => sum + row.all_channel_receipts, 0) / fruitNormalRows.length)}.`);
