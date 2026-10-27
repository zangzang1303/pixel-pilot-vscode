/**
 * Deduplicates request IDs at the host boundary. Terminal promises are retained
 * for a bounded window so webview retry/replay cannot start a second paid run.
 */
export class WebviewBridge {
  private readonly requests = new Map<string, Promise<unknown>>();

  constructor(private readonly maxRememberedRequests = 256) {}

  public dispatch<T>(requestId: string, execute: () => Promise<T>): Promise<T> {
    const existing = this.requests.get(requestId);
    if (existing) return existing as Promise<T>;

    const promise = Promise.resolve().then(execute);
    this.requests.set(requestId, promise);
    this.trim();
    return promise;
  }

  private trim(): void {
    while (this.requests.size > this.maxRememberedRequests) {
      const oldest = this.requests.keys().next().value as string | undefined;
      if (!oldest) return;
      this.requests.delete(oldest);
    }
  }
}
