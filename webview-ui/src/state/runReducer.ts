export type RunPhase =
  | 'idle'
  | 'queuing'
  | 'planning'
  | 'authorizing'
  | 'executing'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface RunMetrics {
  latencyMs?: number;
  costUsd?: number;
  model?: string;
}

export interface RunState {
  phase: RunPhase;
  requestId?: string;
  toolName?: string;
  provider?: string;
  stage?: string;
  fraction?: number;
  startedAt?: number;
  label?: string;
  error?: string;
  metrics?: RunMetrics;
}

export type RunAction =
  | { type: 'start'; requestId: string; label: string; toolName?: string; provider?: string }
  | { type: 'progress'; requestId?: string; stage: string; fraction?: number; provider?: string }
  | { type: 'succeed'; requestId?: string; metrics?: RunMetrics }
  | { type: 'fail'; requestId?: string; error: string }
  | { type: 'cancel'; requestId?: string }
  | { type: 'reset' };

export const initialRunState: RunState = { phase: 'idle' };

/**
 * A terminal event for another request must never overwrite the active run (B18).
 */
export function runReducer(state: RunState, action: RunAction): RunState {
  if (action.type === 'start') {
    return {
      phase: 'executing',
      requestId: action.requestId,
      label: action.label,
      toolName: action.toolName,
      provider: action.provider,
      startedAt: Date.now(),
      stage: 'Starting execution...',
      fraction: 0
    };
  }

  if (action.type === 'reset') {
    return initialRunState;
  }

  // Guard against mismatched request ID
  if (action.requestId && state.requestId && action.requestId !== state.requestId) {
    return state;
  }

  if (action.type === 'progress') {
    return {
      ...state,
      phase: 'processing',
      stage: action.stage,
      fraction: action.fraction ?? state.fraction,
      provider: action.provider ?? state.provider
    };
  }

  if (action.type === 'succeed') {
    return {
      ...state,
      phase: 'succeeded',
      error: undefined,
      metrics: action.metrics ?? state.metrics,
      stage: 'Completed successfully'
    };
  }

  if (action.type === 'cancel') {
    return {
      ...state,
      phase: 'cancelled',
      stage: 'Operation cancelled'
    };
  }

  if (action.type === 'fail') {
    return {
      ...state,
      phase: 'failed',
      error: action.error,
      stage: 'Operation failed'
    };
  }

  return state;
}
