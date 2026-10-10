import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import path from "node:path";
function load(file, stubs = {}) {
  const evaluated = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", js)(
    name => { if (!(name in stubs)) throw Error("Unmocked " + name); return stubs[name]; },
    evaluated, evaluated.exports,
  );
  return evaluated.exports;
}
const matching = load("features/opportunities/lib/matching.ts");
const context = load("features/opportunities/lib/source-context.ts");
const intent = load("features/opportunities/lib/intent.ts");
const evidence = load("features/opportunities/lib/project-evidence.ts");
const policy = load("server/opportunities/policy.ts");
const fit = load("server/opportunities/fit.ts", {
  "@/features/opportunities/lib/source-context": context,
  "@/features/opportunities/lib/project-evidence": evidence,
  "@/features/opportunities/lib/matching": matching, "./policy": policy,
});
const review = load("server/opportunities/career-review.ts", {
  "@/features/opportunities/lib/source-context": context,
  "@/features/opportunities/lib/project-evidence": evidence, "./policy": policy,
});
const priority = load("server/opportunities/priority.ts", {
  "@/features/opportunities/lib/source-context": context,
  "@/features/opportunities/lib/intent": intent, "./career-review": review,
});
const profile = { id: "profile", ownerId: "owner", skills: ["React"],
  projectEvidence: [], experienceYears: 2, careerContext: "", targetRoles: ["Frontend Developer"],
  homeCountry: "Nigeria", relocation: false, maxWeeklyHours: 40 };
const research = {risk:"UNKNOWN",flags:[],contacts:[],pages:[],coverage:"",publishedKnown:false,checkedAt:""};
const row = {id:"one",profileId:"profile",source:"WEB_SEARCH",externalId:"one",kind:"EMPLOYMENT",
  title:"Frontend Developer",company:"Unconfirmed",url:"https://example.com/job",
  description:"React and TypeScript developer opportunity.",location:"Remote",jobType:"Full time",
  publishedAt:new Date(),updatedAt:new Date(),status:"SHORTLISTED",notes:"Preserve this decision",quarantined:false,research};
const oldProfile = {...profile,skills:["TypeScript"],targetRoles:["Backend Developer"]};
const oldFit = fit.careerFit(row,oldProfile,research);
const {kind, ...oldPriority} = priority.evidencePriority(row,oldProfile,research,false);
Object.assign(row,{kind,score:oldFit.score,assessment:{...oldFit.assessment,...oldPriority,customEvidence:"keep"}});
const expectedFit = fit.careerFit(row,profile,research);
assert.notDeepEqual(row.assessment.matched,expectedFit.assessment.matched);
let reads = 0, writes = [];
const prisma = {
  opportunityProfile:{findUnique:async q=>{assert.deepEqual(q,{where:{ownerId:"owner"}});return profile;}},
  opportunity:{
    findMany:async q=>{assert.equal(q.where.profileId,"profile");assert.equal(q.take,100);return reads++===0?[row]:[];},
    updateMany:async q=>{
      assert.equal(q.where.profileId,"profile");assert.equal(q.where.updatedAt,row.updatedAt);
      assert.deepEqual(Object.keys(q.data).sort(),["assessment","kind","score"]);
      assert.equal("notes" in q.data,false);assert.equal("status" in q.data,false);
      writes.push(q);Object.assign(row,q.data);return {count:1};
    },
  },
};
const refresh = load("server/opportunities/refresh-priorities.ts",{
  "server-only":{},"@/lib/prisma":{prisma},"./priority":priority,"./fit":fit,
});
assert.deepEqual(await refresh.refreshPriorities("owner"),{checked:1,changed:1});
assert.deepEqual(row.assessment.matched,expectedFit.assessment.matched);
assert.equal(row.score,expectedFit.score);
assert.equal(row.assessment.customEvidence,"keep");
assert.equal(row.notes,"Preserve this decision");assert.equal(row.status,"SHORTLISTED");
if (process.argv[2]) {
  const systems = process.argv[2];
  const read = file => path.join(systems, file);
  const contract = load(read("features/opportunities/types.ts"), {
    "./lib/career-review": load(read("features/opportunities/lib/career-review.ts")),
    "./lib/project-evidence": load(read("features/opportunities/lib/project-evidence.ts")),
  });
  const data = contract.validateFinderData({
    profile: { ...profile, enabled: true, researchEnabled: true },
    jobs: [{ ...row, publishedAt: row.publishedAt.toISOString(),
      lastSeenAt: new Date().toISOString(), sourceState: "LISTED", salary: null,
      research: { ...research, checkedAt: new Date().toISOString() } }],
    runs: [], analytics: null,
    pagination: { page: 1, pageSize: 6, total: 1, pages: 1, hasNext: false, hasPrevious: false },
  });
  assert.equal(data.jobs[0].score, expectedFit.score);
  assert.deepEqual(data.jobs[0].assessment.matched, expectedFit.assessment.matched);
  console.log("PASS: refreshed API assessment is accepted by the actual Systems response validator.");
}
// Assessment timestamps alone must not cause a second write.
row.assessment.careerReview.assessedAt="2000-01-01T00:00:00.000Z";
reads=0;writes=[];
assert.deepEqual(await refresh.refreshPriorities("owner"),{checked:1,changed:0});
assert.equal(writes.length,0);
// Legacy rows without research remain supported.
row.research=null;row.assessment={};reads=0;
assert.deepEqual(await refresh.refreshPriorities("owner"),{checked:1,changed:1});
// A concurrent edit is skipped by the database predicate, not counted as a successful refresh.
row.assessment={};reads=0;
prisma.opportunity.updateMany=async q=>{assert.equal(q.where.updatedAt,row.updatedAt);return {count:0};};
assert.deepEqual(await refresh.refreshPriorities("owner"),{checked:1,changed:0});
console.log("PASS: changed profile refreshes fit even at the same priority, legacy research, repeatable refresh, owner scope, concurrent edits and preserved decisions.");
