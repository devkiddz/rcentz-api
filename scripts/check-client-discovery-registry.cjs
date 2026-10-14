const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const ts=require('typescript');const Module=require('node:module');
function load(name){const file=path.resolve(__dirname,'../server/opportunities/'+name);const transformed=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(transformed.outputText,file);return m.exports;}
// Resolve dependency safely from the verified local source without a build step.
const intake=load('client-discovery-intake.ts');const old=Module._load;Module._load=function(request,parent,isMain){if(request==='./client-discovery-intake')return intake;return old.apply(this,arguments)};let registry;try{registry=load('client-discovery-registry.ts')}finally{Module._load=old}
const {validateRegistrySource,isEligibleForScheduledCollection,DEFAULT_DISCOVERY_SOURCES}=registry;
const base={id:'procurement-portal',name:'Official procurement',homepage:'https://procurement.example.org/',kind:'PUBLIC_RFP',lane:'DIRECT_DEMAND',method:'PUBLIC_FEED',approval:'DRAFT',enabled:false,permittedEndpoint:'https://procurement.example.org/feed',cadenceMinutes:1440,maxItemsPerRun:25};
let n=0;function check(label,fn){fn();console.log('PASS:',label);n++}
check('Registry ships empty',()=>assert.equal(DEFAULT_DISCOVERY_SOURCES.length,0));
check('Draft source validates but cannot collect',()=>{assert.equal(validateRegistrySource(base).ok,true);assert.equal(isEligibleForScheduledCollection(base),false)});
check('Approved disabled cannot collect',()=>assert.equal(isEligibleForScheduledCollection({...base,approval:'APPROVED'}),false));
check('Approved enabled source eligible in policy only',()=>assert.equal(isEligibleForScheduledCollection({...base,approval:'APPROVED',enabled:true}),true));
check('Suspended enabled rejected',()=>assert.equal(validateRegistrySource({...base,approval:'SUSPENDED',enabled:true}).ok,false));
check('Manual review not schedulable',()=>{const s={...base,method:'MANUAL_REVIEW',permittedEndpoint:null,approval:'APPROVED',enabled:true};assert.equal(validateRegistrySource(s).ok,true);assert.equal(isEligibleForScheduledCollection(s),false)});
check('Endpoint mandatory for feed',()=>assert.equal(validateRegistrySource({...base,permittedEndpoint:null}).ok,false));
check('Cross-host endpoint rejected',()=>assert.equal(validateRegistrySource({...base,permittedEndpoint:'https://other.example.org/feed'}).ok,false));
check('Private endpoint rejected',()=>assert.equal(validateRegistrySource({...base,permittedEndpoint:'https://127.0.0.1/feed'}).ok,false));
check('HTTP homepage rejected',()=>assert.equal(validateRegistrySource({...base,homepage:'http://procurement.example.org'}).ok,false));
check('Excessive run size rejected',()=>assert.equal(validateRegistrySource({...base,maxItemsPerRun:101}).ok,false));
check('Too frequent cadence rejected',()=>assert.equal(validateRegistrySource({...base,cadenceMinutes:5}).ok,false));
check('Career lane unavailable',()=>assert.equal(validateRegistrySource({...base,lane:'CAREER'}).ok,false));
check('Directory not equivalent to partnership notice',()=>assert.equal(validateRegistrySource({...base,lane:'PARTNERSHIP',kind:'BUSINESS_DIRECTORY'}).ok,false));
check('No input mutation',()=>{const before=JSON.stringify(base);validateRegistrySource(base);assert.equal(JSON.stringify(base),before)});
console.log(`PASS: ${n} source registry policy checks. No network, API or database calls.`);
