import "server-only";
import { prisma } from "@/lib/prisma";
export async function analytics(profileId: string) {
  const since = new Date(Date.now() - 30 * 86400000);
  const [total, pipeline, quarantined, contacts, sourceRuns, events, newRows] =
    await Promise.all([
      prisma.opportunity.count({ where: { profileId } }),
      prisma.opportunity.groupBy({
        by: ["status"],
        where: { profileId },
        _count: { _all: true },
      }),
      prisma.opportunity.count({ where: { profileId, quarantined: true } }),
      prisma.opportunity.findMany({
        where: { profileId },
        select: { research: true },
        take: 5000,
      }),
      prisma.opportunitySourceRun.findMany({
        where: { profileId, startedAt: { gte: since } },
        orderBy: { startedAt: "desc" },
        take: 1000,
      }),
      prisma.opportunityEvent.findMany({
        where: { opportunity: { profileId }, createdAt: { gte: since } },
        select: { opportunityId: true, toStatus: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 5000,
      }),
      prisma.opportunity.findMany({
        where: { profileId, createdAt: { gte: since } },
        select: { createdAt: true },
        take: 5000,
      }),
    ]);
  const applied = new Set(
    events.filter((e) => e.toStatus === "APPLIED").map((e) => e.opportunityId),
  );
  const replied = new Set(
    events
      .filter((e) =>
        ["REPLIED", "INTERVIEW", "OFFER", "CONTRACT_WON"].includes(e.toStatus),
      )
      .map((e) => e.opportunityId),
  );
  const contacted = [...replied].filter((id) => applied.has(id)).length;
  const emails = new Set<string>();
  for (const row of contacts) {
    if (
      row.research &&
      typeof row.research === "object" &&
      !Array.isArray(row.research) &&
      Array.isArray(row.research.contacts)
    )
      for (const c of row.research.contacts)
        if (
          c &&
          typeof c === "object" &&
          !Array.isArray(c) &&
          typeof c.email === "string"
        )
          emails.add(c.email);
  }
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      day,
      discovered: newRows.filter((r) =>
        r.createdAt.toISOString().startsWith(day),
      ).length,
      applied: events.filter(
        (r) =>
          r.toStatus === "APPLIED" && r.createdAt.toISOString().startsWith(day),
      ).length,
    };
  });
  const bySource = new Map<
    string,
    {
      source: string;
      runs: number;
      failures: number;
      fetched: number;
      added: number;
      duplicates: number;
      skipped: number;
      lastStatus: string;
      lastRun: string;
      message: string | null;
    }
  >();
  for (const r of sourceRuns) {
    const v = bySource.get(r.source) || {
      source: r.source,
      runs: 0,
      failures: 0,
      fetched: 0,
      added: 0,
      duplicates: 0,
      skipped: 0,
      lastStatus: r.status,
      lastRun: r.startedAt.toISOString(),
      message: r.message,
    };
    v.runs++;
    v.failures += r.status === "FAILED" ? 1 : 0;
    v.fetched += r.fetched;
    v.added += r.added;
    v.duplicates += r.duplicates;
    v.skipped += r.skipped;
    bySource.set(r.source, v);
  }
  return {
    total,
    quarantined,
    publicContacts: emails.size,
    pipeline: pipeline.map((p) => ({ status: p.status, count: p._count._all })),
    daily,
    sources: [...bySource.values()],
    recordedApplications: applied.size,
    recordedResponses: contacted,
    responseRate:
      events.length < 5000 && applied.size
        ? Math.round((contacted / applied.size) * 100)
        : null,
    historyCoverage:
      "Only timestamped decisions recorded after this release. Response rate counts responses among applications recorded in the last 30 days; older applications and unrecorded outcomes are excluded.",
    bounded:
      events.length === 5000 ||
      newRows.length === 5000 ||
      contacts.length === 5000 ||
      sourceRuns.length === 1000,
    searchConfigured: !!process.env.OPPORTUNITY_SEARCH_API_KEY,
  };
}
