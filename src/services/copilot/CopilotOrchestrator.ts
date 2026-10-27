import { AgentToolRegistry, ValidatedToolCall } from '../ai/AgentToolRegistry';
import { AgentContext, AgentDecision, VisionAgentOrchestrator } from '../ai/VisionAgentOrchestrator';
import { LLMConfig } from '../ai/LLMProvider';

export interface PlanningEngine {
  decideTool(prompt: string, context?: AgentContext, config?: LLMConfig): Promise<AgentDecision>;
}

/** Shared planning/validation authority for chat and protocol ingress. */
export class CopilotOrchestrator {
  constructor(private readonly planner: PlanningEngine = VisionAgentOrchestrator) {}

  public plan(prompt: string, context: AgentContext, config: LLMConfig): Promise<AgentDecision> {
    return this.planner.decideTool(prompt, context, config);
  }

  public validateTool(toolName: unknown, args: unknown): ValidatedToolCall {
    return AgentToolRegistry.validateToolCall(toolName, args);
  }
}
