import { API_BASE_URL, ApiError, getJson } from "./client";

const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string, init: RequestInit) => Promise<Response>) {
  globalThis.fetch = ((url: string, init: RequestInit) => handler(String(url), init)) as typeof fetch;
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError | Error | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error as Error;
  }
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("getJson", () => {
  it("requests the configured base URL and returns parsed JSON", async () => {
    let requested = "";
    stubFetch(async (url) => {
      requested = url;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    expect(await getJson("/products?limit=0")).toEqual({ ok: true });
    expect(requested).toBe(`${API_BASE_URL}/products?limit=0`);
  });

  it("reports HTTP failures with the status", async () => {
    stubFetch(async () => new Response("nope", { status: 503 }));
    const error = (await errorOf(getJson("/x"))) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("http");
    expect(error.status).toBe(503);
  });

  it("reports an unreadable body as a parse error", async () => {
    stubFetch(async () => new Response("<html>not json</html>", { status: 200 }));
    const error = (await errorOf(getJson("/x"))) as ApiError;
    expect(error.kind).toBe("parse");
  });

  it("reports an unreachable server as a network error", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const error = (await errorOf(getJson("/x"))) as ApiError;
    expect(error.kind).toBe("network");
  });

  it("times out slow requests", async () => {
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const error = (await errorOf(getJson("/x", { timeoutMs: 20 }))) as ApiError;
    expect(error.kind).toBe("timeout");
  });

  it("re-throws caller cancellation untouched so it is not shown as a failure", async () => {
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const controller = new AbortController();
    const pending = errorOf(getJson("/x", { signal: controller.signal, timeoutMs: 5_000 }));
    controller.abort();

    const error = await pending;
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error?.name).toBe("AbortError");
  });
});
