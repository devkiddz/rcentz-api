import "server-only";
import { prisma } from "@/lib/prisma";
import { evidencePriority } from "./priority";
import type { Research } from "./research";
export async function refreshPriorities(ownerId: string) {
  const profile = await prisma.opportunityProfile.findUnique({where: {ownerId}});
  if (!profile) return {changed: 0, checked: 0};
  let cursor: string | undefined, changed = 0, checked = 0;
  // Bounded batches; no networking, no decision/event/notes changes.
  for (;;) {
    const rows = await prisma.opportunity.findMany({where: {profileId: profile.id}, orderBy: {id: "asc"}, take: 100, ...(cursor ? {cursor:{id:cursor},skip:1} : {})});
    if (!rows.length) break;
    for (const row of rows) {
      checked++;
      const research = row.research as Research | null;
      const assessment = row.assessment && typeof row.assessment === "object" && !Array.isArray(row.assessment) ? row.assessment : {};
      const {kind, ...priority} = evidencePriority({...row, publishedKnown: !!research?.publishedKnown}, profile, research, row.quarantined);
      if (row.kind !== kind || assessment.priority !== priority.priority || assessment.priorityLabel !== priority.priorityLabel) {
        const update = await prisma.opportunity.updateMany({where:{id:row.id,profileId:profile.id,updatedAt:row.updatedAt},data:{kind, assessment:{...assessment,...priority}}});
        changed += update.count;
      }
    }
    cursor = rows.at(-1)!.id;
  }
  return {changed, checked};
}
