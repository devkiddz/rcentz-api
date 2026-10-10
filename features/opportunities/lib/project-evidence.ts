export type ProjectEvidence = { name: string; url: string; skills: string[]; contribution: string };
export function isProjectEvidence(value: unknown): value is ProjectEvidence[] {
 return Array.isArray(value) && value.length <= 6 && value.every(v => {
  if(!v || typeof v !== "object" || Array.isArray(v)) return false;
  const p=v as Record<string,unknown>;
  if(typeof p.name!=="string" || !p.name.trim() || p.name.length>100 || typeof p.contribution!=="string" || !p.contribution.trim() || p.contribution.length>400 || typeof p.url!=="string" || p.url.length>500 || !Array.isArray(p.skills) || !p.skills.length || p.skills.length>12 || p.skills.some(s=>typeof s!=="string" || !s.trim() || s.length>50)) return false;
  try {const url=new URL(p.url);return url.protocol==="https:" && !url.username && !url.password;} catch {return false;}
 });
}
export function projectGrounding(value: unknown, matched: string[]) {
 const projects=isProjectEvidence(value)?value:[];
 const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
 const covered=matched.filter(skill=>projects.some(p=>p.skills.some(s=>normalize(s)===normalize(skill))));
 const relevant=projects.filter(p=>p.skills.some(s=>matched.some(skill=>normalize(s)===normalize(skill))));
 return {relevant, missing:matched.filter(s=>!covered.includes(s)), covered};
}
