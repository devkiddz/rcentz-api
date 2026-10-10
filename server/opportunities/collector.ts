import { evidencePriority } from "./priority";
import {
  admission,
  finderPolicy,
  untouchedWhere,
  retentionWhere,
} from "./policy";
import "server-only";
import { prisma } from "@/lib/prisma";
import { discover, type SourceListing } from "./sources";
import { canonicalKey, investigate } from "./research";
import { careerFit } from "./fit";
export async function runCollection(ownerId: string) {
  const lease = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"opportunity:" + ownerId}))`;
      const profile = await tx.opportunityProfile.findUnique({
        where: { ownerId },
      });
      if (!profile?.enabled) return { status: "disabled" as const };
      const recent = await tx.opportunityRun.findFirst({
        where: {
          profileId: profile.id,
          startedAt: { gt: new Date(Date.now() - 20 * 3600000) },
        },
        orderBy: { startedAt: "desc" },
      });
      if (recent) return { status: "cooldown" as const };
      const run = await tx.opportunityRun.create({
        data: {
          profileId: profile.id,
          source: "MULTI_SOURCE",
          status: "RUNNING",
        },
      });
      return { status: "leased" as const, profile, run };
    },
    { maxWait: 5000, timeout: 10000 },
  );
  if (lease.status !== "leased") return { status: lease.status, added: 0 };
  const { profile, run } = lease;
  try {
    const batches = await discover(
      profile.targetRoles,
      profile.skills,
      profile.researchEnabled,
    );
    const items = batches.flatMap((batch) => batch.listings);
    const candidates = items
      .map((listing) => ({
        listing,
        key: canonicalKey(listing),
        fit: careerFit(listing, profile, {
          risk: "UNKNOWN",
          flags: [],
          contacts: [],
          pages: [],
          coverage: "",
          publishedKnown: listing.publishedKnown,
          checkedAt: "",
        }),
      }))
      .filter((v) => v.fit.score > 0)
      .sort(
        (a, b) =>
          b.fit.score - a.fit.score ||
          b.listing.publishedAt.getTime() - a.listing.publishedAt.getTime(),
      );
    const uniqueMap = new Map<string, (typeof candidates)[number]>();
    for (const candidate of candidates)
      if (!uniqueMap.has(candidate.key))
        uniqueMap.set(candidate.key, candidate);
    const ranked = [...uniqueMap.values()];
    const old = await prisma.opportunity.findMany({
      where: {
        profileId: profile.id,
        OR: [
          { canonicalKey: { in: ranked.map((v) => v.key) } },
          ...batches.map((b) => ({
            source: b.source,
            externalId: { in: b.listings.map((v) => v.externalId) },
          })),
        ],
      },
      select: {
        id: true,
        source: true,
        externalId: true,
        canonicalKey: true,
        research: true,
        title: true, description: true, company: true, location: true,
        quarantined: true,
      },
    });
    const existing = new Map(
      old.filter((v) => v.canonicalKey).map((v) => [v.canonicalKey, v]),
    );
    // Reserve territory for every source and new records; a large feed must not crowd out web/project leads.
    const selected = new Map<string, (typeof ranked)[number]>();
    const add = (v: (typeof ranked)[number]) => {
      if (selected.size < 180 && !selected.has(v.key)) selected.set(v.key, v);
    };
    ranked.slice(0, 80).forEach(add);
    for (const batch of batches)
      ranked
        .filter((v) => v.listing.source === batch.source)
        .slice(0, 6)
        .forEach(add);
    ranked
      .filter((v) => !existing.has(v.key))
      .sort(
        (a, b) =>
          b.listing.publishedAt.getTime() - a.listing.publishedAt.getTime(),
      )
      .slice(0, 50)
      .forEach(add);
    ranked.forEach(add);
    const untouched = await prisma.opportunity.count({
      where: untouchedWhere(profile.id),
    });
    const budget = Math.min(
      finderPolicy.maxNewPerRun,
      Math.max(0, finderPolicy.maxUntouched - untouched),
    );
    const admitted = new Map<string, (typeof ranked)[number]>();
    let stretch = 0;
    const priorFor = (v: (typeof ranked)[number]) =>
      existing.get(v.key) ||
      old.find(
        (o) =>
          o.source === v.listing.source &&
          o.externalId === v.listing.externalId,
      );
    const admit = (v: (typeof ranked)[number]) => {
      if (admitted.has(v.key) || priorFor(v) || admitted.size >= budget) return;
      const category = admission(v.listing, profile, v.fit);
      if (
        category === "skip" ||
        (category === "stretch" && stretch >= finderPolicy.maxStretchPerRun)
      )
        return;
      admitted.set(v.key, v);
      if (category === "stretch") stretch++;
    };
    // Reserve new-save room across sources before filling by priority.
    for (let slot = 0; slot < 2; slot++) {
      for (const batch of batches) {
        const candidate = ranked.filter(
          (v) =>
            v.listing.source === batch.source &&
            !priorFor(v) &&
            admission(v.listing, profile, v.fit) === "priority",
        )[slot];
        if (candidate) admit(candidate);
      }
    }
    ranked
      .filter((v) => admission(v.listing, profile, v.fit) === "priority")
      .forEach(admit);
    ranked.forEach(admit);
    const unique = [
      ...new Map(
        [...selected.values()]
          .filter((v) => priorFor(v))
          .slice(0, 180 - admitted.size)
          .concat([...admitted.values()])
          .map((v) => [v.key, v]),
      ).values(),
    ].slice(0, 180);
    const needsResearch = unique.filter((v) => {
      const previous = existing.get(v.key)?.research;
      if (!previous || typeof previous !== "object" || Array.isArray(previous))
        return true;
      return (
        !Array.isArray(previous.pages) ||
        !previous.pages.length ||
        typeof previous.checkedAt !== "string" ||
        Date.parse(previous.checkedAt) < Date.now() - 7 * 86400000
      );
    });
    const enrichment = new Set<string>();
    needsResearch
      .filter((v) => v.listing.source === "WEB_SEARCH")
      .slice(0, 2)
      .forEach((v) => enrichment.add(v.key));
    for (const v of needsResearch)
      if (enrichment.size < 8) enrichment.add(v.key);
    const assessed: {
      listing: SourceListing;
      key: string;
      research: Awaited<ReturnType<typeof investigate>>;
    }[] = [];
    // Rotate bounded enrichment through unseen/stale records; all other candidates receive source-text screening.
    for (let i = 0; i < unique.length; i += 4) {
      const part = unique.slice(i, i + 4);
      assessed.push(
        ...(await Promise.all(
          part.map(async (v) => ({
            listing: v.listing,
            key: v.key,
            research: await investigate(
              v.listing,
              profile.researchEnabled && enrichment.has(v.key),
            ),
          })),
        )),
      );
    }
    const perSource = new Map(
      batches.map((b) => [
        b.source,
        {
          added: 0,
          duplicates: 0,
          skipped: Math.max(
            0,
            b.listings.length -
              unique.filter((v) => v.listing.source === b.source).length,
          ),
        },
      ]),
    );
    let added = 0;
    let removed = 0;
    await prisma.$transaction(
      async (tx) => {
        const room = Math.min(
          finderPolicy.maxNewPerRun,
          Math.max(
            0,
            finderPolicy.maxUntouched -
              (await tx.opportunity.count({
                where: untouchedWhere(profile.id),
              })),
          ),
        );
        for (const item of assessed) {
          const prior =
            existing.get(item.key) ||
            old.find(
              (v) =>
                v.source === item.listing.source &&
                v.externalId === item.listing.externalId,
            );
          const { source, kind, publishedKnown: _, ...listing } = item.listing;
          void _; void kind;
          if (
            !item.research.pages.length &&
            prior?.research &&
            typeof prior.research === "object" &&
            !Array.isArray(prior.research) &&
            typeof prior.research.checkedAt === "string" &&
            Array.isArray(prior.research.flags)
          ) {
            const previous = prior.research as unknown as typeof item.research;
            const flags = [
              ...new Map(
                [...previous.flags, ...item.research.flags].map((f) => [
                  f.reason,
                  f,
                ]),
              ).values(),
            ];
            item.research = {
              ...previous,
              flags,
              risk: flags.length ? "HIGH" : previous.risk,
            };
            if (previous.vacancy?.fullText && previous.vacancy.url === item.listing.url && prior?.description) {
              item.listing.title = prior.title; item.listing.description = prior.description;
              item.listing.company = prior.company; item.listing.location = prior.location;
              listing.title = prior.title; listing.description = prior.description;
              listing.company = prior.company; listing.location = prior.location;
            }
          }
          const fit = careerFit(item.listing, profile, item.research);
          const {kind: correctedKind, ...priority} = evidencePriority(item.listing, profile, item.research, item.research.risk === "HIGH" || !!prior?.quarantined);
          const data = {
            ...listing,
            ...fit,
            kind: correctedKind,
            assessment: {...fit.assessment, ...priority},
            canonicalKey: item.key,
            research: item.research,
            quarantined: item.research.risk === "HIGH" || !!prior?.quarantined,
            lastSeenAt: new Date(),
            sourceState: "LISTED",
          };
          const count = perSource.get(source)!;
          if (prior) {
            await tx.opportunity.update({ where: { id: prior.id }, data });
            count.duplicates++;
          } else {
            if (added >= room) {
              count.skipped++;
              continue;
            }
            await tx.opportunity.create({
              data: { profileId: profile.id, source, ...data },
            });
            added++;
            count.added++;
          }
        }
        if (
          process.env.OPPORTUNITY_RETENTION_ENABLED === "true" &&
          batches.some((b) => ["SUCCESS", "PARTIAL"].includes(b.status))
        ) {
          const where = retentionWhere(profile.id);
          const stale = await tx.opportunity.findMany({
            where,
            select: { id: true },
            orderBy: [{ lastSeenAt: "asc" }, { id: "asc" }],
            take: finderPolicy.maxCleanupPerRun,
          });
          if (stale.length)
            removed = (
              await tx.opportunity.deleteMany({
                where: { ...where, id: { in: stale.map((v) => v.id) } },
              })
            ).count;
        }
        for (const batch of batches) {
          const c = perSource.get(batch.source)!;
          await tx.opportunitySourceRun.create({
            data: {
              profileId: profile.id,
              source: batch.source,
              status: batch.status,
              fetched: batch.listings.length,
              ...c,
              message: batch.message,
              startedAt: run.startedAt,
              finishedAt: new Date(),
            },
          });
        }
        const successes = batches.filter((b) =>
          ["SUCCESS", "PARTIAL"].includes(b.status),
        ).length;
        const status =
          successes === 0
            ? "FAILED"
            : batches.some((b) => b.status !== "SUCCESS")
              ? "PARTIAL"
              : "SUCCESS";
        await tx.opportunityRun.update({
          where: { id: run.id },
          data: {
            status,
            fetched: items.length,
            added,
            finishedAt: new Date(),
            message: `${successes}/${batches.length} sources completed; ${unique.length} candidates processed; ${added} admitted (max 25, two stretch); ${removed} stale untouched records removed. Enrichment capped at eight; source absence does not establish closure.`,
          },
        });
        await tx.notification.create({
          data: {
            userId: ownerId,
            type: "SYSTEM",
            title: "Rcentz opportunity review",
            message: `${added} new opportunities. Review fit, risk evidence and unverified contact details before acting.`,
            href: "/admin/opportunities",
          },
        });
      },
      { maxWait: 5000, timeout: 60000 },
    );
    return {
      status: batches.some((b) => ["SUCCESS", "PARTIAL"].includes(b.status))
        ? "success"
        : "failed",
      added,
    };
  } catch {
    await prisma.opportunityRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        message:
          "Discovery or persistence failed. Existing opportunities and decisions preserved.",
        finishedAt: new Date(),
      },
    });
    return { status: "failed", added: 0 };
  }
}
