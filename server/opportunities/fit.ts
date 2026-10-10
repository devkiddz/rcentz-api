import { sourceContext } from "@/features/opportunities/lib/source-context";
import { projectGrounding } from "@/features/opportunities/lib/project-evidence";
import { weeklyHours } from "./policy";
import { assess } from "@/features/opportunities/lib/matching";
import type { SourceListing } from "./sources";
import type { Research } from "./research";
export type CareerProfile = {
  skills: string[];
  projectEvidence?: unknown;
  experienceYears: number;
  careerContext: string;
  targetRoles: string[];
  homeCountry: string;
  relocation: boolean;
  maxWeeklyHours: number | null;
};
export function careerFit(
  listing: SourceListing,
  profile: CareerProfile,
  research: Research,
) {
  const resultsPage = sourceContext({...listing, research}) === "RESULTS_PAGE";
  const base = assess(listing, profile.skills, profile.experienceYears);
  const a = base.assessment;
  const text = (listing.title + " " + listing.description).toLowerCase();
  const concerns = [...a.concerns];
  const matchedRole = profile.targetRoles.find((role) =>
    role
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .some((w) => listing.title.toLowerCase().includes(w)),
  );
  const hours = weeklyHours(text);
  if (hours && profile.maxWeeklyHours && hours > profile.maxWeeklyHours)
    concerns.push(
      `Listing mentions ${hours} hours/week, above your ${profile.maxWeeklyHours}-hour boundary.`,
    );
  const worldwide = /worldwide|anywhere|global/i.test(listing.location);
  const remote = /remote/i.test(
    listing.location + " " + listing.jobType + " " + listing.title,
  );
  const sponsorship =
    /visa sponsorship|relocation (?:assistance|support)|sponsor.{0,20}visa/i.test(
      text,
    );
  const eligibility = worldwide
    ? "Worldwide wording found; employer acceptance and work authorization still require confirmation."
    : sponsorship && profile.relocation
      ? "Relocation/sponsorship wording found; investigate eligibility and costs."
      : `Eligibility from ${profile.homeCountry} is unconfirmed. ${remote ? "Remote wording does not establish worldwide eligibility" : "Listed location: " + (listing.location || "not supplied")}.`;
  const evidence = [
    ...a.matched.map((skill) => `${skill} appears in the listing.`),
    ...(matchedRole ? [`Title overlaps target role: ${matchedRole}.`] : []),
  ];
  const unknowns = [
    "Actual workload and autonomy",
    "Employer legitimacy and recruiter authority",
    "Whether the role protects your Rcentz commitments",
  ];
  if (!listing.salary) unknowns.push("Salary and payment terms");
  if (!profile.careerContext.trim())
    unknowns.push(
      "Your portfolio, qualifications and career boundaries have not been recorded.",
    );
  else
    unknowns.push(
      "Portfolio quality, interpersonal fit and claimed credentials need human validation; keyword analysis cannot certify them.",
    );
  const portfolioTerms = profile.careerContext
    .toLowerCase()
    .split(/[^a-z0-9.+#]+/)
    .filter(
      (w) =>
        w.length > 5 &&
        ![
          "experience",
          "developer",
          "software",
          "building",
          "projects",
          "rcentz",
          "systems",
          "applications",
          "engineering",
        ].includes(w),
    );
  const contextMatches = [...new Set(portfolioTerms)]
    .filter((word) =>
      new RegExp(
        "\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
        "i",
      ).test(text),
    )
    .slice(0, 8);
  if (contextMatches.length)
    evidence.push(
      "Listing overlaps career-context terms: " +
        contextMatches.join(", ") +
        ". This is overlap, not proof of competence.",
    );
  const grounding = projectGrounding(profile.projectEvidence, a.matched);
  evidence.push(...grounding.relevant.map(p=>`Owner-recorded project: ${p.name} (${p.url}). Personal contribution: ${p.contribution}. Reference and ownership have not been independently verified.`));
  if(grounding.missing.length) unknowns.push("No recorded project example for these listing-matched skills: " + grounding.missing.join(", ") + ". This is missing evidence, not proof you lack the skill.");
  if(!grounding.relevant.length) unknowns.push("No relevant project references are recorded; the assessment currently rests on listing/profile overlap.");
  const employeeScore = Math.max(
    0,
    Math.min(
      100,
      base.score +
        (matchedRole ? 8 : 0) +
        (contextMatches.length ? 5 : 0) -
        (hours && profile.maxWeeklyHours && hours > profile.maxWeeklyHours
          ? 25
          : 0),
    ),
  );
  const buyer = listing.kind !== "EMPLOYMENT";
  const score = buyer ? listing.kind === "PROSPECT" ? 15 : 50 : employeeScore;
  const verdict = buyer ? (listing.kind === "PROSPECT" ? "Need unconfirmed — prospect only" : "Buyer request — confirm issuer, scope and terms") :
    research.risk === "HIGH"
      ? "Quarantine — risk evidence needs review"
      : score >= 50 && !concerns.length
        ? "Pursue after verification"
        : score >= 25
          ? /\b(senior|lead|principal|staff|head|director|cto)\b/i.test(
              listing.title,
            ) ||
            a.concerns.some(
              (c) => c.startsWith("Listing mentions") && c.includes("years"),
            )
            ? "Stretch role — validate experience and ownership"
            : "Clarify before pursuing"
          : "Low priority";
  return {
    score: resultsPage ? 0 : score,
    assessment: {
      ...a,
      eligibility,
      concerns,
      verdict,
      evidence,
      unknowns,
      dimensions: [
        {name: "Project evidence", finding: grounding.relevant.length ? `${grounding.relevant.length} owner-recorded references; prepare ${grounding.relevant.map(p=>p.name).join(", ")} to demonstrate ${grounding.covered.join(", ")}. Links do not certify quality or ownership.` : "Add specific project references and personal contributions before relying on this assessment."},
        {
          name: "Skills",
          finding: a.matched.length + " recorded skills appear",
        },
        {
          name: "Responsibility",
          finding: concerns[0] || "Seniority fit requires review",
        },
        { name: "Work arrangement", finding: eligibility },
        {
          name: "Career direction",
          finding: matchedRole || "Adjacent opportunity; role fit unconfirmed",
        },
        {
          name: "Vision / capacity",
          finding: hours
            ? `${hours} hours/week mentioned`
            : "Workload not established",
        },
        { name: "Compensation", finding: listing.salary || "Not supplied" },
      ],
    },
  };
}
