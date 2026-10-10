import { refreshPriorities } from "@/server/opportunities/refresh-priorities";
import { readContacts } from "@/server/opportunities/contacts";
import { reviewCareer } from "@/server/opportunities/career-review";
import { retentionSnapshot } from "@/server/opportunities/retention";
import { isProjectEvidence } from "@/features/opportunities/lib/project-evidence";
import {
  readOpportunityPage,
  pageWindow,
  opportunitySelect,
} from "@/server/opportunities/pagination";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/server/api/responses/api-response";
import { requireApplicationIdentity } from "@/server/api/auth/require-application-identity";
import { runCollection } from "@/server/opportunities/collector";
import { analytics } from "@/server/opportunities/analytics";
import { statuses } from "@/features/opportunities/lib/matching";
export const runtime = "nodejs";
export const maxDuration = 300;
const operationScopes: Record<string, string> = {
  list: "opportunities:read",
  contacts: "opportunities:read",
  refresh: "opportunities:write",
  retention: "opportunities:read",
  detail: "opportunities:read",
  profile: "opportunities:write",
  decision: "opportunities:write",
  collect: "opportunities:collect",
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16000) {
      await reader.cancel();
      throw new Error("BODY_LIMIT");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function handle(request: Request) {
  let body: string;
  let payload: unknown;
  try {
    body = await boundedBody(request);
    payload = JSON.parse(body);
  } catch {
    return apiError("INVALID_BODY", "A bounded JSON request is required", 400);
  }
  if (
    !record(payload) ||
    typeof payload.operation !== "string" ||
    !Object.hasOwn(operationScopes, payload.operation)
  )
    return apiError("INVALID_OPERATION", "Unsupported operation", 400);
  try {
    const actor = await requireApplicationIdentity(
      request,
      body,
      operationScopes[payload.operation],
    );
    if (!actor.ok) return actor.response;
    const ownerId = actor.userId;
    if (payload.operation === "refresh") return apiSuccess(await refreshPriorities(ownerId));
    if (payload.operation === "contacts") return apiSuccess(await readContacts(ownerId, payload.page));
    if (payload.operation === "retention") {
      if (payload.preview !== undefined && typeof payload.preview !== "boolean") return apiError("INVALID_PREVIEW", "Preview must be a boolean", 400);
      return apiSuccess(await retentionSnapshot(ownerId, payload.preview === true));
    }
    if (payload.operation === "detail") {
      if (
        typeof payload.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,160}$/.test(payload.id)
      )
        return apiError("INVALID_ID", "Invalid opportunity identifier", 400);
      const job = await prisma.opportunity.findFirst({
        where: { id: payload.id, profile: { ownerId } },
        select: { ...opportunitySelect, profile: { select: { skills: true, projectEvidence: true, experienceYears: true, careerContext: true, targetRoles: true, homeCountry: true, relocation: true, maxWeeklyHours: true } } },
      });
      if (!job) return apiSuccess({ job: null });
      const { profile, ...publicJob } = job;
      const review = reviewCareer({ ...publicJob, externalId: publicJob.id, publishedKnown: false }, profile, job.quarantined);
      return apiSuccess({
        job: { ...publicJob, description: job.description.slice(0, 6000), assessment: { ...(record(job.assessment) ? job.assessment : {}), careerReview: review } },
      });
    }
    if (payload.operation === "profile") {
      const { skills, experienceYears, enabled } = payload;
      if (
        !Array.isArray(skills) ||
        !skills.length ||
        skills.length > 20 ||
        skills.some(
          (s) => typeof s !== "string" || !s.trim() || s.length > 50,
        ) ||
        typeof experienceYears !== "number" ||
        !Number.isInteger(experienceYears) ||
        experienceYears < 0 ||
        experienceYears > 50 ||
        typeof enabled !== "boolean"
      )
        return apiError("INVALID_PROFILE", "Invalid search profile", 400);
      if (
        (payload.careerContext !== undefined &&
          (typeof payload.careerContext !== "string" ||
            payload.careerContext.length > 6000)) ||
        (payload.targetRoles !== undefined &&
          (!Array.isArray(payload.targetRoles) ||
            !payload.targetRoles.length ||
            payload.targetRoles.length > 8 ||
            payload.targetRoles.some(
              (v) => typeof v !== "string" || !v.trim() || v.length > 80,
            ))) ||
        (payload.homeCountry !== undefined &&
          (typeof payload.homeCountry !== "string" ||
            !payload.homeCountry.trim() ||
            payload.homeCountry.length > 80)) ||
        (payload.relocation !== undefined &&
          typeof payload.relocation !== "boolean") ||
        (payload.researchEnabled !== undefined &&
          typeof payload.researchEnabled !== "boolean") ||
        (payload.maxWeeklyHours !== undefined &&
          payload.maxWeeklyHours !== null &&
          (typeof payload.maxWeeklyHours !== "number" ||
            !Number.isInteger(payload.maxWeeklyHours) ||
            payload.maxWeeklyHours < 1 ||
            payload.maxWeeklyHours > 80))
      )
        return apiError("INVALID_PROFILE", "Invalid career preferences", 400);
      if (payload.projectEvidence !== undefined && !isProjectEvidence(payload.projectEvidence)) return apiError("INVALID_EVIDENCE", "Supply at most six complete HTTPS project references", 400);
      const extra = {
        ...(isProjectEvidence(payload.projectEvidence) ? {projectEvidence: payload.projectEvidence.map(p => ({name: p.name.trim(), url: p.url.trim(), skills: [...new Set(p.skills.map(s => s.trim()))], contribution: p.contribution.trim()}))} : {}),
        ...(typeof payload.careerContext === "string"
          ? { careerContext: payload.careerContext.trim() }
          : {}),
        ...(Array.isArray(payload.targetRoles)
          ? { targetRoles: payload.targetRoles as string[] }
          : {}),
        ...(typeof payload.homeCountry === "string"
          ? { homeCountry: payload.homeCountry.trim() }
          : {}),
        ...(typeof payload.relocation === "boolean"
          ? { relocation: payload.relocation }
          : {}),
        ...(typeof payload.researchEnabled === "boolean"
          ? { researchEnabled: payload.researchEnabled }
          : {}),
        ...(payload.maxWeeklyHours === null ||
        typeof payload.maxWeeklyHours === "number"
          ? { maxWeeklyHours: payload.maxWeeklyHours }
          : {}),
      };
      const data = {
        ...extra,
        skills: [...new Set((skills as string[]).map((s) => s.trim()))],
        experienceYears,
        enabled,
      };
      await prisma.opportunityProfile.upsert({
        where: { ownerId },
        create: { ownerId, ...data },
        update: data,
      });
      return apiSuccess({ saved: true });
    }
    if (payload.operation === "decision") {
      if (
        typeof payload.id !== "string" ||
        payload.id.length > 160 ||
        typeof payload.status !== "string" ||
        !(statuses as readonly string[]).includes(payload.status) ||
        typeof payload.notes !== "string" ||
        payload.notes.length > 2000
      )
        return apiError("INVALID_DECISION", "Invalid decision", 400);
      const id = payload.id,
        status = payload.status,
        notes = payload.notes.trim();
      const changed = await prisma.$transaction(async (tx) => {
        const prior = await tx.opportunity.findFirst({
          where: { id, profile: { ownerId } },
          select: { id: true, status: true },
        });
        if (!prior) return 0;
        const update = await tx.opportunity.updateMany({
          where: { id, profile: { ownerId }, status: prior.status },
          data: { status, notes },
        });
        if (update.count && prior.status !== status)
          await tx.opportunityEvent.create({
            data: {
              opportunityId: id,
              fromStatus: prior.status,
              toStatus: status,
            },
          });
        return update.count;
      });
      return changed
        ? apiSuccess({ saved: true })
        : apiError(
            "NOT_FOUND",
            "Opportunity not found or concurrently changed",
            404,
          );
    }
    if (payload.operation === "collect")
      return apiSuccess(await runCollection(ownerId));
    const profile = await prisma.opportunityProfile.findUnique({
      where: { ownerId },
      select: {
        id: true,
        skills: true,
        experienceYears: true,
        enabled: true,
        careerContext: true,
        projectEvidence: true,
        targetRoles: true,
        homeCountry: true,
        relocation: true,
        maxWeeklyHours: true,
        researchEnabled: true,
      },
    });
    const status =
      typeof payload.status === "string" &&
      (statuses as readonly string[]).includes(payload.status)
        ? payload.status
        : undefined;
    const kind =
      typeof payload.kind === "string" &&
      ["EMPLOYMENT", "CONTRACT", "PROJECT", "PROSPECT"].includes(payload.kind)
        ? payload.kind
        : undefined;
    const paged = payload.contractVersion === 3;
    const result = paged
      ? profile
        ? await readOpportunityPage(
            prisma,
            profile.id,
            {
              status,
              kind,
              queue: payload.queue === "quarantine" ? "quarantine" : "review",
            },
            payload.page,
          )
        : { jobs: [], pagination: pageWindow(0, 1) }
      : null;
    const jobs = result
      ? result.jobs
      : profile
        ? await prisma.opportunity.findMany({
            where: {
              profileId: profile.id,
              ...(payload.contractVersion === 2
                ? payload.queue === "quarantine"
                  ? { quarantined: true }
                  : { quarantined: false }
                : { source: "REMOTIVE" }),
              ...(typeof payload.kind === "string" &&
              ["EMPLOYMENT", "CONTRACT", "PROJECT", "PROSPECT"].includes(payload.kind)
                ? { kind: payload.kind }
                : {}),
              ...(status ? { status } : { status: { not: "ARCHIVED" } }),
            },
            orderBy: [{ score: "desc" }, { publishedAt: "desc" }],
            take: 100,
            select: {
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
            },
          })
        : [];
    const runs = profile
      ? await prisma.opportunityRun.findMany({
          where: { profileId: profile.id },
          orderBy: { startedAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            fetched: true,
            added: true,
            startedAt: true,
            message: true,
          },
        })
      : [];
    const summary =
      profile && (payload.contractVersion === 2 || paged)
        ? await analytics(profile.id)
        : null;
    return apiSuccess({
      profile: profile
        ? {
            skills: profile.skills,
            experienceYears: profile.experienceYears,
            enabled: profile.enabled,
            careerContext: profile.careerContext,
            projectEvidence: profile.projectEvidence,
            targetRoles: profile.targetRoles,
            homeCountry: profile.homeCountry,
            relocation: profile.relocation,
            maxWeeklyHours: profile.maxWeeklyHours,
            researchEnabled: profile.researchEnabled,
          }
        : null,
      jobs: jobs.map((job) => ({
        ...job,
        description: job.description.slice(0, 6000),
      })),
      runs,
      analytics: summary,
      pagination: result?.pagination ?? null,
    });
  } catch {
    return apiError(
      "SERVICE_UNAVAILABLE",
      "Opportunity service unavailable",
      503,
    );
  }
}

export async function POST(request: Request) {
  const response = await handle(request);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
