import { Prisma, type PrismaClient } from "@/generated/prisma/client";

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
      const tiers = [4, 3, 2, 1, 0];
      const jobs: Prisma.OpportunityGetPayload<{select: typeof opportunitySelect}>[] = [];
      let skip = (pagination.page - 1) * opportunityPageSize;
      for (const tier of tiers) {
        const tierFilter: Prisma.OpportunityWhereInput = tier === 0
          ? { OR: [{assessment: {path:["priority"],equals:Prisma.AnyNull}}, { NOT: { OR: [1,2,3,4].map(value => ({assessment: {path: ["priority"], equals: value}})) } }] }
          : { assessment: { path: ["priority"], equals: tier } };
        const scoped = { ...where, ...tierFilter };
        const count = await tx.opportunity.count({where: scoped});
        if (skip >= count) { skip -= count; continue; }
        const part = await tx.opportunity.findMany({
          where: scoped, select: opportunitySelect,
          orderBy: [{ score: "desc" }, { publishedAt: "desc" }, { id: "asc" }],
          take: opportunityPageSize - jobs.length, skip,
        });
        jobs.push(...part); skip = 0;
        if (jobs.length === opportunityPageSize) break;
      }
      return { jobs, pagination };
    },
    { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 10000 },
  );
}
