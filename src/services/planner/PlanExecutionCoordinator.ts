import { MultiStepPlan, PlanCheckpoint, PlanStep, StepExecutionResult } from './types';
import { CopilotError } from '../execution/errors';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { PlanValidator } from './PlanValidator';

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
  private activePlanLocks = new Set<string>();

  constructor(private readonly checkpointDirectory?: string) {}

  private checkpointPath(planId: string): string {
    const fileName = createHash('sha256').update(planId).digest('hex') + '.json';
    return path.join(this.checkpointDirectory!, fileName);
  }

  private fingerprint(plan: MultiStepPlan, sessionId: string): string {
    return createHash('sha256').update(JSON.stringify({ sessionId, steps: plan.steps })).digest('hex');
  }

  private persist(checkpoint: PlanCheckpoint): void {
    if (!this.checkpointDirectory) return;
    fs.mkdirSync(this.checkpointDirectory, { recursive: true });
    const target = this.checkpointPath(checkpoint.planId);
    const temporary = `${target}.tmp`;
    // Only persist references and status; executor values and errors can contain private content.
    const safe: PlanCheckpoint = {
      ...checkpoint,
      stepResults: Object.fromEntries(Object.entries(checkpoint.stepResults).map(([id, result]) => [id, {
        stepId: result.stepId,
        toolName: result.toolName,
        status: result.status,
        artifactId: result.artifactId,
        durationMs: result.durationMs
      }]))
    };
    try {
      fs.writeFileSync(temporary, JSON.stringify(safe), 'utf8');
      fs.renameSync(temporary, target);
    } catch (error) {
      try { fs.unlinkSync(temporary); } catch { /* Keep the previous checkpoint. */ }
      throw error;
    }
  }

  private load(planId: string): PlanCheckpoint | undefined {
    if (!this.checkpointDirectory) return undefined;
    const target = this.checkpointPath(planId);
    if (!fs.existsSync(target)) return undefined;
    try {
      const checkpoint = JSON.parse(fs.readFileSync(target, 'utf8')) as PlanCheckpoint;
      if (checkpoint.planId !== planId || typeof checkpoint.sessionId !== 'string' ||
          typeof checkpoint.planFingerprint !== 'string' || !checkpoint.stepResults ||
          !Number.isInteger(checkpoint.currentStepIndex)) {
        throw new Error('Invalid checkpoint format.');
      }
      return checkpoint;
    } catch {
      throw new CopilotError({ code: 'precondition_failed', message: 'Plan checkpoint is malformed; execution is paused for inspection.' });
    }
  }

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
    let checkpoint = this.checkpoints.get(planId);
    if (!checkpoint) {
      checkpoint = this.load(planId);
      if (checkpoint) this.checkpoints.set(planId, checkpoint);
    }
    return checkpoint;
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
    PlanValidator.validate(plan);
    this.acquireSessionLock(sessionId);
    let planLockAcquired = false;

    try {
      if (this.activePlanLocks.has(plan.planId)) {
        throw new CopilotError({ code: 'concurrency_limit', message: `Plan '${plan.planId}' is already executing.` });
      }
      this.activePlanLocks.add(plan.planId);
      planLockAcquired = true;
      let checkpoint = this.getCheckpoint(plan.planId);
      const fingerprint = this.fingerprint(plan, sessionId);
      if (checkpoint && (checkpoint.sessionId !== sessionId || checkpoint.planFingerprint !== fingerprint)) {
        throw new CopilotError({ code: 'precondition_failed', message: 'Plan ID belongs to a different session or plan revision.' });
      }
      if (checkpoint?.inFlightStepId) {
        throw new CopilotError({ code: 'precondition_failed', message: `Step '${checkpoint.inFlightStepId}' has an unknown outcome; reconcile the provider job before resuming.` });
      }
      if (!checkpoint) {
        checkpoint = {
          planId: plan.planId,
          sessionId,
          planFingerprint: fingerprint,
          stepResults: {},
          currentStepIndex: 0,
          isCompleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        this.checkpoints.set(plan.planId, checkpoint);
        this.persist(checkpoint);
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
        checkpoint.inFlightStepId = step.stepId;
        this.persist(checkpoint);
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
          checkpoint.inFlightStepId = undefined;
          try {
            this.persist(checkpoint);
          } catch (error) {
            checkpoint.inFlightStepId = step.stepId;
            throw error;
          }
        } catch (err: any) {
          if (checkpoint.inFlightStepId === step.stepId && checkpoint.stepResults[step.stepId]?.status === 'succeeded') throw err;
          checkpoint.stepResults[step.stepId] = {
            stepId: step.stepId,
            toolName: step.toolName,
            status: 'failed',
            error: err.message,
            durationMs: Date.now() - startTime
          };
          checkpoint.updatedAt = Date.now();
          if (!step.route?.isCloud) checkpoint.inFlightStepId = undefined;
          this.persist(checkpoint);
          throw err;
        }
      }

      checkpoint.isCompleted = true;
      checkpoint.updatedAt = Date.now();
      this.persist(checkpoint);
      return checkpoint;
    } finally {
      if (planLockAcquired) this.activePlanLocks.delete(plan.planId);
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
    const checkpoint = this.getCheckpoint(plan.planId);
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
        if (!lastResult?.artifactId) throw new CopilotError({ code: 'precondition_failed', message: `Missing prior artifact for ${step.stepId}.` });
        resolved[argName] = lastResult.artifactId;
      } else if (bindingRef.startsWith('$')) {
        const match = bindingRef.match(/^\$([^.]+)\.(.+)$/);
        if (match) {
          const targetStepId = match[1];
          const field = match[2];
          const targetResult = priorResults[targetStepId];
          if (field !== 'artifactId' || targetResult?.status !== 'succeeded' || !targetResult.artifactId) {
            throw new CopilotError({ code: 'precondition_failed', message: `Missing bound artifact for ${step.stepId}.` });
          }
          resolved[argName] = targetResult.artifactId;
        }
      }
    }

    return resolved;
  }
}
