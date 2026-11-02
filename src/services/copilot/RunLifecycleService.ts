export type RunState = 'running' | 'cancelled';

/** Tracks request ownership and prevents a late result from being committed. */
export class RunLifecycleService {
  private readonly runs = new Map<string, RunState>();
  private readonly controllers = new Map<string, AbortController>();

  public start(requestId: string): void {
    if (this.runs.has(requestId)) throw new Error(`Request ${requestId} is already running.`);
    this.runs.set(requestId, 'running');
    this.controllers.set(requestId, new AbortController());
  }

  public cancel(requestId: string): boolean {
    if (this.runs.get(requestId) !== 'running') return false;
    this.runs.set(requestId, 'cancelled');
    this.controllers.get(requestId)?.abort();
    return true;
  }

  public signal(requestId: string): AbortSignal | undefined {
    return this.controllers.get(requestId)?.signal;
  }

  public throwIfCancelled(requestId: string): void {
    if (this.runs.get(requestId) === 'cancelled') throw new Error('Operation cancelled.');
  }

  public finish(requestId: string): void {
    this.runs.delete(requestId);
    this.controllers.delete(requestId);
  }
}
