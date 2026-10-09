import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
function load(file, stubs = {}) {
 const output = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const evaluated = {exports:{}};
 new Function('require','module','exports',output)(name=>{if (!(name in stubs)) throw Error('Unmocked '+name);return stubs[name];},evaluated,evaluated.exports);return evaluated.exports;
}
const matching = load('features/opportunities/lib/matching.ts');
const listing = {externalId:'1',title:'Frontend Developer',company:'Company',url:'https://remotive.com/remote-jobs/test',description:'React, Next.js, TypeScript. 2 years of experience.',location:'Worldwide',salary:null,jobType:'contract',publishedAt:new Date()};
assert.equal(matching.assess(listing,matching.defaultSkills,2).assessment.verdict,'Worth reviewing');
assert.match(matching.assess({...listing,title:'Senior Frontend Engineer',description:'React. 5+ years of professional experience'},matching.defaultSkills,2).assessment.concerns.join(' '),/5\+ years/);
assert.match(matching.assess({...listing,location:'United States'},matching.defaultSkills,2).assessment.eligibility,/unknown/);
assert.equal(matching.assess({...listing,description:'reactive programming',title:'Engineer'},['React'],2).assessment.matched.length,0);
const parser=load('server/opportunities/remotive.ts');
const row={id:1,title:'Frontend',company_name:'Company',url:listing.url,description:'<script>alert(1)</script><p>React</p>',publication_date:'2026-10-08T12:00:00',candidate_required_location:'Worldwide'};
assert.equal(parser.parseRemotive({jobs:[row,row]}).length,1);
assert.equal(parser.parseRemotive({jobs:[row]})[0].description,'React');
assert.throws(()=>parser.parseRemotive({jobs:[{...row,url:'https://evil.example'}]}));
assert.throws(()=>parser.parseRemotive({jobs:[{...row,publication_date:'invalid'}]}));
assert.throws(()=>parser.parseRemotive({error:'rate limited'}));
let enabled=true, fail=false, fetches=0, rows=[],runs=[],notifications=[];
let feed=[listing];let mutex=Promise.resolve();
const tx={
 $executeRaw:async()=>{},
 opportunityProfile:{findUnique:async()=>({id:'profile',enabled,skills:matching.defaultSkills,experienceYears:2})},
 opportunityRun:{findFirst:async()=>runs.at(-1)||null,create:async({data})=>{runs.push(data);return data;}},
 opportunity:{findUnique:async({where})=>rows.find(r=>r.externalId===where.profileId_source_externalId.externalId),upsert:async({create,update})=>{let r=rows.find(r=>r.externalId===create.externalId);if(r)Object.assign(r,update);else rows.push({...create});},updateMany:async({where,data})=>{for(const r of rows)if(!where.externalId.notIn.includes(r.externalId))Object.assign(r,data);}},
 notification:{create:async({data})=>notifications.push(data)}
};
const collector=load('server/opportunities/collector.ts',{'server-only':{},'@/lib/prisma':{prisma:{$transaction:async(fn)=>{const p=mutex.then(()=>fn(tx));mutex=p.catch(()=>{});return p;}}},'@/features/opportunities/lib/matching':matching,'./remotive':{collectRemotive:async()=>{fetches++;if(fail)throw Error('SOURCE');return feed;}}});
await Promise.all([collector.runCollection('dennis'),collector.runCollection('dennis')]);
assert.equal(fetches,1);assert.equal(rows.length,1);assert.equal(notifications.length,1);
rows[0].status='APPLIED';rows[0].notes='Interview booked';runs=[];
await collector.runCollection('dennis');assert.equal(rows.length,1);assert.equal(rows[0].status,'APPLIED');assert.equal(rows[0].notes,'Interview booked');
runs=[];feed=[];await collector.runCollection('dennis');assert.equal(rows[0].sourceState,'NOT_IN_FEED');assert.equal(rows[0].status,'APPLIED');
runs=[];fail=true;await collector.runCollection('dennis');assert.equal(runs[0].status,'FAILED');assert.equal(rows.length,1);
runs=[];enabled=false;const count=fetches;await collector.runCollection('dennis');assert.equal(fetches,count);

console.log('PASS: grounded matching, source validation, cooldown, concurrency, deduplication, decision preservation and failed feeds.');
