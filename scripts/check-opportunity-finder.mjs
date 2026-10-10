import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import * as crypto from "node:crypto";
import * as net from "node:net";
function load(file, stubs = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => {
      if (!(name in stubs)) throw Error("Unmocked " + name);
      return stubs[name];
    },
    module,
    module.exports,
  );
  return module.exports;
}
let dnsCalls = 0,
  requests = 0;
const web = load("server/opportunities/web.ts", {
  "node:net": net,
  "node:dns/promises": {
    lookup: async () => {
      dnsCalls++;
      return [{ address: "127.0.0.1" }];
    },
  },
  "node:https": {
    request: () => {
      requests++;
      throw Error("Unexpected network");
    },
  },
});
for (const ip of [
  "127.0.0.1",
  "10.1.2.3",
  "172.16.0.1",
  "192.168.1.1",
  "169.254.169.254",
  "100.64.0.1",
  "0.0.0.0",
  "224.0.0.1",
  "::1",
])
  assert.equal(web.publicIPv4(ip), false);
assert.equal(web.publicIPv4("8.8.8.8"), true);
for (const url of [
  "http://company.example",
  "https://user:pass@company.example",
  "https://localhost",
  "https://10.0.0.1",
  "https://[::1]",
  "https://company.internal",
  "https://company.example:8080",
])
  assert.throws(() => web.publicUrl(url));
await assert.rejects(
  web.publicPage("https://company.example/jobs"),
  /Unsafe resolved/,
);
assert.equal(dnsCalls, 1);
assert.equal(requests, 0);
const matching = load("features/opportunities/lib/matching.ts");
const research = load("server/opportunities/research.ts", {
  "node:crypto": crypto,
  "./web": web,
  "./search": {
    searchWeb: async () => {
      throw Error("No key");
    },
  },
});
assert.equal(
  research.spamSignals("Pay a registration fee before starting to secure a job")
    .length,
  1,
);
assert.equal(
  research.spamSignals(
    "We never pay registration fees. Do not pay an application fee to secure a job.",
  ).length,
  0,
);
assert.equal(
  research.spamSignals("Send your bank password to continue").length,
  1,
);
assert.equal(
  research.publicContacts(
    "<script>jobs@bad.example</script> careers@company.example person@company.example",
    "https://company.example/contact",
  ).length,
  1,
);
assert.equal(
  research.robotsAllow(
    "User-agent: *\nUser-agent: Googlebot\nDisallow: /private",
    "/private/x",
  ),
  false,
);
assert.equal(
  research.robotsAllow(
    "User-agent: Googlebot\nDisallow: /\nUser-agent: *\nDisallow: /private",
    "/jobs",
  ),
  true,
);
assert.equal(
  research.jobPosting(
    '<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer","description":"React","hiringOrganization":{"name":"Acme"}}</script>',
  ).company,
  "Acme",
);
assert.equal(
  research.jobPosting('<script type="application/ld+json">broken</script>'),
  null,
);
const sources = load("server/opportunities/sources.ts", {
  "node:crypto": crypto,
  "./web": web,
  "./search": { searchWeb: () => {} },
  "./remotive": { collectRemotive: () => {} },
});
const listing = {
  source: "REMOTIVE",
  kind: "EMPLOYMENT",
  publishedKnown: true,
  externalId: "1",
  title: "Frontend Developer",
  company: "Company",
  url: "https://company.example/jobs/1",
  description:
    "React, Next.js, TypeScript. 2 years of experience. 40 hours per week.",
  location: "Worldwide",
  salary: null,
  jobType: "full_time",
  publishedAt: new Date(),
};
assert.equal(
  sources.parseFeed("JOBICY", {
    jobs: [
      {
        id: 1,
        jobTitle: "Engineer",
        companyName: "Acme",
        url: listing.url,
        jobDescription: "React",
        pubDate: "2026-10-09",
      },
    ],
  }).length,
  1,
);
assert.equal(
  sources.parseFeed("ARBEITNOW", {
    data: [
      { title: "Engineer", url: "http://unsafe.example", description: "React" },
    ],
  }).length,
  0,
);
assert.throws(() => sources.parseFeed("GREENHOUSE:acme", { error: "No jobs" }));
assert.equal(
  research.canonicalKey(listing),
  research.canonicalKey({
    ...listing,
    url: listing.url + "?utm_source=tracker",
  }),
);
const policy = load("server/opportunities/policy.ts");
const fit = load("server/opportunities/fit.ts", {
  "@/features/opportunities/lib/project-evidence": load("features/opportunities/lib/project-evidence.ts"),
  "./policy": policy,
  "@/features/opportunities/lib/matching": matching,
});
const profile = {
  id: "profile",
  enabled: true,
  skills: matching.defaultSkills,
  experienceYears: 2,
  targetRoles: ["Frontend Engineer"],
  careerContext: "Built commerce dashboards and accessible interfaces.",
  homeCountry: "Ghana",
  relocation: true,
  maxWeeklyHours: 20,
  researchEnabled: false,
};
const evidence = {
  risk: "UNKNOWN",
  flags: [],
  contacts: [],
  pages: [],
  coverage: "Source only",
  publishedKnown: true,
  checkedAt: new Date().toISOString(),
};
assert.match(
  fit.careerFit(listing, profile, evidence).assessment.concerns.join(" "),
  /40.*20/,
);
assert.match(
  fit.careerFit({ ...listing, location: "US remote" }, profile, evidence)
    .assessment.eligibility,
  /Ghana.*unconfirmed/,
);
assert.equal(
  matching.assess(
    { ...listing, title: "Engineer", description: "reactive programming" },
    ["React"],
    2,
  ).assessment.matched.length,
  0,
);
let feed = [
    listing,
    {
      ...listing,
      source: "JOBICY",
      externalId: "2",
      url: listing.url + "?utm_source=jobs",
    },
  ],
  fail = false,
  persistenceFailure = false,
  fetches = 0,
  rows = [],
  runs = [],
  notifications = [],
  sourceRuns = [];
let mutex = Promise.resolve();
const tx = {
  $executeRaw: async () => {},
  opportunityProfile: { findUnique: async () => profile },
  opportunityRun: {
    findFirst: async () => runs.at(-1) || null,
    create: async ({ data }) => {
      const r = { id: "run-" + runs.length, ...data };
      runs.push(r);
      return r;
    },
    update: async ({ where, data }) =>
      Object.assign(
        runs.find((r) => r.id === where.id),
        data,
      ),
  },
  opportunity: {
    findMany: async () => rows,
    count: async () =>
      rows.filter((r) => r.status === "NEW" && !r.notes).length,
    create: async ({ data }) => {
      if (persistenceFailure) throw Error("DB");
      rows.push({
        id: "job-" + rows.length,
        status: "NEW",
        notes: "",
        ...data,
      });
    },
    update: async ({ where, data }) => {
      if (persistenceFailure) throw Error("DB");
      Object.assign(
        rows.find((r) => r.id === where.id),
        data,
      );
    },
  },
  opportunitySourceRun: { create: async ({ data }) => sourceRuns.push(data) },
  notification: { create: async ({ data }) => notifications.push(data) },
};
const prisma = {
  ...tx,
  $transaction: (fn) => {
    const result = mutex.then(async () => {
      const snapshot = structuredClone({
        rows,
        runs,
        notifications,
        sourceRuns,
      });
      try {
        return await fn(tx);
      } catch (e) {
        ({ rows, runs, notifications, sourceRuns } = snapshot);
        throw e;
      }
    });
    mutex = result.catch(() => {});
    return result;
  },
};
profile.maxWeeklyHours = 40;
const collector = load("server/opportunities/collector.ts", {
  "server-only": {},
  "@/lib/prisma": { prisma },
  "./fit": fit,
  "./policy": policy,
  "./research": research,
  "./sources": {
    discover: async () => {
      fetches++;
      if (fail) throw Error("SOURCE");
      return [
        {
          source: "REMOTIVE",
          status: "SUCCESS",
          listings: feed.filter((r) => r.source === "REMOTIVE"),
          message: null,
        },
        {
          source: "JOBICY",
          status: "SUCCESS",
          listings: feed.filter((r) => r.source === "JOBICY"),
          message: null,
        },
        {
          source: "WEB_SEARCH",
          status: feed.some((v) => v.source === "WEB_SEARCH")
            ? "SUCCESS"
            : "NOT_CONFIGURED",
          listings: feed.filter((v) => v.source === "WEB_SEARCH"),
          message: "Key missing",
        },
      ];
    },
  },
});
const results = await Promise.all([
  collector.runCollection("owner"),
  collector.runCollection("owner"),
]);
assert.deepEqual(results.map((r) => r.status).sort(), ["cooldown", "success"]);
assert.equal(fetches, 1);
assert.equal(rows.length, 1);
assert.equal(runs[0].status, "PARTIAL");
assert.equal(sourceRuns.length, 3);
rows[0].status = "APPLIED";
rows[0].notes = "Human decision";
runs = [];
await collector.runCollection("owner");
assert.equal(rows.length, 1);
assert.equal(rows[0].status, "APPLIED");
assert.equal(rows[0].notes, "Human decision");
runs = [];
feed = [];
await collector.runCollection("owner");
assert.equal(rows.length, 1);
assert.equal(rows[0].status, "APPLIED");
assert.equal(rows[0].sourceState, "LISTED");
runs = [];
fail = true;
await collector.runCollection("owner");
assert.equal(runs[0].status, "FAILED");
assert.equal(rows.length, 1);
runs = [];
fail = false;
feed = [
  { ...listing, description: "React. Pay an application fee to secure a job." },
];
await collector.runCollection("owner");
assert.equal(rows[0].quarantined, true);
assert.equal(rows[0].status, "APPLIED");
runs = [];
persistenceFailure = true;
await collector.runCollection("owner");
assert.equal(runs[0].status, "FAILED");
assert.equal(rows[0].notes, "Human decision");
runs = [];
profile.enabled = false;
const n = fetches;
assert.equal((await collector.runCollection("owner")).status, "disabled");
assert.equal(fetches, n);
console.log(
  "PASS: private-network blocking, robots, contact provenance, malformed feeds, cross-source deduplication, career boundaries, risk quarantine, concurrent cooldown, transaction rollback and decision preservation.",
);

profile.enabled = true;
persistenceFailure = false;
runs = [];
feed = [
  ...Array.from({ length: 220 }, (_, i) => ({
    ...listing,
    externalId: "large-" + i,
    url: "https://company.example/jobs/large-" + i,
  })),
  {
    ...listing,
    source: "WEB_SEARCH",
    kind: "PROJECT",
    externalId: "project",
    url: "https://company.example/tender/project",
    title: "Web development tender",
    description: "React Next.js TypeScript project request",
    location: "Not established",
  },
];
await collector.runCollection("owner");
assert.equal(
  rows.some((r) => r.source === "WEB_SEARCH" && r.kind === "PROJECT"),
  true,
);
assert.equal(runs[0].added <= 25, true);
console.log(
  "PASS: a large high-scoring feed cannot crowd web/project territory out of the processing budget.",
);

const strong = {
  ...listing,
  externalId: "policy",
  description:
    "React Next.js TypeScript. 2 years of experience. 40 hours per week.",
};
assert.equal(policy.weeklyHours("40–60 hours per week"), 60);
assert.equal(policy.weeklyHours("Flexible hours; weekly meetings"), null);
assert.equal(
  policy.admission(strong, profile, fit.careerFit(strong, profile, evidence)),
  "priority",
);
const overload = {
  ...strong,
  description: strong.description + " Requires 45-60 hours/week.",
};
assert.equal(
  policy.admission(
    overload,
    profile,
    fit.careerFit(overload, profile, evidence),
  ),
  "skip",
);
const senior = { ...strong, title: "Senior Frontend Developer" };
assert.equal(
  policy.admission(senior, profile, fit.careerFit(senior, profile, evidence)),
  "stretch",
);
const mismatch = {
  ...strong,
  description: "React Next.js TypeScript. 8 years of experience.",
};
assert.equal(
  policy.admission(mismatch, profile, {
    score: 90,
    assessment: { matched: ["React", "TypeScript"] },
  }),
  "skip",
);
rows = [];
runs = [];
feed = Array.from({ length: 60 }, (_, i) => ({
  ...strong,
  externalId: "budget-" + i,
  url: "https://company.example/jobs/budget-" + i,
}));
await collector.runCollection("owner");
assert.equal(rows.length, 25);
rows = [];
runs = [];
feed = Array.from({ length: 10 }, (_, i) => ({
  ...senior,
  externalId: "stretch-" + i,
  url: "https://company.example/jobs/stretch-" + i,
}));
await collector.runCollection("owner");
assert.equal(rows.length, 2);
rows = Array.from({ length: 500 }, (_, i) => ({
  id: "existing-" + i,
  status: "NEW",
  notes: "",
  externalId: "existing-" + i,
  source: "REMOTIVE",
  canonicalKey: "existing-" + i,
}));
runs = [];
feed = [strong];
await collector.runCollection("owner");
assert.equal(rows.length, 500);
assert.equal(runs[0].added, 0);
const safe = policy.retentionWhere("profile", new Date("2026-10-09T07:00:00Z"));
assert.equal(safe.status, "NEW");
assert.equal(safe.notes, "");
assert.equal(safe.quarantined, false);
assert.deepEqual(safe.events, { none: {} });
assert.equal(safe.profileId, "profile");
assert.equal(safe.lastSeenAt.lt.toISOString(), "2026-07-11T07:00:00.000Z");
assert.equal(safe.updatedAt.lt.toISOString(), safe.lastSeenAt.lt.toISOString());
assert.throws(() => policy.retentionWhere(""));
rows = [
  {
    id: "stale",
    profileId: "profile",
    status: "NEW",
    notes: "",
    quarantined: false,
    lastSeenAt: new Date(0),
    updatedAt: new Date(0),
    events: [],
  },
  { id: "noted", status: "NEW", notes: "Keep this", quarantined: false },
  { id: "applied", status: "APPLIED", notes: "", quarantined: false },
  { id: "risk", status: "NEW", notes: "", quarantined: true },
  { id: "history", status: "NEW", notes: "", quarantined: false, events: [{}] },
];
const oldFind = tx.opportunity.findMany;
let deletes = 0;
tx.opportunity.findMany = async (q) => {
  if (q.where.updatedAt) {
    assert.equal(q.take, 100);
    assert.equal(q.where.profileId, "profile");
    return [{ id: "stale" }];
  }
  return rows;
};
tx.opportunity.deleteMany = async ({ where }) => {
  deletes++;
  assert.equal(where.profileId, "profile");
  assert.equal(where.status, "NEW");
  assert.equal(where.notes, "");
  assert.equal(where.quarantined, false);
  assert.deepEqual(where.events, { none: {} });
  assert.deepEqual(where.id.in, ["stale"]);
  assert.ok(where.updatedAt.lt);
  rows = rows.filter((r) => r.id !== "stale");
  return { count: 1 };
};
process.env.OPPORTUNITY_RETENTION_ENABLED = "true";
runs = [];
feed = [];
await collector.runCollection("owner");
assert.equal(deletes, 1);
assert.deepEqual(
  rows.map((r) => r.id),
  ["noted", "applied", "risk", "history"],
);
runs = [];
fail = true;
await collector.runCollection("owner");
assert.equal(deletes, 1);
delete process.env.OPPORTUNITY_RETENTION_ENABLED;
tx.opportunity.findMany = oldFind;
console.log(
  "PASS: workload ranges, experience gaps, 25-new and two-stretch limits, 500-untouched cap, owner-scoped retention predicates, history/notes/quarantine protection and no cleanup after failed discovery.",
);
process.env.OPPORTUNITY_RETENTION_ENABLED = "true";
runs = [];
const failedCollector = load("server/opportunities/collector.ts", {
  "server-only": {},
  "@/lib/prisma": { prisma },
  "./fit": fit,
  "./policy": policy,
  "./research": research,
  "./sources": {
    discover: async () => [
      {
        source: "REMOTIVE",
        status: "FAILED",
        listings: [],
        message: "Feed unavailable",
      },
    ],
  },
});
await failedCollector.runCollection("owner");
assert.equal(deletes, 1);
assert.equal(runs[0].status, "FAILED");
delete process.env.OPPORTUNITY_RETENTION_ENABLED;
console.log(
  "PASS: completed all-failed source batches also preserve stale records.",
);

rows = [];
runs = [];
const manyBatches = Array.from({ length: 15 }, (_, index) => ({
  source: index === 14 ? "WEB_SEARCH" : "BOARD:" + index,
  status: "SUCCESS",
  message: null,
  listings: Array.from({ length: 50 }, (_, i) => ({
    ...strong,
    source: index === 14 ? "WEB_SEARCH" : "BOARD:" + index,
    kind: index === 14 ? "PROJECT" : "EMPLOYMENT",
    externalId: "fair-" + index + "-" + i,
    url: "https://company.example/jobs/fair-" + index + "-" + i,
  })),
}));
const fairCollector = load("server/opportunities/collector.ts", {
  "server-only": {},
  "@/lib/prisma": { prisma },
  "./fit": fit,
  "./policy": policy,
  "./research": research,
  "./sources": { discover: async () => manyBatches },
});
await fairCollector.runCollection("owner");
assert.equal(rows.length, 25);
assert.equal(new Set(rows.map((r) => r.source)).size, 15);
assert.equal(
  rows.some((r) => r.source === "WEB_SEARCH" && r.kind === "PROJECT"),
  true,
);
console.log(
  "PASS: round-robin admission preserves all 15 source territories inside the 25-new-save budget.",
);

const projectProof = load("features/opportunities/lib/project-evidence.ts");
const recordedProject = { name: "Dashboard", url: "https://example.com/demo", skills: ["React", "TypeScript"], contribution: "Implemented the interface and typed API integration." };
assert.equal(projectProof.isProjectEvidence([recordedProject]), true);
for (const bad of [{...recordedProject,url:"http://example.com"},{...recordedProject,url:"https://user:pass@example.com"},{...recordedProject,contribution:""},{...recordedProject,skills:Array(13).fill("React")}]) assert.equal(projectProof.isProjectEvidence([bad]),false);
assert.equal(projectProof.isProjectEvidence(Array(7).fill(recordedProject)),false);
assert.deepEqual(projectProof.projectGrounding([recordedProject], ["React","SQL"]).missing,["SQL"]);
const groundedListing = {...listing, description: "React TypeScript SQL frontend role, 40 hours per week"};
const ungroundedFit = fit.careerFit(groundedListing,{...profile,skills:["React","TypeScript","SQL"]},evidence);
const groundedFit = fit.careerFit(groundedListing,{...profile,skills:["React","TypeScript","SQL"],projectEvidence:[recordedProject]},evidence);
assert.equal(groundedFit.score,ungroundedFit.score);
assert.deepEqual(groundedFit.assessment.concerns,ungroundedFit.assessment.concerns);
assert.match(groundedFit.assessment.evidence.join(" "),/Owner-recorded project: Dashboard.*not been independently verified/);
assert.match(groundedFit.assessment.unknowns.join(" "),/SQL.*missing evidence/);
console.log("PASS: bounded project references, unsafe URLs rejected, personal contribution required, explicit evidence gaps and unchanged scoring/workload boundaries.");
