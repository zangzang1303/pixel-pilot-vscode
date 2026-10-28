/**
 * Versioned, serializable contract shared by extension-host ingress points and webview.
 * Keep this module dependency-free so it can also be consumed by a webview build.
 */
export const PROTOCOL_VERSION = 2 as const;
export const MAX_PROTOCOL_BYTES = 256 * 1024;

export type RunCommand = 'chat' | 'analyze' | 'tool' | 'cancel';

export interface RunRequest {
  version: typeof PROTOCOL_VERSION;
  requestId: string;
  command: RunCommand;
  sessionId?: string;
  nodeId?: string;
  text?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  targetRequestId?: string;
}

export interface ProtocolError {
  code: 'invalid_message' | 'unsupported_version' | 'duplicate_request' | 'cancelled';
  message: string;
  requestId?: string;
}

export type ProtocolParseResult =
  | { ok: true; value: RunRequest }
  | { ok: false; error: ProtocolError };

const validCommands = new Set<RunCommand>(['chat', 'analyze', 'tool', 'cancel']);

export function parseRunRequest(input: unknown): ProtocolParseResult {
  let serialized: string;
  try { serialized = JSON.stringify(input); } catch { serialized = ''; }
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_PROTOCOL_BYTES || !input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: { code: 'invalid_message', message: 'Message must be a bounded object.' } };
  }
  const value = input as Record<string, unknown>;
  const requestId = value.requestId;
  if (value.version !== PROTOCOL_VERSION) {
    return { ok: false, error: { code: 'unsupported_version', message: `Unsupported protocol version: ${String(value.version)}`, requestId: typeof requestId === 'string' ? requestId : undefined } };
  }
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(requestId)) {
    return { ok: false, error: { code: 'invalid_message', message: 'A valid requestId is required.' } };
  }
  if (typeof value.command !== 'string' || !validCommands.has(value.command as RunCommand)) {
    return { ok: false, error: { code: 'invalid_message', message: 'Unknown command.', requestId } };
  }
  if (value.args !== undefined && (value.args === null || typeof value.args !== 'object' || Array.isArray(value.args))) {
    return { ok: false, error: { code: 'invalid_message', message: 'args must be an object.', requestId } };
  }
  if (value.command === 'tool' && (typeof value.toolName !== 'string' || !value.toolName)) {
    return { ok: false, error: { code: 'invalid_message', message: 'toolName is required for tool requests.', requestId } };
  }
  if (value.command === 'cancel' && (typeof value.targetRequestId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value.targetRequestId))) {
    return { ok: false, error: { code: 'invalid_message', message: 'targetRequestId is required for cancellation.', requestId } };
  }
  if ((value.command === 'chat' || value.command === 'analyze') && (typeof value.text !== 'string' || !value.text.trim())) {
    return { ok: false, error: { code: 'invalid_message', message: 'text is required for this request.', requestId } };
  }
  return {
    ok: true,
    value: {
      version: PROTOCOL_VERSION,
      requestId,
      command: value.command as RunCommand,
      sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined,
      nodeId: typeof value.nodeId === 'string' ? value.nodeId : undefined,
      text: typeof value.text === 'string' ? value.text : undefined,
      toolName: typeof value.toolName === 'string' ? value.toolName : undefined,
      args: value.args as Record<string, unknown> | undefined,
      targetRequestId: typeof value.targetRequestId === 'string' ? value.targetRequestId : undefined
    }
  };
}

// ---------------------------------------------------------------------------
// Protocol v2 DTOs and Unions (Section 11 of COPILOT_DEVELOPMENT_PLAN.md)
// ---------------------------------------------------------------------------

export interface Envelope {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  correlationId?: string;
  sessionId?: string;
}

export interface ToolResultView {
  toolName: string;
  status: 'succeeded' | 'failed' | 'no_change';
  outputImageUri?: string;
  previewImageUri?: string;
  summary: string;
  metrics?: {
    model?: string;
    provider?: string;
    latencyMs?: number;
    costUsd?: number;
  };
}

export interface ConfirmationView {
  token: string;
  provider: string;
  purpose: string;
  estimatedCostUsd?: number;
}

export interface SessionView {
  sessionId: string;
  title: string;
  rootNodeId: string;
  currentNodeId: string;
  updatedAt: number;
  nodeCount: number;
}

export interface SessionDelta {
  sessionId: string;
  revision: string;
  addedNodeId?: string;
  updatedCurrentNodeId?: string;
}

export interface CapabilityView {
  id: string;
  name: string;
  provider: string;
  available: boolean;
  unavailableReason?: string;
}

export type ClientCommand =
  | { type: 'client.ready'; lastSequence?: number }
  | { type: 'copilot.submit'; sessionId: string; nodeId: string; revision?: string; text: string }
  | { type: 'tool.execute'; sessionId: string; nodeId: string; toolName: string; args?: Record<string, unknown> }
  | { type: 'run.cancel'; runId: string }
  | { type: 'confirmation.respond'; token: string; approved: boolean }
  | { type: 'session.select_node'; sessionId: string; nodeId: string }
  | { type: 'session.sync'; sessionId: string; afterSequence?: number };

export type ClientMessage = Envelope & ClientCommand;

export type HostEvent =
  | { type: 'request.accepted'; runId?: string }
  | { type: 'request.rejected'; error: ProtocolError }
  | { type: 'run.status'; runId: string; status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'; summary: string }
  | { type: 'confirmation.required'; confirmation: ConfirmationView }
  | { type: 'step.progress'; runId: string; stage: string; percentage?: number }
  | { type: 'tool.result'; runId: string; result: ToolResultView }
  | { type: 'run.completed'; runId: string; outcome: 'succeeded' | 'partial' | 'no_change' }
  | { type: 'run.failed'; runId: string; error: ProtocolError }
  | { type: 'run.cancelled'; runId: string }
  | { type: 'session.snapshot'; session: SessionView }
  | { type: 'session.delta'; delta: SessionDelta }
  | { type: 'capabilities.updated'; catalog: CapabilityView[] };

export type HostMessage = Envelope & { eventId: string; sequence: number } & HostEvent;

export function parseClientMessage(raw: unknown): { ok: true; value: ClientMessage } | { ok: false; error: ProtocolError } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: { code: 'invalid_message', message: 'Client message must be an object.' } };
  }
  const msg = raw as Record<string, unknown>;
  if (msg.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, error: { code: 'unsupported_version', message: `Unsupported protocol version: ${String(msg.protocolVersion)}` } };
  }
  if (typeof msg.requestId !== 'string' || !msg.requestId.trim()) {
    return { ok: false, error: { code: 'invalid_message', message: 'requestId is required.' } };
  }
  if (typeof msg.type !== 'string' || !msg.type.trim()) {
    return { ok: false, error: { code: 'invalid_message', message: 'type is required.' } };
  }
  return { ok: true, value: raw as ClientMessage };
}
