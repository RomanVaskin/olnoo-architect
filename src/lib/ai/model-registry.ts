import type { GenerationMode } from "@/lib/types";
import type { ModelSpec } from "./types";

/**
 * Provider-independent registry mapping user-facing generation modes to a
 * concrete provider + model. This is the only place that knows real model
 * identifiers — the rest of the pipeline (API route, wizard, Concepts UI)
 * only ever deals with GenerationMode. Adding OpenAI or FLUX later means
 * adding entries here, not changing the UI or the generation workflow.
 *
 * Server-only: never import this module from a "use client" file.
 */

const FAST_MODEL = "gemini-3.1-flash-lite-image";
const MAXIMUM_QUALITY_MODEL = "gemini-3-pro-image";

function balancedModel(): string {
  return process.env.AI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image";
}

/** "auto" currently resolves to Balanced; it is not a distinct model. */
export function resolveModelSpec(mode: GenerationMode): ModelSpec {
  switch (mode === "auto" ? "balanced" : mode) {
    case "fast":
      return { provider: "router", model: FAST_MODEL };
    case "maximum-quality":
      return { provider: "router", model: MAXIMUM_QUALITY_MODEL };
    case "balanced":
    default:
      return { provider: "router", model: balancedModel() };
  }
}

/** The mode actually used for a request — "auto" is never returned, since it is only a selection alias. */
export function resolveEffectiveMode(mode: GenerationMode): Exclude<GenerationMode, "auto"> {
  return mode === "auto" ? "balanced" : mode;
}
