import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const output = ts.transpileModule(
  fs.readFileSync("server/opportunities/analytics.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const now = new Date();
let rows = [
  { opportunityId: "current", toStatus: "APPLIED", createdAt: now },
  { opportunityId: "current", toStatus: "REPLIED", createdAt: now },
  { opportunityId: "legacy", toStatus: "REPLIED", createdAt: now },
];
const prisma = {
  opportunity: {
    count: async () => 2,
    groupBy: async () => [{ status: "APPLIED", _count: { _all: 1 } }],
    findMany: async ({ select }) =>
      select.research
        ? [
            {
              research: {
                contacts: [
                  { email: "jobs@company.example" },
                  { email: "jobs@company.example" },
                ],
              },
            },
          ]
        : [{ createdAt: now }],
  },
  opportunitySourceRun: { findMany: async () => [] },
  opportunityEvent: { findMany: async () => rows },
};
const module = { exports: {} };
new Function("require", "module", "exports", output)(
  (name) => (name === "server-only" ? {} : { prisma }),
  module,
  module.exports,
);
let a = await module.exports.analytics("profile");
assert.equal(a.recordedApplications, 1);
assert.equal(a.recordedResponses, 1);
assert.equal(a.responseRate, 100);
assert.equal(a.publicContacts, 1);
assert.match(a.historyCoverage, /older applications/);
rows = [];
a = await module.exports.analytics("profile");
assert.equal(a.responseRate, null);
rows = Array.from({ length: 5000 }, (_, i) => ({
  opportunityId: "job-" + i,
  toStatus: "APPLIED",
  createdAt: now,
}));
a = await module.exports.analytics("profile");
assert.equal(a.responseRate, null);
assert.equal(a.bounded, true);
console.log(
  "PASS: timestamped response cohort excludes legacy responses, contacts deduplicate, empty and truncated histories do not invent rates.",
);
