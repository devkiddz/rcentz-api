import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
function load(file,stubs={}){const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',out)(n=>{if(!(n in stubs))throw Error('Unmocked '+n);return stubs[n];},m,m.exports);return m.exports;}
const {reviewCareer}=load('server/opportunities/career-review.ts',{'@/features/opportunities/lib/project-evidence':load('features/opportunities/lib/project-evidence.ts'),'./policy':load('server/opportunities/policy.ts')});
const {isCareerReview}=load('features/opportunities/lib/career-review.ts');
const profile={skills:['React','TypeScript'],projectEvidence:[{name:'Delivery',url:'https://example.com',skills:['React','TypeScript'],contribution:'I implemented React components and TypeScript data contracts.'}],experienceYears:2,careerContext:'',targetRoles:['Frontend Developer'],homeCountry:'Nigeria',relocation:true,maxWeeklyHours:40};
const listing={source:'REMOTIVE',kind:'EMPLOYMENT',externalId:'one',title:'Frontend Developer',company:'Acme',url:'https://example.com/job',location:'Worldwide',salary:null,jobType:'full_time',publishedAt:new Date(),publishedKnown:true};
const filler=' The team builds a customer workspace and discusses delivery milestones with colleagues. '.repeat(4);
const run=(description,patch={},p=profile)=>reviewCareer({...listing,description:description+filler,...patch},p,false,new Date('2026-10-10T00:00:00Z'));
let a=run('Must haves: React and TypeScript required.');assert.equal(a.recommendation,'PURSUE');assert.ok(isCareerReview(a));assert.equal(a.requirements.filter(r=>r.evidence==='SUPPORTED').length,2);
a=run('Must haves: React and TypeScript required.',{}, {...profile,projectEvidence:[{...profile.projectEvidence[0],contribution:'Built a customer workspace.'}]});assert.equal(a.recommendation,'CLARIFY');assert.ok(a.requirements.every(r=>r.evidence!=='SUPPORTED'));
for(const [text,expected] of [
 ['Must haves: AWS and Docker required. React and TypeScript required.','SKIP'],
 ['Must haves: React and TypeScript required. Nice to haves: AWS and Docker. 8 years of experience preferred.','PURSUE'],
 ['Must haves: React and TypeScript required. Minimum 5 years of experience.','SKIP'],
 ['Must haves: React and TypeScript required. Minimum 5 years of React experience.','SKIP'],
 ['Must haves: React and TypeScript required. Minimum 3 years of experience.','STRETCH'],
 ['Our company has 20 years of experience. Must haves: React and TypeScript required.','PURSUE'],
 ['Must haves: React and TypeScript required. 40-50 hours per week.','SKIP'],
 ["Must haves: React and TypeScript required. Master's degree required.",'CLARIFY'],
 ["Must haves: React and TypeScript required. Bachelor's degree preferred.",'PURSUE'],
])assert.equal(run(text).recommendation,expected,text);
a=run('Requirements: React or Vue required. TypeScript required.');assert.notEqual(a.recommendation,'SKIP');assert.equal(a.requirements.find(r=>r.name.includes('Vue')).evidence,'SUPPORTED');
assert.equal(run('Must haves: React and TypeScript required.',{title:'Senior Frontend Developer'}).recommendation,'STRETCH');
assert.equal(run('Must haves: React and TypeScript required.',{source:'WEB_SEARCH'}).recommendation,'CLARIFY');
assert.equal(reviewCareer({...listing,description:'React required'},profile,false).recommendation,'CLARIFY');
assert.equal(reviewCareer({...listing,description:'40-50 hours per week'},profile,true).recommendation,'QUARANTINE');
a=run('JavaScript is required. Reactive design matters.');assert.ok(!a.requirements.some(r=>['React','Java'].includes(r.name)));
a=run('No prior experience with React required. TypeScript required.');assert.ok(!a.requirements.some(r=>r.name==='React'));
a=run('Must haves: React and TypeScript required.',{}, {...profile,projectEvidence:[{...profile.projectEvidence[0],url:'javascript:alert(1)'}]});assert.ok(!a.requirements.some(r=>r.evidence==='SUPPORTED'));
assert.equal(isCareerReview({...a,recommendation:'AUTO_APPLY'}),false);assert.equal(isCareerReview({...a,requirements:Array(21).fill(a.requirements[0])}),false);assert.equal(isCareerReview({...a,requirements:[{...a.requirements[0],quote:'x'.repeat(281)}]}),false);
for(const contribution of ['I did not implement React or TypeScript.', 'The team implemented React and TypeScript; I only observed.', 'I will build React and TypeScript features.', 'I am learning React and TypeScript.']) {
 const result=run('Must haves: React and TypeScript required.',{}, {...profile,projectEvidence:[{...profile.projectEvidence[0],contribution}]});assert.ok(!result.requirements.some(r=>r.evidence==='SUPPORTED'),contribution);
}
assert.equal(run('React and TypeScript required, Docker preferred.').recommendation,'CLARIFY');
const before=JSON.stringify(profile);run('React required.');assert.equal(JSON.stringify(profile),before);
console.log('PASS: contributions versus tags, mandatory/preferred/alternative wording, experience/capacity boundaries, qualification unknowns, snippet caution, quarantine precedence, bounded contracts and immutable profiles.');
