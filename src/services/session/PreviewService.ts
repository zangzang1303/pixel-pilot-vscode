export interface PendingPreview<T> {
  previewId: string;
  sessionId: string;
  parentNodeId: string;
  sourceRevision: string;
  payload: T;
  expiresAt: number;
}

export type PreviewApplyResult<R> =
  | { status: 'applied'; value: R }
  | { status: 'stale'; currentRevision: string }
  | { status: 'discarded' }
  | { status: 'expired' };

type Entry<T, R> = {
  preview: PendingPreview<T>;
  state: 'ready' | 'applying' | 'applied' | 'discarded';
  applyPromise?: Promise<PreviewApplyResult<R>>;
  result?: R;
};

/** In-memory, bounded staging for previews; only apply() may invoke the durable commit. */
export class PreviewService<T, R> {
  private readonly entries = new Map<string, Entry<T, R>>();

  constructor(private readonly ttlMs = 10 * 60_000, private readonly maxEntries = 20) {}

  public stage(input: Omit<PendingPreview<T>, 'expiresAt'>, now = Date.now()): PendingPreview<T> {
    this.prune(now);
    if (!input.previewId || !input.sessionId || !input.parentNodeId || !input.sourceRevision) {
      throw new Error('Preview requires an ID, session, parent node, and source revision.');
    }
    if (this.entries.has(input.previewId)) throw new Error('Preview ID already exists.');
    if (this.entries.size >= this.maxEntries) throw new Error('Too many pending previews; apply or discard one first.');
    const preview = { ...input, expiresAt: now + this.ttlMs };
    this.entries.set(preview.previewId, { preview, state: 'ready' });
    return preview;
  }

  public async apply(previewId: string, currentRevision: () => string, commit: (preview: PendingPreview<T>) => Promise<R>, now = Date.now()): Promise<PreviewApplyResult<R>> {
    const entry = this.entries.get(previewId);
    if (!entry || entry.preview.expiresAt <= now) {
      this.entries.delete(previewId);
      return { status: 'expired' };
    }
    if (entry.state === 'discarded') return { status: 'discarded' };
    if (entry.state === 'applied') return { status: 'applied', value: entry.result as R };
    if (entry.applyPromise) return entry.applyPromise;

    const revision = currentRevision();
    if (revision !== entry.preview.sourceRevision) return { status: 'stale', currentRevision: revision };
    entry.state = 'applying';
    entry.applyPromise = (async () => {
      try {
        const value = await commit(entry.preview);
        entry.state = 'applied';
        entry.result = value;
        return { status: 'applied', value } as const;
      } catch (error) {
        entry.state = 'ready';
        entry.applyPromise = undefined;
        throw error;
      }
    })();
    return entry.applyPromise;
  }

  public discard(previewId: string): boolean {
    const entry = this.entries.get(previewId);
    if (!entry || entry.state === 'applying' || entry.state === 'applied') return false;
    entry.state = 'discarded';
    this.entries.delete(previewId);
    return true;
  }

  public get(previewId: string): PendingPreview<T> | undefined {
    return this.entries.get(previewId)?.preview;
  }

  private prune(now: number): void {
    for (const [id, entry] of this.entries) {
      if (entry.preview.expiresAt <= now && entry.state !== 'applying') this.entries.delete(id);
    }
  }
}
