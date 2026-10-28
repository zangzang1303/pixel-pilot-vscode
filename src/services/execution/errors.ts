export type CopilotErrorCode =
  | 'unsupported_provider'
  | 'timeout'
  | 'cancelled'
  | 'network_error'
  | 'invalid_input'
  | 'quota_exceeded'
  | 'execution_failed'
  | 'precondition_failed'
  | 'unavailable'
  | 'concurrency_limit';

export interface CopilotErrorDetails {
  code: CopilotErrorCode;
  message: string;
  requestId?: string;
  toolName?: string;
  provider?: string;
  retryable?: boolean;
  details?: unknown;
}

export class CopilotError extends Error {
  public readonly code: CopilotErrorCode;
  public readonly requestId?: string;
  public readonly toolName?: string;
  public readonly provider?: string;
  public readonly retryable: boolean;
  public readonly details?: unknown;

  constructor(options: CopilotErrorDetails) {
    super(options.message);
    this.name = 'CopilotError';
    this.code = options.code;
    this.requestId = options.requestId;
    this.toolName = options.toolName;
    this.provider = options.provider;
    this.retryable = options.retryable ?? CopilotError.isDefaultRetryable(options.code);
    this.details = options.details;
    Object.setPrototypeOf(this, CopilotError.prototype);
  }

  public static isDefaultRetryable(code: CopilotErrorCode): boolean {
    switch (code) {
      case 'network_error':
      case 'quota_exceeded':
      case 'concurrency_limit':
        return true;
      case 'invalid_input':
      case 'precondition_failed':
      case 'cancelled':
      case 'unsupported_provider':
      case 'timeout':
      case 'execution_failed':
      case 'unavailable':
      default:
        return false;
    }
  }

  public static createTimeoutError(timeoutMs: number, toolName?: string, requestId?: string): CopilotError {
    return new CopilotError({
      code: 'timeout',
      message: `Execution timed out after ${timeoutMs}ms.`,
      toolName,
      requestId,
      retryable: false
    });
  }

  public static createCancelledError(toolName?: string, requestId?: string): CopilotError {
    return new CopilotError({
      code: 'cancelled',
      message: 'Operation was cancelled by user or deadline.',
      toolName,
      requestId,
      retryable: false
    });
  }

  public static createInvalidInputError(message: string, toolName?: string, requestId?: string): CopilotError {
    return new CopilotError({
      code: 'invalid_input',
      message,
      toolName,
      requestId,
      retryable: false
    });
  }
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof CopilotError) {
    return err.retryable;
  }
  return false;
}
