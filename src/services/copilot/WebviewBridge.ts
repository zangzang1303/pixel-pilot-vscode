/**
 * Deduplicates request IDs at the host boundary, tracks connected surfaces,
 * and maintains sequence ordering for broadcast events.
 */
export class WebviewBridge {
  private readonly requests = new Map<string, Promise<unknown>>();
  private readonly surfaces = new Set<(message: unknown) => void>();
  private sequence = 0;

  constructor(private readonly maxRememberedRequests = 256) {}

  public dispatch<T>(requestId: string, execute: () => Promise<T>): Promise<T> {
    const existing = this.requests.get(requestId);
    if (existing) return existing as Promise<T>;

    const promise = Promise.resolve().then(execute);
    this.requests.set(requestId, promise);
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
      const oldest = this.requests.keys().next().value as string | undefined;
      if (!oldest) return;
      this.requests.delete(oldest);
    }
  }
}
