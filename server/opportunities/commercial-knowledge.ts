import { matchCommercialProblems } from '@/server/opportunities/commercial-matching';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';

type Input = Record<string, unknown>;
const slug = (v: unknown): v is string => typeof v === 'string' && v.length <= 70 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const field = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
const optional = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const strings = (v: unknown, maxItems = 20): v is string[] => Array.isArray(v) && v.length <= maxItems && v.every(item => field(item, 200));
const id = (v: unknown): v is string => field(v, 160) && /^[A-Za-z0-9_-]+$/.test(v);
const statuses = ['DRAFT', 'PAUSED', 'ARCHIVED'] as const;

export async function commercialKnowledge(operation: string, input: Input, ownerId: string) {
  const profile = await prisma.companyOpportunityProfile.findUnique({ where: { key: 'rcentz-systems' }, select: { id: true, managerId: true } });
  if (!profile || profile.managerId !== ownerId) return apiError('FORBIDDEN', 'Commercial catalogue is not assigned to this owner', 403);
  const profileId = profile.id;


  if (operation === 'knowledge:match') {
    if (typeof input.text !== 'string' || input.text.trim().length < 12 || input.text.length > 4000 ||
        (input.limit !== undefined && (!Number.isInteger(input.limit) || (input.limit as number) < 1 || (input.limit as number) > 10)))
      return apiError('INVALID_MATCH_INPUT', 'Supply a business description (12–4000 characters) and optional limit (1–10)', 400);
    const [problems, groups] = await Promise.all([
      prisma.commercialBusinessProblem.findMany({
        where: { profileId, status: { not: 'ARCHIVED' } },
        orderBy: { createdAt: 'asc' }, take: 200,
        select: { id: true, key: true, title: true, description: true, symptoms: true, impact: true, status: true,
          solutions: { orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], take: 40,
            select: { id: true, rationale: true, priority: true, qualificationCriteria: true,
              solution: { select: { id: true, key: true, name: true, problem: true, proposedWorkflow: true, status: true, groupId: true, capabilityId: true } } } } }
      }),
      prisma.commercialSolutionGroup.findMany({ where: { profileId }, select: { id: true, name: true }, take: 100 }),
    ]);
    const matches = matchCommercialProblems({ text: input.text, problems, groups, limit: input.limit as number | undefined });
    return apiSuccess({ matches, catalogueProblemCount: problems.length, requiresHumanReview: true, noMatchDoesNotRejectLead: true });
  }

  if (operation === 'knowledge:list') {
    const [problems, groups] = await Promise.all([
      prisma.commercialBusinessProblem.findMany({ where: { profileId }, orderBy: { createdAt: 'asc' }, take: 200,
        include: { solutions: { orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], include: { solution: { select: { id: true, key: true, name: true, problem: true, proposedWorkflow: true, status: true, groupId: true, capabilityId: true } } } } } }),
      prisma.commercialSolutionGroup.findMany({ where: { profileId }, orderBy: { name: 'asc' }, take: 100 }),
    ]);
    return apiSuccess({ problems, groups });
  }

  if (operation === 'knowledge:problem') {
    const recordId = input.id;
    if (recordId !== undefined && !id(recordId)) return apiError('INVALID_ID', 'Invalid problem identifier', 400);
    if (!slug(input.key) || !field(input.title, 160) || !field(input.description, 4000) || !strings(input.symptoms) || !strings(input.impact) || !statuses.includes(input.status as typeof statuses[number])) return apiError('INVALID_PROBLEM', 'Invalid business problem', 400);
    const data = { key: input.key, title: input.title.trim(), description: input.description.trim(), symptoms: [...new Set(input.symptoms.map(x => x.trim()))], impact: [...new Set(input.impact.map(x => x.trim()))], status: input.status as typeof statuses[number] };
    if (recordId !== undefined) {
      const changed = await prisma.commercialBusinessProblem.updateMany({ where: { id: recordId, profileId }, data });
      return changed.count ? apiSuccess({ saved: true }) : apiError('NOT_FOUND', 'Problem not found', 404);
    }
    try { const created = await prisma.commercialBusinessProblem.create({ data: { ...data, profileId } }); return apiSuccess({ id: created.id }, 201); }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return apiError('CONFLICT', 'Problem key exists', 409); throw error; }
  }

  if (operation === 'knowledge:group') {
    const recordId = input.id;
    if (recordId !== undefined && !id(recordId)) return apiError('INVALID_ID', 'Invalid group identifier', 400);
    if (!slug(input.key) || !field(input.name, 120) || !optional(input.description, 1000)) return apiError('INVALID_GROUP', 'Invalid solution group', 400);
    const data = { key: input.key, name: input.name.trim(), description: input.description.trim() };
    if (recordId !== undefined) {
      const changed = await prisma.commercialSolutionGroup.updateMany({ where: { id: recordId, profileId }, data });
      return changed.count ? apiSuccess({ saved: true }) : apiError('NOT_FOUND', 'Group not found', 404);
    }
    try { const created = await prisma.commercialSolutionGroup.create({ data: { ...data, profileId } }); return apiSuccess({ id: created.id }, 201); }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return apiError('CONFLICT', 'Group key exists', 409); throw error; }
  }

  if (operation === 'knowledge:link') {
    if (!id(input.problemId) || !id(input.solutionId) || !field(input.rationale, 1600) || !strings(input.qualificationCriteria) || !Number.isInteger(input.priority) || (input.priority as number) < -100 || (input.priority as number) > 100) return apiError('INVALID_LINK', 'Invalid problem-solution relationship', 400);
    const [problem, solution] = await Promise.all([
      prisma.commercialBusinessProblem.findFirst({ where: { id: input.problemId, profileId }, select: { id: true } }),
      prisma.capabilitySolution.findFirst({ where: { id: input.solutionId, capability: { profileId } }, select: { id: true } }),
    ]);
    if (!problem || !solution) return apiError('NOT_FOUND', 'Problem or solution not found in the company catalogue', 404);
    const data = { rationale: input.rationale.trim(), qualificationCriteria: [...new Set(input.qualificationCriteria.map(x => x.trim()))], priority: input.priority as number };
    const link = await prisma.commercialProblemSolution.upsert({ where: { problemId_solutionId: { problemId: problem.id, solutionId: solution.id } }, create: { problemId: problem.id, solutionId: solution.id, ...data }, update: data });
    return apiSuccess({ id: link.id, saved: true });
  }

  if (operation === 'knowledge:assign-group') {
    if (!id(input.solutionId) || (input.groupId !== null && !id(input.groupId))) return apiError('INVALID_GROUP', 'Invalid group assignment', 400);
    if (input.groupId !== null) {
      const group = await prisma.commercialSolutionGroup.findFirst({ where: { id: input.groupId as string, profileId }, select: { id: true } });
      if (!group) return apiError('NOT_FOUND', 'Group not found', 404);
    }
    const changed = await prisma.capabilitySolution.updateMany({ where: { id: input.solutionId, capability: { profileId } }, data: { groupId: input.groupId as string | null } });
    return changed.count ? apiSuccess({ saved: true }) : apiError('NOT_FOUND', 'Solution not found', 404);
  }
  return apiError('INVALID_OPERATION', 'Unsupported commercial knowledge operation', 400);
}
