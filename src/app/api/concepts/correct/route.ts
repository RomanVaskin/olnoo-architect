import { NextRequest, NextResponse } from "next/server";
import type { GeometryVerificationReport } from "@/lib/types";
import { GenerationError } from "@/lib/ai/errors";
import { validateCorrectionForm } from "@/lib/ai/request-validation";
import { resolveEffectiveMode, resolveModelSpec } from "@/lib/ai/model-registry";
import { getProvider } from "@/lib/ai/provider";
import { getGeometryReviewer } from "@/lib/ai/reviewer-provider";
import { buildCorrectionPrompt } from "@/lib/ai/correction-prompt";
import { reviewGeometrySafely } from "@/lib/ai/geometry-reviewer";
import { withGenerationSlot } from "@/lib/ai/concurrency";
import { requireAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";

// Authentication is enforced before validation or any provider call. A
// distributed per-user/IP rate limit is still required before public launch;
// the process-wide generation cap is only a local resource-safety bound.

const GENERATION_TIMEOUT_MS = 90_000;
const REVIEW_TIMEOUT_MS = 45_000;

interface CorrectionVariantResponse {
  status: "succeeded" | "failed";
  mode: string;
  mimeType?: string;
  imageBase64?: string;
  warnings: string[];
  geometryVerification?: GeometryVerificationReport;
  error?: { code: string; message: string };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status });
  }
  if (!process.env.AI_ROUTER_URL || !process.env.AI_ROUTER_API_KEY) {
    return errorResponse(new GenerationError("missing-api-key"), 500);
  }

  let input;
  try {
    input = await validateCorrectionForm(await request.formData());
  } catch (error) {
    return errorResponse(error, 400);
  }

  const spec = resolveModelSpec(input.mode);
  const provider = getProvider(spec);
  const reviewer = getGeometryReviewer();
  const effectiveMode = resolveEffectiveMode(input.mode);

  const variant = await withGenerationSlot<CorrectionVariantResponse>(async () => {
    const generationController = new AbortController();
    const generationTimer = setTimeout(() => generationController.abort(), GENERATION_TIMEOUT_MS);
    try {
      const generated = await provider.generate(
        spec,
        {
          images: input.images,
          constraints: input.constraints,
          variantIndex: 1,
          variantCount: 1,
          promptOverride: buildCorrectionPrompt(input.constraints, input.findings, input.images.length > 2),
          imageLabels: [
            "IMAGE 1: GENERATED CONCEPT TO CORRECT — edit this image and preserve its design intent.",
            "IMAGE 2: ORIGINAL PRIMARY VIEW — authoritative geometry and camera reference.",
            ...(input.images.length > 2 ? ["IMAGE 3: ORIGINAL REFERENCE VIEW — geometry context only, not the output camera."] : []),
          ],
        },
        generationController.signal,
      );
      clearTimeout(generationTimer);

      const reviewController = new AbortController();
      const reviewTimer = setTimeout(() => reviewController.abort(), REVIEW_TIMEOUT_MS);
      let geometryVerification: GeometryVerificationReport;
      try {
        geometryVerification = await reviewGeometrySafely(
          reviewer,
          {
            primaryImage: input.images[1],
            referenceImages: input.images.slice(2),
            generatedImage: { data: Buffer.from(generated.imageBase64, "base64"), mimeType: generated.mimeType },
            constraints: input.constraints,
          },
          reviewController.signal,
          logCorrectionReviewFailure,
        );
      } finally {
        clearTimeout(reviewTimer);
      }

      return {
        status: "succeeded",
        mode: effectiveMode,
        mimeType: generated.mimeType,
        imageBase64: generated.imageBase64,
        warnings: generated.warnings,
        geometryVerification,
      };
    } catch (error) {
      const generationError = error instanceof GenerationError ? error : new GenerationError("provider-failure");
      console.error(`[concepts/correct] ${generationError.code}`);
      return {
        status: "failed",
        mode: effectiveMode,
        warnings: [],
        error: { code: generationError.code, message: generationError.userMessage },
      };
    } finally {
      clearTimeout(generationTimer);
    }
  });

  return NextResponse.json({ variants: [variant] });
}

function logCorrectionReviewFailure(error: unknown) {
  console.warn("[concepts/correct-review]", { code: error instanceof Error ? error.name : "UnknownError" });
}

function errorResponse(error: unknown, status: number) {
  const generationError = error instanceof GenerationError ? error : new GenerationError("provider-failure");
  console.error(`[concepts/correct] ${generationError.code}`);
  return NextResponse.json({ error: { code: generationError.code, message: generationError.userMessage } }, { status });
}
