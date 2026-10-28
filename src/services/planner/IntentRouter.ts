import { ProviderCatalog, ProviderId, PriorityToolName } from '../execution/ProviderCatalog';
import { MultiStepPlan, PlanStep, PlannerContext } from './types';
import { CopilotError } from '../execution/errors';

export interface RouteDecision {
  providerId: ProviderId;
  modelId?: string;
  isCloud: boolean;
  costEstimate: number;
}

/**
 * IntentRouter (B23, B24)
 * Capability-aware and offline-enforced routing engine.
 * - Prioritizes local-first providers (sharp, local comfyui, ollama).
 * - Enforces 0 non-loopback network requests when offlineMode is enabled.
 * - Computes cost estimates and flags cloud disclosure/consent requirements.
 */
export class IntentRouter {
  constructor(private readonly catalog: ProviderCatalog = new ProviderCatalog()) {}

  /**
   * Resolves routes for all steps in a plan, annotating each step with provider and cost.
   */
  public async routePlan(
    plan: MultiStepPlan,
    context: PlannerContext = {}
  ): Promise<MultiStepPlan> {
    const isOffline = context.offlineMode ?? false;
    let totalEstimatedCost = 0;
    let requiresConsent = false;

    for (const step of plan.steps) {
      const decision = await this.routeStep(step, isOffline);
      step.route = decision;
      totalEstimatedCost += decision.costEstimate;
      if (decision.isCloud || decision.costEstimate > 0) {
        requiresConsent = true;
      }
    }

    plan.estimatedCost = {
      totalEstimate: totalEstimatedCost,
      currency: 'USD',
      requiresConsent
    };

    return plan;
  }

  /**
   * Determines optimal provider route for an individual step.
   */
  public async routeStep(step: PlanStep, isOffline: boolean): Promise<RouteDecision> {
    const toolName = step.toolName as PriorityToolName;

    // Check offline mode restrictions
    if (isOffline) {
      const localProviders: ProviderId[] = ['sharp', 'comfyui', 'ollama'];
      const availableLocals: ProviderId[] = [];

      for (const id of localProviders) {
        const check = await this.catalog.isToolSupported(id, toolName);
        if (check.supported) {
          availableLocals.push(id);
        }
      }

      if (availableLocals.length === 0) {
        throw new CopilotError({
          code: 'unavailable',
          message: `Tool '${step.toolName}' is not available in local offline mode. Cloud fallback is blocked.`,
          toolName: step.toolName,
          retryable: false
        });
      }

      // Choose local provider (sharp preferred for basic raster, comfyui for diffusion)
      const chosen = availableLocals.includes('sharp') ? 'sharp' : availableLocals[0];
      return {
        providerId: chosen,
        isCloud: false,
        costEstimate: 0
      };
    }

    // Online mode: Query all available providers for this tool
    const candidateProviders = await this.catalog.getAvailableProvidersForTool(toolName);

    // Prefer local-first (cost = 0, privacy friendly)
    if (candidateProviders.includes('sharp')) {
      return {
        providerId: 'sharp',
        isCloud: false,
        costEstimate: 0
      };
    }

    if (candidateProviders.includes('comfyui')) {
      return {
        providerId: 'comfyui',
        isCloud: false,
        costEstimate: 0
      };
    }

    if (candidateProviders.includes('ollama')) {
      return {
        providerId: 'ollama',
        isCloud: false,
        costEstimate: 0
      };
    }

    // Cloud candidates
    if (candidateProviders.includes('runware')) {
      return {
        providerId: 'runware',
        isCloud: true,
        costEstimate: 0.005 // Typical micro-transaction estimation
      };
    }

    if (candidateProviders.includes('cloud_llm')) {
      return {
        providerId: 'cloud_llm',
        isCloud: true,
        costEstimate: 0.002
      };
    }

    // If candidate list is empty, probe sharp as default local fallback
    const sharpCheck = await this.catalog.isToolSupported('sharp', toolName);
    if (sharpCheck.supported) {
      return {
        providerId: 'sharp',
        isCloud: false,
        costEstimate: 0
      };
    }

    throw new CopilotError({
      code: 'unavailable',
      message: `No active provider available for tool '${step.toolName}'.`,
      toolName: step.toolName,
      retryable: false
    });
  }
}
