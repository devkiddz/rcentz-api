import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import * as crypto from "node:crypto";
function load(file, stubs = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const evaluated = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => {
      if (!(name in stubs)) throw Error("Unmocked " + name);
      return stubs[name];
    },
    evaluated,
    evaluated.exports,
  );
  return evaluated.exports;
}
const signing = load("server/api/auth/application-signature.ts", {
  "node:crypto": crypto,
});
const secret = "test-only-secret-with-at-least-32-characters";
process.env.RCENTZ_SYSTEMS_API_SECRET = secret;
process.env.OPPORTUNITY_OWNER_ID = "central-owner";
const path = "/api/v1/internal/systems/opportunities";
const body = JSON.stringify({ operation: "list" });
const claims = {
  applicationId: "systems",
  subject: "local-owner",
  issuedAt: String(Date.now()),
  nonce: crypto.randomUUID(),
};
const signature = signing.signApplicationRequest(secret, claims, path, body);
assert.equal(
  signing.validApplicationSignature(secret, claims, path, body, signature),
  true,
);
for (const [key, value] of Object.entries({
  applicationId: "another-app",
  subject: "another-user",
  issuedAt: "1000000000000",
  nonce: crypto.randomUUID(),
}))
  assert.equal(
    signing.validApplicationSignature(
      secret,
      { ...claims, [key]: value },
      path,
      body,
      signature,
    ),
    false,
  );
assert.equal(
  signing.validApplicationSignature(
    secret,
    claims,
    path,
    body + " ",
    signature,
  ),
  false,
);
assert.equal(
  signing.validApplicationSignature(
    secret,
    claims,
    "/another-path",
    body,
    signature,
  ),
  false,
);
assert.equal(
  signing.validApplicationSignature(undefined, claims, path, body, signature),
  false,
);
let identity = {
  enabled: true,
  scopes: ["opportunities:read"],
  user: { id: "central-owner", status: "ACTIVE", role: "ADMIN" },
};
let lookup = 0;
const nonces = new Set();
let writes = 0;
const prisma = {
  applicationIdentity: {
    findUnique: async (q) => {
      lookup++;
      assert.equal(q.where.applicationId_subject.subject, "local-owner");
      return identity;
    },
  },
  applicationRequestNonce: {
    create: async ({ data }) => {
      if (nonces.has(data.nonce)) throw { code: "P2002" };
      nonces.add(data.nonce);
    },
  },
};
const responses = {
  apiError: (code, message, status) =>
    Response.json({ code, message }, { status }),
  apiSuccess: (data) => Response.json({ success: true, data }),
};
const authority = load("server/api/auth/require-application-identity.ts", {
  "server-only": {},
  "@/lib/prisma": { prisma },
  "@/server/api/responses/api-response": responses,
  "./application-signature": signing,
});
function request(payload = { operation: "list" }, changes = {}) {
  const text = JSON.stringify(payload);
  const c = { ...claims, nonce: crypto.randomUUID() };
  return new Request("https://api.example" + path, {
    method: "POST",
    body: text,
    headers: {
      "x-rcentz-app": c.applicationId,
      "x-rcentz-subject": c.subject,
      "x-rcentz-issued-at": c.issuedAt,
      "x-rcentz-nonce": c.nonce,
      "x-rcentz-signature": signing.signApplicationRequest(
        secret,
        c,
        path,
        text,
      ),
      ...changes,
    },
  });
}
let r = request();
assert.equal(
  (await authority.requireApplicationIdentity(r, body, "opportunities:read"))
    .ok,
  true,
);
assert.equal(
  (await authority.requireApplicationIdentity(r, body, "opportunities:read"))
    .response.status,
  409,
);
for (const change of [
  { enabled: false },
  { scopes: [] },
  { user: { id: "other", status: "ACTIVE", role: "ADMIN" } },
  { user: { id: "central-owner", status: "INACTIVE", role: "ADMIN" } },
  { user: { id: "central-owner", status: "ACTIVE", role: "CUSTOMER" } },
]) {
  const before = identity;
  identity = { ...identity, ...change };
  assert.equal(
    (
      await authority.requireApplicationIdentity(
        request(),
        body,
        "opportunities:read",
      )
    ).response.status,
    403,
  );
  identity = before;
}
const beforeLookup = lookup;
assert.equal(
  (
    await authority.requireApplicationIdentity(
      request({}, { "x-rcentz-signature": "0".repeat(64) }),
      "{}",
      "opportunities:read",
    )
  ).response.status,
  401,
);
assert.equal(lookup, beforeLookup);
prisma.$transaction = async (fn) => fn(prisma);
prisma.opportunity = {
  findFirst: async (q) => {
    writes++;
    assert.equal(q.where.profile.ownerId, "central-owner");
    return null;
  },
  updateMany: async (q) => {
    writes++;
    assert.equal(q.where.profile.ownerId, "central-owner");
    return { count: 0 };
  },
};
const matching = load("features/opportunities/lib/matching.ts");
const review = load("server/opportunities/career-review.ts", {
  "@/features/opportunities/lib/source-context": load("features/opportunities/lib/source-context.ts"),
  "@/features/opportunities/lib/project-evidence": load("features/opportunities/lib/project-evidence.ts"),
  "./policy": load("server/opportunities/policy.ts"),
});
const route = load("app/api/v1/internal/systems/opportunities/route.ts", {
  "@/server/opportunities/career-review": review,
  "@/server/opportunities/refresh-priorities": {refreshPriorities: async owner=>{assert.equal(owner,"central-owner");return {checked:1,changed:0};}},
  "@/server/opportunities/contacts": {readContacts: async owner=>{assert.equal(owner,"central-owner");return {contacts:[]};}},
  "@/server/opportunities/retention": {retentionSnapshot: async ownerId => {assert.equal(ownerId, "central-owner"); return {deletionPerformed:false};}},
  "@/features/opportunities/lib/source-context": load("features/opportunities/lib/source-context.ts"),
  "@/features/opportunities/lib/project-evidence": load("features/opportunities/lib/project-evidence.ts"),
  "@/lib/prisma": { prisma },
  "@/server/api/responses/api-response": responses,
  "@/server/api/auth/require-application-identity": authority,
  "@/server/opportunities/collector": {
    runCollection: () => {
      throw Error("Unexpected collection");
    },
  },
  "@/features/opportunities/lib/matching": matching,
  "@/server/opportunities/pagination": {
    readOpportunityPage: () => {
      throw Error("Unexpected pagination");
    },
    pageWindow: () => {},
    opportunitySelect: { id: true, description: true },
  },
  "@/server/opportunities/analytics": {
    analytics: () => {
      throw Error("Unexpected analytics");
    },
  },
});
identity.scopes = ["opportunities:write"];
assert.equal(
  (
    await route.POST(
      request({
        operation: "decision",
        id: "another-users-job",
        status: "APPLIED",
        notes: "",
      }),
    )
  ).status,
  404,
);
assert.equal(writes, 1);
assert.equal(
  (
    await route.POST(
      request({
        operation: "decision",
        id: "job",
        status: "INVENTED",
        notes: "",
      }),
    )
  ).status,
  400,
);
assert.equal(writes, 1);
identity.enabled = false;
assert.equal(
  (
    await route.POST(
      request({
        operation: "decision",
        id: "job",
        status: "APPLIED",
        notes: "",
      }),
    )
  ).status,
  403,
);
assert.equal(writes, 1);
assert.equal(
  (await route.POST(request({ operation: "__proto__" }))).status,
  400,
);
assert.equal(
  (
    await route.POST(
      new Request("https://api.example", {
        method: "POST",
        body: "x".repeat(17000),
      }),
    )
  ).status,
  400,
);
console.log(
  "PASS: tamper protection, freshness, replay rejection, per-app identity, active admin authority, owner/scope isolation, bounded bodies and ownership-scoped mutations.",
);
identity.enabled = true;
let state = { id: "owned", status: "NEW" };
const events = [];
prisma.opportunity.findFirst = async (q) => {
  assert.equal(q.where.profile.ownerId, "central-owner");
  return state;
};
prisma.opportunity.updateMany = async (q) => {
  assert.equal(q.where.profile.ownerId, "central-owner");
  assert.equal(q.where.status, state.status);
  state = { ...state, ...q.data };
  return { count: 1 };
};
prisma.opportunityEvent = { create: async ({ data }) => events.push(data) };
assert.equal(
  (
    await route.POST(
      request({
        operation: "decision",
        id: "owned",
        status: "APPLIED",
        notes: "Reviewed",
      }),
    )
  ).status,
  200,
);
assert.equal(events.length, 1);
assert.equal(events[0].fromStatus, "NEW");
assert.equal(events[0].toStatus, "APPLIED");
assert.equal(
  (
    await route.POST(
      request({
        operation: "decision",
        id: "owned",
        status: "APPLIED",
        notes: "Updated note",
      }),
    )
  ).status,
  200,
);
assert.equal(events.length, 1);
console.log(
  "PASS: owner-scoped status transition records one event; repeated saves do not fabricate applications.",
);

let detailReads = 0;
const detailProfile = {skills:["React","TypeScript"],projectEvidence:[],experienceYears:2,careerContext:"",targetRoles:["Frontend Developer"],homeCountry:"Nigeria",relocation:true,maxWeeklyHours:40};
prisma.opportunity.findFirst = async (q) => {
  detailReads++;
  assert.equal(q.where.profile.ownerId, "central-owner");
  assert.ok(q.select.id);
  assert.ok(q.select.profile.select.projectEvidence);
  return q.where.id === "owned"
    ? { id: "owned", title: "Frontend Developer", kind:"EMPLOYMENT", source: "REMOTIVE", url: "https://example.com/job", description: ("Must haves: React and TypeScript required. " + "x".repeat(7000)), status: "ARCHIVED", quarantined: false, assessment: {}, profile: detailProfile }
    : null;
};
identity.scopes = ["opportunities:write"];
assert.equal(
  (await route.POST(request({ operation: "detail", id: "owned" }))).status,
  403,
);
assert.equal(detailReads, 0);
identity.scopes = ["opportunities:read"];
const detailResponse = await route.POST(
  request({ operation: "detail", id: "owned" }),
);
assert.equal(detailResponse.status, 200);
assert.equal(detailResponse.headers.get("Cache-Control"), "no-store");
const detail = await detailResponse.json();
assert.equal(detail.data.job.description.length, 6000);
assert.equal(detail.data.job.status, "ARCHIVED");
assert.equal(detail.data.job.profile, undefined);
assert.equal(detail.data.job.assessment.careerReview.version, 1);
assert.equal(detail.data.job.assessment.careerReview.recommendation, "CLARIFY");
const writesBeforeReview = writes;
detailProfile.projectEvidence.push({name:"Recorded work",url:"https://example.com/demo",skills:["React","TypeScript"],contribution:"Implemented React screens and TypeScript API contracts."});
const refreshedDetail = await (await route.POST(request({operation:"detail",id:"owned"}))).json();
assert.equal(refreshedDetail.data.job.assessment.careerReview.recommendation,"PURSUE");
assert.equal(refreshedDetail.data.job.status,"ARCHIVED");
assert.equal(writes,writesBeforeReview);
assert.equal(
  (
    await (
      await route.POST(request({ operation: "detail", id: "other-owner" }))
    ).json()
  ).data.job,
  null,
);
for (const id of ["", "../owned", "x".repeat(161)])
  assert.equal(
    (await route.POST(request({ operation: "detail", id }))).status,
    400,
  );
assert.equal(detailReads, 3);
console.log(
  "PASS: private detail requires read scope, scopes every lookup to owner, handles missing/archived records, bounds excerpts and rejects malformed identifiers.",
);
identity.scopes = ["opportunities:write"];
let evidenceWrites = 0;
prisma.opportunityProfile = {upsert: async q => {
  evidenceWrites++;
  assert.equal(q.where.ownerId,"central-owner");
  if(evidenceWrites===1) {
    assert.equal(q.update.projectEvidence[0].name,"Dashboard");
    assert.equal("untrustedExtra" in q.update.projectEvidence[0],false);
  } else assert.equal("projectEvidence" in q.update,false);
  return {id:"profile"};
}};
const evidenceProfile = {operation:"profile",skills:["React"],experienceYears:2,enabled:true};
assert.equal((await route.POST(request({...evidenceProfile,projectEvidence:[{name:"Bad",url:"http://example.com",skills:["React"],contribution:"UI"}]}))).status,400);
assert.equal(evidenceWrites,0);
assert.equal((await route.POST(request({...evidenceProfile,projectEvidence:[{name:" Dashboard ",url:"https://example.com",skills:["React"],contribution:"Implemented UI",untrustedExtra:"drop"}]}))).status,200);
assert.equal((await route.POST(request(evidenceProfile))).status,200);
assert.equal(evidenceWrites,2);
console.log("PASS: project evidence rejected before writes, owner scoped, explicit fields sanitized and older clients preserve references.");

identity.scopes = ["opportunities:write"];
assert.equal((await route.POST(request({operation:"retention",preview:true}))).status,403);
identity.scopes = ["opportunities:read"];
assert.equal((await route.POST(request({operation:"retention",preview:"yes"}))).status,400);
assert.equal((await route.POST(request({operation:"retention",preview:true,ownerId:"other-owner"}))).status,200);
console.log("PASS: retention requires read scope and ignores supplied owner IDs.");

identity.scopes = ["opportunities:write"];
assert.equal((await route.POST(request({operation:"contacts",ownerId:"other"}))).status,403);
assert.equal((await route.POST(request({operation:"refresh",ownerId:"other"}))).status,200);
identity.scopes = ["opportunities:read"];
assert.equal((await route.POST(request({operation:"contacts",ownerId:"other"}))).status,200);
assert.equal((await route.POST(request({operation:"refresh",ownerId:"other"}))).status,403);
console.log("PASS: contacts require read scope, priority refresh requires write scope, supplied owners ignored.");
