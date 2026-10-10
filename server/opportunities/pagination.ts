import type { PrismaClient, Prisma } from "@/generated/prisma/client";

export const opportunityPageSize = 6;
export function pageWindow(total: number, requested: unknown) {
  const pages = Math.max(1, Math.ceil(total / opportunityPageSize));
  const page = Math.min(
    pages,
    typeof requested === "number" &&
      Number.isSafeInteger(requested) &&
      requested > 0
      ? requested
      : 1,
  );
  return {
    page,
    pageSize: opportunityPageSize,
    total,
    pages,
    hasPrevious: page > 1,
    hasNext: page < pages,
  };
}
export const opportunitySelect = {
  id: true,
  source: true,
  kind: true,
  research: true,
  quarantined: true,
  title: true,
  company: true,
  url: true,
  description: true,
  location: true,
  salary: true,
  jobType: true,
  publishedAt: true,
  lastSeenAt: true,
  sourceState: true,
  score: true,
  assessment: true,
  status: true,
  notes: true,
} satisfies Prisma.OpportunitySelect;
export async function readOpportunityPage(
  database: Pick<PrismaClient, "$transaction">,
  profileId: string,
  filters: { status?: string; kind?: string; queue?: string },
  requested: unknown,
) {
  if (!profileId) throw Error("Owner profile required");
  const where: Prisma.OpportunityWhereInput = {
    profileId,
    quarantined: filters.queue === "quarantine",
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.status
      ? { status: filters.status }
      : { status: { not: "ARCHIVED" } }),
  };
  return database.$transaction(
    async (tx) => {
      const total = await tx.opportunity.count({ where });
      const pagination = pageWindow(total, requested);
      const jobs = await tx.opportunity.findMany({
        where,
        select: opportunitySelect,
        orderBy: [{ score: "desc" }, { publishedAt: "desc" }, { id: "asc" }],
        take: opportunityPageSize,
        skip: (pagination.page - 1) * opportunityPageSize,
      });
      return { jobs, pagination };
    },
    { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 10000 },
  );
}
