const fs = require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const ts=require('typescript');const Module=require('node:module');
const file=path.resolve(__dirname,'../server/opportunities/client-discovery-intake.ts');const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(out.outputText,file);const {assessCommercialCandidate,canonicalPublicUrl}=m.exports;
const base={sourceKind:'PUBLIC_RFP',sourceName:'Public notice',sourceUrl:'https://example.org/tenders/123?utm_source=search',title:'Request for proposal for a customer portal',description:'Seeking a vendor to develop a service platform',capturedAt:'2026-10-12T12:00:00Z'};
let n=0;function check(label,fn){fn();console.log('PASS:',label);n++}
check('Valid public procurement signal enters review',()=>assert.equal(assessCommercialCandidate(base).decision,'REVIEW'));
check('Tracking parameters stripped',()=>assert.equal(assessCommercialCandidate(base).normalizedUrl,'https://example.org/tenders/123'));
check('Canonical key stable on repeats',()=>assert.equal(assessCommercialCandidate(base).canonicalKey,assessCommercialCandidate(base).canonicalKey));
check('Career-only vacancy rejected',()=>assert.equal(assessCommercialCandidate({...base,title:'We are hiring a software developer',description:'Apply for this job',sourceKind:'OTHER_PUBLIC'}).decision,'REJECT'));
check('Mixed contract advert sent for review',()=>assert.equal(assessCommercialCandidate({...base,title:'Contract to develop a portal',description:'Applications welcome'}).decision,'REVIEW'));
check('Directory listing is not treated as buyer intent',()=>assert.ok(assessCommercialCandidate({...base,sourceKind:'BUSINESS_DIRECTORY',title:'Software services directory',description:'Company profile'}).warnings.some(x=>x.includes('not evidence'))));
check('Plain company website is review only',()=>assert.equal(assessCommercialCandidate({...base,sourceKind:'COMPANY_WEBSITE',title:'Company home',description:'Corporate overview'}).decision,'REVIEW'));
check('Reject localhost',()=>assert.equal(canonicalPublicUrl('https://localhost/foo'),null));
check('Reject embedded credentials',()=>assert.equal(canonicalPublicUrl('https://a:b@example.org/foo'),null));
check('Reject insecure HTTP',()=>assert.equal(canonicalPublicUrl('http://example.org'),null));
check('Reject private IP',()=>assert.equal(canonicalPublicUrl('https://192.168.1.1/test'),null));
check('Missing source rejected',()=>assert.equal(assessCommercialCandidate({...base,sourceName:''}).decision,'REJECT'));
check('Future capture timestamp rejected',()=>assert.equal(assessCommercialCandidate({...base,capturedAt:'2099-01-01T00:00:00Z'}).decision,'REJECT'));
check('No mutation',()=>{const before=JSON.stringify(base);assessCommercialCandidate(base);assert.equal(JSON.stringify(base),before)});
console.log(`PASS: ${n} P6 intake policy checks. No API, database or network access.`);
