import { useMemo, useState } from "react";
import Papa from "papaparse";
import { AreaChart, Area, BarChart, Bar, Cell, CartesianGrid, LabelList, Legend, Line, LineChart, Pie, PieChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownToLine, BarChart3, BellRing, BookOpen, ChevronRight, CircleHelp, Filter, LayoutDashboard, Menu, Search, ShieldAlert, Sparkles, Target, Users, X, Zap } from "lucide-react";
import { allowanceFormulaInterpretations, allowanceFormulaMode, PRICING_ASSUMPTION_LABEL, PRICING_REGIMES, SYNTHETIC_EXCESS_RATE, totalFreeTransactionAllowance } from "./config/pricingRegimes";
import type { AppData, Filters } from "./types/data";
import { campaignComparison, cohortRows, exportRows, feeBurdenByIndustry, formatPct, formatRate, industryRows, initialFilters, merchantViews, percent, pricingRegimeRows, retentionSummary, rootCauseRows, rowsByMonth, statusLabel, statusRows, type MerchantView, type MetricValue } from "./utils/metrics";

type Page = "overview" | "segments" | "retention" | "drivers" | "pricing" | "actions" | "brief" | "method";
const PALETTE = ["#0f766e", "#2563eb", "#f59e0b", "#e4573d", "#8b5cf6", "#64748b"];
const calendarAxisTicks = ["2024-01", "2024-04", "2024-07", "2024-10", "2025-01", "2025-04", "2025-07", "2025-10"];
const nav: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Executive Overview", icon: LayoutDashboard }, { id: "segments", label: "Merchant Segmentation", icon: Users },
  { id: "retention", label: "Retention Analysis", icon: BarChart3 }, { id: "drivers", label: "Adoption Drivers", icon: Target },
  { id: "pricing", label: "Pricing & Communication", icon: BellRing }, { id: "actions", label: "Merchant Action Centre", icon: Zap },
  { id: "brief", label: "AI Decision Brief", icon: Sparkles },
  { id: "method", label: "Methodology", icon: BookOpen }
];
const statusOptions = ["Primary User", "Secondary User", "Backup User", "Churned", "Insufficient Observation"] as const;

const rootCauseShortLabels: Record<string, string> = {
  "Pricing Increase": "Pricing Increase",
  "Pricing Expectation Gap": "Expectation Gap",
  "Rate Notification Not Understood": "Rate Not Understood",
  "Settlement Account Inconvenience": "Account Friction",
  "Repeated Speaker Failure": "Speaker Issue",
  "Settlement Information Uncertainty": "Other Operations",
  "Bank QR Remained Non-primary": "Other Operations",
  "Existing WeChat Habit": "WeChat Habit",
  "Promotion Ended": "Promotion-led"
};

function chartTooltip({ active, payload, label }: any) {
  const fullLabel = payload?.[0]?.payload?.fullName ?? payload?.[0]?.payload?.fullLabel ?? label;
  return active && payload?.length ? <div className="chart-tooltip">{fullLabel && <b className="tooltip-title">{fullLabel}</b>}{payload.map((p: any) => <div key={p.name}><span style={{ background: p.color }} />{p.name}: <b>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</b></div>)}</div> : null;
}

function calendarTooltip({ active, payload }: any) {
  const row = payload?.[0]?.payload;
  return active && row ? <div className="chart-tooltip"><b className="tooltip-title">{row.month}</b><div>Active merchants: <b>{row.active}</b></div><div>New onboarding: <b>{row.onboarded}</b></div><div>Newly Stopped Using: <b>{row.stopped}</b></div><div>Pricing regime: <b>{row.pricingRegime}</b></div><div>Campaign: <b>{row.campaign}</b></div><div>Bank QR value: <b>{Math.round(row.bankValue).toLocaleString()}</b></div><div>All-channel receipts: <b>{Math.round(row.allReceipts).toLocaleString()}</b></div><div>Portfolio Bank QR Share: <b>{formatPct(row.share)}</b></div></div> : null;
}

function campaignTooltip({ active, payload }: any) {
  const row = payload?.[0]?.payload;
  return active && row ? <div className="chart-tooltip"><b className="tooltip-title">{row.name}</b>{payload.map((item: any) => { const detail: MetricValue | undefined = row[`${item.dataKey}Detail`]; return <div key={item.dataKey}>{item.name}: <b>{detail ? metricDisplay(detail) : formatPct(Number(item.value))}</b>{detail && <small>{detail.numerator} of {detail.denominator}; {detail.rule}</small>}</div>; })}</div> : null;
}

function Metric({ label, value, note, tone = "teal", definition }: { label: string; value: string; note: string; tone?: string; definition?: string }) {
  return <article className={`metric ${tone}`} title={definition}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}

const metricDisplay = (metric: MetricValue) => metric.value === null ? "N/A" : formatPct(metric.value);

function ChartPanel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return <section className={`panel chart-panel ${className}`}><div className="panel-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>;
}

function FilterControl({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="filter-control"><span>{label}</span>{children}</label>;
}

function RootCauseChart({ causes, churned }: { causes: ReturnType<typeof rootCauseRows>; churned: number }) {
  const data = causes.map((cause) => ({ ...cause, fullName: cause.name, name: rootCauseShortLabels[cause.name] ?? cause.name, annotation: `${cause.value} (${formatPct(percent(cause.value, churned))})` }));
  const height = Math.max(270, data.length * 38);
  return <ResponsiveContainer width="100%" height={height}><BarChart layout="vertical" data={data} margin={{ left: 18, right: 76 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={154} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} /><Tooltip content={chartTooltip} /><Bar dataKey="value" name="Merchants" fill="#e4573d" radius={[0, 5, 5, 0]}><LabelList dataKey="annotation" position="right" fill="#52656a" fontSize={12} /></Bar></BarChart></ResponsiveContainer>;
}

function App({ appData }: { appData: AppData }) {
  const requestedPage = new URLSearchParams(window.location.search).get("page");
  const [page, setPage] = useState<Page>(nav.some((item) => item.id === requestedPage) ? requestedPage as Page : "overview");
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [pricingExposure, setPricingExposure] = useState("All");
  const [notificationStatus, setNotificationStatus] = useState("All");
  const [pricingComplaint, setPricingComplaint] = useState("All");
  const [selected, setSelected] = useState<MerchantView | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(requestedPage !== "brief");
  const merchantBase = useMemo(() => merchantViews(appData, filters), [filters]);
  const merchants = useMemo(() => merchantBase.filter((merchant) =>
    (pricingExposure === "All" || (pricingExposure === "Exposed" ? merchant.pricing.affected_by_rate_change : !merchant.pricing.affected_by_rate_change)) &&
    (notificationStatus === "All" || (notificationStatus === "Not received" ? !merchant.pricing.notification_received : notificationStatus === "Received" ? merchant.pricing.notification_received && !merchant.pricing.notification_acknowledged : notificationStatus === "Acknowledged" ? merchant.pricing.notification_acknowledged && !merchant.pricing.merchant_understood_rate_change : merchant.pricing.merchant_understood_rate_change)) &&
    (pricingComplaint === "All" || (pricingComplaint === "Complaint logged" ? merchant.pricing.pricing_complaint : pricingComplaint === "Unresolved complaint" ? merchant.pricing.pricing_complaint && !merchant.pricing.complaint_resolved : !merchant.pricing.pricing_complaint))
  ), [merchantBase, notificationStatus, pricingComplaint, pricingExposure]);
  const monthly = useMemo(() => rowsByMonth(merchants), [merchants]);
  const statuses = useMemo(() => statusRows(merchants), [merchants]);
  const causes = useMemo(() => rootCauseRows(merchants), [merchants]);
  const industries = useMemo(() => industryRows(merchants), [merchants]);
  const total = merchants.length;
  const churned = merchants.filter((m) => m.outcome.final_usage_status === "Churned");
  const primary = merchants.filter((m) => m.outcome.final_usage_status === "Primary User");
  const affected = merchants.filter((m) => m.pricing.affected_by_rate_change);
  const pricingChurn = churned.filter((m) => m.pricing.pricing_related_churn);
  const notificationUnderstood = affected.filter((m) => m.pricing.merchant_understood_rate_change);
  const options = (field: keyof Filters) => Array.from(new Set(appData.merchantMaster.map((m) => {
    if (field === "district") return m.district; if (field === "area") return m.area; if (field === "industry") return m.industry; if (field === "merchantSize") return m.merchant_size; if (field === "branchProximity") return m.branch_proximity; if (field === "onboardingMonth") return m.onboarding_date.slice(0, 7); return "";
  }))).filter(Boolean).sort();
  const update = (field: keyof Filters, value: string) => setFilters((prev) => ({ ...prev, [field]: value }));
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === "search" ? Boolean(value) : value !== "All").length + Number(pricingExposure !== "All") + Number(notificationStatus !== "All") + Number(pricingComplaint !== "All");
  const resetAll = () => { setFilters(initialFilters); setPricingExposure("All"); setNotificationStatus("All"); setPricingComplaint("All"); };
  const download = () => {
    const csv = Papa.unparse(exportRows(merchants)); const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = href; a.download = "merchant-action-list.csv"; a.click(); URL.revokeObjectURL(href);
  };

  return <div className="app-shell">
    <aside className={sideOpen ? "sidebar open" : "sidebar"}><div className="brand"><span className="brand-mark">Q</span><div><b>Merchant Pulse</b><small>Portfolio analytics</small></div><button className="icon-btn close-nav" onClick={() => setSideOpen(false)} aria-label="Close navigation"><X /></button></div>
      <nav>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => { setPage(item.id); setFiltersOpen(item.id !== "brief"); setSideOpen(false); const url = new URL(window.location.href); item.id === "overview" ? url.searchParams.delete("page") : url.searchParams.set("page", item.id); window.history.replaceState({}, "", url); }} className={page === item.id ? "active" : ""}><Icon />{item.label}</button>; })}</nav>
      <div className="sidebar-note"><ShieldAlert /><p><b>Synthetic dataset</b><br />Illustrative merchant behaviour only. No real bank or payment institution data.</p></div>
    </aside>
    <main><header className="topbar"><button className="icon-btn menu" onClick={() => setSideOpen(true)} aria-label="Open navigation"><Menu /></button><div><p className="eyebrow">Merchant QR Payment Adoption & Retention Analysis</p><h1>{page === "pricing" ? "Two Charging Models Across Four Pricing Regimes" : nav.find((n) => n.id === page)?.label}</h1></div><div className="topbar-actions">{page === "brief" && <button className="scope-toggle" onClick={() => setFiltersOpen((value) => !value)}><Filter />{filtersOpen ? "Hide filters" : "Adjust portfolio"}</button>}<button className="export" onClick={download}><ArrowDownToLine />Export filtered CSV</button></div></header>
      {page !== "method" && filtersOpen && <section className="filters">
        <div className="filter-heading"><div className="filter-label"><Filter />Portfolio Filters</div><p>Refine the merchant portfolio by location, industry, onboarding period, usage status and pricing exposure.</p></div>
        <div className="filter-summary"><span>Active filters: <b>{activeFilterCount}</b></span><span>Showing <b>{merchants.length}</b> of 308 merchants</span><div className="filter-actions"><button className="reset" onClick={resetAll}>Reset all filters</button><button className="filter-export" onClick={download}><ArrowDownToLine />Export filtered merchants</button></div></div>
        <div className="filter-groups">
          <fieldset><legend>Merchant Profile</legend><div className="filter-grid"><FilterControl label="District"><select value={filters.district} onChange={(e) => update("district", e.target.value)}><option value="All">All districts</option>{options("district").map((x) => <option key={x}>{x}</option>)}</select></FilterControl><FilterControl label="Area"><select value={filters.area} onChange={(e) => update("area", e.target.value)}><option value="All">All areas</option>{options("area").map((x) => <option key={x}>{x}</option>)}</select></FilterControl><FilterControl label="Industry"><select value={filters.industry} onChange={(e) => update("industry", e.target.value)}><option value="All">All industries</option>{options("industry").map((x) => <option key={x}>{x}</option>)}</select></FilterControl><FilterControl label="Merchant Size"><select value={filters.merchantSize} onChange={(e) => update("merchantSize", e.target.value)}><option value="All">All sizes</option>{options("merchantSize").map((x) => <option key={x}>{x}</option>)}</select></FilterControl><FilterControl label="Branch Proximity"><select value={filters.branchProximity} onChange={(e) => update("branchProximity", e.target.value)}><option value="All">All distances</option>{options("branchProximity").map((x) => <option key={x}>{x}</option>)}</select></FilterControl></div></fieldset>
          <fieldset><legend>Lifecycle</legend><div className="filter-grid lifecycle-grid"><FilterControl label="Onboarding Period"><select value={filters.onboardingMonth} onChange={(e) => update("onboardingMonth", e.target.value)}><option value="All">All periods</option>{options("onboardingMonth").map((x) => <option key={x}>{x}</option>)}</select></FilterControl><FilterControl label="Current Usage Status"><select value={filters.finalStatus} onChange={(e) => update("finalStatus", e.target.value)}><option value="All">All statuses</option>{statusOptions.map((x) => <option key={x} value={x}>{statusLabel(x)}</option>)}</select></FilterControl></div></fieldset>
          <fieldset><legend>Pricing and Communication</legend><div className="filter-grid"><FilterControl label="Pricing Exposure"><select value={pricingExposure} onChange={(e) => setPricingExposure(e.target.value)}><option>All</option><option>Exposed</option><option>Not exposed</option></select></FilterControl><FilterControl label="Notification Status"><select value={notificationStatus} onChange={(e) => setNotificationStatus(e.target.value)}><option>All</option><option>Not received</option><option>Received</option><option>Acknowledged</option><option>Understood</option></select></FilterControl><FilterControl label="Pricing Complaint"><select value={pricingComplaint} onChange={(e) => setPricingComplaint(e.target.value)}><option>All</option><option>Complaint logged</option><option>Unresolved complaint</option><option>No complaint</option></select></FilterControl></div></fieldset>
        </div>
        <div className="search filter-search"><Search /><input value={filters.search} onChange={(e) => update("search", e.target.value)} placeholder="Search merchant ID" /></div>
      </section>}
      <div className="content">
        {page === "overview" && <Overview total={total} primary={primary.length} churned={churned.length} monthly={monthly} statuses={statuses} causes={causes} pricingChurn={pricingChurn.length} selected={setSelected} merchants={merchants} />}
        {page === "segments" && <Segments industries={industries} merchants={merchants} selected={setSelected} />}
        {page === "retention" && <Retention merchants={merchants} monthly={monthly} causes={causes} />}
        {page === "drivers" && <Drivers merchants={merchants} />}
        {page === "pricing" && <Pricing affected={affected} churned={churned} pricingChurn={pricingChurn} understood={notificationUnderstood} merchants={merchants} />}
        {page === "actions" && <Actions merchants={merchants} selected={setSelected} />}
        {page === "brief" && <AiDecisionBrief merchants={merchants} affected={affected} churned={churned} pricingChurn={pricingChurn} understood={notificationUnderstood} />}
        {page === "method" && <Methodology />}
      </div>
    </main>
    {selected && <MerchantDrawer merchant={selected} onClose={() => setSelected(null)} />}
  </div>;
}

type BriefEvidence = { metricKey: string; label: string; value: string; interpretation: string };
type DecisionBrief = { summary: string; evidence: BriefEvidence[]; actions: string[]; limitations: string[]; mode: "live" | "demo" };

function buildSnapshot(merchants: MerchantView[], affected: MerchantView[], churned: MerchantView[], pricingChurn: MerchantView[], understood: MerchantView[]) {
  const complaints = merchants.filter((merchant) => merchant.pricing.pricing_complaint);
  const openComplaints = complaints.filter((merchant) => !merchant.pricing.complaint_resolved);
  const primary = merchants.filter((merchant) => merchant.outcome.final_usage_status === "Primary User");
  return {
    portfolio_size: merchants.length,
    primary_user_rate: percent(primary.length, merchants.length),
    stopped_use_rate: percent(churned.length, merchants.length),
    pricing_related_stopped_use_share: percent(pricingChurn.length, churned.length),
    rate_change_exposure: percent(affected.length, merchants.length),
    pricing_understanding_rate: percent(understood.length, affected.length),
    open_complaints: openComplaints.length
  };
}

function demoBrief(snapshot: ReturnType<typeof buildSnapshot>): DecisionBrief {
  const pricingRisk = snapshot.pricing_related_stopped_use_share >= 0.35;
  return {
    mode: "demo",
    summary: pricingRisk
      ? "Pricing understanding is the clearest intervention point in the filtered portfolio. Retention action should begin before the next rate transition, with unresolved complaints handled first."
      : "The filtered portfolio does not show a dominant pricing signal. Segment-level follow-up should focus on sustained usage and operational friction before changing commercial terms.",
    evidence: [
      { metricKey: "stopped_use_rate", label: "Observed stopped-use rate", value: formatPct(snapshot.stopped_use_rate), interpretation: "Uses only merchants with an observed final outcome; right-censored cases are not treated as exits." },
      { metricKey: "pricing_related_stopped_use_share", label: "Pricing-related share of stopped-use cases", value: formatPct(snapshot.pricing_related_stopped_use_share), interpretation: "Shows how often a pricing or understanding factor appears among sufficiently observed exits." },
      { metricKey: "pricing_understanding_rate", label: "Rate-change understanding", value: formatPct(snapshot.pricing_understanding_rate), interpretation: "Receiving a notice is separated from confirmed understanding of the mechanism and likely impact." }
    ],
    actions: [
      "Prioritise unresolved pricing complaints before the next rate-effective date.",
      "Use a short acknowledgement-and-understanding check instead of treating message delivery as comprehension.",
      "Review M3 and M6 retention after intervention using the same eligibility rules."
    ],
    limitations: [
      "All merchant records and pricing regimes are synthetic.",
      "The dashboard shows descriptive associations, not causal effects.",
      "This cached brief demonstrates the product flow; live model generation requires a server-side API key."
    ]
  };
}

function AiDecisionBrief({ merchants, affected, churned, pricingChurn, understood }: { merchants: MerchantView[]; affected: MerchantView[]; churned: MerchantView[]; pricingChurn: MerchantView[]; understood: MerchantView[] }) {
  const snapshot = useMemo(() => buildSnapshot(merchants, affected, churned, pricingChurn, understood), [merchants, affected, churned, pricingChurn, understood]);
  const [brief, setBrief] = useState<DecisionBrief>(() => demoBrief(snapshot));
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("Showing a reviewed fallback brief. Connect a server-side model key for live generation.");

  const generate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/decision-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics: snapshot })
      });
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      const next = await response.json() as DecisionBrief;
      setBrief(next);
      setNotice(next.mode === "live" ? "Live model response. Evidence values were injected from validated dashboard metrics." : "Server is in demo mode because no model key is configured.");
    } catch {
      setBrief(demoBrief(snapshot));
      setNotice("Live generation is unavailable, so the reviewed fallback brief is shown.");
    } finally {
      setLoading(false);
    }
  };

  return <section className="ai-brief">
    <div className="ai-hero"><div><p className="eyebrow">Evidence-grounded AI</p><h2>Turn validated portfolio metrics into an operational decision brief</h2><p>All calculations stay deterministic. The model can interpret supplied metrics, select evidence and recommend follow-up, but it cannot recalculate or invent portfolio values.</p></div><button onClick={generate} disabled={loading}><Sparkles />{loading ? "Generating..." : "Generate decision brief"}</button></div>
    <div className={`ai-mode ${brief.mode}`}><b>{brief.mode === "live" ? "Live AI" : "Reviewed demo"}</b><span>{notice}</span></div>
    <article className="brief-summary"><p className="eyebrow">Executive summary</p><h3>{brief.summary}</h3></article>
    <div className="brief-grid"><section className="panel"><div className="panel-title"><div><h2>Evidence used</h2><p>Values are supplied by the application, never generated by the model.</p></div></div><div className="evidence-list">{brief.evidence.map((item) => <article key={item.metricKey}><div><span>{item.label}</span><strong>{item.value}</strong></div><p>{item.interpretation}</p></article>)}</div></section><section className="panel"><div className="panel-title"><div><h2>Recommended actions</h2><p>Human review is required before any merchant contact or pricing decision.</p></div></div><ol className="brief-actions">{brief.actions.map((action) => <li key={action}>{action}</li>)}</ol></section></div>
    <section className="brief-limitations"><ShieldAlert /><div><b>Guardrails and limitations</b><ul>{brief.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div></section>
  </section>;
}

function Overview({ total, primary, churned, monthly, statuses, causes, pricingChurn, merchants, selected }: { total: number; primary: number; churned: number; monthly: ReturnType<typeof rowsByMonth>; statuses: ReturnType<typeof statusRows>; causes: ReturnType<typeof rootCauseRows>; pricingChurn: number; merchants: MerchantView[]; selected: (m: MerchantView) => void }) {
  return <ExecutiveOverview total={total} primary={primary} churned={churned} monthly={monthly} statuses={statuses} causes={causes} pricingChurn={pricingChurn} merchants={merchants} selected={selected} />;
}

function Featured({ merchants, selected }: { merchants: MerchantView[]; selected: (m: MerchantView) => void }) { const m = merchants.find((x) => x.merchant_id === "M187"); if (!m) return null; return <section className="featured"><div><p className="eyebrow">Featured case study</p><h2>M187: delayed use turned a rate change into a pricing shock</h2><p>Promotional onboarding created a low-friction entry, but the merchant did not build a routine before the rate change. The unanswered follow-up left the pricing expectation gap unresolved; usage then declined after a complaint.</p><button onClick={() => selected(m)}>Open merchant timeline <ChevronRight /></button></div><ol><li><b>Onboarded</b><span>Promotion activated</span></li><li><b>48 days</b><span>First real transaction</span></li><li><b>Rate adjusted</b><span>Follow-up not answered</span></li><li><b>Complaint</b><span>Expectation gap recorded</span></li><li><b>Stopped Using at M5</b><span>Pricing-sensitive exit</span></li></ol></section>; }

function Segments({ industries, merchants, selected }: { industries: ReturnType<typeof industryRows>; merchants: MerchantView[]; selected: (m: MerchantView) => void }) { return <><section className="metric-grid"><Metric label="Industries in scope" value={String(industries.length)} note="Merchant mix is intentionally uneven" /><Metric label="Near-branch merchants" value={formatPct(percent(merchants.filter((m) => m.branch_proximity === "Near").length, merchants.length))} note="Useful for assisted follow-up" tone="blue" /><Metric label="Promotion-led merchants" value={formatPct(percent(merchants.filter((m) => m.outcome.promotion_driven_tag).length, merchants.length))} note="Requires post-promotion care" tone="amber" /><Metric label="High-priority actions" value={String(merchants.filter((m) => m.outcome.priority === "High").length)} note="Pricing or retention intervention" tone="coral" /></section><div className="grid two"><ChartPanel title="Industry composition" subtitle="Merchant count by industry"><ResponsiveContainer width="100%" height={330}><BarChart layout="vertical" data={industries} margin={{ left: 28, right: 24 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} /><Tooltip content={chartTooltip} /><Bar dataKey="merchants" name="Merchants" fill="#0f766e" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></ChartPanel><ChartPanel title="Stopped Using concentration" subtitle="Stopped Using rate by industry"><ResponsiveContainer width="100%" height={330}><BarChart layout="vertical" data={[...industries].sort((a, b) => b.churn - a.churn)} margin={{ left: 28, right: 24 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={(value) => formatPct(Number(value))} /><YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} /><Tooltip content={chartTooltip} /><Bar dataKey="churn" name="Stopped Using rate" fill="#e4573d" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></ChartPanel></div><MerchantTable merchants={merchants} selected={selected} title="Merchant portfolio" /></> }

function Retention({ merchants, monthly, causes }: { merchants: MerchantView[]; monthly: ReturnType<typeof rowsByMonth>; causes: ReturnType<typeof rootCauseRows> }) { return <RetentionUsage merchants={merchants} monthly={monthly} causes={causes} />; }

function Drivers({ merchants }: { merchants: MerchantView[] }) { const proximity = ["Near", "Medium", "Far"].map((name) => { const rows = merchants.filter((m) => m.branch_proximity === name); return { name, primary: percent(rows.filter((m) => m.outcome.final_usage_status === "Primary User").length, rows.length), understood: percent(rows.filter((m) => m.pricing.merchant_understood_rate_change).length, rows.length) }; }); const settlement = ["Primary Operating Account", "Occasional Use", "Rarely Used, Requires Transfer Out"].map((fullName) => { const rows = merchants.filter((m) => m.settlement_account_usage === fullName); return { fullName, name: fullName === "Primary Operating Account" ? "Primary account" : fullName === "Occasional Use" ? "Occasional use" : "Transfer-out required", primary: percent(rows.filter((m) => m.outcome.final_usage_status === "Primary User").length, rows.length) }; }).sort((a, b) => b.primary - a.primary); return <><section className="insight"><Target /><div><b>Adoption needs a routine, not merely a working QR code.</b><span>Proximity and settlement-account fit create useful operational leverage, but they do not substitute for clear economics when rates change.</span></div></section><div className="grid two"><ChartPanel title="Branch proximity effect" subtitle="Primary conversion and rate-change understanding"><ResponsiveContainer width="100%" height={290}><BarChart data={proximity}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis tickFormatter={(value) => formatPct(Number(value))} /><Tooltip content={chartTooltip} /><Legend /><Bar dataKey="primary" name="Primary conversion" fill="#2563eb" radius={[5, 5, 0, 0]} /><Bar dataKey="understood" name="Rate understood" fill="#0f766e" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel><ChartPanel title="Settlement account fit" subtitle="Channel conversion by operational account usage"><ResponsiveContainer width="100%" height={290}><BarChart layout="vertical" data={settlement} margin={{ left: 22, right: 24 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={(value) => formatPct(Number(value))} /><YAxis type="category" dataKey="name" width={134} tickLine={false} axisLine={false} /><Tooltip content={chartTooltip} /><Bar dataKey="primary" name="Primary conversion" fill="#8b5cf6" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></ChartPanel></div></> }

function Pricing({ affected, churned, pricingChurn, understood, merchants }: { affected: MerchantView[]; churned: MerchantView[]; pricingChurn: MerchantView[]; understood: MerchantView[]; merchants: MerchantView[] }) {
  return <PricingCommunication affected={affected} churned={churned} pricingChurn={pricingChurn} understood={understood} merchants={merchants} />;
}
function ExecutiveOverview({ total, primary, churned, monthly, statuses, causes, pricingChurn, merchants, selected }: { total: number; primary: number; churned: number; monthly: ReturnType<typeof rowsByMonth>; statuses: ReturnType<typeof statusRows>; causes: ReturnType<typeof rootCauseRows>; pricingChurn: number; merchants: MerchantView[]; selected: (m: MerchantView) => void }) {
  const funnel = [{ name: "Activated", value: total }, { name: "Retained 6m", value: merchants.filter((m) => m.outcome.retained_6m === true).length }, { name: "Primary channel", value: primary }];
  const durationMonths = (regime: typeof PRICING_REGIMES[number]) => (Number(regime.endDate.slice(0, 4)) - Number(regime.startDate.slice(0, 4))) * 12 + Number(regime.endDate.slice(5, 7)) - Number(regime.startDate.slice(5, 7)) + 1;
  return <>
    <section className="metric-grid"><Metric label="Activated merchants" value={total.toLocaleString()} note="Scoped portfolio" /><Metric label="Primary-channel conversion" value={formatPct(percent(primary, total))} note={`${primary} merchants use bank QR as primary`} tone="blue" /><Metric label="Stopped Using" value={formatPct(percent(churned, total))} note={`${churned} observed exits`} tone="coral" /><Metric label="Stopped-use Cases with Pricing-related Factors" value={formatPct(percent(pricingChurn, churned))} note={`${pricingChurn} of ${churned} sufficiently observed stopped-use cases`} tone="amber" /></section>
    <section className="insight"><AlertTriangle /><div><b>Executive signal: onboarding volume is not the same as sustained merchant quality.</b><span>Calendar trends identify campaign peaks and pricing transitions; lifecycle retention keeps insufficiently observed merchants out of outcome rates.</span></div></section>
    <div className="grid two">
      <ChartPanel title="Monthly Merchant Onboarding Trend" subtitle="2024-01 to 2025-12; campaign windows and pricing transition points"><ResponsiveContainer width="100%" height={290}><BarChart data={monthly} margin={{ left: 4, right: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><ReferenceArea x1="2024-01" x2="2024-03" fill="#f59e0b" fillOpacity={0.12} /><ReferenceArea x1="2025-11" x2="2025-12" fill="#f59e0b" fillOpacity={0.12} /><ReferenceLine x="2024-07" stroke="#64748b" strokeDasharray="4 4" /><ReferenceLine x="2025-03" stroke="#64748b" strokeDasharray="4 4" /><ReferenceLine x="2025-09" stroke="#64748b" strokeDasharray="4 4" /><XAxis dataKey="month" ticks={calendarAxisTicks} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip content={chartTooltip} /><Bar dataKey="onboarded" name="New onboarding" fill="#0f766e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Active Merchants and Average Bank QR Share" subtitle="Portfolio calendar month, not merchant lifecycle age"><ResponsiveContainer width="100%" height={290}><LineChart data={monthly} margin={{ left: 4, right: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" ticks={calendarAxisTicks} tick={{ fontSize: 10 }} /><YAxis yAxisId="count" /><YAxis yAxisId="share" orientation="right" tickFormatter={(value) => formatPct(Number(value))} /><Tooltip content={chartTooltip} /><Legend /><Line yAxisId="count" type="monotone" dataKey="active" name="Active merchants" stroke="#0f766e" strokeWidth={3} dot={false} /><Line yAxisId="share" type="monotone" dataKey="share" name="Average Bank QR Share" stroke="#f59e0b" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></ChartPanel>
    </div>
    <ChartPanel title="Two Charging Models Across Four Pricing Regimes" subtitle="Segment width represents duration across January 2024 to December 2025."><div className="timeline-events"><span title="A period of intensive merchant acquisition, promotional offers and gift-led onboarding.">Marketing Campaign: Jan-Mar 2024</span><span title="A period of stronger transaction activity among fruit retail and wholesale merchants around the year-end and Lunar New Year trading cycle.">Fruit Trade Seasonal Peak: Dec-Mar</span><span title="Post-campaign retention for the November-December 2025 cohort is not fully observable within the dataset.">Marketing Campaign: Nov-Dec 2025</span></div><div className="pricing-group-labels"><span className="allowance-group">Allowance-based Charging</span><span className="flat-group">Flat-rate Charging</span></div><div className="pricing-timeline proportional">{PRICING_REGIMES.map((regime) => <div className={`regime-segment ${regime.id.toLowerCase()}`} style={{ gridColumn: `span ${durationMonths(regime)}` }} key={regime.id}><div><b>{regime.id.replace("REGIME_", "Regime ")}</b><em>Synthetic Assumption</em></div><span>{regime.startDate} to {regime.endDate}</span><small>{durationMonths(regime)} months</small><strong>{regime.label}</strong></div>)}</div><p className="timeline-note">Free Transaction Allowance applies only to monthly Bank QR transaction value. Allowance-based fees apply only above that allowance; flat-rate fees apply to all Bank QR transaction value.</p></ChartPanel>
    <div className="grid two"><ChartPanel title="Final Channel Position" subtitle="Insufficient Observation is not an outcome"><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={statuses} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={3}>{statuses.map((_, index) => <Cell key={index} fill={PALETTE[index]} />)}</Pie><Tooltip content={chartTooltip} /><Legend /></PieChart></ResponsiveContainer></ChartPanel><ChartPanel title="Primary Root Cause Profile" subtitle="Primary Root Cause only; one classified cause per Stopped Using merchant"><RootCauseChart causes={causes} churned={churned} /></ChartPanel></div>
    <ChartPanel title="Conversion Funnel" subtitle="Activation to sustained primary usage"><ResponsiveContainer width="100%" height={230}><BarChart layout="vertical" data={funnel} margin={{ left: 26, right: 24 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={116} /><Tooltip content={chartTooltip} /><Bar dataKey="value" name="Merchants" fill="#2563eb" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></ChartPanel>
    <Featured merchants={merchants} selected={selected} />
  </>;
}

function RetentionUsage({ merchants, monthly, causes }: { merchants: MerchantView[]; monthly: ReturnType<typeof rowsByMonth>; causes: ReturnType<typeof rootCauseRows> }) {
  const cohorts = cohortRows(merchants);
  const campaign = campaignComparison(merchants);
  const summary = retentionSummary(merchants);
  const [cohortYear, setCohortYear] = useState("All");
  const [showAllCohorts, setShowAllCohorts] = useState(false);
  const visibleCohorts = cohorts.filter((cohort) => cohortYear === "All" || cohort.month.startsWith(cohortYear));
  const displayedCohorts = showAllCohorts ? visibleCohorts : visibleCohorts.slice(-12);
  const churned = summary.stopped.numerator;
  const calendar = monthly.map((row) => ({ ...row, fullName: row.month }));
  const cohortCell = (value: MetricValue) => <td className={value.value === null ? "cohort-na" : "cohort-value"} title={`${value.numerator} of ${value.denominator}. ${value.rule}`} style={value.value === null ? undefined : { backgroundColor: `rgba(15,118,110,${0.12 + value.value * 0.58})` }}>{metricDisplay(value)}</td>;
  const exportCohorts = () => { const csv = Papa.unparse(visibleCohorts.map((cohort) => ({ onboarding_cohort: cohort.month, merchants: cohort.merchants, activation_rate: metricDisplay(cohort.activation), m3_retention: metricDisplay(cohort.m3), m6_retention: metricDisplay(cohort.m6), primary_channel_conversion: metricDisplay(cohort.primary), eligible_for_m3: cohort.eligibleM3, eligible_for_m6: cohort.eligibleM6, eligible_for_final_outcome: cohort.finalEligible }))); const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); const href = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = href; link.download = "retention-cohorts.csv"; link.click(); URL.revokeObjectURL(href); };
  const campaignQuality = campaign.map((group) => ({ name: group.name, activation: group.activation.value, activationDetail: group.activation, m3: group.m3.value, m3Detail: group.m3, m6: group.m6.value, m6Detail: group.m6, primary: group.primary.value, primaryDetail: group.primary }));
  const campaignRisk = campaign.map((group) => ({ name: group.name, promotion: group.promotion.value, promotionDetail: group.promotion, complaint: group.complaint.value, complaintDetail: group.complaint, decline: group.decline.value, declineDetail: group.decline }));
  return <>
    <section className="metric-grid"><Metric label="30-day Activation Rate" value={metricDisplay(summary.activation)} note={`${summary.activation.numerator} of ${summary.activation.denominator} eligible merchants`} definition={summary.activation.rule} /><Metric label="M3 Retention" value={metricDisplay(summary.m3)} note={`${summary.m3.numerator} of ${summary.m3.denominator} eligible activated merchants`} definition={summary.m3.rule} tone="blue" /><Metric label="M6 Retention" value={metricDisplay(summary.m6)} note={`${summary.m6.numerator} of ${summary.m6.denominator} eligible activated merchants`} definition={summary.m6.rule} tone="coral" /><Metric label="Observed Stopped-use Rate" value={metricDisplay(summary.stopped)} note={`${summary.stopped.numerator} of ${summary.stopped.denominator} final-outcome eligible merchants`} definition={summary.stopped.rule} tone="amber" /></section>
    <section className="insight"><AlertTriangle /><div><b>Metric-specific eligibility protects right-censored merchants from false failures.</b><span>{summary.rightCensored.final} merchants do not yet have sufficient observation for a final outcome. M3, M6 and final-outcome denominators are calculated separately.</span></div></section>
    <div className="section-heading"><h2>Calendar View</h2><p>Natural portfolio-month trends, from 2024-01 through 2025-12.</p></div>
    <div className="grid two"><ChartPanel title="Active Merchants by Calendar Month" subtitle="Unique merchant IDs with active Bank QR usage"><ResponsiveContainer width="100%" height={300}><LineChart data={calendar} margin={{ left: 4, right: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><ReferenceArea x1="2024-01" x2="2024-03" fill="#f59e0b" fillOpacity={0.1} /><ReferenceArea x1="2025-11" x2="2025-12" fill="#f59e0b" fillOpacity={0.1} /><ReferenceLine x="2024-07" stroke="#64748b" strokeDasharray="4 4" /><ReferenceLine x="2025-03" stroke="#64748b" strokeDasharray="4 4" /><ReferenceLine x="2025-09" stroke="#64748b" strokeDasharray="4 4" /><XAxis dataKey="month" ticks={calendarAxisTicks} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip content={calendarTooltip} /><Legend /><Line type="monotone" dataKey="active" name="Active merchants" stroke="#0f766e" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></ChartPanel><ChartPanel title="Monthly Onboarding and Newly Stopped-use Events" subtitle="Event counts; campaign periods are shaded and pricing transitions are dashed"><ResponsiveContainer width="100%" height={300}><BarChart data={calendar} margin={{ left: 4, right: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><ReferenceArea x1="2024-01" x2="2024-03" fill="#f59e0b" fillOpacity={0.1} /><ReferenceArea x1="2025-11" x2="2025-12" fill="#f59e0b" fillOpacity={0.1} /><ReferenceLine x="2024-07" stroke="#64748b" strokeDasharray="4 4" /><ReferenceLine x="2025-03" stroke="#64748b" strokeDasharray="4 4" /><ReferenceLine x="2025-09" stroke="#64748b" strokeDasharray="4 4" /><XAxis dataKey="month" ticks={calendarAxisTicks} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip content={calendarTooltip} /><Legend /><Bar dataKey="onboarded" name="New onboarding" fill="#2563eb" /><Bar dataKey="stopped" name="Newly Stopped Using" fill="#e4573d" /></BarChart></ResponsiveContainer></ChartPanel></div>
    <ChartPanel title="Portfolio Bank QR Share by Calendar Month" subtitle="Portfolio-weighted: total Bank QR transaction value divided by total all-channel receipts for active merchants"><ResponsiveContainer width="100%" height={280}><AreaChart data={calendar}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" ticks={calendarAxisTicks} tick={{ fontSize: 10 }} /><YAxis tickFormatter={(value) => formatPct(Number(value))} /><Tooltip content={calendarTooltip} /><Area type="monotone" dataKey="share" name="Portfolio Bank QR Share" stroke="#f59e0b" fill="#fde7b0" strokeWidth={3} /></AreaChart></ResponsiveContainer><p className="chart-note">Survivor bias applies: the share among remaining active merchants can rise after low-usage merchants stop using.</p></ChartPanel>
    <div className="section-heading"><h2>Cohort View</h2><p>Retention uses merchant lifecycle age. N/A cells are right-censored and are never converted into zero.</p></div>
    <section className="panel cohort-panel"><div className="panel-title"><div><h2>Onboarding Cohorts</h2><p>Each metric cell includes its numerator, denominator and eligibility rule on hover.</p></div><div className="cohort-actions"><select value={cohortYear} onChange={(event) => { setCohortYear(event.target.value); setShowAllCohorts(false); }}><option>All</option><option>2024</option><option>2025</option></select><button className="text-button" onClick={() => setShowAllCohorts((value) => !value)}>{showAllCohorts ? "Show recent 12" : "Show all cohorts"}</button><button className="text-button" onClick={exportCohorts}>Export cohort table</button></div></div><div className="cohort-wrap"><table><thead><tr><th>Onboarding cohort</th><th>Merchants</th><th>30-day activation</th><th>M3 retention after activation</th><th>M6 retention after activation</th><th>Primary-channel conversion</th><th>Eligible for M3</th><th>Eligible for M6</th></tr></thead><tbody>{displayedCohorts.map((cohort) => <tr key={cohort.month}><td>{cohort.month}</td><td>{cohort.merchants}</td>{cohortCell(cohort.activation)}{cohortCell(cohort.m3)}{cohortCell(cohort.m6)}{cohortCell(cohort.primary)}<td>{cohort.eligibleM3}</td><td>{cohort.eligibleM6}</td></tr>)}</tbody></table></div></section>
    <div className="section-heading"><h2>Marketing Cohort Analysis</h2><p>Denominators vary by metric because right-censored merchants are excluded from lifecycle outcomes.</p></div>
    <div className="grid two"><ChartPanel title="Outcome Quality" subtitle="Activation and lifecycle outcomes use their own eligible merchant denominators"><ResponsiveContainer width="100%" height={310}><BarChart data={campaignQuality} margin={{ left: 4, right: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tickFormatter={(value) => formatPct(Number(value))} /><Tooltip content={campaignTooltip} /><Legend /><Bar dataKey="activation" name="30-day activation" fill="#0f766e" /><Bar dataKey="m3" name="M3 retention" fill="#2563eb" /><Bar dataKey="m6" name="M6 retention" fill="#8b5cf6" /><Bar dataKey="primary" name="Primary-channel conversion" fill="#f59e0b" /></BarChart></ResponsiveContainer></ChartPanel><ChartPanel title="Risk Indicators" subtitle="All risk indicators use the full merchant group as their denominator"><ResponsiveContainer width="100%" height={310}><BarChart data={campaignRisk} margin={{ left: 4, right: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tickFormatter={(value) => formatPct(Number(value))} /><Tooltip content={campaignTooltip} /><Legend /><Bar dataKey="promotion" name="Promotion dependency" fill="#f59e0b" /><Bar dataKey="complaint" name="Pricing complaint rate" fill="#e4573d" /><Bar dataKey="decline" name="Pricing-related usage decline" fill="#8b5cf6" /></BarChart></ResponsiveContainer></ChartPanel></div>
    <div className="grid two"><ChartPanel title="Primary Root Cause" subtitle="One primary root cause per observed Stopped Using merchant"><RootCauseChart causes={causes} churned={churned} /></ChartPanel><ContributingFactors merchants={merchants} /></div>
  </>;
}

function ContributingFactors({ merchants }: { merchants: MerchantView[] }) {
  const stoppedUsing = merchants.filter((merchant) => merchant.eligible_for_final_outcome && merchant.outcome.final_usage_status === "Churned");
  const contributors = [
    ["Pricing Expectation Gap", stoppedUsing.filter((m) => m.pricing.pricing_expectation_gap > 0).length],
    ["Rate Change Not Understood", stoppedUsing.filter((m) => m.pricing.affected_by_rate_change && !m.pricing.merchant_understood_rate_change).length],
    ["Promotion-led Adoption", stoppedUsing.filter((m) => m.outcome.promotion_driven_tag).length],
    ["Existing WeChat Habit", stoppedUsing.filter((m) => m.primary_channel_before === "WeChat Pay").length],
    ["Settlement Account Friction", stoppedUsing.filter((m) => m.settlement_account_usage === "Rarely Used, Requires Transfer Out").length],
    ["Speaker Reliability Issue", stoppedUsing.filter((m) => m.outcome.speaker_issue_count > 0).length]
  ].map(([name, value]) => ({ name: String(name), fullName: String(name), value: Number(value), annotation: `${value} (${formatPct(percent(Number(value), stoppedUsing.length))})` })).sort((a, b) => b.value - a.value);
  return <ChartPanel title="Contributing Factors" subtitle={`Unique merchants among ${stoppedUsing.length} sufficiently observed Stopped Using merchants; multiple factors may apply`}><ResponsiveContainer width="100%" height={Math.max(270, contributors.length * 42)}><BarChart layout="vertical" data={contributors} margin={{ left: 18, right: 74 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={178} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><Tooltip content={chartTooltip} /><Bar dataKey="value" name="Merchants" fill="#8b5cf6" radius={[0, 5, 5, 0]}><LabelList dataKey="annotation" position="right" fill="#52656a" fontSize={12} /></Bar></BarChart></ResponsiveContainer></ChartPanel>;
}

function PricingCommunication({ affected, churned, pricingChurn, understood, merchants }: { affected: MerchantView[]; churned: MerchantView[]; pricingChurn: MerchantView[]; understood: MerchantView[]; merchants: MerchantView[] }) {
  const [selectedRegimeId, setSelectedRegimeId] = useState("REGIME_A");
  const regimes = pricingRegimeRows(merchants);
  const industries = feeBurdenByIndustry(merchants);
  const usage = merchants.flatMap((merchant) => merchant.usage);
  const selectedRegime = PRICING_REGIMES.find((regime) => regime.id === selectedRegimeId)!;
  const exampleDeposit = 50000;
  const exampleBankValue = 230000;
  const baseAllowance = selectedRegime.baseFreeQuota;
  const depositAllowance = exampleDeposit * selectedRegime.depositMultiplier;
  const totalAllowance = totalFreeTransactionAllowance(baseAllowance, depositAllowance);
  const chargeableValue = selectedRegime.model === "quota" ? Math.max(exampleBankValue - totalAllowance, 0) : exampleBankValue;
  const estimatedFee = selectedRegime.model === "quota" ? chargeableValue * SYNTHETIC_EXCESS_RATE : exampleBankValue * selectedRegime.flatRate;
  const effectiveRate = exampleBankValue ? estimatedFee / exampleBankValue : 0;
  const totalComplaints = merchants.filter((merchant) => merchant.pricing.pricing_complaint).length;
  const openComplaints = merchants.filter((merchant) => merchant.pricing.pricing_complaint && !merchant.pricing.complaint_resolved).length;
  const complaintResolutionRate = percent(totalComplaints - openComplaints, totalComplaints);
  const distribution = [["0%", 0, 0], ["0.01%-0.15%", 0, 0.0015], ["0.16%-0.22%", 0.0015, 0.0022], [">0.22%", 0.0022, Infinity]].map(([name, min, max]) => ({ name, value: usage.filter((row) => row.effective_fee_rate >= Number(min) && row.effective_fee_rate < Number(max)).length }));
  const transitions = Array.from({ length: 24 }, (_, index) => { const month = `202${index < 12 ? 4 : 5}-${String((index % 12) + 1).padStart(2, "0")}`; const rows = usage.filter((row) => row.portfolio_month === month); return { month, complaints: rows.filter((row) => row.pricing_complaint).length, decline: rows.filter((row) => row.pricing_related_usage_decline).length }; });
  const comm = [{ name: "Sent", value: affected.filter((merchant) => merchant.pricing.rate_notification_sent).length }, { name: "Received", value: affected.filter((merchant) => merchant.pricing.notification_received).length }, { name: "Acknowledged", value: affected.filter((merchant) => merchant.pricing.notification_acknowledged).length }, { name: "Understood", value: understood.length }];
  const formatCurrency = (value: number) => `RMB ${Math.round(value).toLocaleString()}`;
  const durationMonths = (regime: typeof PRICING_REGIMES[number]) => (Number(regime.endDate.slice(0, 4)) - Number(regime.startDate.slice(0, 4))) * 12 + Number(regime.endDate.slice(5, 7)) - Number(regime.startDate.slice(5, 7)) + 1;
  return <>
    <section className="metric-grid pricing-kpis"><Metric label="Rate-change Affected" value={String(affected.length)} note={`${affected.length} of ${merchants.length} merchants. Merchants affected by at least one pricing transition.`} /><Metric label="Rate Change Understood" value={formatPct(percent(understood.length, affected.length))} note={`${understood.length} of ${affected.length} affected merchants. Confirmed understanding of mechanism, date and likely fee impact.`} tone="blue" /><Metric label="Stopped-use Cases with Pricing-related Factors" value={formatPct(percent(pricingChurn.length, churned.length))} note={`${pricingChurn.length} of ${churned.length} sufficiently observed stopped-use cases. Recorded as a primary or contributing factor.`} tone="coral" /><Metric label="Open Pricing Complaints" value={String(openComplaints)} note={`${openComplaints} open of ${totalComplaints} total pricing complaints. Resolution rate: ${formatPct(complaintResolutionRate)}.`} tone="amber" /></section>
    <section className="pricing-event"><BellRing /><div><p className="eyebrow">{PRICING_ASSUMPTION_LABEL}</p><h2>Two Charging Models Across Four Pricing Regimes</h2><p>Dates, formulas, rates and thresholds are configurable synthetic assumptions informed by prior merchant onboarding experience. They do not represent the official pricing history or policy of any bank or payment institution.</p></div></section>
    <ChartPanel title="Pricing Regime Timeline" subtitle="Segment width represents duration across January 2024 to December 2025."><div className="allowance-definition"><b>Free Transaction Allowance</b><span>A Free Transaction Allowance is the monthly Bank QR transaction value that can be processed without a simulated transaction fee. It is not an account balance, credit facility or transaction limit. It is calculated monthly, applies only to Bank QR transaction value, and excludes estimated all-channel merchant receipts.</span></div><div className="timeline-events"><span title="A period of intensive merchant acquisition, promotional offers and gift-led onboarding.">Marketing Campaign: Jan-Mar 2024</span><span title="A period of stronger transaction activity among fruit retail and wholesale merchants around the year-end and Lunar New Year trading cycle.">Fruit Trade Seasonal Peak: Dec-Mar</span><span title="A period of intensive merchant acquisition, promotional offers and gift-led onboarding. Post-campaign retention is not fully observable within the dataset.">Marketing Campaign: Nov-Dec 2025</span></div><div className="pricing-group-labels"><span className="allowance-group">Allowance-based Charging</span><span className="flat-group">Flat-rate Charging</span></div><div className="pricing-timeline proportional">{PRICING_REGIMES.map((regime) => <div className={`regime-segment ${regime.id.toLowerCase()}`} style={{ gridColumn: `span ${durationMonths(regime)}` }} key={regime.id}><div><b>{regime.id.replace("REGIME_", "Regime ")}</b><em>Synthetic Assumption</em></div><span>{regime.startDate} to {regime.endDate}</span><small>{durationMonths(regime)} months</small><strong>{regime.label}</strong></div>)}</div><p className="timeline-note">Allowance-based regimes charge only Bank QR transaction value above the Total Free Transaction Allowance. Flat-rate regimes charge all Bank QR transaction value at the configured rate.</p></ChartPanel>
    <ChartPanel title="Worked Example" subtitle="A synthetic calculation driven by the active configuration."><div className="example-toolbar"><label>Inspect regime <select value={selectedRegimeId} onChange={(event) => setSelectedRegimeId(event.target.value)}>{PRICING_REGIMES.map((regime) => <option key={regime.id} value={regime.id}>{regime.id.replace("REGIME_", "Regime ")}: {regime.label}</option>)}</select></label></div>{selectedRegime.model === "quota" ? <><p className="example-copy">Current Synthetic Interpretation: {allowanceFormulaInterpretations[allowanceFormulaMode]} This interpretation is configurable and does not represent a confirmed historical policy.</p><div className="worked-example"><span>Previous-month average daily deposit<b>{formatCurrency(exampleDeposit)}</b></span><span>Base Free Allowance<b>{formatCurrency(baseAllowance)}</b></span><span>Deposit-linked Allowance<b>{formatCurrency(depositAllowance)}</b></span><span>Total Free Transaction Allowance<b>{formatCurrency(totalAllowance)}</b></span><span>Monthly Bank QR transaction value<b>{formatCurrency(exampleBankValue)}</b></span><span>Chargeable Transaction Value<b>{formatCurrency(chargeableValue)}</b></span><span>Synthetic excess rate<b>{formatRate(SYNTHETIC_EXCESS_RATE)}</b></span><span>Estimated monthly fee<b>{formatCurrency(estimatedFee)}</b></span><span>Effective fee rate<b>{formatRate(effectiveRate)}</b></span></div></> : <><p className="example-copy">Estimated Monthly Fee = Monthly Bank QR Transaction Value x Applicable Flat Rate.</p><div className="worked-example"><span>Monthly Bank QR transaction value<b>{formatCurrency(exampleBankValue)}</b></span><span>Applicable flat rate<b>{formatRate(selectedRegime.flatRate)}</b></span><span>Estimated monthly fee<b>{formatCurrency(estimatedFee)}</b></span><span>Effective fee rate<b>{formatRate(effectiveRate)}</b></span></div></>}</ChartPanel>
    <div className="grid two"><ChartPanel title="Allowance-based Charging: Fee Components" subtitle="Average Free Transaction Allowance, chargeable value and estimated fee"><ResponsiveContainer width="100%" height={290}><BarChart data={regimes.slice(0, 2)}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="id" /><YAxis /><Tooltip content={chartTooltip} /><Legend /><Bar dataKey="freeQuota" name="Average Free Transaction Allowance" fill="#0f766e" /><Bar dataKey="chargeable" name="Chargeable Transaction Value" fill="#f59e0b" /><Bar dataKey="fee" name="Estimated monthly fee" fill="#e4573d" /></BarChart></ResponsiveContainer></ChartPanel><ChartPanel title="Flat-rate Charging: Applied Rate and Value" subtitle="Rates are shown as discrete regime outputs"><ResponsiveContainer width="100%" height={290}><BarChart data={regimes.slice(2)}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="id" /><YAxis yAxisId="value" /><YAxis yAxisId="rate" orientation="right" tickFormatter={(value) => formatRate(Number(value))} /><Tooltip content={chartTooltip} /><Legend /><Bar yAxisId="value" dataKey="value" name="Transaction value" fill="#2563eb" /><Bar yAxisId="value" dataKey="fee" name="Estimated monthly fee" fill="#e4573d" /><Bar yAxisId="rate" dataKey="appliedRate" name="Applied rate" fill="#8b5cf6" /></BarChart></ResponsiveContainer></ChartPanel></div>
    <div className="grid two"><ChartPanel title="Effective Fee Rate Distribution" subtitle="Merchant-month distribution across all observed records"><ResponsiveContainer width="100%" height={270}><BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis /><Tooltip content={chartTooltip} /><Bar dataKey="value" name="Merchant-month records" fill="#2563eb" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel><ChartPanel title="Fee Burden by Industry" subtitle="Average estimated fee and effective fee rate"><ResponsiveContainer width="100%" height={Math.max(270, industries.length * 38)}><BarChart layout="vertical" data={industries} margin={{ left: 18, right: 24 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={142} tickLine={false} axisLine={false} /><Tooltip content={chartTooltip} /><Bar dataKey="fee" name="Average estimated fee" fill="#e4573d" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></ChartPanel></div>
    <div className="grid two"><ChartPanel title="Pricing-related Complaints and Usage Decline" subtitle="Portfolio-month records around pricing transitions"><ResponsiveContainer width="100%" height={290}><LineChart data={transitions}><CartesianGrid strokeDasharray="3 3" vertical={false} /><ReferenceLine x="2024-07" stroke="#64748b" strokeDasharray="4 4" /><ReferenceLine x="2025-03" stroke="#64748b" strokeDasharray="4 4" /><ReferenceLine x="2025-09" stroke="#64748b" strokeDasharray="4 4" /><XAxis dataKey="month" ticks={calendarAxisTicks} tick={{ fontSize: 10 }} /><YAxis /><Tooltip content={chartTooltip} /><Legend /><Line type="monotone" dataKey="complaints" name="Pricing-related complaints" stroke="#e4573d" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="decline" name="Usage decline after transition" stroke="#f59e0b" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></ChartPanel><ChartPanel title="Notification Sent to Understood" subtitle="Receiving a notice does not mean understanding it"><ResponsiveContainer width="100%" height={290}><BarChart data={comm}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip content={chartTooltip} /><Bar dataKey="value" name="Merchants" fill="#0f766e" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel></div>
  </>;
}
function Actions({ merchants, selected }: { merchants: MerchantView[]; selected: (m: MerchantView) => void }) { const atRisk = merchants.filter((m) => m.outcome.priority === "High").sort((a, b) => Number(b.pricing.pricing_related_churn) - Number(a.pricing.pricing_related_churn) || b.pricing.rate_sensitivity_score - a.pricing.rate_sensitivity_score); return <><section className="insight"><Zap /><div><b>Action centre ranks the next conversation, not just the last failure.</b><span>High-priority merchants include unresolved pricing complaints, poor rate-change understanding, and nearby accounts where assisted recovery is practical.</span></div></section><MerchantTable merchants={atRisk} selected={selected} title={`Prioritised action queue (${atRisk.length})`} compact /></> }

function MerchantTable({ merchants, selected, title, compact = false }: { merchants: MerchantView[]; selected: (m: MerchantView) => void; title: string; compact?: boolean }) {
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<"merchant" | "industry" | "status" | "priority">("merchant");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const sorted = [...merchants].sort((a, b) => {
    const values = { merchant: [a.merchant_id, b.merchant_id], industry: [a.industry, b.industry], status: [statusLabel(a.outcome.final_usage_status), statusLabel(b.outcome.final_usage_status)], priority: [a.outcome.priority, b.outcome.priority] }[sortKey];
    return String(values[0]).localeCompare(String(values[1])) * (sortDirection === "asc" ? 1 : -1);
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = sorted.length ? (currentPage - 1) * pageSize : 0;
  const end = Math.min(start + pageSize, sorted.length);
  const rows = sorted.slice(start, end);
  const toggleSort = (key: typeof sortKey) => { if (key === sortKey) setSortDirection((direction) => direction === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDirection("asc"); } setPage(1); };
  return <section className="panel table-panel"><div className="panel-title"><div><h2>{title}</h2><p>{compact ? "Prioritised action list, not the full merchant portfolio." : "Click a merchant to inspect the timeline and action context."}</p></div><span className="count">{merchants.length}</span></div>{!compact && <div className="portfolio-summary"><span>308 total merchants</span><span>Filtered result: {merchants.length} merchants</span></div>}<div className="table-wrap"><table><thead><tr><th><button onClick={() => toggleSort("merchant")}>Merchant</button></th><th><button onClick={() => toggleSort("industry")}>Industry</button></th><th><button onClick={() => toggleSort("status")}>Final status</button></th><th>Rate understood</th><th>Root cause</th><th><button onClick={() => toggleSort("priority")}>Priority</button></th></tr></thead><tbody>{rows.map((m) => <tr key={m.merchant_id} onClick={() => selected(m)}><td><b>{m.merchant_id}</b><small>{m.synthetic_merchant_name}</small></td><td>{m.industry}</td><td><span className={`status ${m.outcome.final_usage_status.toLowerCase().replaceAll(" ", "-")}`}>{statusLabel(m.outcome.final_usage_status)}</span></td><td>{m.pricing.affected_by_rate_change ? m.pricing.merchant_understood_rate_change ? "Understood" : "Not confirmed" : "N/A"}</td><td>{m.outcome.likely_root_cause}</td><td><span className={`priority ${m.outcome.priority.toLowerCase()}`}>{m.outcome.priority}</span></td></tr>)}</tbody></table></div><div className="table-pagination"><span>Showing rows {sorted.length ? start + 1 : 0}-{end} of {sorted.length}</span><label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[12, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><div className="pager"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>Previous</button><span>Page {currentPage} of {totalPages}</span><button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>Next</button></div><label>Jump to page <input type="number" min="1" max={totalPages} value={currentPage} onChange={(event) => setPage(Math.max(1, Math.min(totalPages, Number(event.target.value) || 1)))} /></label></div></section>;
}
function MerchantDrawer({ merchant: m, onClose }: { merchant: MerchantView; onClose: () => void }) { return <div className="drawer-layer" onMouseDown={onClose}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}><button className="icon-btn drawer-close" onClick={onClose} aria-label="Close merchant details"><X /></button><p className="eyebrow">Merchant detail</p><h2>{m.merchant_id}</h2><p className="muted">{m.industry} - {m.merchant_size} - {m.branch_proximity} branch proximity</p><div className="drawer-kpis"><div><span>Final status</span><b>{statusLabel(m.outcome.final_usage_status)}</b></div><div><span>Final QR share</span><b>{formatPct(m.outcome.final_bank_qr_share)}</b></div><div><span>Applied rate</span><b>{formatRate(m.pricing.current_applied_rate)}</b></div><div><span>Priority</span><b>{m.outcome.priority}</b></div></div><h3>Pricing and communication</h3><dl><dt>Expected rate</dt><dd>{formatRate(m.pricing.expected_rate)}</dd><dt>Expectation gap</dt><dd>{formatRate(m.pricing.pricing_expectation_gap)}</dd><dt>Notification</dt><dd>{m.pricing.notification_received ? "Received" : "Not confirmed"}</dd><dt>Understood change</dt><dd>{m.pricing.merchant_understood_rate_change ? "Yes" : "No"}</dd></dl><div className="next-action"><p>Recommended action</p><b>{m.outcome.recommended_action}</b></div></aside></div>; }
function Methodology() { return <section className="method"><div className="method-hero"><CircleHelp /><div><p className="eyebrow">Data and assumptions</p><h2>An analytical portfolio piece with transparent synthetic foundations</h2><p>This project uses deterministic, simulated merchant records. It does not report a real bank, acquirer, merchant, or payment-platform performance result.</p></div></div><div className="method-grid"><section><h3>Dataset grain</h3><p>308 merchants are observed from 2024-01 through 2025-12, with variable merchant-month record lengths.</p></section><section><h3>Campaign observation</h3><p>Marketing peaks occur in 2024 Q1 and at 2025 year-end. The latter cannot be observed for full post-campaign retention and is right-censored.</p></section><section><h3>Outcome definitions</h3><p>Stopped Using corresponds to the analytical concept of merchant churn. Right-censored merchants are not classified as retained or stopped using.</p></section><section><h3>Pricing hypothesis</h3><p>{PRICING_ASSUMPTION_LABEL}. Four configured synthetic regimes track deposit-linked Free Transaction Allowance and flat-rate periods.</p></section></div></section>; }
export default App;
