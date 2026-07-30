import { parseGeometryReview, type GeometryReviewProvider } from "./geometry-reviewer";
import { callRouter } from "./router-client";

export const GEOMETRY_REVIEW_MODEL = process.env.AI_REVIEW_MODEL || "gemini-3.5-flash";

export const GEOMETRY_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "checks"],
  properties: {
    summary: { type: "string" },
    checks: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "status", "confidence", "explanation"],
        properties: {
          key: { type: "string", enum: ["camera", "volumes", "roof", "openings", "proportions"] },
          status: { type: "string", enum: ["consistent", "possible-deviation", "uncertain"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          explanation: { type: "string" },
        },
      },
    },
  },
} as const;

export function buildGeometryReviewPrompt(mustKeep: string[], referenceCount = 0): string {
  return [
    "You are an architectural visual-comparison reviewer.",
    "Compare IMAGE 1 (the original Primary View) with IMAGE 2 (the generated redesign).",
    referenceCount > 0
      ? `IMAGES 3–${referenceCount + 2} are reference views of the same original building. Use them only to understand building identity and geometry hidden in IMAGE 1; do not require their camera angles to match IMAGE 2.`
      : "No additional reference views are available.",
    "Evaluate only visible geometric consistency. Ignore intended changes to materials, colors, lighting, landscaping, furniture and weather.",
    "Check exactly these five categories: camera/perspective, overall volumes and storeys, roof geometry, window/door opening positions, overall proportions/footprint.",
    "Use possible-deviation only when a visible discrepancy exists; use uncertain when occlusion, crop or image quality prevents a reliable comparison.",
    "Do not claim professional approval, construction accuracy, exact dimensions, code compliance or certification.",
    `User must-keep constraints: ${mustKeep.length ? mustKeep.join("; ") : "none supplied"}.`,
    "Write summary and explanations in Russian. Return only the requested JSON.",
  ].join("\n");
}

export function buildRouterReviewImages(request: Parameters<GeometryReviewProvider["review"]>[0]) {
  const references = request.referenceImages ?? [];
  return [
    {
      mimeType: request.primaryImage.mimeType,
      data: request.primaryImage.data.toString("base64"),
      label: "IMAGE 1 — ORIGINAL PRIMARY VIEW",
    },
    {
      mimeType: request.generatedImage.mimeType,
      data: request.generatedImage.data.toString("base64"),
      label: "IMAGE 2 — GENERATED REDESIGN TO REVIEW",
    },
    ...references.map((image, index) => ({
      mimeType: image.mimeType,
      data: image.data.toString("base64"),
      label: `IMAGE ${index + 3} — ORIGINAL REFERENCE VIEW (${image.role})`,
    })),
  ];
}

export const routerGeometryReviewer: GeometryReviewProvider = {
  async review(request, signal) {
    const referenceImages = request.referenceImages ?? [];
    const response = await callRouter<{ content: string }>(
      "/api/structured",
      {
        model: GEOMETRY_REVIEW_MODEL,
        prompt: buildGeometryReviewPrompt(request.constraints.mustKeep, referenceImages.length),
        images: buildRouterReviewImages(request),
        jsonSchema: GEOMETRY_REVIEW_SCHEMA,
        temperature: 0,
      },
      signal,
    );
    if (!response.content) throw new Error("empty-review-response");
    return {
      ...parseGeometryReview(response.content),
      reviewedSourceViews: 1 + referenceImages.length,
    };
  },
};
