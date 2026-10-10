import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
const js = ts.transpileModule(
  fs.readFileSync("server/opportunities/pagination.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const module = { exports: {} };
new Function("module", "exports", js)(module, module.exports);
const { readOpportunityPage, pageWindow } = module.exports;
for (const value of [
  -1,
  0,
  NaN,
  Infinity,
  1.5,
  "2",
  {},
  Number.MAX_SAFE_INTEGER + 1,
])
  assert.equal(pageWindow(14, value).page, 1);
assert.equal(pageWindow(14, Number.MAX_SAFE_INTEGER).page, 3);
assert.equal(pageWindow(0, 50).pages, 1);
const rows = Array.from({ length: 14 }, (_, i) => ({
  id: String(i).padStart(2, "0"),
  profileId: "owner",
  score: 100 - Math.floor(i / 2),
  publishedAt: new Date("2026-10-09"),
  status: "NEW",
  kind: "EMPLOYMENT",
  quarantined: false,
}));
rows.push(
  { ...rows[0], id: "other", profileId: "other", score: 999 },
  { ...rows[0], id: "risk", quarantined: true },
  { ...rows[0], id: "archived", status: "ARCHIVED" },
  { ...rows[0], id: "project", kind: "PROJECT", score: 1 },
);
let reads = 0;
const match = (r, w) =>
  r.profileId === w.profileId &&
  r.quarantined === w.quarantined &&
  (!w.kind || r.kind === w.kind) &&
  (typeof w.status === "string"
    ? r.status === w.status
    : r.status !== w.status.not);
const db = {
  $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, "RepeatableRead");
    return fn({
      opportunity: {
        count: async ({ where }) => rows.filter((r) => match(r, where)).length,
        findMany: async (q) => {
          reads++;
          assert.equal(q.take, 6);
          assert.equal(q.where.profileId, "owner");
          assert.deepEqual(q.orderBy, [
            { score: "desc" },
            { publishedAt: "desc" },
            { id: "asc" },
          ]);
          return rows
            .filter((r) => match(r, q.where))
            .sort(
              (a, b) =>
                b.score - a.score ||
                b.publishedAt - a.publishedAt ||
                a.id.localeCompare(b.id),
            )
            .slice(q.skip, q.skip + q.take);
        },
      },
    });
  },
};
const pages = await Promise.all(
  [1, 2, 3].map((page) =>
    readOpportunityPage(db, "owner", { kind: "EMPLOYMENT" }, page),
  ),
);
assert.deepEqual(
  pages.map((p) => p.jobs.length),
  [6, 6, 2],
);
assert.equal(new Set(pages.flatMap((p) => p.jobs.map((j) => j.id))).size, 14);
assert.equal(pages[2].pagination.hasNext, false);
assert.equal(pages[0].pagination.hasPrevious, false);
assert.equal(
  (await readOpportunityPage(db, "owner", { queue: "quarantine" }, 1)).jobs[0]
    .id,
  "risk",
);
assert.equal(
  (await readOpportunityPage(db, "owner", { status: "ARCHIVED" }, 1)).jobs[0]
    .id,
  "archived",
);
assert.equal(
  (await readOpportunityPage(db, "owner", { kind: "PROJECT" }, 1)).pagination
    .total,
  1,
);
assert.equal(
  (await readOpportunityPage(db, "owner", { kind: "EMPLOYMENT" }, 99999999))
    .pagination.page,
  3,
);
await assert.rejects(readOpportunityPage(db, "", {}, 1), /Owner profile/);
assert.equal(reads, 7);
console.log(
  "PASS: six-row database limit, stable ranked pagination, owner isolation, filtered counts, empty/last pages and oversized page clamping.",
);
