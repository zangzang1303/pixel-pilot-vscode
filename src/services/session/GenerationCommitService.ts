import { SessionManager } from './SessionManager';
import { ArtifactWriter } from './SessionCommitService';
import { AIResult } from './types';

export interface GenerationTarget {
  sessionId: string | null;
  nodeId: string | null;
}

/** Creates a generated root only after its image has been validated and cached. */
export class GenerationCommitService {
  constructor(private readonly sessions: SessionManager, private readonly assets: ArtifactWriter) {}

  public capture(expected?: Partial<GenerationTarget>): GenerationTarget {
    const active = this.sessions.getActiveSession();
    const target = { sessionId: active?.sessionId || null, nodeId: active?.currentNodeId || null };
    if ((expected?.sessionId && expected.sessionId !== target.sessionId) ||
        (expected?.nodeId && expected.nodeId !== target.nodeId)) {
      throw new Error('The selected session changed. Retry generation from the current session.');
    }
    return target;
  }

  public async commit(target: GenerationTarget, prompt: string, result: AIResult, params?: Record<string, unknown>) {
    if (!result.success || !result.outputImageUri) {
      throw new Error(result.error || 'Generation did not produce an image.');
    }
    const artifact = await this.assets.saveToCache(result.outputImageUri);
    const active = this.sessions.getActiveSession();
    const shouldActivate = (active?.sessionId || null) === target.sessionId &&
      (active?.currentNodeId || null) === target.nodeId;
    return this.sessions.createSession(artifact, prompt.slice(0, 48), {
      activate: shouldActivate,
      operation: 'generate',
      metrics: result.metrics,
      prompt,
      params
    });
  }
}
