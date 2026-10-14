import 'server-only';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
import { commercialRunOverview, commercialDefaults } from './client-collector';
import { commercialQueries } from './client-discovery-policy';
/** Compatibility read operation: discovery configuration and history, without provider charges or writes. */
export async function clientDiscoveryReview(operation:string,_input:Record<string,unknown>,ownerId:string){
 if(operation!=='client:discovery-review')return apiError('INVALID_OPERATION','Unsupported discovery operation',400);
 const profile=await prisma.companyOpportunityProfile.findUnique({where:{key:'rcentz-systems'},select:{id:true,managerId:true}});
 if(!profile||profile.managerId!==ownerId)return apiError('FORBIDDEN','Company owner required',403);
 const [settings,capabilities,discovery]=await Promise.all([
 prisma.clientAcquisitionSettings.findUnique({where:{companyProfileId:profile.id}}),
 prisma.companyCapability.findMany({where:{profileId:profile.id,status:{notIn:['ARCHIVED','PAUSED']}},take:100,select:{id:true,name:true,purpose:true,businessProblems:true,possibleWork:true,status:true,buyerPhrases:true}}),
 commercialRunOverview(profile.id,ownerId)]);
 return apiSuccess({source:'Worldwide public web',sourceUrl:'https://search.brave.com',readOnly:true,automaticCollectionEnabled:settings?.discoveryEnabled??false,checked:0,candidates:[],requiresHumanReview:true,discovery,queries:commercialQueries(settings??commercialDefaults,capabilities),note:'Use Collect opportunities in Client Acquisition to search and save leads. This read operation does not start collection.'});
}
