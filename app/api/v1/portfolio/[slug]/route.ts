import type { NextRequest } from "next/server";

import { getPortfolioProject } from "@/features/portfolio/server/get-portfolio-project";
import {
  defaultLocale,
  isSupportedLocale,
} from "@/i18n/config";
import {
  apiError,
  apiSuccess,
} from "@/server/api/responses/api-response";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    const requestedLocale =
      request.nextUrl.searchParams.get("locale");

    const locale =
      requestedLocale && isSupportedLocale(requestedLocale)
        ? requestedLocale
        : defaultLocale;

    const project = await getPortfolioProject(
      slug,
      locale
    );

    if (!project) {
      return apiError(
        "PORTFOLIO_PROJECT_NOT_FOUND",
        "Portfolio project not found",
        404
      );
    }

    const data = {
      name: project.name,
      slug: project.slug,

      description: project.description,
      purpose: project.purpose,
      vision: project.vision,
      expectedOutcome: project.expectedOutcome,

      type: project.type,
      status: project.status,
      progress: project.progress,

      tagline: project.tagline,
      summary: project.summary,
      challenge: project.challenge,
      solution: project.solution,
      outcome: project.outcome,

      liveUrl: project.liveUrl,
      repositoryUrl: project.repositoryUrl,

      featured: project.featured,

      publishedAt: project.publishedAt,
      startedAt: project.startedAt,
      expectedEndAt: project.expectedEndAt,
      completedAt: project.completedAt,

      technologies: project.technologies,
      media: project.media,
      updates: project.updates,

      analytics: project.analytics,
      engagement: project.engagement,
      reactions: project.reactions,

      credits: project.credits,
      suggestions: project.suggestions,
      seo: project.seo,
    };

    return apiSuccess(data);
  } catch (error) {
    console.error(
      "[api:v1:portfolio:detail]",
      error
    );

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Portfolio project could not be loaded",
      500
    );
  }
}