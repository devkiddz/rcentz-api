type OpportunityText = { title: string; description: string; kind: string };
export function opportunityIntent(listing: OpportunityText): "EMPLOYMENT" | "CONTRACT" | "PROJECT" | "PROSPECT" {
  const title = listing.title.toLowerCase();
  const text = `${title} ${listing.description}`.slice(0,16000);
  const deliverable = /\b(?:website|web app|software|portal|platform|application|e-commerce|ecommerce|digital system|development services|development project)\b/i.test(text);
  const buyer = /\b(?:request for (?:proposals?|quotations?)|rfp|rfq|invitation to (?:bid|tender)|tender for|procurement of|seeking (?:a |an )?(?:agency|vendor|supplier|development partner)|(?:need|looking for) (?:a |an )?(?:agency|vendor|supplier)|(?:build|develop|redesign) our (?:website|platform|portal|app)|submit (?:a |your )?(?:proposal|bid|quotation))\b/i.test(text);
  const jobTitle = /\b(?:project manager|(?:frontend|front.end|backend|full.stack|software|web|senior|junior) (?:developer|engineer)|developer vacancy|engineer vacancy|developer|engineer|project manager)\b/i.test(title);
  const vacancy = /\b(?:job description|employment type|salary|benefits|years of experience|apply for (?:this|the) (?:job|role)|join our team)\b/i.test(text);
  const buyerTitle = /\b(?:rfp|rfq|tender|procurement|request for proposal|invitation to bid)\b/i.test(title);
  if (/\b(?:templates?|samples?|examples?|guides?|how to|what is)\b/i.test(title) && !jobTitle) return "PROSPECT";
  if (!buyerTitle && /\b(?:we (?:offer|provide)|our services|hire us|our agency|we help.{0,60}(?:rfp|proposal))\b/i.test(text)) return "PROSPECT";
  if (deliverable && buyer && (buyerTitle || (!jobTitle && !vacancy))) return listing.kind === "CONTRACT" ? "CONTRACT" : "PROJECT";
  if (jobTitle || vacancy || listing.kind === "EMPLOYMENT") return "EMPLOYMENT";
  return "PROSPECT";
}
export function contactPurpose(email: string) {
  const local = email.split("@")[0];
  return /procurement|tenders?|bids?|purchas|vendors?|suppliers?/i.test(local) ? "Procurement" :
    /careers?|jobs?|hr|talent|recruit|hiring/i.test(local) ? "Recruitment" : "Business enquiries";
}
