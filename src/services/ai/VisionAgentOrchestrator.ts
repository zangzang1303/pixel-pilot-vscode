// VisionAgentOrchestrator.ts - Context-Aware Vision & LLM Agent Orchestrator
import { ParsedIntent } from '../session/types';
import { AgentToolRegistry } from './AgentToolRegistry';
import { LLMConfig, LLMProvider } from './LLMProvider';

export interface AgentContext {
  currentImageUri?: string;
  width?: number;
  height?: number;
  currentNodeId?: string;
  previousOperations?: string[];
}

export interface AgentDecision {
  toolName: string;
  args: Record<string, any>;
  intent: ParsedIntent;
  thought: string;
  reasoningSteps: string[];
  llmModelUsed?: string;
}

/**
 * Intelligent Vision Agent Orchestrator:
 * Powered by LLM (Google Gemini Vision, OpenAI, or Local Cognitive Brain).
 * Analyzes image context, interprets user language intent, and decides which tool to call.
 */
export class VisionAgentOrchestrator {
  /**
   * Main entry point: Understands user prompt in visual context and resolves the optimal tool
   */
  public static async decideTool(
    userPrompt: string,
    context?: AgentContext,
    llmConfig?: LLMConfig
  ): Promise<AgentDecision> {
    return await LLMProvider.planWithLLM(userPrompt, context, llmConfig);
  }
}

