import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as crypto from 'node:crypto';
function load(file, stubs = {}) {
 const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
 const evaluated = {exports: {}};
 new Function('require', 'module', 'exports', output)(name => {if (!(name in stubs)) throw Error('Unmocked ' + name); return stubs[name];}, evaluated, evaluated.exports); return evaluated.exports;
}
const signing = load('server/api/auth/application-signature.ts', {'node:crypto': crypto});
const secret = 'test-only-secret-with-at-least-32-characters';
process.env.RCENTZ_SYSTEMS_API_SECRET = secret; process.env.OPPORTUNITY_OWNER_ID = 'central-owner';
const path = '/api/v1/internal/systems/opportunities';
const body = JSON.stringify({operation: 'list'});
const claims = {applicationId: 'systems', subject: 'local-owner', issuedAt: String(Date.now()), nonce: crypto.randomUUID()};
const signature = signing.signApplicationRequest(secret, claims, path, body);
assert.equal(signing.validApplicationSignature(secret, claims, path, body, signature), true);
for (const [key, value] of Object.entries({applicationId: 'another-app', subject: 'another-user', issuedAt: '1000000000000', nonce: crypto.randomUUID()})) assert.equal(signing.validApplicationSignature(secret, {...claims, [key]: value}, path, body, signature), false);
assert.equal(signing.validApplicationSignature(secret, claims, path, body + ' ', signature), false);
assert.equal(signing.validApplicationSignature(secret, claims, '/another-path', body, signature), false);
assert.equal(signing.validApplicationSignature(undefined, claims, path, body, signature), false);
let identity = {enabled: true, scopes: ['opportunities:read'], user: {id: 'central-owner', status: 'ACTIVE', role: 'ADMIN'}};
let lookup = 0; const nonces = new Set(); let writes = 0;
const prisma = {applicationIdentity: {findUnique: async q => {lookup++; assert.equal(q.where.applicationId_subject.subject, 'local-owner'); return identity;}}, applicationRequestNonce: {create: async ({data}) => {if (nonces.has(data.nonce)) throw {code:'P2002'}; nonces.add(data.nonce);}}};
const responses = {apiError: (code, message, status) => Response.json({code, message}, {status}), apiSuccess: data => Response.json({success: true, data})};
const authority = load('server/api/auth/require-application-identity.ts', {'server-only': {}, '@/lib/prisma': {prisma}, '@/server/api/responses/api-response': responses, './application-signature': signing});
function request(payload = {operation: 'list'}, changes = {}) {
 const text = JSON.stringify(payload); const c = {...claims, nonce: crypto.randomUUID()};
 return new Request('https://api.example' + path, {method:'POST', body:text, headers:{'x-rcentz-app':c.applicationId, 'x-rcentz-subject':c.subject, 'x-rcentz-issued-at':c.issuedAt, 'x-rcentz-nonce':c.nonce, 'x-rcentz-signature':signing.signApplicationRequest(secret,c,path,text), ...changes}});
}
let r = request(); assert.equal((await authority.requireApplicationIdentity(r,body,'opportunities:read')).ok,true);
assert.equal((await authority.requireApplicationIdentity(r,body,'opportunities:read')).response.status,409);
for (const change of [{enabled:false}, {scopes:[]}, {user:{id:'other',status:'ACTIVE',role:'ADMIN'}}, {user:{id:'central-owner',status:'INACTIVE',role:'ADMIN'}}, {user:{id:'central-owner',status:'ACTIVE',role:'CUSTOMER'}}]) {
 const before = identity; identity = {...identity, ...change};
 assert.equal((await authority.requireApplicationIdentity(request(),body,'opportunities:read')).response.status,403); identity = before;
}
const beforeLookup=lookup; assert.equal((await authority.requireApplicationIdentity(request({}, {'x-rcentz-signature':'0'.repeat(64)}),'{}','opportunities:read')).response.status,401); assert.equal(lookup,beforeLookup);
prisma.opportunity = {updateMany: async q => {writes++; assert.equal(q.where.profile.ownerId,'central-owner'); return {count:0};}};
const matching = load('features/opportunities/lib/matching.ts');
const route = load('app/api/v1/internal/systems/opportunities/route.ts', {'@/lib/prisma': {prisma}, '@/server/api/responses/api-response':responses, '@/server/api/auth/require-application-identity':authority, '@/server/opportunities/collector':{runCollection:()=>{throw Error('Unexpected collection');}}, '@/features/opportunities/lib/matching': matching});
identity.scopes=['opportunities:write'];
assert.equal((await route.POST(request({operation:'decision',id:'another-users-job',status:'APPLIED',notes:''}))).status,404); assert.equal(writes,1);
assert.equal((await route.POST(request({operation:'decision',id:'job',status:'INVENTED',notes:''}))).status,400); assert.equal(writes,1);
identity.enabled=false; assert.equal((await route.POST(request({operation:'decision',id:'job',status:'APPLIED',notes:''}))).status,403); assert.equal(writes,1);
assert.equal((await route.POST(request({operation:'__proto__'}))).status,400);
assert.equal((await route.POST(new Request('https://api.example',{method:'POST',body:'x'.repeat(17000)}))).status,400);
console.log('PASS: tamper protection, freshness, replay rejection, per-app identity, active admin authority, owner/scope isolation, bounded bodies and ownership-scoped mutations.');
