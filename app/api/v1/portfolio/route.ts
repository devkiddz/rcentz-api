import type { NextRequest } from "next/server";

import { getPortfolioProjects } from "@/features/portfolio/server/get-portfolio-projects";
import {
  defaultLocale,
  isSupportedLocale,
} from "@/i18n/config";
import {
  apiError,
  apiSuccess,
} from "@/server/api/responses/api-response";

export async function GET(request: NextRequest) {
  try {
    const requestedLocale =
      request.nextUrl.searchParams.get("locale");

    const locale =
      requestedLocale && isSupportedLocale(requestedLocale)
        ? requestedLocale
        : defaultLocale;

    const projects = await getPortfolioProjects(locale);

    const data = projects.map((project) => ({
      name: project.name,
      slug: project.slug,
      description: project.description,
      type: project.type,
      status: project.status,
      progress: project.progress,

      tagline: project.tagline,
      summary: project.summary,
      outcome: project.outcome,

      liveUrl: project.liveUrl,
      repositoryUrl: project.repositoryUrl,

      featured: project.featured,
      publishedAt: project.publishedAt,
      completedAt: project.completedAt,

      technologies: project.technologies,
      media: project.media,

      analytics: project.analytics,
      reactions: project.reactions,

      credits: project.credits,
      suggestions: project.suggestions,
    }));

    return apiSuccess(data);
  } catch (error) {
    console.error("[api:v1:portfolio]", error);

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Portfolio projects could not be loaded",
      500
    );
  }
}