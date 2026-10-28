// SessionManager.ts - Core Engine for Context-Aware Visual Directed Acyclic Graph (DAG) & Multi-Session Store
import fs from 'fs';
import path from 'path';
import { ImageSession, HistoryNode, OperationType, NodeMetrics, ChatMessage } from './types';

export class SessionManager {
  private static readonly STORE_SCHEMA_VERSION = 2;
  private sessions: Map<string, ImageSession> = new Map();
  private activeSessionId: string | null = null;
  private storageFilePath: string | null = null;
  private legacyBackupPath: string | null = null;
  private legacyBackupCreated = false;

  constructor(storageDir?: string) {
    if (storageDir) {
      this.storageFilePath = path.join(storageDir, '.pixelpilot_sessions.json');
      this.loadFromDisk();
    }
  }

  private saveToDisk(): void {
    if (!this.storageFilePath) return;
    const dir = path.dirname(this.storageFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = {
      schemaVersion: SessionManager.STORE_SCHEMA_VERSION,
      activeSessionId: this.activeSessionId,
      sessions: Array.from(this.sessions.values())
    };
    const temporaryPath = `${this.storageFilePath}.tmp`;
    try {
      if (this.legacyBackupPath && !this.legacyBackupCreated) {
        fs.copyFileSync(this.storageFilePath, this.legacyBackupPath, fs.constants.COPYFILE_EXCL);
        this.legacyBackupCreated = true;
      }
      fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(temporaryPath, this.storageFilePath);
      this.legacyBackupPath = null;
    } catch (e) {
      try { fs.unlinkSync(temporaryPath); } catch { /* Keep the original store intact. */ }
      throw e;
    }
  }

  /** A failed store write must not leave a new node or active pointer in memory. */
  private persistMutation<T>(mutation: () => T): T {
    if (!this.storageFilePath) return mutation();
    const before = new Map(Array.from(this.sessions, ([id, session]) =>
      [id, JSON.parse(JSON.stringify(session)) as ImageSession] as const));
    const activeBefore = this.activeSessionId;
    try {
      const result = mutation();
      this.saveToDisk();
      return result;
    } catch (error) {
      this.sessions = before;
      this.activeSessionId = activeBefore;
      throw error;
    }
  }

  private loadFromDisk(): void {
    if (!this.storageFilePath || !fs.existsSync(this.storageFilePath)) return;
    try {
      const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
      const stored = JSON.parse(raw) as ImageSession[] | { schemaVersion?: number; activeSessionId: string | null; sessions: ImageSession[] };
      const list = Array.isArray(stored) ? stored : stored.sessions;
      if (!Array.isArray(list)) throw new Error('Invalid session store');
      for (const s of list) {
        if (s && typeof s.sessionId === 'string' && s.nodes && typeof s.rootNodeId === 'string') {
          this.validateAndRepairSession(s);
          s.messages = Array.isArray(s.messages) ? s.messages : [];
          s.updatedAt = Number.isFinite(s.updatedAt) ? s.updatedAt : Date.now();
          this.sessions.set(s.sessionId, s);
        }
      }
      const validSessions = Array.from(this.sessions.values());
      if (validSessions.length > 0) this.activeSessionId = !Array.isArray(stored) && stored.activeSessionId && this.sessions.has(stored.activeSessionId)
        ? stored.activeSessionId : validSessions[0].sessionId;
      if (Array.isArray(stored) || stored.schemaVersion !== SessionManager.STORE_SCHEMA_VERSION) {
        this.legacyBackupPath = `${this.storageFilePath}.v1.bak.${Date.now()}`;
      }
    } catch {
      console.warn('Pixel Pilot session store was malformed and has been quarantined.');
      try {
        const quarantinePath = `${this.storageFilePath}.corrupt.${Date.now()}`;
        fs.renameSync(this.storageFilePath, quarantinePath);
      } catch {
        // Keep the original file if it cannot be moved; do not overwrite it.
      }
    }
  }

  /**
   * Initializes a new session with an original root image node and welcome message
   */
  public createSession(initialImageUri: string, title = 'Phiên làm việc mới', options?: {
    activate?: boolean;
    operation?: 'original' | 'generate';
    metrics?: NodeMetrics;
    prompt?: string;
    params?: Record<string, unknown>;
  }): ImageSession {
    const sessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const rootNodeId = 'node_0_root';

    const rootNode: HistoryNode = {
      nodeId: rootNodeId,
      parentId: null,
      childrenIds: [],
      timestamp: Date.now(),
      operation: options?.operation || 'original',
      operationLabel: options?.operation === 'generate' ? 'Generated image' : 'Ảnh gốc (Original)',
      inputImageUri: options?.operation === 'generate' ? '' : initialImageUri,
      outputImageUri: initialImageUri,
      prompt: options?.prompt,
      params: options?.params,
      metrics: options?.metrics || {
        model: 'Input Source',
        latencyMs: 0,
        costUsd: 0
      }
    };

    const initialMessage: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'assistant',
      timestamp: Date.now(),
      text: options?.operation === 'generate'
        ? `Đã tạo ảnh từ prompt "${title}".`
        : initialImageUri
        ? `Đã nạp ảnh "${title}". Bạn muốn thực hiện tác vụ gì? Hãy gõ câu lệnh hoặc chọn một trong các thao tác bên dưới.`
        : 'Chào mừng bạn đến với AI Image Studio! Hãy nạp một ảnh từ máy tính hoặc kéo thả ảnh vào để bắt đầu.',
      nodeId: rootNodeId,
      operation: options?.operation || 'original',
      outputImageUri: initialImageUri
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

    return this.persistMutation(() => {
      this.sessions.set(sessionId, session);
      if (options?.activate !== false) this.activeSessionId = sessionId;
      return session;
    });
  }

  public setNodeExportPath(sessionId: string, nodeId: string, exportPath: string): void {
    if (!/^\.\/assets\/[A-Za-z0-9_.\/-]+$/.test(exportPath) || exportPath.includes('..')) {
      throw new Error('Invalid workspace export path.');
    }
    const node = this.sessions.get(sessionId)?.nodes[nodeId];
    if (!node) throw new Error('The target image no longer exists.');
    this.persistMutation(() => {
      node.params = { ...node.params, exportPath };
    });
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
      activateCurrent?: boolean;
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

    return this.persistMutation(() => {
      parentNode.childrenIds.push(nodeId);
      session.nodes[nodeId] = newNode;
      if (options?.activateCurrent !== false) session.currentNodeId = nodeId;
      session.updatedAt = Date.now();
      session.messages.push({
        id: 'msg_' + Date.now(), sender: 'assistant', timestamp: Date.now(),
        text: `✨ Đã hoàn tất "${operationLabel}". Kết quả đã hiển thị trên khung hình phía trên. Bạn có thể so sánh với ảnh gốc hoặc tải về máy.`,
        nodeId, operation, outputImageUri, metrics
      });
      return newNode;
    });
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

    return this.persistMutation(() => {
      session.messages.push(fullMessage);
      session.updatedAt = Date.now();
      return fullMessage;
    });
  }

  public attachImage(sessionId: string, imageUri: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !imageUri) return;
    const current = session.nodes[session.currentNodeId];
    if (current.outputImageUri === imageUri) return;
    this.persistMutation(() => {
      if (!current.outputImageUri && current.nodeId === session.rootNodeId) {
        current.inputImageUri = imageUri;
        current.outputImageUri = imageUri;
      } else {
        const nodeId = `node_${Object.keys(session.nodes).length}_attached`;
        current.childrenIds.push(nodeId);
        session.nodes[nodeId] = {
          nodeId, parentId: current.nodeId, childrenIds: [], timestamp: Date.now(),
          operation: 'original', operationLabel: 'Ảnh đang mở',
          inputImageUri: current.outputImageUri, outputImageUri: imageUri,
          metrics: { model: 'Canvas', latencyMs: 0, costUsd: 0 }
        };
        session.currentNodeId = nodeId;
      }
      session.updatedAt = Date.now();
    });
  }

  /**
   * Rollbacks or jumps to any node in the DAG (Non-destructive branching)
   */
  public rollbackToNode(sessionId: string, targetNodeId: string): HistoryNode {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (!session.nodes[targetNodeId]) throw new Error(`Target node ${targetNodeId} not found`);

    return this.persistMutation(() => {
      session.currentNodeId = targetNodeId;
      session.updatedAt = Date.now();
      session.messages.push({
        id: 'msg_' + Date.now(), sender: 'system', timestamp: Date.now(),
        text: `↩️ Đã chuyển trạng thái (Rollback) về: "${session.nodes[targetNodeId].operationLabel}"`,
        nodeId: targetNodeId
      });
      return session.nodes[targetNodeId];
    });
  }

  public renameSession(sessionId: string, newTitle: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.persistMutation(() => {
        session.title = newTitle;
        session.updatedAt = Date.now();
      });
    }
  }

  public deleteSession(sessionId: string): void {
    this.persistMutation(() => {
      this.sessions.delete(sessionId);
      if (this.activeSessionId === sessionId) {
        const remaining = Array.from(this.sessions.keys());
        this.activeSessionId = remaining.length > 0 ? remaining[0] : null;
      }
    });
  }

  public getActiveSession(): ImageSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  public setActiveSession(sessionId: string): ImageSession | null {
    if (this.sessions.has(sessionId)) {
      return this.persistMutation(() => {
        this.activeSessionId = sessionId;
        return this.sessions.get(sessionId) || null;
      });
    }
    return null;
  }

  public getSession(sessionId: string): ImageSession | null {
    return this.sessions.get(sessionId) || null;
  }

  public getAllSessions(): ImageSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Absolute artifact paths referenced by retained history. */
  public getReferencedArtifactPaths(): Set<string> {
    const referenced = new Set<string>();
    const collect = (value: string | undefined) => {
      if (value && path.isAbsolute(value)) referenced.add(path.resolve(value));
    };
    for (const session of this.sessions.values()) {
      for (const node of Object.values(session.nodes)) {
        collect(node.inputImageUri);
        collect(node.outputImageUri);
        collect(node.maskUri);
      }
      for (const message of session.messages) collect(message.outputImageUri);
    }
    return referenced;
  }

  public exportDAG(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    return JSON.stringify(session, null, 2);
  }

  public importDAG(jsonStr: string): ImageSession {
    const session = JSON.parse(jsonStr) as ImageSession;
    this.validateAndRepairSession(session);
    if (!session.currentNodeId || !session.nodes[session.currentNodeId]) {
      session.currentNodeId = session.rootNodeId;
    }
    if (!session.messages) {
      session.messages = [];
    }
    return this.persistMutation(() => {
      this.sessions.set(session.sessionId, session);
      this.activeSessionId = session.sessionId;
      return session;
    });
  }

  /** Validate parent links and rebuild child links instead of trusting persisted input. */
  private validateAndRepairSession(session: ImageSession): void {
    if (!session.sessionId || !session.nodes || !session.rootNodeId || !session.nodes[session.rootNodeId]) {
      throw new Error('Invalid Session DAG format');
    }
    const nodes = session.nodes;
    if (nodes[session.rootNodeId].parentId !== null) {
      throw new Error('Session root must not have a parent');
    }
    for (const [nodeId, node] of Object.entries(nodes)) {
      if (!node || node.nodeId !== nodeId) throw new Error('Invalid node record');
      if (nodeId !== session.rootNodeId && (!node.parentId || !nodes[node.parentId])) {
        throw new Error(`Node ${nodeId} has an invalid parent`);
      }
      node.childrenIds = [];
    }
    for (const [nodeId, node] of Object.entries(nodes)) {
      if (node.parentId) nodes[node.parentId].childrenIds.push(nodeId);
    }
    for (const startId of Object.keys(nodes)) {
      const seen = new Set<string>();
      let cursor: HistoryNode | undefined = nodes[startId];
      while (cursor) {
        if (seen.has(cursor.nodeId)) throw new Error('Session graph contains a cycle');
        seen.add(cursor.nodeId);
        cursor = cursor.parentId ? nodes[cursor.parentId] : undefined;
      }
    }
  }
}
