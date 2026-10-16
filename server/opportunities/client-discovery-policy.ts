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
  {key:'ng-web',label:'Nigeria · websites and landing pages',kind:'REQUEST',query:'Nigeria ("need a website" OR "looking for a web developer" OR "landing page") -site:designrush.com -site:clutch.co -site:goodfirms.co -jobs -careers'},
  {key:'global-web',label:'Worldwide · website requests',kind:'REQUEST',query:'("need a website" OR "looking for a web designer" OR "need a landing page") -site:designrush.com -site:clutch.co -site:goodfirms.co -jobs -careers'},
  {key:'commerce',label:'Worldwide · online stores',kind:'REQUEST',query:'("need an online store" OR "looking for Shopify developer" OR "ecommerce website") ("looking for" OR "need" OR "request") -site:designrush.com -site:clutch.co -site:goodfirms.co -jobs'},
  {key:'business-systems',label:'Worldwide · business applications',kind:'REQUEST',query:'("need a customer portal" OR "workflow automation" OR "custom software") ("looking for" OR "request for proposal" OR "development partner") -site:designrush.com -site:clutch.co -site:goodfirms.co -jobs'},
  {key:'communities',label:'Public discussions and blogs',kind:'REQUEST',query:'("need a website" OR "need an ecommerce" OR "looking for a developer") (site:reddit.com OR site:indiehackers.com OR site:medium.com) -site:designrush.com -site:clutch.co -site:goodfirms.co -jobs'},
  {key:'ng-research',label:'Nigeria · business research leads',kind:'RESEARCH',query:'Nigeria ("new business" OR "new store" OR "launching") ("orders via WhatsApp" OR "online booking" OR "our website")'},
 ];
 const extras:SearchPlan[]=[
  {key:'global-research',label:'Worldwide · business research leads',kind:'RESEARCH',query:'("opening a new business" OR "launching our store") ("online orders" OR "booking" OR "website")'},
  {key:'rfp',label:'Worldwide · published project requests',kind:'REQUEST',query:'("website development" OR "ecommerce" OR "software development") ("request for proposal" OR "seeking an agency") ("deadline" OR "submit proposal") -site:designrush.com -site:clutch.co -site:goodfirms.co'},
 ];
 for(const region of settings.regions.slice(0,8))extras.push({key:'region-'+extras.length,label:'Target region · '+phrase(region),kind:'REQUEST',query:phrase(region)+' ("need a website" OR "ecommerce" OR "custom software") ("looking for" OR "request") -site:designrush.com -site:clutch.co -site:goodfirms.co -jobs'});
 for(const cap of capabilities.filter(c=>!['ARCHIVED','PAUSED'].includes(c.status)).slice(0,12)){
  const phrases=typeof cap.buyerPhrases==='object'&&cap.buyerPhrases!==null?Object.values(cap.buyerPhrases).flat().filter((x):x is string=>typeof x==='string'):[];
  for(const term of [...phrases,...cap.possibleWork,cap.name].slice(0,3)) extras.push({key:'capability-'+extras.length,label:'Company capability · '+phrase(term),kind:'REQUEST',query:'"'+phrase(term)+'" ("looking for" OR "need" OR "request for proposal") -site:designrush.com -site:clutch.co -site:goodfirms.co -jobs'});
 }
 for(const term of [...settings.businessProblems,...settings.industries,...settings.engagementTypes,...settings.preferredSources].slice(0,16))extras.push({key:'preference-'+extras.length,label:'Company preference · '+phrase(term),kind:'REQUEST',query:phrase(term)+' ("website" OR "software" OR "online store") ("looking for" OR "need") -site:designrush.com -site:clutch.co -site:goodfirms.co -jobs'});
 // Keep Nigeria/global/small-business coverage on every run; rotate the remaining knowledge searches daily.
 const offset=Math.floor(now.getTime()/86400000)%extras.length;
 return [...plans,extras[offset],extras[(offset+1)%extras.length]].map(p=>({...p,query:p.query.slice(0,500)}));
}
const tech = /\b(website|web design|web developer|landing page|ecommerce|e-commerce|online store|shopify|software|customer portal|crm|booking|automation|database|web app|application development)\b/i;
const hiring = /\b(we are hiring|job vacancy|apply for (?:this |the )?(?:job|role|position)|salary and benefits|send your cv|full.time employee|careers? at)\b/i;
const editorial = /\b(how to|step.by.step|tutorial|beginner.s guide|learn to|course|(?:top|best|leading)\b.{0,75}\b(?:agencies|companies|developers|providers|tools|services)|agency rankings|directory|comparison|buying guide|templates?|examples?)\b/i;
const seller = /\b(we (?:build|design|offer|provide|deliver|help)|our (?:web design|development services)|hire us|full.service (?:digital |web )?agency|website design services|web development agency|our clients)\b/i;
const need = /\b(?:need(?:s)?|looking for|seeking|want(?:s)? to (?:build|hire|commission)|planning to (?:build|commission)|require(?:s)?|searching for)\b.{0,100}\b(?:website|web (?:designer|developer|development)|landing page|online store|ecommerce|e-commerce|shopify|software|portal|crm|booking|automation|developer|agency|development partner)\b/i;
const buyerVoice = /\b(?:i|we|our (?:business|company|team|store|shop|clinic|organisation|organization|charity)|my (?:business|company|store|shop)|(?:the |our )?client)\b.{0,65}\b(?:need(?:s)?|(?:am |are |is )?(?:looking for|seeking|searching for)|want(?:s)? to (?:build|hire|commission)|planning to (?:build|commission)|require(?:s)?)\b/i;
const procurement = /\b(?:request for proposals?|request for quotations?|invitation (?:to bid|for bids|to tender)|tender (?:notice|invitation)|rfp|rfq)\b/i;
const procurementAction = /\b(?:invites? (?:proposals|bids|tenders|qualified)|(?:is |are )?(?:issuing|issued|seeking proposals)|submit (?:your |a |the )?(?:proposal|bid)|submission (?:deadline|date)|closing date|deadline|tender reference|procurement reference|proposals? (?:are )?due)\b/i;
const researchVoice = /\b(?:we|our|my)\b.{0,100}\b(?:launch(?:ing|es|ed)?|open(?:ing|ed)?|orders? (?:via|through|on)|book(?:ing|ings)? (?:via|through|on)|manual(?:ly)?|spreadsheet|whatsapp)\b/i;
const words = (value: string) => new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(word => word.length > 3 && !['with','from','your','this','that','business','company','need','website','development'].includes(word)));

/** Excerpt admission only: an explicit statement earns review, never verified buyer status. */
export function commercialIntent(title: string, description: string, url: string, research: boolean) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (editorial.test(title)) return null;
  if (['designrush.com','clutch.co','goodfirms.co','sortlist.com','upcity.com','agencyspotter.com'].some(directory => host === directory || host.endsWith('.' + directory))) return null;
  const sentences = (title + '. ' + description).split(/(?:[.!?]\s+|\n+)/).map(value => value.trim()).filter(Boolean);
  const requestEvidence = sentences.find(sentence => !seller.test(sentence) && !hiring.test(sentence) && need.test(sentence) && buyerVoice.test(sentence));
  const formalRequest = procurement.test(title) && tech.test(title + ' ' + description) && procurementAction.test(description) && !seller.test(title);
  if (hiring.test(title + ' ' + description) && !formalRequest) return null;
  if (requestEvidence || formalRequest) return {kind: 'REQUEST_SIGNAL' as const, evidence: requestEvidence ?? title};
  if (!research || seller.test(title + ' ' + description) || !researchVoice.test(description)) return null;
  return {kind: 'RESEARCH_LEAD' as const, evidence: 'First-person business activity; purchasing intent is not established.'};
}

/** Preserve the published amount/range; unrelated prices and agency rates are not buyer budgets. */
export function publishedBuyerBudget(text: string): string | null {
  const currency = '(?:USD|GBP|NGN|EUR|US\\$|\\$|£|₦|€)';
  const amount = '\\d[\\d,]*(?:\\.\\d+)?\\s*(?:[kKmM]\\b|thousand\\b|million\\b)?';
  const pattern = new RegExp(currency + '\\s*' + amount + '(?:\\s*(?:[-–—]|to)\\s*(?:' + currency + '\\s*)?' + amount + ')?', 'gi');
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 80), index);
    const after = text.slice(index + match[0].length, index + match[0].length + 45);
    const context = before + ' ' + after;
    if (!/\b(?:budget|funding|project value|contract value|estimated cost|fixed.price|can pay|will pay|paying|allocated|spend)\b/i.test(context)) continue;
    if (/^\s*(?:per\s+(?:hour|month|year)|\/\s*(?:hr|hour|month|year)|annually|salary)\b/i.test(after)) continue;
    return match[0].trim();
  }
  return null;
}

export function assessWebLead(input: {title:string;description:string;url:string;research:boolean}, capabilities: CapabilityInput[], preferences: Preferences) {
  const url = canonicalPublicUrl(input.url);
  const title = plain(input.title).slice(0,240);
  const description = plain(input.description).slice(0,4000);
  const text = title + ' ' + description;
  if (!url || !tech.test(text) || description.length < 12) return null;
  const intent = commercialIntent(title, description, url, input.research);
  if (!intent) return null;
  const request = intent.kind === 'REQUEST_SIGNAL';
  const queryWords = words(text);
  const matches = capabilities.filter(capability => !['ARCHIVED','PAUSED'].includes(capability.status)).flatMap(capability => {
    const terms = words([capability.name,capability.purpose,...capability.businessProblems,...capability.possibleWork].join(' '));
    const hits = [...terms].filter(word => queryWords.has(word));
    return hits.length >= 2 ? [{capabilityId:capability.id,score:Math.min(85,20+hits.length*8),rationale:'Shared subject terms: '+hits.slice(0,8).join(', ')+'. Delivery evidence and capacity still require review.'}] : [];
  }).sort((a,b) => b.score-a.score).slice(0,12);
  const score = Math.min(90,(request?40:15)+(matches[0]?.score?Math.round(matches[0].score/3):0));
  const budget = request ? publishedBuyerBudget(text) : null;
  if (score < preferences.minimumScore || ((preferences.requireBudget || !preferences.includeUnpriced) && !budget)) return null;
  const warnings = [request?'An explicit buyer statement or procurement notice appears in the excerpt; verify its author, date and current availability.':'Research lead only: business activity does not establish purchasing intent.','Location, Nigeria eligibility, budget, deadline and capacity remain unconfirmed unless supported by the original source.','Search excerpts may be outdated or incomplete. No contact or delivery commitment is authorized.'];
  return {url,title,description,kind:intent.kind,intentEvidence:intent.evidence,score,budget,matches,warnings};
}
