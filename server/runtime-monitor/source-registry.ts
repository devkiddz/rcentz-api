import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export function monitorTokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
export async function authenticateMonitorSource(sourceId: string, token: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(sourceId) || token.length < 48 || token.length > 256) return null;
  const source = await prisma.runtimeMonitorSource.findUnique({where:{id:sourceId},select:{id:true,projectId:true,enabled:true,tokenHash:true}});
  if (!source?.enabled) return null;
  const a=Buffer.from(monitorTokenHash(token),'hex');
  const b=Buffer.from(source.tokenHash,'hex');
  if (a.length !== b.length || !timingSafeEqual(a,b)) return null;
  return {id:source.id,projectId:source.projectId};
}
