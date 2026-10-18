type MetricKey =
  | "portfolio_size"
  | "primary_user_rate"
  | "stopped_use_rate"
  | "pricing_related_stopped_use_share"
  | "rate_change_exposure"
  | "pricing_understanding_rate"
  | "open_complaints";

type Metrics = Record<MetricKey, number>;

const labels: Record<MetricKey, string> = {
  portfolio_size: "Merchants in scope",
  primary_user_rate: "Primary-user rate",
  stopped_use_rate: "Observed stopped-use rate",
  pricing_related_stopped_use_share: "Pricing-related share of stopped-use cases",
  rate_change_exposure: "Rate-change exposure",
  pricing_understanding_rate: "Rate-change understanding",
  open_complaints: "Open pricing complaints"
};

const percentMetrics = new Set<MetricKey>([
  "primary_user_rate",
  "stopped_use_rate",
  "pricing_related_stopped_use_share",
  "rate_change_exposure",
  "pricing_understanding_rate"
]);

function valueFor(key: MetricKey, value: number) {
  return percentMetrics.has(key) ? `${(value * 100).toFixed(1)}%` : String(Math.round(value));
}

function validMetrics(input: unknown): input is Metrics {
  if (!input || typeof input !== "object") return false;
  return (Object.keys(labels) as MetricKey[]).every((key) => Number.isFinite((input as Metrics)[key]));
}

function demo(metrics: Metrics) {
  return {
    mode: "demo" as const,
    summary: "Pricing understanding is the clearest intervention point in this portfolio. Begin follow-up before the next rate transition and prioritise unresolved complaints.",
    evidence: (["stopped_use_rate", "pricing_related_stopped_use_share", "pricing_understanding_rate"] as MetricKey[]).map((metricKey) => ({
      metricKey,
      label: labels[metricKey],
      value: valueFor(metricKey, metrics[metricKey]),
      interpretation: metricKey === "pricing_understanding_rate"
        ? "Separates confirmed understanding from simple message delivery."
        : "Calculated by deterministic application code using documented eligibility rules."
    })),
    actions: [
      "Prioritise unresolved pricing complaints before the next rate-effective date.",
      "Confirm understanding instead of treating message delivery as comprehension.",
      "Measure post-intervention M3 and M6 retention with unchanged eligibility rules."
    ],
    limitations: [
      "All records and pricing regimes are synthetic.",
      "The analysis is descriptive and does not establish causality.",
      "No live model was called because the server-side API configuration is absent."
    ]
  };
}

function extractOutputText(payload: any): string | null {
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return typeof payload?.output_text === "string" ? payload.output_text : null;
}

export default async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { portfolioLabel?: string; metrics?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!validMetrics(body.metrics)) {
    return Response.json({ error: "All documented portfolio metrics are required." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) return Response.json(demo(body.metrics));

  const metricKeys = Object.keys(labels) as MetricKey[];
  const suppliedMetrics = Object.fromEntries(metricKeys.map((key) => [key, {
    label: labels[key],
    value: valueFor(key, body.metrics![key])
  }]));

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "evidence", "actions", "limitations"],
    properties: {
      summary: { type: "string" },
      evidence: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["metric_key", "interpretation"],
          properties: {
            metric_key: { type: "string", enum: metricKeys },
            interpretation: { type: "string" }
          }
        }
      },
      actions: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
      limitations: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } }
    }
  };

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_output_tokens: 900,
      input: [
        {
          role: "system",
          content: "You are a merchant-portfolio analyst. Use only the supplied metrics. Never recalculate values, claim causality, or imply that synthetic data is real. Select evidence keys and give concise operational recommendations that require human review."
        },
        {
          role: "user",
          content: JSON.stringify({ portfolio: body.portfolioLabel || "Filtered portfolio", metrics: suppliedMetrics })
        }
      ],
      text: { format: { type: "json_schema", name: "merchant_decision_brief", strict: true, schema } }
    })
  });

  if (!apiResponse.ok) {
    const diagnostic = await apiResponse.text();
    console.error("OpenAI request failed", apiResponse.status, diagnostic.slice(0, 500));
    return Response.json(demo(body.metrics));
  }

  const payload = await apiResponse.json();
  const outputText = extractOutputText(payload);
  if (!outputText) return Response.json(demo(body.metrics));

  try {
    const parsed = JSON.parse(outputText) as {
      summary: string;
      evidence: { metric_key: MetricKey; interpretation: string }[];
      actions: string[];
      limitations: string[];
    };
    const evidence = parsed.evidence.map((item) => ({
      metricKey: item.metric_key,
      label: labels[item.metric_key],
      value: valueFor(item.metric_key, body.metrics![item.metric_key]),
      interpretation: item.interpretation
    }));
    return Response.json({ mode: "live", summary: parsed.summary, evidence, actions: parsed.actions, limitations: parsed.limitations });
  } catch (error) {
    console.error("Structured output parsing failed", error);
    return Response.json(demo(body.metrics));
  }
};
