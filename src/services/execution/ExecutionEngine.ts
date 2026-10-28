import { CopilotError, isRetryableError } from './errors';

export interface ExecutionOptions {
  requestId: string;
  toolName?: string;
  timeoutMs?: number;
  maxRetries?: number;
  parentSignal?: AbortSignal;
}

export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface RunRecord {
  requestId: string;
  toolName?: string;
  status: RunStatus;
  startedAt: number;
  finishedAt?: number;
  attempts: number;
  error?: CopilotError;
}

/**
 * ExecutionEngine (B14)
 * Manages run lifecycle, AbortSignals, timeout deadlines, and bounded retries.
 * Enforces late-result quarantine when cancelled.
 */
export class ExecutionEngine {
  private activeRuns = new Map<string, {
    record: RunRecord;
    controller: AbortController;
  }>();

  /**
   * Executes a task with deadline, cancellation, and retry policies.
   */
  public async execute<T>(
    options: ExecutionOptions,
    task: (signal: AbortSignal, attempt: number) => Promise<T>
  ): Promise<T> {
    const { requestId, toolName, timeoutMs = 60000, maxRetries = 2, parentSignal } = options;

    if (this.activeRuns.has(requestId)) {
      throw new CopilotError({
        code: 'invalid_input',
        message: `Run with requestId '${requestId}' is already in progress.`,
        requestId,
        toolName
      });
    }

    const controller = new AbortController();
    const record: RunRecord = {
      requestId,
      toolName,
      status: 'pending',
      startedAt: Date.now(),
      attempts: 0
    };

    // Forward parent cancellation if provided
    let parentCleanup: (() => void) | undefined;
    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort();
      } else {
        const onParentAbort = () => controller.abort();
        parentSignal.addEventListener('abort', onParentAbort);
        parentCleanup = () => parentSignal.removeEventListener('abort', onParentAbort);
      }
    }

    this.activeRuns.set(requestId, { record, controller });

    let timeoutTimer: NodeJS.Timeout | undefined;
    if (timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        controller.abort();
      }, timeoutMs);
    }

    record.status = 'running';

    try {
      let lastError: any;
      const totalAllowedAttempts = Math.max(1, 1 + maxRetries);

      for (let attempt = 1; attempt <= totalAllowedAttempts; attempt++) {
        record.attempts = attempt;

        if (controller.signal.aborted) {
          record.status = 'cancelled';
          throw CopilotError.createCancelledError(toolName, requestId);
        }

        try {
          const result = await task(controller.signal, attempt);

          // Check if abort happened during task execution
          if (controller.signal.aborted) {
            record.status = 'cancelled';
            throw CopilotError.createCancelledError(toolName, requestId);
          }

          record.status = 'succeeded';
          record.finishedAt = Date.now();
          return result;
        } catch (err: any) {
          lastError = err;

          if (controller.signal.aborted) {
            record.status = 'cancelled';
            throw CopilotError.createCancelledError(toolName, requestId);
          }

          const canRetry = attempt < totalAllowedAttempts && isRetryableError(err);
          if (!canRetry) {
            break;
          }
        }
      }

      // If we reached here without returning, normalize error
      record.status = 'failed';
      record.finishedAt = Date.now();

      if (lastError instanceof CopilotError) {
        record.error = lastError;
        throw lastError;
      }

      const copilotErr = new CopilotError({
        code: 'execution_failed',
        message: lastError?.message || String(lastError),
        requestId,
        toolName
      });
      record.error = copilotErr;
      throw copilotErr;
    } finally {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      if (parentCleanup) {
        parentCleanup();
      }
      this.activeRuns.delete(requestId);
    }
  }

  /**
   * Cancels an active run by requestId.
   * Returns true if run was active and aborted, false otherwise.
   */
  public cancel(requestId: string): boolean {
    const active = this.activeRuns.get(requestId);
    if (!active) {
      return false;
    }
    active.record.status = 'cancelled';
    active.controller.abort();
    return true;
  }

  /**
   * Returns true if a run is currently active.
   */
  public isRunning(requestId: string): boolean {
    return this.activeRuns.has(requestId);
  }

  /**
   * Gets current record for a running task.
   */
  public getRecord(requestId: string): RunRecord | undefined {
    return this.activeRuns.get(requestId)?.record;
  }
}
