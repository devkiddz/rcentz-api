import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('server/opportunities/reviewed-quality-cleanup.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};let nowAccepted=false;
new Function('require','module','exports',code)(name=>{assert.equal(name,'./client-discovery-policy');return {assessWebLead:()=>nowAccepted?{kind:'REQUEST_SIGNAL'}:null};},mod,mod.exports);
const {cleanupReviewedLeads,reviewedTargets}=mod.exports;
function setup(){
 const rows=reviewedTargets.map(([id,title])=>({id,ownerId:'owner',companyProfileId:'company',source:'PUBLIC_WEB',state:'NEW',notes:'',updatedAt:new Date('2026-10-16'),summary:'Published seller content for review',qualification:{title,sourceUrl:'https://source.example/'+id},matches:[{id:'proof'}]}));
 rows.push({id:'preserve',ownerId:'owner',companyProfileId:'company',source:'PUBLIC_WEB',state:'NEW',notes:'Important buyer evidence',qualification:{title:'A buyer request'}});
 const state={rows,logs:[],active:true,conflict:false};
 const tx={companyOpportunityProfile:{findUnique:async()=>({id:'company',managerId:'owner'})},user:{findUnique:async()=>({status:state.active?'ACTIVE':'INACTIVE',role:'ADMIN'})},clientProspect:{findFirst:async({where})=>state.rows.find(r=>Object.entries(where).every(([k,v])=>r[k]===v))??null,updateMany:async({where,data})=>{if(state.conflict&&where.id===reviewedTargets[3][0])return {count:0};const r=state.rows.find(r=>r.id===where.id&&r.updatedAt===where.updatedAt);if(!r)return {count:0};Object.assign(r,data,{updatedAt:new Date()});return {count:1};}},auditLog:{count:async({where})=>state.logs.filter(l=>l.entityId===where.entityId).length,create:async({data})=>{state.logs.push(data);return data;}}};
 const db={$transaction:async fn=>{const previous=structuredClone({rows:state.rows,logs:state.logs});try{return await fn(tx);}catch(e){state.rows=previous.rows;state.logs=previous.logs;throw e;}}};
 return {state,db};
}
let {state,db}=setup();const before=structuredClone(state.rows);
const preview=await cleanupReviewedLeads(db);assert.equal(preview.mode,'READ_ONLY_PREVIEW');assert.equal(preview.count,10);assert.deepEqual(state.rows,before);assert.equal(state.logs.length,0);
const applied=await cleanupReviewedLeads(db,true);assert.equal(applied.count,10);assert.equal(state.logs.length,10);
for(let i=0;i<10;i++){assert.equal(state.rows[i].state,'ARCHIVED');assert.equal(state.rows[i].notes,before[i].notes);assert.deepEqual(state.rows[i].matches,before[i].matches);assert.equal(state.rows[i].summary,before[i].summary);}
assert.deepEqual(state.rows.at(-1),before.at(-1));
const repeated=await cleanupReviewedLeads(db,true);assert.equal(repeated.count,0);assert.equal(repeated.alreadyArchived.length,10);assert.equal(state.logs.length,10);
for(const mutation of [s=>s.rows[0].notes='Reviewed',s=>s.rows[0].state='REVIEW',s=>s.rows[0].ownerId='another',s=>s.rows[0].qualification.title='Changed title',s=>s.rows[0].qualification.review={},s=>s.logs.push({entityId:s.rows[0].id}),s=>s.active=false]){
 ({state,db}=setup());mutation(state);const snapshot=structuredClone({rows:state.rows,logs:state.logs});await assert.rejects(()=>cleanupReviewedLeads(db,true));assert.deepEqual({rows:state.rows,logs:state.logs},snapshot);
}
({state,db}=setup());state.conflict=true;const snapshot=structuredClone(state.rows);await assert.rejects(()=>cleanupReviewedLeads(db,true),/Concurrent/);assert.deepEqual(state.rows,snapshot);assert.equal(state.logs.length,0);
({state,db}=setup());nowAccepted=true;await assert.rejects(()=>cleanupReviewedLeads(db,true),/now passes admission/);assert.equal(state.logs.length,0);nowAccepted=false;
console.log('PASS: preview is read-only; exactly ten reviewed identities archive atomically with history; all other records/evidence/notes/matches preserved; reruns add no history.');
console.log('PASS: changed titles, notes, stages, ownership, prior reviews, inactive manager, renewed admission and concurrent edits stop cleanup; transaction rolls back every archive on conflict.');
