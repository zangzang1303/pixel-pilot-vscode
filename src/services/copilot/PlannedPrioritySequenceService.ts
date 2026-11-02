import { CopilotOrchestrator } from './CopilotOrchestrator';
import { PriorityToolRunService } from './PriorityToolRunService';
import { SessionManager } from '../session/SessionManager';
import { MultiStepPlan, PlanCheckpoint, PlanStep } from '../planner/types';

/** Connects routed priority plans to pinned DAG nodes and durable checkpoints. */
export class PlannedPrioritySequenceService {
  constructor(
    private readonly orchestrator: CopilotOrchestrator,
    private readonly priorityTools: PriorityToolRunService,
    private readonly sessions: SessionManager
  ) {}

  public async run(input: {
    plan: MultiStepPlan;
    sessionId: string;
    initialNodeId: string;
    expectedSteps: number;
    requestId?: string;
    signal?: AbortSignal;
    onStarted?: () => void;
    onStep?: (step: PlanStep, fraction: number) => void;
    onCommitted?: () => void;
  }): Promise<PlanCheckpoint> {
    const { plan, sessionId, initialNodeId, requestId, signal } = input;
    if (plan.intent !== 'edit' || plan.steps.length !== input.expectedSteps ||
        plan.steps.some(step => !['image.remove_background', 'image.recolor'].includes(step.toolName))) {
      throw new Error(plan.clarificationMessage || 'The full edit sequence could not be planned safely.');
    }
    if (plan.steps.some(step => !step.route || step.route.isCloud ||
        !['sharp', 'comfyui'].includes(step.route.providerId))) {
      throw new Error('This plan requires a provider route that is not available for automatic local execution.');
    }
    if (plan.steps.some(step =>
      (step.toolName === 'image.recolor' ||
       (step.toolName === 'image.remove_background' && step.args.quality === 'model')) &&
      step.route?.providerId !== 'comfyui')) {
      throw new Error('A model edit cannot be routed to the basic Sharp processor.');
    }
    if (!this.sessions.getSession(sessionId)?.nodes[initialNodeId]?.outputImageUri) {
      throw new Error('The plan source image is no longer available.');
    }

    input.onStarted?.();

    return this.orchestrator.executeMultiStepPlan(plan, sessionId, async (step, resolvedArgs) => {
      if (signal?.aborted) throw new Error('Operation cancelled.');
      const current = this.sessions.getSession(sessionId);
      const boundArtifactId = typeof resolvedArgs.imageId === 'string' && resolvedArgs.imageId.startsWith('art_')
        ? resolvedArgs.imageId : undefined;
      const parentId = boundArtifactId
        ? Object.values(current?.nodes || {}).find(node => node.params?.artifactId === boundArtifactId)?.nodeId
        : initialNodeId;
      if (!parentId || !current?.nodes[parentId]) throw new Error('A prior plan artifact has no matching DAG node.');
      const args = { ...resolvedArgs };
      delete args.imageId; // The executor pins imageId to the verified DAG node.
      if (step.toolName === 'image.remove_background') {
        args.quality = step.route?.providerId === 'sharp' ? 'basic' : 'model';
      }
      input.onStep?.(step, plan.steps.indexOf(step) / plan.steps.length);
      const result = await this.priorityTools.run({
        requestId: `${requestId || plan.planId}:${step.stepId}`,
        sessionId, parentId, toolName: step.toolName, args, signal
      });
      input.onCommitted?.();
      if (!result.artifactId) throw new Error('Plan step did not persist an image artifact.');
      return { artifactId: result.artifactId };
    }, signal);
  }
}
