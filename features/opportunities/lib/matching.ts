export type Listing = {
  externalId: string;
  title: string;
  company: string;
  url: string;
  description: string;
  location: string;
  salary: string | null;
  jobType: string;
  publishedAt: Date;
};
export type Assessment = {
  matched: string[];
  concerns: string[];
  questions: string[];
  eligibility: string;
  verdict: string;
  evidence?: string[];
  unknowns?: string[];
  dimensions?: { name: string; finding: string }[];
};
export const defaultSkills = [
  "React",
  "Next.js",
  "TypeScript",
  "JavaScript",
  "HTML",
  "CSS",
  "Tailwind",
  "Prisma",
  "PostgreSQL",
];
export const statuses = [
  "NEW",
  "SHORTLISTED",
  "APPLIED",
  "REPLIED",
  "INTERVIEW",
  "OFFER",
  "CONTRACT_WON",
  "REJECTED",
  "ARCHIVED",
  "CLOSED",
] as const;
export function assess(
  listing: Listing,
  skills: string[],
  experienceYears: number,
): { score: number; assessment: Assessment } {
  const text = `${listing.title} ${listing.description}`.toLowerCase();
  const aliases: Record<string, string[]> = {
    react: ["react", "reactjs"],
    "next.js": ["next.js", "nextjs", "next js"],
  };
  const matched = skills.filter((skill) =>
    (aliases[skill.toLowerCase()] || [skill.toLowerCase()]).some((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
    }),
  );
  const concerns: string[] = [];
  const senior = /\b(senior|lead|principal|staff|head|director|cto)\b/i.test(
    listing.title,
  );
  if (senior)
    concerns.push(
      "Title signals senior responsibility; clarify expected ownership.",
    );
  const requirements = [
    ...text.matchAll(
      /\b(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s*\+?\s*years?\s+(?:of\s+)?(?:professional\s+|commercial\s+|relevant\s+|frontend\s+|software\s+|development\s+|engineering\s+)*experience/g,
    ),
  ];
  const years = Math.max(0, ...requirements.map((m) => Number(m[1])));
  if (years > experienceYears)
    concerns.push(
      `Listing mentions ${years}+ years of experience; your profile records ${experienceYears}+.`,
    );
  if (/\b(master[’']?s|bachelor[’']?s|degree)\b/i.test(text))
    concerns.push("Degree mentioned: inspect whether mandatory or optional.");
  const eligibility = /worldwide|anywhere|global/i.test(listing.location)
    ? "Location field says worldwide; confirm employer eligibility."
    : /nigeria/i.test(listing.location)
      ? "Nigeria is named; confirm work arrangement."
      : `Nigeria eligibility unknown. Listed location: ${listing.location || "unspecified"}.`;
  const questions = [
    "Confirm applications remain open on the source page.",
    "Clarify salary, working hours, mentorship and delivery expectations.",
  ];
  let score = Math.min(
    90,
    matched.length * 12 +
      (/frontend|front.end|web developer|full.stack/i.test(listing.title)
        ? 15
        : 0),
  );
  if (senior) score -= 25;
  if (years > experienceYears) score -= 20;
  score = Math.max(0, score);
  return {
    score,
    assessment: {
      matched,
      concerns,
      questions,
      eligibility,
      verdict:
        score >= 50 && !senior && years <= experienceYears
          ? "Worth reviewing"
          : score >= 25
            ? "Stretch / needs review"
            : "Low stack match",
    },
  };
}
