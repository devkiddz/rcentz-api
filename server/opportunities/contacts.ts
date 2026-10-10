import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { pageWindow } from "./pagination";
import { contactPurpose } from "@/features/opportunities/lib/intent";
export async function readContacts(ownerId: string, requested: unknown) {
  if (!ownerId) throw Error("Owner required");
  const scope = Prisma.sql`
    WITH contacts AS (
      SELECT DISTINCT o.id AS "opportunityId", o.title, o.company, o.kind,
        lower(c->>'email') AS email, c->>'sourceUrl' AS "sourceUrl", c->>'observedAt' AS "observedAt"
      FROM "Opportunity" o JOIN "OpportunityProfile" p ON p.id = o."profileId"
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.research->'contacts') = 'array' THEN o.research->'contacts' ELSE '[]'::jsonb END) c
      WHERE p."ownerId" = ${ownerId} AND NOT o.quarantined AND o.status <> 'ARCHIVED'
        AND c->>'email' ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$'
        AND length(c->>'email') <= 254 AND c->>'sourceUrl' LIKE 'https://%'
    )`;
  return prisma.$transaction(async tx => {
    const counts = await tx.$queryRaw<{total: bigint}[]>(Prisma.sql`${scope} SELECT count(*) AS total FROM contacts`);
    const pagination = pageWindow(Number(counts[0].total), requested);
    const contacts = await tx.$queryRaw<{opportunityId:string;title:string;company:string;kind:string;email:string;sourceUrl:string;observedAt:string}[]>(Prisma.sql`${scope} SELECT * FROM contacts ORDER BY company ASC, email ASC, "opportunityId" ASC, "sourceUrl" ASC LIMIT 6 OFFSET ${(pagination.page - 1) * 6}`);
    return {pagination, contacts: contacts.map(c => ({...c, purpose:contactPurpose(c.email)}))};
  }, {isolationLevel:"RepeatableRead",maxWait:5000,timeout:10000});
}
