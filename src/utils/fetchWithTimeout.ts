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
  let timedOut = false;
  const callerSignal = init.signal;
  if (callerSignal?.aborted) throw new Error('Provider request cancelled.');
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('timeout'));
  }, timeoutMs);
  try {
    return await fetchImplementation(input, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (timedOut) {
      throw new Error(`Provider request timed out after ${timeoutMs}ms.`);
    }
    if (callerSignal?.aborted) throw new Error('Provider request cancelled.');
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
