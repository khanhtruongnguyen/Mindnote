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
  type OnConnect,
} from '@xyflow/react';
import type { CustomNode, MapData, MindMapNodeData } from '../types';
import { MindMapNode } from './nodes/MindMapNode';
import { COLOR_SCHEMES } from '../constants/theme';
import { MapPin, Sparkles } from 'lucide-react';

interface CanvasWorkspaceProps {
  mapData: MapData;
  onUpdateMap: (updated: Partial<MapData>) => void;
  selectedNodeId: string | null;
  onSelectNode: (node: CustomNode | null) => void;
  onDoubleClickedCanvas: (position: { x: number; y: number }) => void;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  mapData,
  onUpdateMap,
  selectedNodeId,
  onSelectNode,
  onDoubleClickedCanvas,
}) => {
  const { screenToFlowPosition } = useReactFlow();
  const [showMiniMap, setShowMiniMap] = useState(true);

  const nodeTypes = useMemo(() => ({ mindmap: MindMapNode }), []);

  // Map nodes with selected flag
  const formattedNodes = useMemo(() => {
    return mapData.nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    }));
  }, [mapData.nodes, selectedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(formattedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(mapData.edges);

  // Sync internal state with props when mapData changes (e.g. switching maps)
  React.useEffect(() => {
    setNodes(
      mapData.nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      }))
    );
  }, [mapData.id, mapData.nodes, selectedNodeId, setNodes]);

  React.useEffect(() => {
    setEdges(mapData.edges);
  }, [mapData.id, mapData.edges, setEdges]);

  // Propagate nodes changes to parent
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      // Notify parent on node movement / drag stop
      setTimeout(() => {
        setNodes((currentNodes) => {
          onUpdateMap({ nodes: currentNodes as CustomNode[] });
          return currentNodes;
        });
      }, 0);
    },
    [onNodesChange, onUpdateMap, setNodes]
  );

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
        type: 'default',
        animated: true,
        style: { stroke: accentColor, strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: accentColor,
          width: 16,
          height: 16,
        },
      };

      setEdges((eds) => {
        const nextEdges = addEdge(newEdge, eds);
        onUpdateMap({ edges: nextEdges });
        return nextEdges;
      });
    },
    [nodes, setEdges, onUpdateMap]
  );

  // Click on a node -> select it and open sidebar
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onSelectNode(node as CustomNode);
    },
    [onSelectNode]
  );

  // Click on empty canvas -> close sidebar
  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  // Double click on canvas -> create node right at mouse coordinate
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      // Don't trigger if target is an existing node or handle
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
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2.5}
        defaultEdgeOptions={{
          type: 'default',
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
          gap={24}
          size={1.2}
          color="#252532"
          className="bg-[#121215]"
        />

        {/* Minimal Controls */}
        <Controls
          showInteractive={false}
          className="!bottom-5 !left-5 !bg-[#181822] !border !border-[#2c2c3d] !rounded-xl overflow-hidden !shadow-xl"
        />

        {/* Obsidian-Style Collapsible MiniMap */}
        {showMiniMap && (
          <div className="absolute bottom-5 right-5 z-20 hidden md:block">
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

        {!showMiniMap && (
          <button
            onClick={() => setShowMiniMap(true)}
            title="Hiện Minimap"
            className="absolute bottom-5 right-5 z-20 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181822]/90 border border-[#2e2e3d] text-zinc-400 hover:text-white text-xs shadow-xl"
          >
            <MapPin className="w-3.5 h-3.5 text-purple-400" />
            <span>Minimap</span>
          </button>
        )}
      </ReactFlow>

      {/* Floating Center helper badge if map has no nodes */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-[#181822]/90 border border-[#2e2e3d] backdrop-blur-md rounded-2xl p-6 text-center max-w-sm pointer-events-auto shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Bản đồ đang trống</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Nhấp đúp chuột (Double click) vào bất kỳ vị trí nào hoặc nhấn nút bên dưới để tạo ô ghi chú đầu tiên.
            </p>
            <button
              onClick={() => {
                onDoubleClickedCanvas({ x: 300, y: 200 });
              }}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30"
            >
              + Tạo ghi chú đầu tiên
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
