export const recommendations = ["PURSUE", "STRETCH", "SKIP", "CLARIFY", "QUARANTINE"] as const;
export type CareerRequirement = {
  name: string;
  kind: "SKILL" | "EXPERIENCE" | "RESPONSIBILITY" | "WORKLOAD" | "QUALIFICATION";
  priority: "REQUIRED" | "PREFERRED" | "MENTIONED";
  evidence: "SUPPORTED" | "CLAIMED" | "GAP" | "UNKNOWN";
  quote: string;
  finding: string;
  projects: string[];
};
export type CareerReview = {
  version: 1;
  assessedAt: string;
  recommendation: typeof recommendations[number];
  reason: string;
  coverage: string;
  requirements: CareerRequirement[];
  nextSteps: string[];
};
const bounded = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
export function isCareerReview(v: unknown): v is CareerReview {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const a = v as Record<string, unknown>;
  return a.version === 1 && bounded(a.assessedAt, 40) && Number.isFinite(Date.parse(a.assessedAt)) &&
    recommendations.some(r => r === a.recommendation) && bounded(a.reason, 800) && bounded(a.coverage, 800) &&
    Array.isArray(a.nextSteps) && a.nextSteps.length <= 8 && a.nextSteps.every(s => bounded(s, 700)) &&
    Array.isArray(a.requirements) && a.requirements.length <= 20 && a.requirements.every(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const q = value as Record<string, unknown>;
      return bounded(q.name, 100) && ["SKILL", "EXPERIENCE", "RESPONSIBILITY", "WORKLOAD", "QUALIFICATION"].includes(String(q.kind)) &&
        ["REQUIRED", "PREFERRED", "MENTIONED"].includes(String(q.priority)) && ["SUPPORTED", "CLAIMED", "GAP", "UNKNOWN"].includes(String(q.evidence)) &&
        bounded(q.quote, 280) && bounded(q.finding, 700) && Array.isArray(q.projects) && q.projects.length <= 6 && q.projects.every(s => bounded(s, 100));
    });
}
