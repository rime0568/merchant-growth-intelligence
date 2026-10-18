export type FinalStatus = "Churned" | "Primary User" | "Secondary User" | "Backup User" | "Insufficient Observation";
export type Priority = "High" | "Medium" | "Low";

export interface MerchantMaster {
  merchant_id: string;
  synthetic_merchant_name: string;
  district: string;
  area: string;
  distance_to_branch_km: number;
  branch_proximity: "Near" | "Medium" | "Far";
  industry: string;
  merchant_size: "Micro" | "Small" | "Medium";
  onboarding_date: string;
  onboarding_month: string;
  observation_end_date: string;
  observable_months: number;
  eligible_for_30d_activation: boolean;
  eligible_for_3m_retention: boolean;
  eligible_for_6m_retention: boolean;
  eligible_for_primary_conversion: boolean;
  eligible_for_final_outcome: boolean;
  right_censored: boolean;
  relationship_manager: "RM01";
  rm_wechat_available: boolean;
  existing_wechat_qr: boolean;
  existing_alipay_qr: boolean;
  existing_other_bank_qr: boolean;
  primary_channel_before: string;
  settlement_account_usage: string;
  account_match_score: number;
  business_status: "Operating";
  synthetic_flag: true;
}

export interface OnboardingRecord {
  merchant_id: string;
  application_date: string;
  approval_date: string;
  qr_activated_date: string;
  speaker_installed: boolean;
  training_completed: boolean;
  test_transaction_completed: boolean;
  first_real_transaction_date: string;
  activation_days: number;
  promotion_enrolled: boolean;
  promotion_duration_months: number;
  first_follow_up_date: string;
  follow_up_count: number;
  onboarding_status: "Activated";
  campaign_period: string;
  campaign_name: string;
  campaign_driven_onboarding: boolean;
  promotion_or_gift_motivated: boolean;
  onboarding_quality_score: number;
}

export interface MonthlyUsage {
  merchant_id: string;
  portfolio_month: string;
  merchant_age_month: number;
  all_channel_receipts: number;
  bank_qr_transaction_count: number;
  bank_qr_transaction_value: number;
  bank_qr_share: number;
  active_days: number;
  promotion_active: boolean;
  speaker_issue: string;
  settlement_query: string;
  follow_up_this_month: boolean;
  usage_level: "None" | "Backup" | "Secondary" | "Primary";
  active_at_month_end: boolean;
  pricing_regime_id: "REGIME_A" | "REGIME_B" | "REGIME_C" | "REGIME_D";
  previous_month_average_daily_deposit: number;
  base_free_quota: number;
  deposit_linked_free_quota: number;
  total_free_quota: number;
  chargeable_transaction_value: number;
  applicable_flat_rate: number;
  estimated_monthly_fee: number;
  merchant_expected_fee: number;
  merchant_expected_rate: number;
  effective_fee_rate: number;
  pricing_expectation_gap: number;
  experienced_regime_change: boolean;
  pricing_notification_sent: boolean;
  pricing_notification_received: boolean;
  pricing_notification_acknowledged: boolean;
  pricing_notification_understood: boolean;
  pricing_complaint: boolean;
  pricing_related_usage_decline: boolean;
  rate_sensitivity_score: number;
  seasonal_peak_flag: boolean;
  industry_seasonality_multiplier: number;
  pre_holiday_peak: boolean;
  post_holiday_peak: boolean;
}

export interface SupportRecord {
  ticket_id: string;
  merchant_id: string;
  issue_date: string;
  issue_type: string;
  issue_category: string;
  severity: "Low" | "Medium" | "High";
  first_response_date: string;
  resolution_date: string | null;
  resolution_days: number | null;
  issue_resolved: boolean;
  follow_up_count: number;
  merchant_feedback: string;
  transaction_impact: string;
  reactivated_after_resolution: boolean;
}

export interface MerchantPricingProfile {
  merchant_id: string;
  onboarding_rate: number;
  promotional_rate: number;
  expected_rate: number;
  current_applied_rate: number;
  rate_change_count_since_onboarding: number;
  first_rate_change_date: string | null;
  second_rate_change_date: string | null;
  promotion_end_date: string;
  rate_notification_sent: boolean;
  notification_channel: string;
  notification_received: boolean;
  notification_acknowledged: boolean;
  merchant_understood_rate_change: boolean;
  follow_up_call_answered: boolean;
  pricing_expectation_gap: number;
  pricing_complaint: boolean;
  pricing_complaint_date: string | null;
  complaint_resolved: boolean;
  pricing_related_churn: boolean;
  rate_sensitivity_score: number;
  affected_by_rate_change: boolean;
  pricing_churn_type: string;
  recommended_pricing_action: string;
}

export interface MerchantOutcome {
  merchant_id: string;
  promotion_driven_tag: boolean;
  backup_usage_ever: boolean;
  secondary_usage_ever: boolean;
  primary_usage_ever: boolean;
  final_usage_status: FinalStatus;
  churn_month: number | null;
  retained_3m: boolean | null;
  retained_6m: boolean | null;
  final_bank_qr_share: number;
  speaker_issue_count: number;
  settlement_query_count: number;
  issue_resolution_rate: number;
  likely_root_cause: string;
  cause_confidence: number;
  priority: Priority;
  recommended_action: string;
}

export interface AppData {
  merchantMaster: MerchantMaster[];
  onboardingRecords: OnboardingRecord[];
  monthlyUsage: MonthlyUsage[];
  supportRecords: SupportRecord[];
  merchantPricingProfiles: MerchantPricingProfile[];
  merchantOutcomes: MerchantOutcome[];
}

export interface Filters {
  district: string;
  area: string;
  industry: string;
  merchantSize: string;
  branchProximity: string;
  finalStatus: string;
  promotionDriven: string;
  onboardingMonth: string;
  search: string;
}
