import * as crypto from 'crypto';
import { AgentContext } from '../ai/VisionAgentOrchestrator';
import { ImageSession } from '../session/types';

export interface CopilotContextSnapshot extends AgentContext {
  sessionId: string;
  nodeId: string;
  revision: string;
  ancestry: readonly string[];
}

/** Creates a bounded, immutable context from a pinned session/node. */
export class ContextBuilder {
  public build(session: ImageSession, nodeId = session.currentNodeId): CopilotContextSnapshot {
    const node = session.nodes[nodeId];
    if (!node) throw new Error(`Context node ${nodeId} does not exist in session ${session.sessionId}.`);

    const ancestry: string[] = [];
    let cursor = node;
    while (cursor && ancestry.length < 32) {
      ancestry.push(cursor.nodeId);
      cursor = cursor.parentId ? session.nodes[cursor.parentId] : undefined as never;
    }
    const imageUri = node.outputImageUri || node.inputImageUri;
    const revision = crypto.createHash('sha256')
      .update(`${session.sessionId}:${node.nodeId}:${node.timestamp}:${imageUri}`)
      .digest('hex').slice(0, 16);
    const messages = session.messages.slice(-16).map(message => ({ ...message }));

    return Object.freeze({
      sessionId: session.sessionId,
      nodeId: node.nodeId,
      revision,
      ancestry: Object.freeze(ancestry),
      currentNodeId: node.nodeId,
      currentImageUri: imageUri,
      imageTitle: session.title,
      previousOperations: ancestry.map(id => session.nodes[id].operation),
      conversationHistory: Object.freeze(messages)
    });
  }
}
