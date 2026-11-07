import type { Node, Edge } from '@xyflow/react';

export type NodeColor = 
  | 'purple' 
  | 'blue' 
  | 'emerald' 
  | 'amber' 
  | 'rose' 
  | 'cyan' 
  | 'indigo' 
  | 'graphite';

export type NodeShape = 'pill' | 'circle' | 'card' | 'full';

export interface MindMapNodeData {
  label: string;
  color: NodeColor;
  shape: NodeShape;
  content: string;
  icon?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

export type CustomNode = Node<MindMapNodeData, 'mindmap'>;

export interface MapData {
  id: string;
  name: string;
  nodes: CustomNode[];
  edges: Edge[];
  context?: string; // Ngữ cảnh sổ tay / Kiến thức nền của Map dành cho AI
  attachments?: Record<string, string>; // attachmentId -> base64
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  activeMapId: string;
  githubToken?: string;
  gistId?: string;
  lastSyncedAt?: number;
  aiBaseUrl?: string;
  aiApiKey?: string;
  aiModel?: string;
  cachedModels?: string[];
  saveChatHistory?: boolean;
}

export interface AgentActionNode {
  id?: string;
  label: string;
  content: string;
  color?: NodeColor;
  shape?: NodeShape;
  position?: { x: number; y: number };
}

export interface AgentActionEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
}

export interface AgentAction {
  type: 'create_map' | 'modify_map';
  summary?: string;
  nodes: AgentActionNode[];
  edges?: AgentActionEdge[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoningContent?: string;
  agentAction?: AgentAction;
  isApplied?: boolean;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  mapId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
