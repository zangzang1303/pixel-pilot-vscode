/**
 * Deduplicates request IDs at the host boundary, tracks connected surfaces,
 * and maintains sequence ordering for broadcast events.
 */
export class WebviewBridge {
  private readonly requests = new Map<string, { fingerprint?: string; promise: Promise<unknown>; settled: boolean }>();
  private readonly surfaces = new Set<(message: unknown) => void>();
  private sequence = 0;

  constructor(private readonly maxRememberedRequests = 256) {}

  public dispatch<T>(requestId: string, execute: () => Promise<T>, fingerprint?: string): Promise<T> {
    const existing = this.requests.get(requestId);
    if (existing) {
      if ((existing.fingerprint !== undefined || fingerprint !== undefined) && fingerprint !== existing.fingerprint) {
        return Promise.reject(new Error(`Request ID '${requestId}' was reused with a different payload.`));
      }
      return existing.promise as Promise<T>;
    }

    const promise = Promise.resolve().then(execute);
    const entry = { fingerprint, promise: promise as Promise<unknown>, settled: false };
    this.requests.set(requestId, entry);
    void promise.then(
      () => { entry.settled = true; this.trim(); },
      () => { entry.settled = true; this.trim(); }
    );
    this.trim();
    return promise;
  }

  public registerSurface(send: (message: unknown) => void): () => void {
    this.surfaces.add(send);
    return () => {
      this.surfaces.delete(send);
    };
  }

  public getSurfaceCount(): number {
    return this.surfaces.size;
  }

  public getNextSequence(): number {
    return ++this.sequence;
  }

  public broadcast(event: Record<string, unknown>): number {
    const seq = ++this.sequence;
    const message = { ...event, sequence: seq };
    for (const send of this.surfaces) {
      try {
        send(message);
      } catch {
        // Surface might be disposed
      }
    }
    return seq;
  }

  private trim(): void {
    while (this.requests.size > this.maxRememberedRequests) {
      const oldestSettled = [...this.requests].find(([, entry]) => entry.settled)?.[0];
      if (!oldestSettled) return; // Never evict an active request: doing so would allow duplicate paid work.
      this.requests.delete(oldestSettled);
    }
  }
}
