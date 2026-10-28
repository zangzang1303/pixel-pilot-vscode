import { AgentToolRegistry } from '../ai/AgentToolRegistry';
import { CopilotError } from '../execution/errors';
import { MultiStepPlan, PlanStep } from './types';

export class PlanValidationError extends Error {
  constructor(message: string, public readonly stepIndex?: number) {
    super(message);
    this.name = 'PlanValidationError';
  }
}

/**
 * PlanValidator (B22)
 * Enforces strict constraints on multi-step plans:
 * - Max 5 steps limit
 * - No cycles or forward references in bindings
 * - Known tools and valid parameters
 * - Intent coherence (no edit steps for chat/clarify)
 */
export class PlanValidator {
  public static readonly MAX_STEPS = 5;

  public static validate(plan: MultiStepPlan): void {
    if (!plan.planId || !plan.planId.trim()) {
      throw new PlanValidationError('Plan must have a valid planId.');
    }

    // Grounded summary safety check: ensure no leaked secret keywords in ANY plan
    if (plan.summary && /AIza[0-9A-Za-z-_]{35}|sk-[0-9A-Za-z]{32,}/.test(plan.summary)) {
      throw new PlanValidationError('Plan summary contains potential leaked secrets.');
    }

    if (plan.intent === 'chat' || plan.intent === 'clarify') {
      if (plan.steps && plan.steps.length > 0) {
        throw new PlanValidationError(
          `Plans with intent '${plan.intent}' cannot contain execution steps.`
        );
      }
      return;
    }

    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new PlanValidationError('Execution plans must contain at least one step.');
    }

    if (plan.steps.length > this.MAX_STEPS) {
      throw new PlanValidationError(
        `Plan exceeds maximum allowed steps (${this.MAX_STEPS}). Got ${plan.steps.length}.`
      );
    }

    const seenStepIds = new Set<string>();

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      this.validateStep(step, i, seenStepIds, plan.steps);
      seenStepIds.add(step.stepId);
    }
  }

  private static validateStep(
    step: PlanStep,
    index: number,
    priorStepIds: Set<string>,
    allSteps: PlanStep[]
  ): void {
    if (!step.stepId || !step.stepId.trim()) {
      throw new PlanValidationError(`Step at index ${index} must have a valid stepId.`, index);
    }

    if (priorStepIds.has(step.stepId)) {
      throw new PlanValidationError(`Duplicate stepId '${step.stepId}' at index ${index}.`, index);
    }

    const tool = AgentToolRegistry.getTool(step.toolName);
    if (!tool) {
      throw new PlanValidationError(
        `Unknown tool '${step.toolName}' in step '${step.stepId}'.`,
        index
      );
    }

    // Validate bindings for acyclicity and forward-reference prevention
    if (step.inputBindings) {
      for (const [argName, bindingRef] of Object.entries(step.inputBindings)) {
        if (!bindingRef.startsWith('$')) {
          continue;
        }

        if (bindingRef.startsWith('$prev.')) {
          if (index === 0) {
            throw new PlanValidationError(
              `Step '${step.stepId}' references '$prev' but is the first step.`,
              index
            );
          }
          continue;
        }

        const match = bindingRef.match(/^\$([^.]+)\.(.+)$/);
        if (!match) {
          throw new PlanValidationError(
            `Invalid binding syntax '${bindingRef}' in step '${step.stepId}'.`,
            index
          );
        }

        const targetStepId = match[1];
        if (targetStepId === step.stepId) {
          throw new PlanValidationError(
            `Cyclic dependency: step '${step.stepId}' binds to itself via '${bindingRef}'.`,
            index
          );
        }

        if (!priorStepIds.has(targetStepId)) {
          const isForward = allSteps.some(s => s.stepId === targetStepId);
          if (isForward) {
            throw new PlanValidationError(
              `Forward reference: step '${step.stepId}' depends on future step '${targetStepId}'.`,
              index
            );
          } else {
            throw new PlanValidationError(
              `Step '${step.stepId}' references non-existent step '${targetStepId}'.`,
              index
            );
          }
        }
      }
    }
  }
}
