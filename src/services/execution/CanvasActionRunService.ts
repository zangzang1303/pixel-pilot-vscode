import { createHash } from 'crypto';

export type CanvasActionState = 'running' | 'awaiting_apply' | 'succeeded' | 'failed' | 'cancelled';
export type CanvasActionBegin =
  | { kind: 'started' }
  | { kind: 'existing'; state: CanvasActionState; previewId?: string }
  | { kind: 'conflict' };

type Entry = {
  fingerprint: string;
  state: CanvasActionState;
  controller?: AbortController;
  cancelRequested: boolean;
  previewId?: string;
};

function stableJson(value: unknown, seen = new WeakSet<object>()): string {
  if (value && typeof value === 'object') {
    if (seen.has(value)) throw new Error('Cyclic Canvas action options.');
    seen.add(value);
    if (Array.isArray(value)) {
      const result = `[${value.map(item => stableJson(item, seen)).join(',')}]`;
      seen.delete(value);
      return result;
    }
    const record = value as Record<string, unknown>;
    const result = `{${Object.keys(record).sort().filter(key => record[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${stableJson(record[key], seen)}`).join(',')}}`;
    seen.delete(value);
    return result;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Keeps only a bounded receipt; image and mask contents are represented by a hash. */
export function fingerprintCanvasAction(input: {
  action: string; dataUrl: string; sessionId?: string; nodeId?: string; options?: unknown;
}): string {
  const hash = createHash('sha256');
  for (const value of [input.action, input.dataUrl, input.sessionId || '', input.nodeId || '', stableJson(input.options || {})]) {
    hash.update(String(value));
    hash.update('\0');
  }
  return hash.digest('hex');
}

/** Owns one Canvas request ID through its first terminal or preview-ready state. */
export class CanvasActionRunService {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxRemembered = 256) {}

  public begin(requestId: string, fingerprint: string, cancelable: boolean): CanvasActionBegin {
    const existing = this.entries.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) return { kind: 'conflict' };
      return { kind: 'existing', state: existing.state, previewId: existing.previewId };
    }
    this.entries.set(requestId, {
      fingerprint, state: 'running', cancelRequested: false,
      controller: cancelable ? new AbortController() : undefined
    });
    this.trim();
    return { kind: 'started' };
  }

  public signal(requestId: string): AbortSignal | undefined {
    return this.entries.get(requestId)?.controller?.signal;
  }

  public cancel(requestId: string): boolean {
    const entry = this.entries.get(requestId);
    if (!entry || entry.state !== 'running' || !entry.controller || entry.cancelRequested) return false;
    entry.cancelRequested = true;
    entry.controller.abort();
    return true;
  }

  public wasCancelled(requestId: string): boolean {
    return this.entries.get(requestId)?.cancelRequested || false;
  }

  public finish(requestId: string, state: Exclude<CanvasActionState, 'running'>, previewId?: string): boolean {
    const entry = this.entries.get(requestId);
    if (!entry || entry.state !== 'running') return false;
    if (entry.cancelRequested && state !== 'cancelled') return false;
    entry.state = state;
    entry.previewId = state === 'awaiting_apply' ? previewId : undefined;
    entry.controller = undefined;
    this.trim();
    return true;
  }

  private trim(): void {
    while (this.entries.size > this.maxRemembered) {
      const oldestSettled = [...this.entries].find(([, entry]) => entry.state !== 'running')?.[0];
      if (!oldestSettled) return;
      this.entries.delete(oldestSettled);
    }
  }
}
