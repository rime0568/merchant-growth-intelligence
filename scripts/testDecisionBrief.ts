import decisionBrief from "../netlify/functions/decision-brief";

const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

delete process.env.OPENAI_API_KEY;

const metrics = {
  portfolio_size: 308,
  primary_user_rate: 0.133,
  stopped_use_rate: 0.503,
  pricing_related_stopped_use_share: 0.665,
  rate_change_exposure: 0.45,
  pricing_understanding_rate: 0.62,
  open_complaints: 4
};

const valid = await decisionBrief(new Request("http://localhost/api/decision-brief", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ metrics })
}));
assert(valid.status === 200, "Valid metrics must return 200");
const validBody = await valid.json() as { mode?: string; evidence?: { value?: string }[] };
assert(validBody.mode === "demo", "A missing provider key must return labelled demo mode");
assert(validBody.evidence?.some((item) => item.value === "50.3%") === true, "Trusted metric values must be formatted by the server");

const invalid = await decisionBrief(new Request("http://localhost/api/decision-brief", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ metrics: { portfolio_size: 308 } })
}));
assert(invalid.status === 400, "Incomplete metrics must return 400");

const wrongMethod = await decisionBrief(new Request("http://localhost/api/decision-brief"));
assert(wrongMethod.status === 405, "GET must return 405");

console.log("Decision brief contract tests passed.");
