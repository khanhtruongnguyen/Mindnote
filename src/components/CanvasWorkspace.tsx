import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  BackgroundVariant,
  SelectionMode,
  type Connection,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnConnect,
} from '@xyflow/react';
import type { CustomNode, MapData, MindMapNodeData } from '../types';
import { MindMapNode } from './nodes/MindMapNode';
import { CustomEdge } from './edges/CustomEdge';
import { COLOR_SCHEMES } from '../constants/theme';
import { MapPin, Sparkles, Plus, BoxSelect, Scissors, ArrowRight } from 'lucide-react';

interface CanvasWorkspaceProps {
  mapData: MapData;
  isMobile?: boolean;
  onUpdateMap: (updated: Partial<MapData>) => void;
  selectedNodeId: string | null;
  focusNodeId?: string | null;
  onSelectNode: (node: CustomNode | null) => void;
  onNavigate?: (mapId?: string, noteId?: string) => void;
  onDoubleClickedCanvas: (position: { x: number; y: number }) => void;
  onAddNewNodeCenter: () => void;
  isMoveMode?: boolean;
  onExitMoveMode?: () => void;
  onOpenMoveModal?: (selectedNodes: CustomNode[], selectedEdges: Edge[]) => void;
}

const EMPTY_ATTACHMENTS: Record<string, string> = {};

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  mapData,
  isMobile = false,
  onUpdateMap,
  selectedNodeId,
  focusNodeId: _focusNodeId,
  onSelectNode,
  onNavigate,
  onDoubleClickedCanvas,
  onAddNewNodeCenter,
  isMoveMode = false,
  onExitMoveMode,
  onOpenMoveModal,
}) => {
  const { screenToFlowPosition } = useReactFlow();
  const [showMiniMap, setShowMiniMap] = useState(false); // Hide by default on mobile, show via toggle
  const [marqueeNodes, setMarqueeNodes] = useState<CustomNode[]>([]);
  const [marqueeEdges, setMarqueeEdges] = useState<Edge[]>([]);

  const nodeTypes = useMemo(() => ({ mindmap: MindMapNode }), []);
  const edgeTypes = useMemo(() => ({ custom: CustomEdge }), []);

  // Lắng nghe sự kiện chọn vùng (Marquee / Box selection) khi bật chế độ Di chuyển
  const handleSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: unknown[]; edges: Edge[] }) => {
      if (isMoveMode) {
        const cNodes = selNodes as CustomNode[];
        setMarqueeNodes(cNodes);
        const nodeIds = new Set(cNodes.map((n) => n.id));
        const internalEdges = (mapData.edges || []).filter(
          (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
        );
        setMarqueeEdges(internalEdges);
      }
    },
    [isMoveMode, mapData.edges]
  );

  // Tự động dọn dẹp vùng chọn khi thoát chế độ di chuyển
  React.useEffect(() => {
    if (!isMoveMode) {
      setMarqueeNodes([]);
      setMarqueeEdges([]);
    }
  }, [isMoveMode]);

  // Delete an edge directly (called by CustomEdge delete button)
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      const nextEdges = mapData.edges.filter((e) => e.id !== edgeId);
      onUpdateMap({ edges: nextEdges });
    },
    [mapData.edges, onUpdateMap]
  );

  // Format edges to include onDelete handler and use custom edge type
  const formattedEdges = useMemo(() => {
    return mapData.edges.map((edge) => ({
      ...edge,
      type: 'custom',
      data: {
        ...edge.data,
        onDelete: handleDeleteEdge,
      },
    }));
  }, [mapData.edges, handleDeleteEdge]);

  // Format nodes with selected flag, zIndex elevation, attachments, and internal navigation
  const formattedNodes = useMemo(() => {
    const currentAttachments = mapData.attachments || EMPTY_ATTACHMENTS;
    const currentCaptions = mapData.attachmentCaptions || EMPTY_ATTACHMENTS;
    return mapData.nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
      zIndex: node.id === selectedNodeId ? 9999 : (node.data.shape === 'full' ? 50 : 1),
      data: {
        ...node.data,
        attachments: currentAttachments,
        attachmentCaptions: currentCaptions,
        onNavigate,
        onNodeClick: (targetId: string) => {
          const lower = targetId.toLowerCase().trim();
          const target = mapData.nodes.find(
            (n) => n.id === targetId || n.data.label?.toLowerCase().trim() === lower || n.data.label?.toLowerCase().includes(lower)
          );
          if (target) onSelectNode(target);
          else onNavigate?.(undefined, targetId);
        },
      },
    }));
  }, [mapData.nodes, selectedNodeId, mapData.attachments, mapData.attachmentCaptions, onNavigate, onSelectNode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(formattedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(formattedEdges);

  // Sync internal state with props when mapData changes
  React.useEffect(() => {
    const currentAttachments = mapData.attachments || EMPTY_ATTACHMENTS;
    const currentCaptions = mapData.attachmentCaptions || EMPTY_ATTACHMENTS;
    setNodes(
      mapData.nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
        zIndex: node.id === selectedNodeId ? 9999 : (node.data.shape === 'full' ? 50 : 1),
        data: {
          ...node.data,
          attachments: currentAttachments,
          attachmentCaptions: currentCaptions,
          onNavigate,
          onNodeClick: (targetId: string) => {
            const lower = targetId.toLowerCase().trim();
            const target = mapData.nodes.find(
              (n) => n.id === targetId || n.data.label?.toLowerCase().trim() === lower || n.data.label?.toLowerCase().includes(lower)
            );
            if (target) onSelectNode(target);
            else onNavigate?.(undefined, targetId);
          },
        },
      }))
    );
  }, [mapData.id, mapData.nodes, selectedNodeId, mapData.attachments, mapData.attachmentCaptions, onNavigate, onSelectNode, setNodes]);

  React.useEffect(() => {
    setEdges(
      mapData.edges.map((edge) => ({
        ...edge,
        type: 'custom',
        data: {
          ...edge.data,
          onDelete: handleDeleteEdge,
        },
      }))
    );
  }, [mapData.id, mapData.edges, handleDeleteEdge, setEdges]);

  // Clean runtime-only properties (attachments, callbacks) before persisting nodes
  const sanitizeNodes = useCallback((currentNodes: unknown[]): CustomNode[] => {
    return currentNodes.map((n) => {
      const node = n as CustomNode;
      const rawData = (node.data || {}) as Record<string, unknown>;
      const { attachments, onNavigate, onNodeClick, ...cleanData } = rawData;
      return {
        ...node,
        data: cleanData as any,
      };
    });
  }, []);

  // Propagate nodes changes to local React Flow state; ONLY notify parent on structural changes (e.g. deletion)
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      const hasStructuralChange = changes.some((c) => c.type === 'remove');
      if (hasStructuralChange) {
        setNodes((currentNodes) => {
          onUpdateMap({ nodes: sanitizeNodes(currentNodes) });
          return currentNodes;
        });
      }
    },
    [onNodesChange, onUpdateMap, setNodes, sanitizeNodes]
  );

  // Sync node positions to parent state ONLY when user finishes dragging (Mouse up / Touch release)
  const handleNodeDragStop = useCallback(() => {
    setNodes((currentNodes) => {
      onUpdateMap({ nodes: sanitizeNodes(currentNodes) });
      return currentNodes;
    });
  }, [onUpdateMap, setNodes, sanitizeNodes]);

  // Propagate edges changes to parent
  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      setTimeout(() => {
        setEdges((currentEdges) => {
          onUpdateMap({ edges: currentEdges });
          return currentEdges;
        });
      }, 0);
    },
    [onEdgesChange, onUpdateMap, setEdges]
  );

  // Handle connecting arrows between nodes
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source) as CustomNode | undefined;
      const sourceColor = sourceNode?.data?.color || 'purple';
      const accentColor = COLOR_SCHEMES[sourceColor]?.accent || '#a855f7';

      const newEdge: Edge = {
        ...params,
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        type: 'custom',
        animated: true,
        style: { stroke: accentColor, strokeWidth: 2 },
        data: {
          onDelete: handleDeleteEdge,
        },
      };

      setEdges((eds) => {
        const nextEdges = addEdge(newEdge, eds);
        onUpdateMap({ edges: nextEdges });
        return nextEdges;
      });
    },
    [nodes, setEdges, onUpdateMap, handleDeleteEdge]
  );

  // Click on a node -> select it and open sidebar (Hoặc giữ phím Shift + Click để mở thẻ nổi đa nhiệm)
  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (event.shiftKey) {
        window.dispatchEvent(
          new CustomEvent('mindnote:open-floating-card', { detail: { nodeId: node.id } })
        );
        return;
      }
      onSelectNode(node as CustomNode);
    },
    [onSelectNode]
  );

  // Click on an edge -> select it (showing the delete button)
  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          selected: e.id === edge.id,
        }))
      );
    },
    [setEdges]
  );

  // Click on empty canvas -> close sidebar & deselect edges
  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
  }, [onSelectNode, setEdges]);

  // Double click on canvas -> create node right at mouse coordinate
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if ((event.target as HTMLElement).closest('.react-flow__node')) {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onDoubleClickedCanvas(position);
    },
    [screenToFlowPosition, onDoubleClickedCanvas]
  );

  return (
    <div className="w-full h-full relative" onDoubleClick={handleDoubleClick}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        elevateNodesOnSelect={true}
        connectionRadius={40}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: isMobile ? 0.4 : 0.25 }}
        minZoom={0.15}
        maxZoom={2.5}
        defaultEdgeOptions={{
          type: 'custom',
          animated: true,
        }}
        onlyRenderVisibleElements={true}
        proOptions={{ hideAttribution: true }}
        selectionOnDrag={isMoveMode}
        panOnDrag={isMoveMode ? [1, 2] : true}
        selectionMode={SelectionMode.Partial}
        onSelectionChange={handleSelectionChange}
      >
        {/* Obsidian Dot Grid */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={isMobile ? 20 : 24}
          size={1.2}
          color="#252532"
          className="bg-[#121215]"
        />

        {/* Minimal Controls (hidden on mobile to save screen space) */}
        {!isMobile && (
          <Controls
            showInteractive={false}
            className="!bottom-5 !left-5 !bg-[#181822] !border !border-[#2c2c3d] !rounded-xl overflow-hidden !shadow-xl"
          />
        )}

        {/* Minimap (only on desktop or when toggled) */}
        {showMiniMap && !isMobile && (
          <div className="absolute bottom-5 right-5 z-20">
            <div className="bg-[#181822]/90 backdrop-blur-md border border-[#2e2e3d] rounded-xl overflow-hidden shadow-2xl p-1">
              <div className="flex items-center justify-between px-2 py-1 text-[10px] text-zinc-400 font-semibold border-b border-zinc-800/80 mb-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5 text-purple-400" />
                  Bản đồ thu nhỏ
                </span>
                <button
                  onClick={() => setShowMiniMap(false)}
                  className="hover:text-white"
                  title="Ẩn minimap"
                >
                  ✕
                </button>
              </div>
              <MiniMap
                nodeColor={(n) => {
                  const nodeData = n.data as MindMapNodeData;
                  const colorKey = nodeData?.color || 'purple';
                  return COLOR_SCHEMES[colorKey]?.accent || '#a855f7';
                }}
                maskColor="rgba(18, 18, 22, 0.7)"
                className="!relative !bottom-0 !right-0 !m-0 !w-40 !h-28 !bg-[#131318] !rounded-lg"
              />
            </div>
          </div>
        )}
      </ReactFlow>

      {/* MOBILE FLOATING ACTION BUTTON (FAB) - Thêm nút nhanh bằng 1 tay */}
      {isMobile && !selectedNodeId && (
        <div
          style={{
            bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          }}
          className="absolute right-6 z-30 flex flex-col items-end gap-3 pointer-events-auto"
        >
          <button
            onClick={onAddNewNodeCenter}
            className="flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm shadow-[0_8px_25px_rgba(124,58,237,0.5)] active:scale-95 transition-transform border border-purple-400/40"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>Thêm ô mới</span>
          </button>
        </div>
      )}

      {/* Chế độ Di chuyển: Thanh thông báo hướng dẫn ở phía trên */}
      {isMoveMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#161622]/95 backdrop-blur-xl border border-amber-500/60 shadow-2xl rounded-2xl px-4 py-2 flex items-center gap-3 text-xs text-zinc-200 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2">
            <BoxSelect className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <span>
              <strong>Chế độ Di chuyển:</strong> Kéo chuột trái trên bảng để khoanh chọn các ô cần chuyển.
            </span>
          </div>
          {onExitMoveMode && (
            <button
              type="button"
              onClick={onExitMoveMode}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer shrink-0 transition-colors"
            >
              Thoát
            </button>
          )}
        </div>
      )}

      {/* Chế độ Di chuyển: Thanh công cụ nổi bên dưới khi đã khoanh chọn ít nhất 1 ô */}
      {isMoveMode && marqueeNodes.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#181827]/95 backdrop-blur-xl border border-amber-500/70 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 text-xs text-white animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>
              Đã khoanh chọn <strong>{marqueeNodes.length} ô</strong> ({marqueeEdges.length} liên kết)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMarqueeNodes([]);
                setMarqueeEdges([]);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold cursor-pointer transition-colors"
            >
              Khoanh lại
            </button>

            {onOpenMoveModal && (
              <button
                type="button"
                onClick={() => onOpenMoveModal(marqueeNodes, marqueeEdges)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-lg shadow-amber-500/30 cursor-pointer transition-all hover:scale-105"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Chuyển sang Map khác</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Center helper badge if map has no nodes */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 px-4">
          <div className="bg-[#181822]/95 border border-[#2e2e3d] backdrop-blur-md rounded-2xl p-6 text-center max-w-sm pointer-events-auto shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Bản đồ đang trống</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              {isMobile
                ? 'Nhấn nút bên dưới để tạo ô ghi chú đầu tiên.'
                : 'Nhấp đúp chuột vào bất kỳ vị trí nào để tạo ô ghi chú đầu tiên.'}
            </p>
            <button
              onClick={onAddNewNodeCenter}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30"
            >
              + Tạo ghi chú đầu tiên
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
