export type RunState = 'running' | 'cancelled';

/** Tracks request ownership and prevents a late result from being committed. */
export class RunLifecycleService {
  private readonly runs = new Map<string, RunState>();

  public start(requestId: string): void {
    if (this.runs.has(requestId)) throw new Error(`Request ${requestId} is already running.`);
    this.runs.set(requestId, 'running');
  }

  public cancel(requestId: string): boolean {
    if (this.runs.get(requestId) !== 'running') return false;
    this.runs.set(requestId, 'cancelled');
    return true;
  }

  public throwIfCancelled(requestId: string): void {
    if (this.runs.get(requestId) === 'cancelled') throw new Error('Operation cancelled.');
  }

  public finish(requestId: string): void {
    this.runs.delete(requestId);
  }
}
