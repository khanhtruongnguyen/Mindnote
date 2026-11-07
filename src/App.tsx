import { useState, useEffect, useCallback, useMemo } from 'react';
import { ReactFlowProvider, MarkerType, type Edge } from '@xyflow/react';
import type { CustomNode, MapData, NodeColor } from './types';
import { StorageService, DEFAULT_STARTER_MAP } from './services/storage';
import { COLOR_SCHEMES } from './constants/theme';
import { Header } from './components/Header';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { Sidebar } from './components/Sidebar';
import { GistSyncModal } from './components/GistSyncModal';
import { HelpModal } from './components/HelpModal';
import { NewMapModal } from './components/NewMapModal';
import { AiChatPanel } from './components/AiChatPanel';
import { AiSettingsModal } from './components/AiSettingsModal';
import { ConnectNodesModal } from './components/ConnectNodesModal';
import { useDeviceMode } from './hooks/useDeviceMode';
import confetti from 'canvas-confetti';

export function App() {
  const { isMobile, preference, changePreference } = useDeviceMode();
  const [maps, setMaps] = useState<MapData[]>(() => StorageService.getMaps());
  const [settings, setSettings] = useState(() => StorageService.getSettings());
  const [activeMapId, setActiveMapId] = useState<string>(() => {
    const saved = StorageService.getSettings().activeMapId;
    return maps.some((m) => m.id === saved) ? saved : maps[0]?.id || DEFAULT_STARTER_MAP.id;
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  // Modals
  const [isGistModalOpen, setIsGistModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isNewMapModalOpen, setIsNewMapModalOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Active Map reference
  const activeMap = useMemo(() => {
    return maps.find((m) => m.id === activeMapId) || maps[0] || DEFAULT_STARTER_MAP;
  }, [maps, activeMapId]);

  // Selected Node reference
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return activeMap.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [activeMap, selectedNodeId]);

  // Update current map data
  const handleUpdateCurrentMap = useCallback(
    (updates: Partial<MapData>) => {
      setMaps((prevMaps) =>
        prevMaps.map((m) => {
          if (m.id === activeMap.id) {
            return {
              ...m,
              ...updates,
              updatedAt: Date.now(),
            };
          }
          return m;
        })
      );
    },
    [activeMap.id]
  );

  // Save image attachment handler
  const handleSaveAttachment = useCallback(
    (attachId: string, base64: string) => {
      handleUpdateCurrentMap({
        attachments: {
          ...(activeMap.attachments || {}),
          [attachId]: base64,
        },
      });
    },
    [activeMap.attachments, handleUpdateCurrentMap]
  );

  // Auto-save maps to local storage
  useEffect(() => {
    StorageService.saveMaps(maps);
  }, [maps]);

  // Auto-save settings
  useEffect(() => {
    StorageService.saveSettings({ ...settings, activeMapId });
  }, [settings, activeMapId]);

  // Focus a node from AI chat click
  const handleFocusNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setFocusNodeId(nodeId);
    setTimeout(() => setFocusNodeId(null), 100);
  }, []);

  // Create node directly from AI chat response
  const handleAddNodeFromAi = useCallback(
    (label: string, content: string) => {
      const colors: NodeColor[] = ['purple', 'blue', 'emerald', 'amber', 'rose', 'cyan'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const newNodeId = `node-${Date.now()}`;
      const newNode: CustomNode = {
        id: newNodeId,
        type: 'mindmap',
        position: {
          x: 420 + (Math.random() * 100 - 50),
          y: 260 + (Math.random() * 100 - 50),
        },
        data: {
          label,
          color: randomColor,
          shape: 'card',
          content,
        },
      };

      handleUpdateCurrentMap({
        nodes: [...activeMap.nodes, newNode],
      });
      setSelectedNodeId(newNodeId);
      setFocusNodeId(newNodeId);
    },
    [activeMap.nodes, handleUpdateCurrentMap]
  );

  // Add AI-generated branch nodes connected to a parent node
  const handleAddBranchNodes = useCallback(
    (parentNode: CustomNode, branches: Array<{ label: string; content: string }>) => {
      if (!branches || branches.length === 0) return;

      const colors: NodeColor[] = ['cyan', 'emerald', 'amber', 'rose', 'indigo', 'purple'];
      const newNodes: CustomNode[] = [];
      const newEdges: Edge[] = [];

      branches.forEach((b, idx) => {
        const newNodeId = `node-branch-${Date.now()}-${idx}`;
        const posX = parentNode.position.x + 300;
        const posY = parentNode.position.y + (idx - (branches.length - 1) / 2) * 125;
        const color = colors[(idx + 2) % colors.length];

        newNodes.push({
          id: newNodeId,
          type: 'mindmap',
          position: { x: posX, y: posY },
          data: {
            label: b.label,
            color,
            shape: 'pill',
            content: b.content,
          },
        });

        newEdges.push({
          id: `e-${parentNode.id}-${newNodeId}-${Date.now()}`,
          source: parentNode.id,
          target: newNodeId,
          type: 'custom',
          animated: true,
          style: {
            stroke: COLOR_SCHEMES[parentNode.data.color || 'purple']?.accent || '#a855f7',
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: COLOR_SCHEMES[parentNode.data.color || 'purple']?.accent || '#a855f7',
            width: 16,
            height: 16,
          },
        });
      });

      handleUpdateCurrentMap({
        nodes: [...activeMap.nodes, ...newNodes],
        edges: [...activeMap.edges, ...newEdges],
      });

      try {
        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    },
    [activeMap.nodes, activeMap.edges, handleUpdateCurrentMap]
  );

  // Add connection edge between 2 nodes
  const handleAddEdge = useCallback(
    (sourceId: string, targetId: string) => {
      if (!sourceId || !targetId || sourceId === targetId) return;

      const exists = activeMap.edges.some(
        (e) => e.source === sourceId && e.target === targetId
      );
      if (exists) {
        alert('Hai ô này đã được nối với nhau rồi!');
        return;
      }

      const sourceNode = activeMap.nodes.find((n) => n.id === sourceId);
      const sourceColor = sourceNode?.data?.color || 'purple';
      const accentColor = COLOR_SCHEMES[sourceColor]?.accent || '#a855f7';

      const newEdge: Edge = {
        id: `e-${sourceId}-${targetId}-${Date.now()}`,
        source: sourceId,
        target: targetId,
        type: 'custom',
        animated: true,
        style: { stroke: accentColor, strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: accentColor,
          width: 16,
          height: 16,
        },
      };

      handleUpdateCurrentMap({
        edges: [...activeMap.edges, newEdge],
      });
    },
    [activeMap.edges, activeMap.nodes, handleUpdateCurrentMap]
  );

  // Delete edge
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      handleUpdateCurrentMap({
        edges: activeMap.edges.filter((e) => e.id !== edgeId),
      });
    },
    [activeMap.edges, handleUpdateCurrentMap]
  );

  // Update App Settings
  const handleSaveSettings = useCallback((updates: Partial<typeof settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      StorageService.saveSettings(next);
      return next;
    });
  }, []);

  // Keyboard shortcut listener (Escape to close modals/sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setIsGistModalOpen(false);
        setIsHelpModalOpen(false);
        setIsNewMapModalOpen(false);
        setIsAiSettingsOpen(false);
        setIsConnectModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Create new map
  const handleCreateNewMap = (name: string) => {
    const newMap: MapData = {
      id: `map-${Date.now()}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes: [
        {
          id: `node-${Date.now()}`,
          type: 'mindmap',
          position: { x: 350, y: 220 },
          data: {
            label: name,
            color: 'purple',
            shape: 'pill',
            content: `# ${name}\n\nNhấp đúp chuột vào canvas để thêm khái niệm con hoặc công thức.`,
          },
        },
      ],
      edges: [],
    };

    setMaps((prev) => [...prev, newMap]);
    setActiveMapId(newMap.id);
    setSelectedNodeId(null);
  };

  // Rename map
  const handleRenameMap = (mapId: string, newName: string) => {
    setMaps((prev) =>
      prev.map((m) => (m.id === mapId ? { ...m, name: newName, updatedAt: Date.now() } : m))
    );
  };

  // Delete map
  const handleDeleteMap = (mapId: string) => {
    if (maps.length <= 1) {
      alert('Bạn cần giữ ít nhất 1 bản đồ.');
      return;
    }
    const remaining = maps.filter((m) => m.id !== mapId);
    setMaps(remaining);
    if (activeMapId === mapId) {
      setActiveMapId(remaining[0].id);
      setSelectedNodeId(null);
    }
  };

  // Create a new node at a given canvas position
  const handleAddNodeAtPosition = useCallback(
    (position: { x: number; y: number }) => {
      const colors: NodeColor[] = ['purple', 'blue', 'emerald', 'amber', 'rose', 'cyan'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newNodeId = `node-${Date.now()}`;
      const newNode: CustomNode = {
        id: newNodeId,
        type: 'mindmap',
        position,
        data: {
          label: 'Ghi chú mới',
          color: randomColor,
          shape: 'pill',
          content: 'Nội dung ghi chú...',
        },
      };

      const updatedNodes = [...activeMap.nodes, newNode];
      handleUpdateCurrentMap({ nodes: updatedNodes });
      setSelectedNodeId(newNodeId);
    },
    [activeMap.nodes, handleUpdateCurrentMap]
  );

  // Add node at center via Header button
  const handleAddNodeCenter = () => {
    handleAddNodeAtPosition({
      x: 350 + (Math.random() * 80 - 40),
      y: 200 + (Math.random() * 80 - 40),
    });
  };

  // Update node data (title, content, color, shape)
  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<CustomNode['data']>) => {
      const updatedNodes = activeMap.nodes.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              ...updates,
            },
          };
        }
        return n;
      });
      handleUpdateCurrentMap({ nodes: updatedNodes });
    },
    [activeMap.nodes, handleUpdateCurrentMap]
  );

  // Delete node and its connected edges
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const updatedNodes = activeMap.nodes.filter((n) => n.id !== nodeId);
      const updatedEdges = activeMap.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );
      handleUpdateCurrentMap({
        nodes: updatedNodes,
        edges: updatedEdges,
      });
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [activeMap.nodes, activeMap.edges, selectedNodeId, handleUpdateCurrentMap]
  );

  // Export & Import
  const handleExportBackup = () => {
    StorageService.exportBackup(maps);
  };

  const handleImportBackup = async (file: File) => {
    try {
      const imported = await StorageService.importBackup(file);
      setMaps(imported);
      if (imported.length > 0) {
        setActiveMapId(imported[0].id);
        setSelectedNodeId(null);
      }
      alert(`Đã nhập thành công ${imported.length} bản đồ ghi chú!`);
    } catch (e: unknown) {
      const err = e as Error;
      alert(`Lỗi khi nhập file: ${err.message}`);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#121215] text-zinc-100 flex flex-col relative overflow-hidden font-sans">
      {/* Top Obsidian Header */}
      <Header
        maps={maps}
        activeMap={activeMap}
        isMobile={isMobile}
        devicePreference={preference}
        onChangeDeviceMode={changePreference}
        onSelectMap={(id) => {
          setActiveMapId(id);
          setSelectedNodeId(null);
        }}
        onOpenNewMapModal={() => setIsNewMapModalOpen(true)}
        onRenameMap={handleRenameMap}
        onDeleteMap={handleDeleteMap}
        onAddNode={handleAddNodeCenter}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onOpenGistModal={() => setIsGistModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        hasGistConfigured={Boolean(settings.githubToken && settings.gistId)}
        isAiOpen={isAiChatOpen}
        onToggleAi={() => setIsAiChatOpen((prev) => !prev)}
      />

      {/* Infinite Canvas Area */}
      <main
        style={{
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
        }}
        className="flex-1 w-full h-full relative overflow-hidden"
      >
        <ReactFlowProvider>
          <CanvasWorkspace
            mapData={activeMap}
            isMobile={isMobile}
            onUpdateMap={handleUpdateCurrentMap}
            selectedNodeId={selectedNodeId}
            focusNodeId={focusNodeId}
            onSelectNode={(node) => setSelectedNodeId(node?.id || null)}
            onDoubleClickedCanvas={handleAddNodeAtPosition}
            onAddNewNodeCenter={handleAddNodeCenter}
          />
        </ReactFlowProvider>
      </main>

      {/* Obsidian Note Detail Sidebar (Bottom Sheet on Mobile) */}
      <Sidebar
        selectedNode={selectedNode}
        allNodes={activeMap.nodes}
        edges={activeMap.edges}
        mapName={activeMap.name}
        settings={settings}
        onAddBranchNodes={handleAddBranchNodes}
        onAddEdge={handleAddEdge}
        onDeleteEdge={handleDeleteEdge}
        onSelectNodeById={handleFocusNode}
        attachments={activeMap.attachments || {}}
        isMobile={isMobile}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        onClose={() => setSelectedNodeId(null)}
        onSaveAttachment={handleSaveAttachment}
      />

      {/* GitHub Gist Sync Modal */}
      <GistSyncModal
        isOpen={isGistModalOpen}
        onClose={() => setIsGistModalOpen(false)}
        maps={maps}
        onMapsLoaded={(loadedMaps) => {
          setMaps(loadedMaps);
          if (loadedMaps.length > 0) {
            setActiveMapId(loadedMaps[0].id);
            setSelectedNodeId(null);
          }
        }}
        githubToken={settings.githubToken || ''}
        gistId={settings.gistId || ''}
        onSaveCredentials={(token, gistId) => {
          setSettings((prev) => ({
            ...prev,
            githubToken: token,
            gistId,
            lastSyncedAt: Date.now(),
          }));
        }}
      />

      {/* Shortcuts & Help Modal */}
      <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />

      {/* Create New Map Modal */}
      <NewMapModal
        isOpen={isNewMapModalOpen}
        onClose={() => setIsNewMapModalOpen(false)}
        onCreate={handleCreateNewMap}
      />

      {/* AI Chat Panel (Floating on PC, Bottom sheet on Mobile) */}
      <AiChatPanel
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        activeMap={activeMap}
        settings={settings}
        isMobile={isMobile}
        onOpenSettings={() => setIsAiSettingsOpen(true)}
        onFocusNode={handleFocusNode}
        onAddNodeFromAi={handleAddNodeFromAi}
        onUpdateSettings={handleSaveSettings}
      />

      {/* AI API & Model Settings Modal */}
      <AiSettingsModal
        isOpen={isAiSettingsOpen}
        onClose={() => setIsAiSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      {/* Connect Nodes Direct Selector Modal */}
      <ConnectNodesModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        nodes={activeMap.nodes}
        edges={activeMap.edges}
        onAddEdge={handleAddEdge}
        onDeleteEdge={handleDeleteEdge}
      />
    </div>
  );
}

export default App;
