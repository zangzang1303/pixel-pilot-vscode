/**
 * Versioned, serializable contract shared by extension-host ingress points.
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
      args: value.args as Record<string, unknown> | undefined
      ,targetRequestId: typeof value.targetRequestId === 'string' ? value.targetRequestId : undefined
    }
  };
}
