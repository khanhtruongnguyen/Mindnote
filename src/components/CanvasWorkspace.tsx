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
  MarkerType,
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
import { MapPin, Sparkles, Plus } from 'lucide-react';

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
}) => {
  const { screenToFlowPosition } = useReactFlow();
  const [showMiniMap, setShowMiniMap] = useState(false); // Hide by default on mobile, show via toggle

  const nodeTypes = useMemo(() => ({ mindmap: MindMapNode }), []);
  const edgeTypes = useMemo(() => ({ custom: CustomEdge }), []);

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
    return mapData.nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
      zIndex: node.id === selectedNodeId ? 9999 : (node.data.shape === 'full' ? 50 : 1),
      data: {
        ...node.data,
        attachments: currentAttachments,
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
  }, [mapData.nodes, selectedNodeId, mapData.attachments, onNavigate, onSelectNode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(formattedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(formattedEdges);

  // Sync internal state with props when mapData changes
  React.useEffect(() => {
    const currentAttachments = mapData.attachments || EMPTY_ATTACHMENTS;
    setNodes(
      mapData.nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
        zIndex: node.id === selectedNodeId ? 9999 : (node.data.shape === 'full' ? 50 : 1),
        data: {
          ...node.data,
          attachments: currentAttachments,
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
  }, [mapData.id, mapData.nodes, selectedNodeId, mapData.attachments, onNavigate, onSelectNode, setNodes]);

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

  // Propagate nodes changes to local React Flow state; ONLY notify parent on structural changes (e.g. deletion)
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      const hasStructuralChange = changes.some((c) => c.type === 'remove');
      if (hasStructuralChange) {
        setNodes((currentNodes) => {
          onUpdateMap({ nodes: currentNodes as CustomNode[] });
          return currentNodes;
        });
      }
    },
    [onNodesChange, onUpdateMap, setNodes]
  );

  // Sync node positions to parent state ONLY when user finishes dragging (Mouse up / Touch release)
  const handleNodeDragStop = useCallback(() => {
    setNodes((currentNodes) => {
      onUpdateMap({ nodes: currentNodes as CustomNode[] });
      return currentNodes;
    });
  }, [onUpdateMap, setNodes]);

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
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: accentColor,
          width: 16,
          height: 16,
        },
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

  // Click on a node -> select it and open sidebar
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
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
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
          },
        }}
        proOptions={{ hideAttribution: true }}
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
