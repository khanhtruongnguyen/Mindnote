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

export type NodeShape = 'pill' | 'circle' | 'card';

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
  attachments?: Record<string, string>; // attachmentId -> base64
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  activeMapId: string;
  githubToken?: string;
  gistId?: string;
  lastSyncedAt?: number;
}
