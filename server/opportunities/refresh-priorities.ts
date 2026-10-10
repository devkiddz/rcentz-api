import "server-only";
import { prisma } from "@/lib/prisma";
import { evidencePriority } from "./priority";
import { careerFit } from "./fit";
import type { Research } from "./research";

function assessmentContent(value: Record<string, unknown>) {
  const review = value.careerReview;
  if (!review || typeof review !== "object" || Array.isArray(review)) return value;
  const { assessedAt, ...content } = review as Record<string, unknown>;
  void assessedAt;
  return { ...value, careerReview: content };
}

export async function refreshPriorities(ownerId: string) {
  const profile = await prisma.opportunityProfile.findUnique({ where: { ownerId } });
  if (!profile) return { changed: 0, checked: 0 };
  let cursor: string | undefined, changed = 0, checked = 0;
  // Bounded batches; no networking, decision, event or notes changes.
  for (;;) {
    const rows = await prisma.opportunity.findMany({
      where: { profileId: profile.id },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    for (const row of rows) {
      checked++;
      const research = row.research as Research | null;
      const assessment = row.assessment && typeof row.assessment === "object" &&
        !Array.isArray(row.assessment) ? row.assessment : {};
      const listing = { ...row, publishedKnown: !!research?.publishedKnown };
      const { kind, ...priority } = evidencePriority(listing, profile, research, row.quarantined);
      const fit = careerFit({ ...listing, kind }, profile, research ?? {
        risk: "UNKNOWN", flags: [], contacts: [], pages: [], coverage: "",
        publishedKnown: false, checkedAt: "",
      });
      const nextAssessment = { ...assessment, ...fit.assessment, ...priority };
      if (row.kind !== kind || row.score !== fit.score ||
        JSON.stringify(assessmentContent(assessment)) !==
          JSON.stringify(assessmentContent(nextAssessment))) {
        const update = await prisma.opportunity.updateMany({
          where: { id: row.id, profileId: profile.id, updatedAt: row.updatedAt },
          data: { kind, score: fit.score, assessment: nextAssessment },
        });
        changed += update.count;
      }
    }
    cursor = rows.at(-1)!.id;
  }
  return { changed, checked };
}
