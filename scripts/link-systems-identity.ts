import { prisma } from '../lib/prisma';
const subject = process.env.SYSTEMS_SUBJECT_ID;
const userId = process.env.OPPORTUNITY_OWNER_ID;
const apply = process.argv.includes('--apply');
async function main() {
 if (!subject || !userId || !/^[a-zA-Z0-9:_-]{1,160}$/.test(subject)) throw new Error('Set SYSTEMS_SUBJECT_ID and API OPPORTUNITY_OWNER_ID privately.');
 const user = await prisma.user.findUnique({where:{id:userId},select:{id:true,role:true,status:true}});
 if (!user || user.status !== 'ACTIVE' || !['ADMIN','SUPER_ADMIN'].includes(user.role)) throw new Error('Existing central owner must be an active administrator.');
 const existing = await prisma.applicationIdentity.findUnique({where:{applicationId_subject:{applicationId:'systems',subject}}});
 if (existing && existing.userId !== userId) throw new Error('Subject already belongs to another central identity. No reassignment performed.');
 const scopes = ['opportunities:read','opportunities:write','opportunities:collect'];
 console.log(JSON.stringify({mode:apply?'apply':'preview',applicationId:'systems',subject,userId,scopes,enabled:true},null,2));
 if (apply) await prisma.applicationIdentity.upsert({where:{applicationId_subject:{applicationId:'systems',subject}},create:{applicationId:'systems',subject,userId,scopes,enabled:true},update:{scopes,enabled:true}});
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
