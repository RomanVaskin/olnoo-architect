import { routerGeometryReviewer } from "./router-geometry-reviewer";
import type { GeometryReviewProvider } from "./geometry-reviewer";

/**
 * Provider boundary for Phase 4. Future reviewer models can be selected here
 * without changing the API route, persistence or UI report contract.
 */
export function getGeometryReviewer(): GeometryReviewProvider {
  return routerGeometryReviewer;
}
