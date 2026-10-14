/* Standalone tests: transpile local TS without adding a runner/dependency. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../server/opportunities/commercial-matching.ts');
const transpiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const mod = new Module(file, module);
mod.filename = file;
mod.paths = Module._nodeModulePaths(path.dirname(file));
mod._compile(transpiled.outputText, file);
const { matchCommercialProblems } = mod.exports;
const solution = { id:'sol-1',key:'internal-operations',name:'Internal Operations Workspace',problem:'Manual tracking',proposedWorkflow:'Requests and approval stages', status:'DRAFT',groupId:'group-1',capabilityId:'cap-1' };
const problem = (id, symptoms, solutionId='sol-1') => ({ id,key:id,title:id === 'problem-1'?'Fragmented operations':'Slow approvals',description:'Disconnected requests and spreadsheet approvals',symptoms,impact:['Delayed approvals'],status:'DRAFT', solutions:[{id:`link-${id}`,rationale:'Use structured approval tracking',priority:1,qualificationCriteria:['How are approvals currently handled?'],solution:{...solution,id:solutionId}}] });
const input = { problems:[problem('problem-1',['Repeated data entry','Disconnected spreadsheets']),problem('problem-2',['Delayed approval requests'])],groups:[{id:'group-1',name:'Operations'}] };
let n=0;
function check(name, fn){fn(); console.log('PASS:', name);n++;}
check('Relevant repeated data entry yields problem',()=> assert.equal(matchCommercialProblems({...input,text:'Repeated data entry across many teams'})[0].id,'problem-1'));
check('Unrelated query yields no false matches',()=> assert.equal(matchCommercialProblems({...input,text:'Need catering equipment installed'}) .length,0));
check('Empty text yields no matches',()=> assert.equal(matchCommercialProblems({...input,text:''}).length,0));
check('Draft blueprint requires review',()=> assert.equal(matchCommercialProblems({...input,text:'Repeated data entry'})[0].solutions[0].requiresReview,true));
check('Canonical solution ID reused',()=> assert.equal(matchCommercialProblems({...input,text:'Repeated data entry'})[0].solutions[0].id,'sol-1'));
check('Qualification remains attached',()=>assert.equal(matchCommercialProblems({...input,text:'Repeated data entry'})[0].solutions[0].qualificationCriteria.length,1));
check('Archived problem omitted',()=>assert.equal(matchCommercialProblems({...input,problems:[{...input.problems[0],status:'ARCHIVED'}],text:'Repeated data entry'}).length,0));
check('Archived blueprint omitted, problem retained',()=>{const result=matchCommercialProblems({...input,problems:[{...input.problems[0],solutions:[{...input.problems[0].solutions[0],solution:{...solution,status:'ARCHIVED'}}]}],text:'Repeated data entry'});assert.equal(result[0].solutions.length,0)});
check('Output bounded by limit',()=>assert.equal(matchCommercialProblems({...input,text:'Delayed approvals disconnected requests spreadsheet approvals',limit:1}).length,1));
check('Repeated matching does not mutate inputs',()=>{const before=JSON.stringify(input);matchCommercialProblems({...input,text:'Repeated data entry'});assert.equal(JSON.stringify(input),before)});
console.log(`PASS: ${n} pure matching checks. No network or database access.`);
