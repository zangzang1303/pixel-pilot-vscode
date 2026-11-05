import { CopilotOrchestrator } from './CopilotOrchestrator';
import { ExecutionEngine } from '../execution/ExecutionEngine';
import { ArtifactStore } from '../storage/ArtifactStore';
import { SessionManager } from '../session/SessionManager';
import { SessionCommitService } from '../session/SessionCommitService';
import { OperationType, AIResult } from '../session/types';
import { decodeImageInput } from '../../utils/imageData';
import { createHash } from 'crypto';

const operations: Record<string, OperationType> = {
  'image.remove_background': 'remove_background',
  'image.recolor': 'recolor',
  'image.inpaint': 'inpaint',
  'image.generate': 'generate'
};

/** Executes protocol v2 priority tools against a pinned DAG node. */
export class PriorityToolRunService {
  constructor(
    private readonly orchestrator: CopilotOrchestrator,
    private readonly engine: ExecutionEngine,
    private readonly artifacts: ArtifactStore,
    private readonly sessions: SessionManager,
    private readonly commits: SessionCommitService
  ) {}

  public cancel(requestId: string): boolean {
    return this.engine.cancel(requestId);
  }

  public async run(input: {
    requestId: string;
    sessionId: string;
    parentId: string;
    toolName: string;
    args: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<{ nodeId?: string; analysis?: unknown; artifactId?: string }> {
    const startedAt = Date.now();
    const { requestId, sessionId, parentId, toolName } = input;
    if (toolName !== 'image.analyze' && !(toolName in operations)) {
      throw new Error(`Priority tool ${toolName} is not supported.`);
    }
    const session = this.sessions.getSession(sessionId);
    const parent = session?.nodes[parentId];
    if (!parent) throw new Error('Pinned context node no longer exists.');
    const pinnedImage = parent.outputImageUri || parent.inputImageUri;
    const args = { ...input.args };
    if (toolName !== 'image.generate') {
      if (!pinnedImage) throw new Error('The pinned node has no image.');
      if (args.imageId !== undefined && args.imageId !== pinnedImage) {
        throw new Error('Tool imageId does not match the pinned node.');
      }
      args.imageId = pinnedImage;
    }
    if (toolName === 'image.inpaint') {
      if (!parent.maskUri || args.maskId !== parent.maskUri) {
        throw new Error('Inpaint requires the mask attached to the pinned node.');
      }
    }
    const call = this.orchestrator.validateTool(toolName, args);
    const argsFingerprint = createHash('sha256').update(JSON.stringify({ parentId, toolName, args: call.args })).digest('hex');
    const prior = Object.values(session.nodes).find(node => node.params?.toolRunId === requestId);
    if (prior) {
      if (prior.parentId !== parentId || prior.params?.argsFingerprint !== argsFingerprint ||
          prior.params?.toolName !== toolName || typeof prior.params?.artifactId !== 'string') {
        throw new Error('Request ID was already used for a different tool operation.');
      }
      return { nodeId: prior.nodeId, artifactId: prior.params.artifactId };
    }

    return this.engine.execute({ requestId, toolName, maxRetries: 0, parentSignal: input.signal }, async (signal) => {
      const output = await this.orchestrator.executeTool(toolName, call.args, {
        signal,
        resolveImageBuffer: async (idOrUri: string) => {
          if (idOrUri.startsWith('art_')) {
            const artifact = await this.artifacts.get(idOrUri);
            if (!artifact) throw new Error('Referenced artifact is missing.');
            return artifact.buffer;
          }
          return decodeImageInput(idOrUri).buffer;
        },
        storeArtifact: async (buffer: Buffer, mime: string, kind: 'image' | 'mask') => {
          if (signal.aborted) throw new Error('Operation cancelled.');
          const record = await this.artifacts.store(buffer, mime, {
            kind,
            parentArtifactId: pinnedImage.startsWith('art_') ? pinnedImage : undefined,
            provenance: { mode: toolName === 'image.generate' || args.quality === 'model' ? 'model' : 'basic', toolRunId: requestId }
          });
          return record.id;
        }
      });
      if (signal.aborted) throw new Error('Operation cancelled.');
      if (toolName === 'image.analyze') {
        this.sessions.addMessage(sessionId, {
          sender: 'assistant', nodeId: parentId, replyType: 'tool_call', toolName,
          text: JSON.stringify(output)
        });
        return { analysis: output };
      }
      const artifactId = output?.artifactId;
      if (typeof artifactId !== 'string') throw new Error('Tool did not return an artifact ID.');
      const artifact = await this.artifacts.get(artifactId);
      if (!artifact) throw new Error('Tool artifact is missing from storage.');
      if (signal.aborted) throw new Error('Operation cancelled.');
      const result: AIResult = {
        success: true,
        outputImageUri: this.artifacts.getAbsolutePath(artifactId),
        metrics: {
          model: toolName,
          latencyMs: Date.now() - startedAt,
          costUsd: toolName === 'image.generate' || args.quality === 'model' ? undefined : 0,
          costStatus: toolName === 'image.generate' || args.quality === 'model' ? 'unknown' : 'estimated',
          width: artifact.record.width,
          height: artifact.record.height
        }
      };
      const node = await this.commits.commitImageResult({
        sessionId, parentId, operation: operations[toolName], intent: { label: call.intent.label },
        prompt: typeof args.prompt === 'string' ? args.prompt : undefined,
        maskUri: typeof args.maskId === 'string' ? args.maskId : undefined,
        params: { artifactId, toolName, toolRunId: requestId, argsFingerprint }, signal, result
      });
      return { nodeId: node.nodeId, artifactId };
    });
  }
}
