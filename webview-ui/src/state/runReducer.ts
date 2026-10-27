export type RunPhase = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface RunState {
  phase: RunPhase;
  requestId?: string;
  label?: string;
  error?: string;
}

export type RunAction =
  | { type: 'start'; requestId: string; label: string }
  | { type: 'succeed'; requestId?: string }
  | { type: 'fail'; requestId?: string; error: string }
  | { type: 'cancel'; requestId?: string }
  | { type: 'reset' };

export const initialRunState: RunState = { phase: 'idle' };

/** A terminal event for another request must never overwrite the active run. */
export function runReducer(state: RunState, action: RunAction): RunState {
  if (action.type === 'start') return { phase: 'running', requestId: action.requestId, label: action.label };
  if (action.type === 'reset') return initialRunState;
  if (action.requestId && state.requestId && action.requestId !== state.requestId) return state;
  if (action.type === 'succeed') return { ...state, phase: 'succeeded', error: undefined };
  if (action.type === 'cancel') return { ...state, phase: 'cancelled' };
  return { ...state, phase: 'failed', error: action.error };
}
