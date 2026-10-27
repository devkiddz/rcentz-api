/* Register a source for any existing Rcentz project; DB connection required.
 * Prints source credential only once. Does not store plaintext secrets in API database.
 */
const crypto = require('node:crypto');
const path = require('node:path');
const {createRequire} = require('node:module');
const requireFromProject = createRequire(path.join(process.cwd(), 'package.json'));
const {Client} = requireFromProject('pg');
const [,,projectId,label] = process.argv;
if(!/^[a-zA-Z0-9_-]{1,128}$/.test(projectId||'') || !label || label.length>120){
 console.error('Usage: node --env-file=.env.local scripts/rm01-register-source.cjs <projectId> <source-label>');process.exit(2);
}
(async()=>{
 const connectionString=process.env.DATABASE_URL;
 if(!connectionString) throw Error('DATABASE_URL missing');
 const client=new Client({connectionString,connectionTimeoutMillis:30000});
 await client.connect();
 try{
  const p=await client.query('SELECT "id" FROM "Project" WHERE "id"=$1',[projectId]);
  if(p.rowCount!==1) throw Error('No registered Rcentz project for that projectId');
  const id='rm_'+crypto.randomBytes(16).toString('hex');
  const token=crypto.randomBytes(48).toString('hex');
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  await client.query('INSERT INTO "RuntimeMonitorSource" ("id","projectId","label","tokenHash") VALUES($1,$2,$3,$4)',[id,projectId,label,hash]);
  console.log('SOURCE_ID='+id);
  console.log('SOURCE_TOKEN='+token);
  console.log('Save token securely in monitored application only. This credential is shown once.');
 }finally{await client.end()}
})().catch(e=>{console.error('Registration failed:',e.message);process.exitCode=1});

