import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { cleanupReviewedLeads } from '../server/opportunities/reviewed-quality-cleanup';
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) throw Error('Only --apply is supported. Omit it for a read-only preview.');
cleanupReviewedLeads(prisma,args[0] === '--apply')
  .then(report => console.log(JSON.stringify(report,null,2)))
  .catch(error => {console.error(error instanceof Error ? error.message : 'Cleanup failed');process.exitCode=1;})
  .finally(async () => prisma.$disconnect());
