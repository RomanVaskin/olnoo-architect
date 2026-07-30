import { GenerationError } from "./errors";

interface RouterErrorBody {
  error?: { code?: string; message?: string };
}

export async function callRouter<T>(
  path: string,
  payload: Record<string, unknown>,
  signal: AbortSignal,
): Promise<T> {
  const baseUrl = process.env.AI_ROUTER_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.AI_ROUTER_API_KEY?.trim();
  if (!baseUrl || !apiKey) throw new GenerationError("missing-api-key");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GenerationError("provider-timeout");
    }
    throw new GenerationError("provider-failure");
  }

  if (!response.ok) {
    const body = await safeJson<RouterErrorBody>(response);
    throw mapRouterError(response.status, body?.error?.code);
  }

  const body = await safeJson<T>(response);
  if (!body) throw new GenerationError("malformed-response");
  return body;
}

function mapRouterError(status: number, code?: string): GenerationError {
  if (code === "PROVIDER_TIMEOUT" || status === 504) return new GenerationError("provider-timeout");
  if (code === "PROVIDER_SAFETY_REJECTION") return new GenerationError("safety-rejection");
  if (code === "PROVIDER_QUOTA_EXHAUSTED") return new GenerationError("quota-exhausted");
  if (code === "PROVIDER_RATE_LIMITED" || status === 429) return new GenerationError("rate-limit");
  if (code === "PROVIDER_INVALID_RESPONSE") return new GenerationError("malformed-response");
  return new GenerationError("provider-failure");
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
