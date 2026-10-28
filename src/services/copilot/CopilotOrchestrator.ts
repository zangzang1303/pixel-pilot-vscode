import { AgentToolRegistry, ValidatedToolCall } from '../ai/AgentToolRegistry';
import { AgentContext, AgentDecision, VisionAgentOrchestrator } from '../ai/VisionAgentOrchestrator';
import { LLMConfig } from '../ai/LLMProvider';
import { RulePlanner } from '../planner/RulePlanner';
import { IntentRouter } from '../planner/IntentRouter';
import { PlanValidator } from '../planner/PlanValidator';
import { PlanExecutionCoordinator, StepExecutorCallback } from '../planner/PlanExecutionCoordinator';
import { MultiStepPlan, PlannerContext, PlanCheckpoint } from '../planner/types';

export interface PlanningEngine {
  decideTool(prompt: string, context?: AgentContext, config?: LLMConfig): Promise<AgentDecision>;
}

/**
 * Shared orchestration authority for chat, button actions, and protocol ingress (B10, B22–B25).
 * Unifies planning, validation, capability routing, and multi-step execution.
 */
export class CopilotOrchestrator {
  private readonly router: IntentRouter;
  private readonly coordinator: PlanExecutionCoordinator;

  constructor(
    private readonly planner: PlanningEngine = VisionAgentOrchestrator,
    router?: IntentRouter,
    coordinator?: PlanExecutionCoordinator
  ) {
    this.router = router || new IntentRouter();
    this.coordinator = coordinator || new PlanExecutionCoordinator();
  }

  public plan(prompt: string, context: AgentContext, config: LLMConfig): Promise<AgentDecision> {
    return this.planner.decideTool(prompt, context, config);
  }

  /**
   * Plans a deterministic multi-step workflow with capability-aware routing (B22, B23).
   */
  public async planMultiStep(
    prompt: string,
    context: PlannerContext = {}
  ): Promise<MultiStepPlan> {
    const rawPlan = RulePlanner.plan(prompt, context);
    PlanValidator.validate(rawPlan);
    return await this.router.routePlan(rawPlan, context);
  }

  /**
   * Executes a multi-step plan with checkpointing and recovery (B25).
   */
  public async executeMultiStepPlan(
    plan: MultiStepPlan,
    sessionId: string,
    executor: StepExecutorCallback,
    signal?: AbortSignal
  ): Promise<PlanCheckpoint> {
    return await this.coordinator.executePlan(plan, sessionId, executor, signal);
  }

  /**
   * Resumes a previously interrupted or failed plan from the failed step (B25).
   */
  public async resumeMultiStepPlan(
    plan: MultiStepPlan,
    sessionId: string,
    executor: StepExecutorCallback,
    signal?: AbortSignal
  ): Promise<PlanCheckpoint> {
    return await this.coordinator.resumePlan(plan, sessionId, executor, signal);
  }

  public validateTool(toolName: unknown, args: unknown): ValidatedToolCall {
    return AgentToolRegistry.validateToolCall(toolName, args);
  }

  public async executeTool(toolName: string, args: unknown, context?: AgentContext): Promise<any> {
    return await AgentToolRegistry.execute(toolName, args, context);
  }

  public classifyIntent(prompt: string): { type: 'chat' | 'tool' | 'analyze'; toolName?: string } {
    const trimmed = prompt.trim();
    if (!trimmed) return { type: 'chat' };
    if (/^(?:phân tích|đo lường|analyze|kiểm tra ảnh)/i.test(trimmed)) {
      return { type: 'analyze', toolName: 'image.analyze' };
    }
    if (/^(?:tách nền|remove background|xóa phông)/i.test(trimmed)) {
      return { type: 'tool', toolName: 'remove_background' };
    }
    if (/^(?:phóng to|upscale|tăng nét 2x|tăng nét 4x)/i.test(trimmed)) {
      return { type: 'tool', toolName: 'upscale_image' };
    }
    if (/^(?:vector|svg|vectorize)/i.test(trimmed)) {
      return { type: 'tool', toolName: 'vectorize_image' };
    }
    return { type: 'chat' };
  }
}

