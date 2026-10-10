import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
function load(file,stubs={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function("require","module","exports",code)(name=>{if(!(name in stubs))throw Error("Unexpected "+name);return stubs[name];},module,module.exports);return module.exports;}
const policy=load("server/opportunities/policy.ts");
let profile={id:"private-profile"},reads=0,samples=0;
const tx={opportunity:{count:async q=>{reads++;assert.equal(q.where.profileId,"private-profile");if(q.where.lastSeenAt){assert.equal(q.where.quarantined,false);assert.deepEqual(q.where.events,{none:{}});assert.equal(q.where.status,"NEW");assert.equal(q.where.notes,"");return 3;}return q.where.status?4:10;},findMany:async q=>{samples++;assert.equal(q.take,6);assert.deepEqual(q.orderBy,[{lastSeenAt:"asc"},{id:"asc"}]);assert.equal(q.where.profileId,"private-profile");return [{id:"old",title:"Old role",company:"Employer",lastSeenAt:new Date("2025-01-01"),updatedAt:new Date("2025-01-01")}];},deleteMany:()=>{throw Error("Preview must never delete");}}};
const prisma={opportunityProfile:{findUnique:async q=>{assert.deepEqual(q.where,{ownerId:"owner"});return profile;}},$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,"RepeatableRead");return fn(tx);}};
const retention=load("server/opportunities/retention.ts",{"@/lib/prisma":{prisma},"./policy":policy});
const now=new Date("2026-10-10T00:00:00Z");
const original=process.env.OPPORTUNITY_RETENTION_ENABLED;process.env.OPPORTUNITY_RETENTION_ENABLED="false";
const summary=await retention.retentionSnapshot("owner",false,now);assert.equal(summary.retentionEnabled,false);assert.equal(summary.eligible,3);assert.equal(summary.ineligible,7);assert.equal(samples,0);assert.equal(summary.deletionPerformed,false);
process.env.OPPORTUNITY_RETENTION_ENABLED="true";
const preview=await retention.retentionSnapshot("owner",true,now);assert.equal(preview.retentionEnabled,true);assert.equal(preview.candidates.length,1);assert.equal(samples,1);assert.equal(preview.cutoff,"2026-07-12T00:00:00.000Z");
profile=null;const before=reads;assert.equal((await retention.retentionSnapshot("owner",true,now)).eligible,0);assert.equal(reads,before);
if(original===undefined)delete process.env.OPPORTUNITY_RETENTION_ENABLED;else process.env.OPPORTUNITY_RETENTION_ENABLED=original;
console.log("PASS: owner-scoped read-only retention snapshot, real enablement state, shared protected predicates, repeatable reads, bounded preview and missing profile.");
