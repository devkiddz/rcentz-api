import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
function load(file,stubs){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(name=>{assert.ok(name in stubs,'Unmocked '+name);return stubs[name];},m,m.exports);return m.exports;}
const plans=Array.from({length:8},(_,i)=>({key:'area'+i,label:'Area '+i,query:'query '+i,kind:i===7?'RESEARCH':'REQUEST'}));
let calls=[],mode='full';
const depth=load('server/opportunities/commercial-search-depth.ts',{'./search':{searchWeb:async(q,count,freshness,offset)=>{
 calls.push({q,count,freshness,offset});
 if(mode==='error' || mode==='partial'&&offset===1)throw Error('Provider unavailable');
 if(mode==='malformed')return {web:{results:null}};
 return {query:{more_results_available:mode!=='short'},web:{results:Array.from({length:count},(_,i)=>({url:'https://example.org/'+q+'/'+offset+'/'+i}))}};
}}});
const run=()=>depth.collectSearchPages(plans,Date.now()+120000);
const full=await run();assert.equal(calls.length,24);assert.deepEqual(calls.map(c=>c.offset),[...Array(8).fill(0),...Array(8).fill(1),...Array(8).fill(2)]);assert.ok(calls.every(c=>c.count===10));assert.equal(full.reduce((n,b)=>n+b.items.length,0),240);assert.ok(full.every(b=>b.stats.pagesFetched===3&&b.stats.requests===3&&b.stats.status==='SUCCESS'));assert.equal(calls[7].freshness,'py');assert.equal(calls[0].freshness,'pm');
mode='short';calls=[];assert.ok((await run()).every(b=>b.items.length===10));assert.equal(calls.length,8);
mode='partial';calls=[];const partial=await run();assert.equal(calls.length,16);assert.ok(partial.every(b=>b.stats.status==='PARTIAL'&&b.items.length===10&&b.stats.pagesFetched===1));
for(mode of ['error','malformed']){calls=[];const failed=await run();assert.equal(calls.length,8);assert.ok(failed.every(b=>b.stats.status==='FAILED'&&!b.items.length));}
calls=[];const expired=await depth.collectSearchPages(plans,Date.now()-1);assert.equal(calls.length,0);assert.ok(expired.every(b=>b.stats.status==='FAILED'));
// Shared provider keeps personal calls on page zero; commercial page offsets are actual page indexes.
let urls=[];process.env.OPPORTUNITY_SEARCH_API_KEY='mock';
const provider=load('server/opportunities/search.ts',{'./web':{sourceJson:async url=>{urls.push(new URL(url));return {};}}});
const oldNow=Date.now;let clock=1000000;Date.now=()=>clock+=2000;
try{await provider.searchWeb('personal');await provider.searchWeb('commercial',10,'pm',2);}finally{Date.now=oldNow;}
assert.equal(urls[0].searchParams.get('count'),'8');assert.equal(urls[0].searchParams.has('offset'),false);assert.equal(urls[1].searchParams.get('offset'),'2');assert.equal(urls[1].searchParams.get('country'),'ALL');
console.log('PASS: 24-call/240-result ceiling, breadth-first page order, provider continuation, early exhaustion, partial-page retention, malformed/failed pages, time budget and unchanged personal-search defaults. No network or database access.');
