const path=require('node:path');
const {createRequire}=require('node:module');
const {Client}=createRequire(path.join(process.cwd(),'package.json'))('pg');
const id=process.argv[2];
if(!/^rm_[0-9a-f]{32}$/.test(id||'')){console.error('Usage: node --env-file=.env.local scripts/rm01-revoke-source.cjs <sourceId>');process.exit(2)}
(async()=>{const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:30000});await client.connect();try{const r=await client.query('UPDATE "RuntimeMonitorSource" SET "enabled"=false,"revokedAt"=now() WHERE "id"=$1 RETURNING "id"',[id]);console.log(r.rowCount?'Source revoked':'Source not found')}finally{await client.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});
