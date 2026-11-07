import { AIResult, OperationType, ParsedIntent } from './types';
import { SessionManager } from './SessionManager';

export interface ArtifactWriter {
  saveToCache(value: string | Buffer, hintExtension?: string): Promise<string>;
}

function withCostProvenance(metrics: AIResult['metrics']): AIResult['metrics'] {
  if (metrics.costStatus) return metrics;
  const model = metrics.model.toLowerCase();
  const runware = model.includes('runware') || model.startsWith('bfl:');
  if (runware) {
    // Historical adapter constants represented tariff estimates, while zero often meant "not reported".
    return metrics.costUsd && metrics.costUsd > 0
      ? { ...metrics, costStatus: 'estimated' }
      : { ...metrics, costUsd: undefined, costStatus: 'unknown' };
  }
  return { ...metrics, costStatus: 'estimated' };
}

/**
 * The only mutation boundary for a completed image operation. Artifact persistence
 * happens before the DAG pointer advances, so a disk failure cannot be displayed
 * as an applied edit.
 */
export class SessionCommitService {
  constructor(private readonly sessions: SessionManager, private readonly assets: ArtifactWriter) {}

  public async commitImageResult(input: {
    sessionId: string;
    parentId: string;
    operation: OperationType;
    intent: Pick<ParsedIntent, 'label'>;
    prompt?: string;
    maskUri?: string;
    params?: Record<string, unknown>;
    signal?: AbortSignal;
    result: AIResult;
  }) {
    if (!input.result.success || !input.result.outputImageUri) {
      throw new Error(input.result.error || 'Operation did not produce an image result.');
    }
    const session = this.sessions.getSession(input.sessionId);
    const parent = session?.nodes[input.parentId];
    if (!session || !parent) throw new Error('The target session or parent node no longer exists.');
    if (input.signal?.aborted) throw new Error('Operation cancelled.');

    const outputPath = await this.assets.saveToCache(input.result.outputImageUri);
    if (input.signal?.aborted) throw new Error('Operation cancelled.');
    const latest = this.sessions.getSession(input.sessionId);
    if (!latest?.nodes[input.parentId]) throw new Error('The target session or parent node no longer exists.');
    const metrics = withCostProvenance(input.result.metrics);
    return this.sessions.addOperationNode(
      input.sessionId,
      input.parentId,
      input.operation,
      input.intent.label || input.operation,
      parent.outputImageUri,
      outputPath,
      metrics,
      {
        prompt: input.prompt, maskUri: input.maskUri, params: input.params,
        textResult: input.result.textResult,
        activateCurrent: latest.currentNodeId === input.parentId
      }
    );
  }
}
