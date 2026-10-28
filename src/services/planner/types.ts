import { PriorityToolName, ProviderId } from '../execution/ProviderCatalog';

export type PlanIntentType = 'chat' | 'analyze' | 'edit' | 'clarify';

export interface PlanStep {
  stepId: string;
  toolName: PriorityToolName | string;
  args: Record<string, any>;
  inputBindings?: Record<string, string>; // e.g. { imageId: '$prev.artifactId' } or { imageId: '$step_1.artifactId' }
  description?: string;
  route?: {
    providerId: ProviderId;
    modelId?: string;
    isCloud: boolean;
    costEstimate?: number;
  };
}

export interface MultiStepPlan {
  planId: string;
  intent: PlanIntentType;
  prompt: string;
  steps: PlanStep[];
  clarificationMessage?: string;
  summary: string;
  estimatedCost?: {
    totalEstimate: number;
    currency: string;
    requiresConsent: boolean;
  };
}

export interface PlannerContext {
  sessionId?: string;
  currentImageId?: string;
  imageHash?: string;
  maskId?: string;
  maskForImageHash?: string;
  offlineMode?: boolean;
  language?: 'vi' | 'en';
}

export interface StepExecutionResult {
  stepId: string;
  toolName: string;
  status: 'succeeded' | 'failed' | 'cancelled' | 'skipped';
  value?: any;
  artifactId?: string;
  error?: string;
  durationMs?: number;
}

export interface PlanCheckpoint {
  planId: string;
  sessionId: string;
  stepResults: Record<string, StepExecutionResult>;
  currentStepIndex: number;
  isCompleted: boolean;
  createdAt: number;
  updatedAt: number;
}
