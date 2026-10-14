import { canonicalPublicUrl } from './client-discovery-intake';
import { plain } from '@/features/opportunities/lib/source-text';
export const prospectStates = ['NEW','REVIEW','QUALIFIED','PURSUING','WON','LOST','ARCHIVED'] as const;
export const stateLabels: Record<string,string> = {NEW:'New',REVIEW:'Reviewing',QUALIFIED:'Qualified',PURSUING:'In discussion',WON:'Won',LOST:'Lost',ARCHIVED:'Archived'};
export type SearchPlan = {key:string;label:string;query:string;kind:'REQUEST'|'RESEARCH'};
export type Preferences = {regions:string[];industries:string[];engagementTypes:string[];preferredSources:string[];businessProblems:string[];minimumScore:number;requireBudget:boolean;includeUnpriced:boolean};
export type CapabilityInput = {id:string;name:string;purpose:string;businessProblems:string[];possibleWork:string[];status:string;buyerPhrases:unknown};
const phrase=(v:string)=>plain(v).replace(/["\r\n]/g,' ').slice(0,90).trim();
export function commercialQueries(settings: Preferences, capabilities:CapabilityInput[], now=new Date()):SearchPlan[]{
 const plans:SearchPlan[]=[
  {key:'ng-web',label:'Nigeria · websites and landing pages',kind:'REQUEST',query:'Nigeria ("need a website" OR "looking for a web developer" OR "landing page") -jobs -careers'},
  {key:'global-web',label:'Worldwide · website requests',kind:'REQUEST',query:'("need a website" OR "looking for a web designer" OR "need a landing page") -jobs -careers'},
  {key:'commerce',label:'Worldwide · online stores',kind:'REQUEST',query:'("need an online store" OR "looking for Shopify developer" OR "ecommerce website") ("looking for" OR "need" OR "request") -jobs'},
  {key:'business-systems',label:'Worldwide · business applications',kind:'REQUEST',query:'("need a customer portal" OR "workflow automation" OR "custom software") ("looking for" OR "request for proposal" OR "development partner") -jobs'},
  {key:'communities',label:'Public discussions and blogs',kind:'REQUEST',query:'("need a website" OR "need an ecommerce" OR "looking for a developer") (site:reddit.com OR site:indiehackers.com OR site:medium.com) -jobs'},
  {key:'ng-research',label:'Nigeria · business research leads',kind:'RESEARCH',query:'Nigeria ("new business" OR "new store" OR "launching") ("orders via WhatsApp" OR "online booking" OR "our website")'},
 ];
 const extras:SearchPlan[]=[
  {key:'global-research',label:'Worldwide · business research leads',kind:'RESEARCH',query:'("opening a new business" OR "launching our store") ("online orders" OR "booking" OR "website")'},
  {key:'rfp',label:'Worldwide · published project requests',kind:'REQUEST',query:'("website development" OR "ecommerce" OR "software development") ("request for proposal" OR "seeking an agency")'},
 ];
 for(const region of settings.regions.slice(0,8))extras.push({key:'region-'+extras.length,label:'Target region · '+phrase(region),kind:'REQUEST',query:phrase(region)+' ("need a website" OR "ecommerce" OR "custom software") ("looking for" OR "request") -jobs'});
 for(const cap of capabilities.filter(c=>!['ARCHIVED','PAUSED'].includes(c.status)).slice(0,12)){
  const phrases=typeof cap.buyerPhrases==='object'&&cap.buyerPhrases!==null?Object.values(cap.buyerPhrases).flat().filter((x):x is string=>typeof x==='string'):[];
  for(const term of [...phrases,...cap.possibleWork,cap.name].slice(0,3)) extras.push({key:'capability-'+extras.length,label:'Company capability · '+phrase(term),kind:'REQUEST',query:'"'+phrase(term)+'" ("looking for" OR "need" OR "request for proposal") -jobs'});
 }
 for(const term of [...settings.businessProblems,...settings.industries,...settings.engagementTypes,...settings.preferredSources].slice(0,16))extras.push({key:'preference-'+extras.length,label:'Company preference · '+phrase(term),kind:'REQUEST',query:phrase(term)+' ("website" OR "software" OR "online store") ("looking for" OR "need") -jobs'});
 // Keep Nigeria/global/small-business coverage on every run; rotate the remaining knowledge searches daily.
 const offset=Math.floor(now.getTime()/86400000)%extras.length;
 return [...plans,extras[offset],extras[(offset+1)%extras.length]].map(p=>({...p,query:p.query.slice(0,500)}));
}
const tech=/\b(website|web design|web developer|landing page|ecommerce|e-commerce|online store|shopify|software|customer portal|crm|booking|automation|database|web app|application development)\b/i;
const demand=/\b(need(?:s)? (?:a |an |help (?:with )?)?(?:new |business )?(?:website|landing page|online store|ecommerce|developer|software|web designer)|looking for (?:a |an )?(?:web|shopify|software|developer|agency)|seeking (?:a |an )?(?:agency|vendor|developer|development partner)|request for proposal|request for quotation|commission a|outsourcing)\b/i;
const hiring=/\b(we are hiring|job vacancy|apply for (?:this |the )?(?:job|role|position)|salary and benefits|send your cv|full.time employee|careers? at)\b/i;
const commercial=/\b(request for proposal|agency|vendor|outsourcing|fixed.price|project budget)\b/i;
const howTo=/\b(how to|step.by.step|tutorial|beginner.s guide|learn to|course|top \d+|best \d+)\b/i;
const selling=/\b(we (?:build|design|offer|provide)|our (?:web design|development services)|hire us|website design services|web development agency)\b/i;
const words=(v:string)=>new Set(v.toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(x=>x.length>3&&!['with','from','your','this','that','business','company','need','website','development'].includes(x)));
export function assessWebLead(input:{title:string;description:string;url:string;research:boolean},capabilities:CapabilityInput[],preferences:Preferences){
 const url=canonicalPublicUrl(input.url);const title=plain(input.title).slice(0,240),description=plain(input.description).slice(0,4000),text=title+' '+description;
 if(!url||!tech.test(text)||description.length<12||howTo.test(title)||(hiring.test(text)&&!commercial.test(text))||(selling.test(title)&&!demand.test(text)))return null;
 const request=demand.test(text);if(!request&&!input.research)return null;
 const kind=request?'REQUEST_SIGNAL':'RESEARCH_LEAD';
 const queryWords=words(text);
 const matches=capabilities.filter(c=>!['ARCHIVED','PAUSED'].includes(c.status)).flatMap(c=>{
  const terms=words([c.name,c.purpose,...c.businessProblems,...c.possibleWork].join(' '));const hits=[...terms].filter(w=>queryWords.has(w));
  return hits.length>=2?[{capabilityId:c.id,score:Math.min(85,20+hits.length*8),rationale:'Shared subject terms: '+hits.slice(0,8).join(', ')+'. Delivery evidence and capacity still require review.'}]:[];
 }).sort((a,b)=>b.score-a.score).slice(0,12);
 const score=Math.min(90,(request?40:15)+(matches[0]?.score?Math.round(matches[0].score/3):0));
 const budget=text.match(/(?:USD|GBP|NGN|EUR|\$|£|₦|€)\s*[\d,.]+(?:\s*[-–]\s*[\d,.]+)?/i)?.[0]?.replace(/[.,]+$/, '')??null;
 if(score<preferences.minimumScore||((preferences.requireBudget||!preferences.includeUnpriced)&&!budget))return null;
 const warnings=[request?'Search excerpt suggests a request; confirm the original page and current availability.':'Research lead only: a business listing or launch does not establish buying intent.','Location, Nigeria eligibility, budget, deadline and capacity remain unconfirmed unless supported by the original source.','Search excerpts may be outdated or incomplete. No contact or delivery commitment is authorized.'];
 return {url,title,description,kind,score,budget,matches,warnings};
}
