export type FetchImplementation = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Bounded fetch for provider calls. A caller gets a deterministic timeout error
 * instead of a permanently pending request when a provider stops responding.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 30_000,
  fetchImplementation: FetchImplementation = fetch
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImplementation(input, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (controller.signal.aborted) {
      throw new Error(`Provider request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
