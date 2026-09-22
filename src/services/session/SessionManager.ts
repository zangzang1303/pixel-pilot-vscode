// SessionManager.ts - Core Engine for Context-Aware Visual Directed Acyclic Graph (DAG) & Multi-Session Store
import fs from 'fs';
import path from 'path';
import { ImageSession, HistoryNode, OperationType, NodeMetrics, ChatMessage } from './types';

export class SessionManager {
  private sessions: Map<string, ImageSession> = new Map();
  private activeSessionId: string | null = null;
  private storageFilePath: string | null = null;

  constructor(storageDir?: string) {
    if (storageDir) {
      this.storageFilePath = path.join(storageDir, '.pixelpilot_sessions.json');
      this.loadFromDisk();
    }
  }

  private saveToDisk(): void {
    if (!this.storageFilePath) return;
    try {
      const data = Array.from(this.sessions.values());
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save sessions to disk:', e);
    }
  }

  private loadFromDisk(): void {
    if (!this.storageFilePath || !fs.existsSync(this.storageFilePath)) return;
    try {
      const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
      const list = JSON.parse(raw) as ImageSession[];
      for (const s of list) {
        this.sessions.set(s.sessionId, s);
      }
      if (list.length > 0) {
        this.activeSessionId = list[0].sessionId;
      }
    } catch (e) {
      console.error('Failed to load sessions from disk:', e);
    }
  }

  /**
   * Initializes a new session with an original root image node and welcome message
   */
  public createSession(initialImageUri: string, title = 'Phiên làm việc mới'): ImageSession {
    const sessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const rootNodeId = 'node_0_root';

    const rootNode: HistoryNode = {
      nodeId: rootNodeId,
      parentId: null,
      childrenIds: [],
      timestamp: Date.now(),
      operation: 'original',
      operationLabel: 'Ảnh gốc (Original)',
      inputImageUri: initialImageUri,
      outputImageUri: initialImageUri,
      metrics: {
        model: 'Input Source',
        latencyMs: 0,
        costUsd: 0
      }
    };

    const initialMessage: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'assistant',
      timestamp: Date.now(),
      text: initialImageUri
        ? `Đã nạp ảnh "${title}". Bạn muốn thực hiện tác vụ gì? Hãy gõ câu lệnh hoặc chọn một trong các thao tác bên dưới.`
        : 'Chào mừng bạn đến với Pixel Pilot AI Studio! Hãy nạp một ảnh từ Workspace hoặc kéo thả ảnh vào để bắt đầu.',
      nodeId: rootNodeId
    };

    const session: ImageSession = {
      sessionId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      rootNodeId,
      currentNodeId: rootNodeId,
      nodes: {
        [rootNodeId]: rootNode
      },
      messages: [initialMessage]
    };

    this.sessions.set(sessionId, session);
    this.activeSessionId = sessionId;
    this.saveToDisk();
    return session;
  }

  /**
   * Adds an operation result as a child node in the DAG, supporting branching
   */
  public addOperationNode(
    sessionId: string,
    parentId: string,
    operation: OperationType,
    operationLabel: string,
    inputImageUri: string,
    outputImageUri: string,
    metrics: NodeMetrics,
    options?: {
      maskUri?: string;
      prompt?: string;
      params?: Record<string, any>;
      textResult?: string;
    }
  ): HistoryNode {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const parentNode = session.nodes[parentId];
    if (!parentNode) {
      throw new Error(`Parent node ${parentId} not found in session DAG`);
    }

    const nodeIndex = Object.keys(session.nodes).length;
    const nodeId = `node_${nodeIndex}_${operation}`;

    const newNode: HistoryNode = {
      nodeId,
      parentId,
      childrenIds: [],
      timestamp: Date.now(),
      operation,
      operationLabel,
      inputImageUri,
      outputImageUri,
      maskUri: options?.maskUri,
      prompt: options?.prompt,
      params: options?.params,
      textResult: options?.textResult,
      metrics
    };

    // Update parent's children array to enable branch traversal
    parentNode.childrenIds.push(nodeId);

    // Save into session DAG
    session.nodes[nodeId] = newNode;
    session.currentNodeId = nodeId;
    session.updatedAt = Date.now();

    // Auto add assistant message to conversation flow
    session.messages.push({
      id: 'msg_' + Date.now(),
      sender: 'assistant',
      timestamp: Date.now(),
      text: `Hoàn tất "${operationLabel}" trong ${metrics.latencyMs}ms (${metrics.model}).`,
      nodeId,
      operation,
      outputImageUri,
      metrics
    });

    this.saveToDisk();
    return newNode;
  }

  /**
   * Adds a chat message to session conversation
   */
  public addMessage(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const fullMessage: ChatMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      timestamp: Date.now(),
      ...message
    };

    session.messages.push(fullMessage);
    session.updatedAt = Date.now();
    this.saveToDisk();
    return fullMessage;
  }

  /**
   * Rollbacks or jumps to any node in the DAG (Non-destructive branching)
   */
  public rollbackToNode(sessionId: string, targetNodeId: string): HistoryNode {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (!session.nodes[targetNodeId]) throw new Error(`Target node ${targetNodeId} not found`);

    session.currentNodeId = targetNodeId;
    session.updatedAt = Date.now();

    session.messages.push({
      id: 'msg_' + Date.now(),
      sender: 'system',
      timestamp: Date.now(),
      text: `↩️ Đã chuyển trạng thái (Rollback) về: "${session.nodes[targetNodeId].operationLabel}"`,
      nodeId: targetNodeId
    });

    this.saveToDisk();
    return session.nodes[targetNodeId];
  }

  public renameSession(sessionId: string, newTitle: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.title = newTitle;
      session.updatedAt = Date.now();
      this.saveToDisk();
    }
  }

  public deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      const remaining = Array.from(this.sessions.keys());
      this.activeSessionId = remaining.length > 0 ? remaining[0] : null;
    }
    this.saveToDisk();
  }

  public getActiveSession(): ImageSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  public setActiveSession(sessionId: string): ImageSession | null {
    if (this.sessions.has(sessionId)) {
      this.activeSessionId = sessionId;
      return this.sessions.get(sessionId) || null;
    }
    return null;
  }

  public getSession(sessionId: string): ImageSession | null {
    return this.sessions.get(sessionId) || null;
  }

  public getAllSessions(): ImageSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public exportDAG(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    return JSON.stringify(session, null, 2);
  }

  public importDAG(jsonStr: string): ImageSession {
    const session = JSON.parse(jsonStr) as ImageSession;
    if (!session.sessionId || !session.nodes || !session.rootNodeId) {
      throw new Error('Invalid Session DAG format');
    }
    if (!session.messages) {
      session.messages = [];
    }
    this.sessions.set(session.sessionId, session);
    this.activeSessionId = session.sessionId;
    this.saveToDisk();
    return session;
  }
}
