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
  html?: string;
  icon?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

export type CustomNode = Node<MindMapNodeData, 'mindmap'>;

export interface FlashcardItem {
  id: string;
  question: string;
  answer: string;
  sourceNodeId?: string;
  sourceNodeLabel?: string;
  status: 'new' | 'learning' | 'mastered';
  createdAt: number;
  lastReviewedAt?: number;
}

export interface SplitNodeBranch {
  label: string;
  content: string;
  color?: NodeColor;
  shape?: NodeShape;
}

export interface SplitNodeResult {
  remainingParentContent: string;
  branches: SplitNodeBranch[];
  summary?: string;
}

export interface MapData {
  id: string;
  name: string;
  nodes: CustomNode[];
  edges: Edge[];
  context?: string; // Ngữ cảnh sổ tay / Kiến thức nền của Map dành cho AI
  attachments?: Record<string, string>; // attachmentId -> base64
  attachmentCaptions?: Record<string, string>; // attachmentId -> Bản tóm tắt AI cho hình ảnh đính kèm
  flashcards?: FlashcardItem[]; // Bộ thẻ Flashcard ôn tập của bản đồ
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
  preferredModels?: string[]; // Danh sách các model hay dùng để xoay vòng AI
  autoFallbackModel?: boolean; // Tự động xoay vòng sang model tiếp theo khi gặp lỗi kết nối
  saveChatHistory?: boolean;
  // Supabase Cloud Sync
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseAutoSync?: boolean;
  supabaseRealtime?: boolean;
  supabaseUserEmail?: string;
  lastCloudSyncedAt?: number;
  // Google Drive 1-Click Sync
  googleDriveScriptUrl?: string;
  lastDriveSyncedAt?: number;
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
  retryPrompt?: string;
  failedModel?: string;
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

export interface SingleMapExportPayload {
  version: 1;
  type: 'mindnote_single_map';
  exportedAt: number;
  source: 'desktop' | 'web';
  map: MapData;
}

export type ImportDataResult =
  | { type: 'single_map'; map: MapData }
  | { type: 'multi_maps'; maps: MapData[] };

export interface GoogleDriveInfo {
  isAvailable: boolean;
  gDrivePath: string | null;
  mindnoteDir: string | null;
}

export interface GoogleDriveExportResult {
  success: boolean;
  fileName?: string;
  filePath?: string;
  folder?: string;
  mapName?: string;
  isFullVault?: boolean;
  error?: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  updatedAt: number;
  size?: number;
  url?: string;
  source: 'script' | 'desktop';
}

export interface MindnoteDesktopBridge {
  isDesktop: boolean;
  getVaultInfo: () => Promise<{
    vaultPath: string;
    attachmentsPath: string;
    mapCount: number;
    attachCount: number;
  }>;
  openVaultFolder: () => Promise<boolean>;
  loadMaps: () => Promise<MapData[] | null>;
  saveMaps: (maps: MapData[]) => Promise<boolean>;
  saveAttachment: (attachId: string, base64: string) => Promise<string | null>;
  importBackupDialog: () => Promise<unknown>;
  exportBackupDialog: (maps: MapData[]) => Promise<boolean>;
  exportSingleMapDialog: (map: MapData) => Promise<boolean>;
  normalizeImportedMap: (map: MapData) => Promise<MapData>;
  getGoogleDriveInfo: () => Promise<GoogleDriveInfo>;
  openGoogleDriveFolder: () => Promise<boolean>;
  exportToGoogleDrive: (data: { map?: MapData; maps?: MapData[]; isFullVault?: boolean; keepSingleFile?: boolean }) => Promise<GoogleDriveExportResult>;
  pickFromGoogleDrive: () => Promise<unknown>;
  listGoogleDriveFiles?: () => Promise<DriveFileItem[]>;
  loadGoogleDriveFile?: (filePath: string) => Promise<unknown>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
}

declare global {
  interface Window {
    mindnoteDesktop?: MindnoteDesktopBridge;
  }
}


