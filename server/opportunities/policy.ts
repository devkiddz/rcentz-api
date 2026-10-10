import type { Prisma } from "@/generated/prisma/client";
import type { SourceListing } from "./sources";
import type { CareerProfile } from "./fit";
export const finderPolicy = {
  maxNewPerRun: 25,
  maxStretchPerRun: 2,
  maxUntouched: 500,
  retentionDays: 90,
  maxCleanupPerRun: 100,
} as const;
export function weeklyHours(text: string): number | null {
  const matches = [
    ...text.matchAll(
      /\b(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*(?:hours?|hrs?|h)\s*(?:per|a|\/)\s*week\b/gi,
    ),
  ];
  return matches.length
    ? Math.max(...matches.map((m) => Number(m[2] || m[1])))
    : null;
}
export function admission(
  listing: SourceListing,
  profile: CareerProfile,
  fit: { score: number; assessment: { matched: string[] } },
): "skip" | "stretch" | "priority" {
  const hours = weeklyHours(listing.description);
  if (
    hours !== null &&
    profile.maxWeeklyHours !== null &&
    hours > profile.maxWeeklyHours
  )
    return "skip";
  const requirements = [
    ...listing.description.matchAll(
      /\b(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s*\+?\s*years?\s+(?:of\s+)?(?:professional\s+|commercial\s+|relevant\s+|frontend\s+|software\s+|development\s+|engineering\s+)*experience/gi,
    ),
  ];
  const years = Math.max(0, ...requirements.map((m) => Number(m[1])));
  if (years > profile.experienceYears + 2) return "skip";
  const employment = listing.kind === "EMPLOYMENT";
  const stretch =
    /\b(senior|lead|principal|staff|head|director|cto)\b/i.test(
      listing.title,
    ) || years > profile.experienceYears;
  if (fit.assessment.matched.length < (employment ? 2 : 1)) return "skip";
  if (fit.score < (stretch ? 30 : employment ? 45 : 20)) return "skip";
  return stretch ? "stretch" : "priority";
}
export function untouchedWhere(
  profileId: string,
): Prisma.OpportunityWhereInput {
  if (!profileId) throw Error("Owner profile required");
  return { profileId, status: "NEW", notes: "", events: { none: {} } };
}
export function retentionWhere(
  profileId: string,
  now = new Date(),
): Prisma.OpportunityWhereInput {
  const cutoff = new Date(
    now.getTime() - finderPolicy.retentionDays * 86400000,
  );
  return {
    ...untouchedWhere(profileId),
    quarantined: false,
    lastSeenAt: { lt: cutoff },
    updatedAt: { lt: cutoff },
  };
}
