import { SessionManager } from './SessionManager';
import { SessionCommitService } from './SessionCommitService';
import { OperationType } from './types';

export interface CanvasActionTarget {
  sessionId: string;
  parentId: string;
}

const IMAGE_ACTIONS: Record<string, { operation: OperationType; label: string }> = {
  removeBackground: { operation: 'remove_background', label: 'Remove background' },
  upscale: { operation: 'upscale', label: 'Upscale' },
  enhance: { operation: 'enhance', label: 'Enhance' },
  mask: { operation: 'mask', label: 'Extract mask' },
  canny: { operation: 'canny', label: 'Detect edges' },
  edgeDetection: { operation: 'canny', label: 'Detect edges' },
  lineart: { operation: 'lineart', label: 'Extract line art' },
  lineExtraction: { operation: 'lineart', label: 'Extract line art' },
  depth: { operation: 'preprocess', label: 'Depth map' },
  extend: { operation: 'extend', label: 'Extend canvas' },
  recolor: { operation: 'recolor', label: 'Recolor' },
  styleTransfer: { operation: 'style_transfer', label: 'Style transfer' },
  vectorize: { operation: 'vectorize', label: 'Vectorize' },
  inpaint: { operation: 'inpaint', label: 'Inpaint' }
};

/** Pins the button's target before any provider or file operation can yield. */
export class CanvasActionCommitService {
  constructor(private readonly sessions: SessionManager, private readonly commits: SessionCommitService) {}

  public capture(expected?: Partial<CanvasActionTarget>): CanvasActionTarget {
    const session = this.sessions.getActiveSession();
    if (!session || !session.nodes[session.currentNodeId]?.outputImageUri) {
      throw new Error('Load an image into the active session before editing.');
    }
    if ((expected?.sessionId && expected.sessionId !== session.sessionId) ||
        (expected?.parentId && expected.parentId !== session.currentNodeId)) {
      throw new Error('The selected image changed. Retry the edit on the current image.');
    }
    return { sessionId: session.sessionId, parentId: session.currentNodeId };
  }

  public async commit(target: CanvasActionTarget, action: string, outputImageUri: string, options?: Record<string, unknown>, maskUri?: string) {
    const definition = IMAGE_ACTIONS[action];
    if (!definition) throw new Error(`Unsupported image edit: ${action}`);
    const { maskDataUrl: _maskDataUrl, ...params } = options || {};
    const provider = typeof options?.provider === 'string' ? options.provider : undefined;
    const model = typeof options?.model === 'string'
      ? options.model
      : (provider ? `Canvas action (${provider})` : 'Canvas action (provider unspecified)');
    return this.commits.commitImageResult({
      ...target,
      operation: definition.operation,
      intent: { label: definition.label },
      prompt: typeof options?.prompt === 'string' ? options.prompt : undefined,
      maskUri,
      params: { ...params, source: 'canvas_button' },
      result: {
        success: true,
        outputImageUri,
        metrics: { model, latencyMs: 0, costUsd: 0 }
      }
    });
  }

  public recordCaption(target: CanvasActionTarget, caption: string) {
    if (!caption.trim()) throw new Error('Caption is empty.');
    if (!this.sessions.getSession(target.sessionId)?.nodes[target.parentId]) {
      throw new Error('The target session or image no longer exists.');
    }
    return this.sessions.addMessage(target.sessionId, {
      sender: 'assistant', text: caption, nodeId: target.parentId, operation: 'caption'
    });
  }
}
