import * as crypto from 'crypto';
import { AgentContext } from '../ai/VisionAgentOrchestrator';
import { ImageSession } from '../session/types';

export interface CopilotContextSnapshot extends AgentContext {
  sessionId: string;
  nodeId: string;
  revision: string;
  ancestry: readonly string[];
  maskUri?: string;
  maskValidForImage?: boolean;
  workspaceScope?: string;
}

/** Creates a bounded, immutable context from a pinned session/node. */
export class ContextBuilder {
  public build(
    session: ImageSession,
    nodeId = session.currentNodeId,
    options?: { maskUri?: string; workspaceScope?: string }
  ): CopilotContextSnapshot {
    const node = session.nodes[nodeId];
    if (!node) throw new Error(`Context node ${nodeId} does not exist in session ${session.sessionId}.`);

    const ancestry: string[] = [];
    let cursor = node;
    while (cursor && ancestry.length < 32) {
      ancestry.push(cursor.nodeId);
      cursor = cursor.parentId ? session.nodes[cursor.parentId] : undefined as never;
    }
    const imageUri = node.outputImageUri || node.inputImageUri;
    const revision = this.computeRevision(session.sessionId, node.nodeId, node.timestamp, imageUri);
    const messages = session.messages.slice(-16).map(message => ({ ...message }));

    const maskUri = options?.maskUri || node.maskUri;
    const maskValidForImage = Boolean(maskUri && (node.maskUri === maskUri || !node.parentId));

    return Object.freeze({
      sessionId: session.sessionId,
      nodeId: node.nodeId,
      revision,
      ancestry: Object.freeze(ancestry),
      currentNodeId: node.nodeId,
      currentImageUri: imageUri,
      maskUri,
      maskValidForImage,
      workspaceScope: options?.workspaceScope,
      imageTitle: session.title,
      previousOperations: ancestry.map(id => session.nodes[id].operation),
      conversationHistory: Object.freeze(messages)
    });
  }

  public computeRevision(sessionId: string, nodeId: string, timestamp: number, imageUri: string): string {
    return crypto.createHash('sha256')
      .update(`${sessionId}:${nodeId}:${timestamp}:${imageUri}`)
      .digest('hex').slice(0, 16);
  }

  public isStaleRevision(session: ImageSession, nodeId: string, expectedRevision: string): boolean {
    const node = session.nodes[nodeId];
    if (!node) return true;
    const imageUri = node.outputImageUri || node.inputImageUri;
    const current = this.computeRevision(session.sessionId, node.nodeId, node.timestamp, imageUri);
    return current !== expectedRevision;
  }
}
