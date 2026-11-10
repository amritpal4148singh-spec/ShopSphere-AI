export type ApiErrorKind = "network" | "timeout" | "http" | "parse";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    if (status !== undefined) this.status = status;
  }
}

/** Configurable endpoint (PRD section 13). Defaults to the free DummyJSON service. */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://dummyjson.com").replace(/\/+$/, "");

export const DEFAULT_TIMEOUT_MS = 10_000;

interface GetJsonOptions {
  /** Caller cancellation (TanStack Query passes one). Cancellation is re-thrown untouched. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** GET a JSON resource. Failures are normalised to ApiError (network, timeout, http, parse). */
export async function getJson(path: string, options: GetJsonOptions = {}): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (options.signal?.aborted) controller.abort();

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new ApiError("http", `Request failed with status ${response.status}`, response.status);
    try {
      return await response.json();
    } catch {
      throw new ApiError("parse", "The response was not valid JSON");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) throw new ApiError("timeout", "The request timed out");
    if (options.signal?.aborted) throw error;
    throw new ApiError("network", "The server could not be reached");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
