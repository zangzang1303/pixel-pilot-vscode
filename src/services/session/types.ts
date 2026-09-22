// types.ts - Data structures for Context-Aware Visual DAG History & Codex-Style Sessions

export type OperationType =
  | 'original'
  | 'remove_background'
  | 'upscale'
  | 'vectorize'
  | 'inpaint'
  | 'mask'
  | 'canny'
  | 'lineart'
  | 'caption'
  | 'extend'
  | 'preprocess';

export interface NodeMetrics {
  model: string;
  latencyMs: number;
  costUsd: number;
  width?: number;
  height?: number;
  fileSizeKb?: number;
  softMattingRatio?: number;
}

export interface HistoryNode {
  nodeId: string;
  parentId: string | null;           // Enables non-linear branching in DAG
  childrenIds: string[];             // Direct children nodes
  timestamp: number;
  operation: OperationType;
  operationLabel: string;
  inputImageUri: string;             // Base64 Data URI or file path
  outputImageUri: string;            // Result image or SVG
  maskUri?: string;                  // Optional mask used in inpaint/segmentation
  prompt?: string;                   // Text prompt for inpainting/generative fill
  params?: Record<string, any>;      // Custom parameters (upscale factor, threshold, etc.)
  textResult?: string;               // Textual output (caption, SVG code, CSS snippet)
  metrics: NodeMetrics;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: number;
  text: string;
  nodeId?: string;                   // Linked to DAG node
  operation?: OperationType;
  outputImageUri?: string;
  metrics?: NodeMetrics;
}

export interface ImageSession {
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  rootNodeId: string;
  currentNodeId: string;
  nodes: Record<string, HistoryNode>; // In-memory hashmap of the complete DAG
  messages: ChatMessage[];            // Prompt & conversation history for this session
}

export interface AIResult {
  success: boolean;
  outputImageUri?: string;
  maskUri?: string;
  textResult?: string;
  metrics: NodeMetrics;
  error?: string;
}

export interface ParsedIntent {
  operation: OperationType;
  label: string;
  factor?: 2 | 4;
  promptText?: string;
  preprocessor?: 'canny' | 'lineart' | 'softedge' | 'depth';
}
