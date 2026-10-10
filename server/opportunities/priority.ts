import { sourceContext } from "@/features/opportunities/lib/source-context";
import { opportunityIntent } from "@/features/opportunities/lib/intent";
import { reviewCareer } from "./career-review";
import type { CareerProfile } from "./fit";
import type { Research } from "./research";
import type { SourceListing } from "./sources";
export function evidencePriority(listing: SourceListing, profile: CareerProfile, research: Research | null, quarantined: boolean) {
  const kind = opportunityIntent(listing);
  const review = reviewCareer({...listing, kind, research}, profile, quarantined);
  const context = sourceContext({...listing, research});
  let priority = 1, priorityLabel = "Discovery — clarify the source";
  if (kind !== "EMPLOYMENT") {
    if (kind !== "PROSPECT" && research?.demand?.confirmed) { priority = 3; priorityLabel = "Buyer request — confirm scope and issuer"; }
    else if (kind !== "PROSPECT") {priority = 2; priorityLabel = "Possible buyer request — verify original brief";}
    else priorityLabel = "Prospect — company need unconfirmed";
  } else if (context === "VACANCY_TEXT") {
    priority = 2; priorityLabel = "Individual vacancy — source or eligibility needs confirmation";
    if (research?.vacancy?.publisher !== undefined && research.vacancy.publisher !== "PUBLIC_PAGE" && research.vacancy.open !== "EXPIRED") {
      priority = 3; priorityLabel = "Company / ATS listing — clarify remaining requirements";
      if (review.recommendation === "PURSUE" && research.vacancy.eligibility === "EXPLICIT" && research.vacancy.open === "NOT_EXPIRED") {
        priority = 4; priorityLabel = "Pursue — contribution fit and explicit location wording";
      }
    }
  }
  if (quarantined || review.recommendation === "SKIP" || research?.vacancy?.open === "EXPIRED") {priority = 0; priorityLabel = quarantined ? "Quarantined — review risk separately" : "Low priority — conflict or expired deadline";}
  return {kind, priority, priorityLabel, careerReview: review};
}
