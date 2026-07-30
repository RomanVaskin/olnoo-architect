import { routerProvider } from "./router-provider";
import type { ImageGenerationProvider, ModelSpec } from "./types";

/**
 * Resolves the model selected for an Architect workflow to the shared OLNOO
 * AI Router transport. Architect never calls a model vendor directly.
 */
export function getProvider(spec: ModelSpec): ImageGenerationProvider {
  switch (spec.provider) {
    case "router":
      return routerProvider;
    default:
      throw new Error(`Unknown provider: ${spec.provider satisfies never}`);
  }
}
