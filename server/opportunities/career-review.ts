import { isProjectEvidence } from "@/features/opportunities/lib/project-evidence";
import type { CareerReview, CareerRequirement } from "@/features/opportunities/lib/career-review";
import type { CareerProfile } from "./fit";
import type { SourceListing } from "./sources";
import { weeklyHours } from "./policy";

type Term = { name: string; pattern: RegExp; kind?: CareerRequirement["kind"] };
const terms: Term[] = [
  { name: "React", pattern: /\breact(?:\.js|js)?\b/i },
  { name: "Next.js", pattern: /\bnext(?:\.js|js| js)\b/i },
  { name: "TypeScript", pattern: /\btypescript\b/i },
  { name: "JavaScript", pattern: /\bjavascript\b/i },
  { name: "HTML", pattern: /\bhtml(?:5)?\b/i },
  { name: "CSS", pattern: /\bcss(?:3)?\b/i },
  { name: "Tailwind CSS", pattern: /\btailwind(?: css)?\b/i },
  { name: "Vue", pattern: /\bvue(?:\.js|js)?\b/i },
  { name: "Angular", pattern: /\bangular\b/i },
  { name: "Svelte", pattern: /\bsvelte\b/i },
  { name: "Node.js", pattern: /\bnode(?:\.js|js| js)\b/i },
  { name: "Python", pattern: /\bpython\b/i },
  { name: "Java", pattern: /\bjava\b/i },
  { name: "C#", pattern: /(?:^|\W)c#(?=\W|$)/i },
  { name: "PHP", pattern: /\bphp\b/i },
  { name: "R", pattern: /(?:^r$|\b(?:programming in r|r programming|r language|especially in r)\b)/i },
  { name: "Prisma", pattern: /\bprisma\b/i },
  { name: "PostgreSQL", pattern: /\bpostgres(?:ql)?\b/i },
  { name: "SQL", pattern: /\bsql\b/i },
  { name: "GraphQL", pattern: /\bgraphql\b/i },
  { name: "REST APIs", pattern: /\brest(?:ful)?(?: api[s]?)?\b/i },
  { name: "AWS", pattern: /\b(?:aws|amazon web services)\b/i },
  { name: "Docker", pattern: /\bdocker\b/i },
  { name: "Kubernetes", pattern: /\b(?:kubernetes|k8s)\b/i },
  { name: "Git", pattern: /\bgit\b/i },
  { name: "Playwright", pattern: /\bplaywright\b/i },
  { name: "Testing Library", pattern: /\btesting library\b/i },
  { name: "Automated testing", pattern: /\b(?:automated tests?|unit tests?|integration tests?|end.to.end tests?)\b/i, kind: "RESPONSIBILITY" },
  { name: "Accessibility", pattern: /\b(?:accessibility|wcag|screen reader|keyboard navigation)\b/i, kind: "RESPONSIBILITY" },
  { name: "Web performance", pattern: /\b(?:core web vitals|web performance|performance optimi[sz]ation|bundle optimi[sz]ation)\b/i, kind: "RESPONSIBILITY" },
  { name: "API integration", pattern: /\b(?:api integration|integrat\w* (?:with |the |rest |backend )*apis?|consum\w* (?:rest |graphql )*apis?)\b/i, kind: "RESPONSIBILITY" },
  { name: "Authentication", pattern: /\b(?:authentication|authorization|better auth)\b/i, kind: "RESPONSIBILITY" },
  { name: "Team leadership", pattern: /\b(?:lead(?:ing)? (?:a |the )?(?:team|engineers)|mentoring|mentor(?:ing)? (?:developers|engineers)|people management)\b/i, kind: "RESPONSIBILITY" },
];
function priority(text: string, heading: CareerRequirement["priority"]): CareerRequirement["priority"] {
  const preferred = /\b(?:preferred|nice.to.have|bonus|desirable|optional|a plus|not required)\b/i.test(text);
  const required = /\b(?:must|required|minimum|mandatory|essential|need to|you will|responsibilities)\b/i.test(text.replace(/not required/gi, ""));
  if (preferred && required) return "MENTIONED";
  if (preferred) return "PREFERRED";
  if (/\b(?:must|required|minimum|mandatory|essential|need to|you will|responsibilities)\b/i.test(text)) return "REQUIRED";
  return heading;
}
function supportsContribution(contribution: string, term: Term) {
  return contribution.split(/[;\n]|[.](?:\s|$)/).some(clause => term.pattern.test(clause) &&
    /\b(?:built|build|implemented|implement|integrated|integrate|tested|test|optimi[sz]ed|maintained|designed|developed|delivered|refactored|created)\b/i.test(clause) &&
    !/\b(?:not|never|only observed|planning|plan to|will|would|learning|learn|hope to|team|we)\b/i.test(clause));
}
function quote(text: string, match: RegExp) {
  const start = Math.max(0, (text.search(match) < 0 ? 0 : text.search(match)) - 70);
  return text.slice(start, start + 280).trim();
}
// This is a bounded, deterministic evidence review, not an LLM or a credential verifier.
export function reviewCareer(listing: SourceListing, profile: CareerProfile, quarantined: boolean, now = new Date()): CareerReview {
  const projects = isProjectEvidence(profile.projectEvidence) ? profile.projectEvidence : [];
  const text = listing.description.slice(0, 16000);
  const fragments = text.replace(/\b(must haves?|nice to haves?|requirements|qualifications|responsibilities|benefits|about us|job overview)\b\s*:?/gi, "\n$1\n")
    .split(/\n|;|[.!?](?:\s|$)/).map(s => s.trim()).filter(Boolean).slice(0, 160);
  const rows: CareerRequirement[] = [];
  let heading: CareerRequirement["priority"] = "MENTIONED";
  let experienceGap = 0, workloadExceeded = false, alternativesUnresolved = false;
  const put = (row: CareerRequirement) => {
    const prior = rows.findIndex(r => r.name === row.name && r.kind === row.kind);
    if (prior < 0) rows.push(row);
    else if (rows[prior].priority !== "REQUIRED" && row.priority === "REQUIRED") rows[prior] = row;
  };
  for (const fragment of fragments) {
    if (/^(?:nice to haves?|benefits|about us|job overview)$/i.test(fragment)) { heading = /^nice/i.test(fragment) ? "PREFERRED" : "MENTIONED"; continue; }
    if (/^(?:must haves?|requirements|qualifications|responsibilities)$/i.test(fragment)) { heading = "REQUIRED"; continue; }
    const p = priority(fragment, heading);
    if (p === "MENTIONED" && /required|must/i.test(fragment) && /preferred|optional|nice.to.have/i.test(fragment)) alternativesUnresolved = true;
    const found = terms.filter(t => t.pattern.test(fragment));
    // Either/or wording must not invent several mandatory skill gaps.
    const alternatives = found.length > 1 && /\bor\b|at least one|one of|such as|e\.g\./i.test(fragment);
    if (alternatives) alternativesUnresolved = true;
    const groups = alternatives ? [found] : found.map(t => [t]);
    for (const group of groups) {
      if (!group.length || /\b(?:no|without) (?:prior )?experience (?:with|in)|no .{0,30}required/i.test(fragment)) continue;
      const claimed = group.some(t => profile.skills.some(s => t.pattern.test(s)));
      const supported = projects.filter(project => group.some(t => supportsContribution(project.contribution, t) && project.skills.some(s => t.pattern.test(s))));
      const tagged = projects.filter(project => group.some(t => project.skills.some(s => t.pattern.test(s))));
      const evidence = supported.length ? "SUPPORTED" : claimed || tagged.length ? "CLAIMED" : p === "MENTIONED" ? "UNKNOWN" : "GAP";
      const names = group.map(t => t.name).join(" / ").slice(0, 100);
      put({ name: names, kind: group[0].kind || "SKILL", priority: p, evidence, quote: quote(fragment, group[0].pattern),
        finding: supported.length ? "Your recorded skill and personal contribution both name this capability. Owner-recorded, not independently verified." :
          claimed || tagged.length ? "Named in your skills or project tags, but no matching personal contribution is recorded. Prepare a concrete example." :
          p === "MENTIONED" ? "Mentioned in the source; neither requirement strength nor your evidence is established." : "No matching recorded skill or contribution. Missing evidence does not prove inability.",
        projects: (supported.length ? supported : tagged).map(project => project.name).slice(0, 6) });
    }
    const years = [...fragment.matchAll(/\b(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s*\+?\s*years?\s+(?:of\s+)?(?:[a-zA-Z.+#-]+\s+){0,4}experience/gi)];
    for (const match of years) {
      const required = Number(match[1]);
      const gap = Math.max(0, required - profile.experienceYears);
      if (p === "REQUIRED") experienceGap = Math.max(experienceGap, gap);
      put({name: `${required}+ years of experience`, kind: "EXPERIENCE", priority: p, evidence: gap ? "GAP" : "CLAIMED", quote: quote(fragment, /\d{1,2}/),
        finding: `Source names ${required}+ years; your profile records ${profile.experienceYears}+. ${gap ? "Do not claim the missing years." : "Timeline and relevance still need validation."}`, projects: []});
    }
    if (/\b(?:bachelor[’']?s|master[’']?s|degree|certification)\b/i.test(fragment) && !/no .{0,20}(?:degree|certification).{0,20}required/i.test(fragment)) {
      put({name: "Qualification",kind:"QUALIFICATION",priority: /equivalent|or experience/i.test(fragment) ? "MENTIONED" : p,evidence:"UNKNOWN",quote:quote(fragment,/degree|bachelor|master|certification/i),finding:"No structured qualification evidence is recorded. Check whether a degree is mandatory, preferred or replaceable with experience; do not invent credentials.",projects:[]});
    }
  }
  const hours = weeklyHours(text);
  if (hours !== null) {
    workloadExceeded = profile.maxWeeklyHours !== null && hours > profile.maxWeeklyHours;
    put({name:"Weekly workload",kind:"WORKLOAD",priority:"REQUIRED",evidence:workloadExceeded?"GAP":"UNKNOWN",quote:quote(text,/\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*(?:hours?|hrs?|h)/i),finding:`Source mentions up to ${hours} hours/week; your limit is ${profile.maxWeeklyHours ?? "not set"}. ${workloadExceeded ? "This exceeds your recorded boundary." : "Confirm overtime, availability and actual expectations."}`,projects:[]});
  }
  const senior = /\b(senior|lead|principal|staff|head|director|cto)\b/i.test(listing.title);
  if (senior) put({name:"Senior responsibility",kind:"RESPONSIBILITY",priority:"REQUIRED",evidence:"UNKNOWN",quote:listing.title.slice(0,280),finding:"Title signals higher ownership. Project delivery alone does not establish team leadership, architecture depth or senior operating experience.",projects:[]});
  const requiredGaps = rows.filter(r => r.priority === "REQUIRED" && r.evidence === "GAP" && ["SKILL","RESPONSIBILITY"].includes(r.kind));
  const support = rows.filter(r => r.evidence === "SUPPORTED");
  const requiredUnproven = rows.filter(r => r.priority === "REQUIRED" && ["SKILL","RESPONSIBILITY","QUALIFICATION"].includes(r.kind) && ["UNKNOWN","CLAIMED"].includes(r.evidence));
  const limited = listing.source === "WEB_SEARCH" || listing.source === "HACKER_NEWS" || text.length < 250;
  let recommendation: CareerReview["recommendation"] = "CLARIFY";
  let reason = "The available evidence is not enough for a confident pursue recommendation. Confirm the requirements and prepare specific contribution examples.";
  if (quarantined) { recommendation="QUARANTINE"; reason="Recruitment risk takes priority over stack fit. Review the risk evidence before pursuing or contacting anyone."; }
  else if (workloadExceeded) { recommendation="SKIP"; reason="The stated workload exceeds your saved boundary. A strong stack match does not make that commitment sustainable."; }
  else if (!limited && experienceGap > 2) { recommendation="SKIP"; reason="The stated experience minimum is more than two years beyond your recorded timeline. Put your application effort elsewhere unless the employer explicitly relaxes it."; }
  else if (!limited && requiredGaps.length >= 2) { recommendation="SKIP"; reason="Several explicit requirements have no recorded supporting skills or contributions. This is an evidence gap, not a judgement that you cannot learn them."; }
  else if (!limited && (senior || experienceGap > 0 || requiredGaps.length > 0)) { recommendation="STRETCH"; reason="There is relevant territory to investigate, but experience, responsibility or explicit capability gaps need an honest conversation. Do not present yourself as already meeting everything."; }
  else if (!limited && support.length >= 2 && !requiredUnproven.length && !alternativesUnresolved && rows.length <= 20 && rows.some(r=>r.priority==="REQUIRED")) { recommendation="PURSUE"; reason="Recorded contributions support the identified explicit requirements without a detected experience or workload conflict. Verify eligibility, employer legitimacy and full scope before applying."; }
  const nextSteps = [
    ...(alternativesUnresolved ? ["Clarify alternative or mixed mandatory/preferred wording on the full source specification."] : []),
    ...requiredGaps.slice(0,2).map(r=>`Confirm whether ${r.name} is mandatory; disclose the evidence gap or prepare a real example.`),
    ...rows.filter(r=>r.evidence==="CLAIMED" && ["SKILL","RESPONSIBILITY"].includes(r.kind)).slice(0,2).map(r=>`Record what you personally implemented for ${r.name}; skill tags alone are not a contribution example.`),
    ...(rows.some(r=>r.kind==="QUALIFICATION") ? ["Ask whether the qualification can be replaced with practical experience."] : []),
    "Confirm geographic eligibility, compensation, hours and whether outside Rcentz work is permitted.",
    "Check that the vacancy is still open and the recruiter is authorized; keep your final decision separate from this recommendation.",
  ].slice(0,8);
  return {version:1,assessedAt:now.toISOString(),recommendation,reason,
    coverage:`Heuristic review of recognized capability phrases in up to 16,000 source characters. ${limited ? "Discovery snippet or short text: full requirements are unconfirmed." : "Source text is still not a verified complete specification."} ${rows.length > 20 ? "Only 20 requirements are shown; review omitted text." : "Unrecognized requirements may be missed."} Project statements are owner-recorded; links were not fetched or audited.`,
    requirements:rows.slice(0,20),nextSteps};
}
