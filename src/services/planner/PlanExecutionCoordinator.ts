import { MultiStepPlan, PlanCheckpoint, PlanStep, StepExecutionResult } from './types';
import { AgentToolRegistry } from '../ai/AgentToolRegistry';
import { CopilotError } from '../execution/errors';

export interface StepExecutorCallback {
  (step: PlanStep, resolvedArgs: Record<string, any>, signal?: AbortSignal): Promise<{
    artifactId?: string;
    value?: any;
  }>;
}

/**
 * PlanExecutionCoordinator (B25)
 * Coordinates multi-step execution with checkpointing, dynamic binding resolution,
 * partial recovery, resume from failure, and session concurrency locks.
 */
export class PlanExecutionCoordinator {
  private checkpoints = new Map<string, PlanCheckpoint>();
  private activeSessionLocks = new Set<string>();

  /**
   * Acquires execution lock for a session.
   */
  public acquireSessionLock(sessionId: string): void {
    if (this.activeSessionLocks.has(sessionId)) {
      throw new CopilotError({
        code: 'concurrency_limit',
        message: `Session '${sessionId}' already has an active execution in progress. Concurrency limit is 1 mutation per session.`,
        retryable: true
      });
    }
    this.activeSessionLocks.add(sessionId);
  }

  /**
   * Releases execution lock for a session.
   */
  public releaseSessionLock(sessionId: string): void {
    this.activeSessionLocks.delete(sessionId);
  }

  /**
   * Retrieves an existing checkpoint for a plan.
   */
  public getCheckpoint(planId: string): PlanCheckpoint | undefined {
    return this.checkpoints.get(planId);
  }

  /**
   * Executes a plan from the beginning or resumes from the last uncompleted step.
   */
  public async executePlan(
    plan: MultiStepPlan,
    sessionId: string,
    executor: StepExecutorCallback,
    signal?: AbortSignal
  ): Promise<PlanCheckpoint> {
    this.acquireSessionLock(sessionId);

    try {
      let checkpoint = this.checkpoints.get(plan.planId);
      if (!checkpoint) {
        checkpoint = {
          planId: plan.planId,
          sessionId,
          stepResults: {},
          currentStepIndex: 0,
          isCompleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        this.checkpoints.set(plan.planId, checkpoint);
      }

      for (let i = checkpoint.currentStepIndex; i < plan.steps.length; i++) {
        if (signal?.aborted) {
          throw CopilotError.createCancelledError(plan.steps[i]?.toolName, plan.planId);
        }

        const step = plan.steps[i];
        checkpoint.currentStepIndex = i;
        checkpoint.updatedAt = Date.now();

        // Check if this step already succeeded previously (recovery/resume)
        if (checkpoint.stepResults[step.stepId]?.status === 'succeeded') {
          continue;
        }

        // Resolve input bindings from prior step artifacts
        const resolvedArgs = this.resolveStepArgs(step, checkpoint.stepResults);

        const startTime = Date.now();
        try {
          const outcome = await executor(step, resolvedArgs, signal);
          checkpoint.stepResults[step.stepId] = {
            stepId: step.stepId,
            toolName: step.toolName,
            status: 'succeeded',
            value: outcome.value,
            artifactId: outcome.artifactId,
            durationMs: Date.now() - startTime
          };
          checkpoint.updatedAt = Date.now();
        } catch (err: any) {
          checkpoint.stepResults[step.stepId] = {
            stepId: step.stepId,
            toolName: step.toolName,
            status: 'failed',
            error: err.message,
            durationMs: Date.now() - startTime
          };
          checkpoint.updatedAt = Date.now();
          throw err;
        }
      }

      checkpoint.isCompleted = true;
      checkpoint.updatedAt = Date.now();
      return checkpoint;
    } finally {
      this.releaseSessionLock(sessionId);
    }
  }

  /**
   * Resumes execution of a failed or interrupted plan from the first uncompleted step.
   */
  public async resumePlan(
    plan: MultiStepPlan,
    sessionId: string,
    executor: StepExecutorCallback,
    signal?: AbortSignal
  ): Promise<PlanCheckpoint> {
    const checkpoint = this.checkpoints.get(plan.planId);
    if (!checkpoint) {
      return this.executePlan(plan, sessionId, executor, signal);
    }

    // Advance currentStepIndex to the first step that did not succeed
    let resumeIndex = 0;
    while (
      resumeIndex < plan.steps.length &&
      checkpoint.stepResults[plan.steps[resumeIndex].stepId]?.status === 'succeeded'
    ) {
      resumeIndex++;
    }

    checkpoint.currentStepIndex = resumeIndex;
    return this.executePlan(plan, sessionId, executor, signal);
  }

  /**
   * Resolves dynamic input bindings (e.g. $prev.artifactId, $step_1.artifactId).
   */
  private resolveStepArgs(
    step: PlanStep,
    priorResults: Record<string, StepExecutionResult>
  ): Record<string, any> {
    const resolved: Record<string, any> = { ...step.args };

    if (!step.inputBindings) {
      return resolved;
    }

    const completedStepEntries = Object.values(priorResults).filter(
      r => r.status === 'succeeded'
    );

    for (const [argName, bindingRef] of Object.entries(step.inputBindings)) {
      if (bindingRef === '$prev.artifactId') {
        const lastResult = completedStepEntries[completedStepEntries.length - 1];
        if (lastResult?.artifactId) {
          resolved[argName] = lastResult.artifactId;
        }
      } else if (bindingRef.startsWith('$')) {
        const match = bindingRef.match(/^\$([^.]+)\.(.+)$/);
        if (match) {
          const targetStepId = match[1];
          const field = match[2];
          const targetResult = priorResults[targetStepId];
          if (targetResult && targetResult.status === 'succeeded') {
            if (field === 'artifactId' && targetResult.artifactId) {
              resolved[argName] = targetResult.artifactId;
            } else if (targetResult.value && targetResult.value[field] !== undefined) {
              resolved[argName] = targetResult.value[field];
            }
          }
        }
      }
    }

    return resolved;
  }
}
