import { buildArchitecturalPrompt } from "./prompt-builder";
import type { GenerationRequest, GenerationResult, ImageGenerationProvider, ModelSpec, SourceImageInput } from "./types";
import { callRouter } from "./router-client";

const ROLE_LABELS: Record<SourceImageInput["role"], string> = {
  front: "front facade",
  side: "side facade",
  rear: "rear facade",
  detail: "detail",
  other: "other view",
};

export function buildRouterImages(images: SourceImageInput[], labels?: string[]) {
  return images.map((image, index) => ({
    mimeType: image.mimeType,
    data: image.data.toString("base64"),
    label: labels?.[index] ?? (
      image.purpose === "primary"
        ? `IMAGE ${index + 1}: PRIMARY EDIT TARGET — ${ROLE_LABELS[image.role]}. Edit this image and preserve its camera exactly.`
        : `IMAGE ${index + 1}: REFERENCE CONTEXT ONLY — ${ROLE_LABELS[image.role]}. Do not use this camera angle for the output.`),
  }));
}

interface RouterImageResponse {
  model: string;
  imageBase64: string;
  mimeType: string;
  warnings: string[];
}

export const routerProvider: ImageGenerationProvider = {
  async generate(spec: ModelSpec, request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    const prompt = request.promptOverride ?? buildArchitecturalPrompt(
      request.constraints,
      request.variantIndex,
      request.variantCount,
      request.images,
    );
    const response = await callRouter<RouterImageResponse>(
      "/api/images/generate",
      {
        model: spec.model,
        prompt,
        images: buildRouterImages(request.images, request.imageLabels),
      },
      signal,
    );
    if (!response.imageBase64 || !response.mimeType || !Array.isArray(response.warnings)) {
      throw new Error("malformed-router-image-response");
    }
    return {
      imageBase64: response.imageBase64,
      mimeType: response.mimeType,
      warnings: response.warnings,
    };
  },
};
