import { useState, useEffect, useCallback, useMemo } from 'react';
import { ReactFlowProvider, MarkerType, type Edge } from '@xyflow/react';
import type {
  CustomNode,
  MapData,
  NodeColor,
  AgentAction,
  ImportDataResult,
  FlashcardItem,
  SplitNodeResult,
} from './types';
import { StorageService, DEFAULT_STARTER_MAP } from './services/storage';
import { AiService } from './services/aiService';
import { computeHierarchicalTreeLayout } from './utils/treeLayout';
import { COLOR_SCHEMES } from './constants/theme';
import { Header } from './components/Header';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GistSyncModal } from './components/GistSyncModal';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { HelpModal } from './components/HelpModal';
import { NewMapModal } from './components/NewMapModal';
import { AiChatPanel } from './components/AiChatPanel';
import { AiSettingsModal } from './components/AiSettingsModal';
import { ConnectNodesModal } from './components/ConnectNodesModal';
import { MapContextModal } from './components/MapContextModal';
import { ImportConfirmModal } from './components/ImportConfirmModal';
import { GoogleDriveImportModal } from './components/GoogleDriveImportModal';
import { FlashcardModal } from './components/FlashcardModal';
import { useDeviceMode } from './hooks/useDeviceMode';
import {
  syncMapToSupabase,
  subscribeToRemoteMaps,
  uploadAttachmentToSupabase,
} from './services/supabase';
import confetti from 'canvas-confetti';

export function App() {
  const { isMobile, preference, changePreference } = useDeviceMode();
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [settings, setSettings] = useState(() => StorageService.getSettings());
  const [activeMapId, setActiveMapId] = useState<string>(() => {
    const saved = StorageService.getSettings().activeMapId;
    return saved || DEFAULT_STARTER_MAP.id;
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  // Modals
  const [isGistModalOpen, setIsGistModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isNewMapModalOpen, setIsNewMapModalOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState(false);
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
  const [pendingImportResult, setPendingImportResult] = useState<ImportDataResult | null>(null);

  // Trạng thái đang sinh mô tả ảnh ẩn cho AI
  const [loadingCaptionIds, setLoadingCaptionIds] = useState<string[]>([]);

  // Undo stack cho thao tác lớn trên bản đồ (Agent, Xếp cây, Tách nhánh)
  const [mapUndoStack, setMapUndoStack] = useState<
    Record<string, Array<{ nodes: CustomNode[]; edges: Edge[] }>>
  >({});

  // Khởi tạo IndexedDB và nạp dữ liệu bản đồ
  useEffect(() => {
    let isMounted = true;

    StorageService.init()
      .then(async () => {
        const loadedMaps = await StorageService.getMaps();
        if (!isMounted) return;

        setMaps(loadedMaps);

        // Xử lý deep link URL (?map=xxx&note=yyy) hoặc activeMapId đã lưu
        const params = new URLSearchParams(window.location.search);
        const paramMap = params.get('map');
        const paramNote = params.get('note');

        let targetMapId = loadedMaps[0]?.id || DEFAULT_STARTER_MAP.id;

        if (paramMap && loadedMaps.some((m) => m.id === paramMap)) {
          targetMapId = paramMap;
        } else {
          const savedActiveId = StorageService.getSettings().activeMapId;
          if (savedActiveId && loadedMaps.some((m) => m.id === savedActiveId)) {
            targetMapId = savedActiveId;
          }
        }

        setActiveMapId(targetMapId);

        if (paramNote) {
          const currentMap = loadedMaps.find((m) => m.id === targetMapId);
          if (currentMap?.nodes.some((n) => n.id === paramNote)) {
            setSelectedNodeId(paramNote);
            setFocusNodeId(paramNote);
          }
        }

        setIsStorageReady(true);
      })
      .catch((err) => {
        console.error('Lỗi khi nạp dữ liệu IndexedDB:', err);
        if (isMounted) setIsStorageReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  // Lưu snapshot vào Undo stack trước khi thực hiện các thao tác lớn trên bản đồ
  const pushUndoSnapshot = useCallback(
    (mapId: string, nodes: CustomNode[], edges: Edge[]) => {
      try {
        const snapshotNodes = JSON.parse(JSON.stringify(nodes)) as CustomNode[];
        const snapshotEdges = JSON.parse(JSON.stringify(edges)) as Edge[];
        setMapUndoStack((prev) => {
          const list = prev[mapId] || [];
          const nextList = [...list.slice(-14), { nodes: snapshotNodes, edges: snapshotEdges }];
          return {
            ...prev,
            [mapId]: nextList,
          };
        });
      } catch (e) {
        console.warn('Không thể tạo snapshot hoàn tác:', e);
      }
    },
    []
  );

  const canUndoMap = useMemo(() => {
    return Boolean((mapUndoStack[activeMap.id]?.length || 0) > 0);
  }, [mapUndoStack, activeMap.id]);

  // Hoàn tác bản đồ về trạng thái trước đó
  const handleUndoMap = useCallback(() => {
    const stack = mapUndoStack[activeMap.id] || [];
    if (stack.length === 0) return;

    const lastSnapshot = stack[stack.length - 1];
    setMapUndoStack((prev) => ({
      ...prev,
      [activeMap.id]: stack.slice(0, -1),
    }));

    handleUpdateCurrentMap({
      nodes: lastSnapshot.nodes,
      edges: lastSnapshot.edges,
    });
  }, [mapUndoStack, activeMap.id, handleUpdateCurrentMap]);

  // Tự động sắp xếp sơ đồ tư duy theo cấu trúc cây phân cấp cân đối
  const handleAutoLayoutMap = useCallback(() => {
    if (!activeMap.nodes || activeMap.nodes.length <= 1) return;
    pushUndoSnapshot(activeMap.id, activeMap.nodes, activeMap.edges);

    const layoutedNodes = computeHierarchicalTreeLayout(activeMap.nodes, activeMap.edges, {
      x: 420,
      y: 300,
    });

    handleUpdateCurrentMap({
      nodes: layoutedNodes,
    });
  }, [activeMap.id, activeMap.nodes, activeMap.edges, pushUndoSnapshot, handleUpdateCurrentMap]);

  // Hàm gọi AI tạo bản tóm tắt ẩn cho ảnh đính kèm (An toàn bất đồng bộ)
  const generateCaptionForAttachment = useCallback(
    async (
      targetMapId: string,
      attachId: string,
      imageSource: string,
      nodeLabel?: string,
      showAlertOnError = false
    ) => {
      if (!settings.aiApiKey?.trim()) {
        if (showAlertOnError) {
          alert('Vui lòng cài đặt API Key trong mục Trợ lý AI trước khi tạo tóm tắt ảnh!');
        }
        return;
      }

      setLoadingCaptionIds((prev) => (prev.includes(attachId) ? prev : [...prev, attachId]));
      try {
        const caption = await AiService.generateImageCaption({
          baseUrl: settings.aiBaseUrl || 'https://api.openai.com/v1',
          apiKey: settings.aiApiKey,
          model: settings.aiModel || 'gpt-4o-mini',
          imageBase64: imageSource,
          nodeLabel,
          mapContext: activeMap.context,
        });
        if (caption) {
          setMaps((prevMaps) =>
            prevMaps.map((m) => {
              if (m.id === targetMapId) {
                return {
                  ...m,
                  attachmentCaptions: {
                    ...(m.attachmentCaptions || {}),
                    [attachId]: caption,
                  },
                  updatedAt: Date.now(),
                };
              }
              return m;
            })
          );
        }
      } catch (err: unknown) {
        const e = err as Error;
        console.warn(`[AI Image Caption] Lỗi khi tóm tắt ảnh ${attachId}:`, e.message);
        if (showAlertOnError) {
          alert(`Không thể tạo mô tả cho ảnh (${attachId}): ${e.message}`);
        }
      } finally {
        setLoadingCaptionIds((prev) => prev.filter((id) => id !== attachId));
      }
    },
    [settings]
  );

  // Cập nhật thủ công bản tóm tắt ẩn của ảnh
  const handleUpdateAttachmentCaption = useCallback(
    (attachId: string, caption: string) => {
      setMaps((prevMaps) =>
        prevMaps.map((m) => {
          if (m.id === activeMap.id) {
            return {
              ...m,
              attachmentCaptions: {
                ...(m.attachmentCaptions || {}),
                [attachId]: caption,
              },
              updatedAt: Date.now(),
            };
          }
          return m;
        })
      );
    },
    [activeMap.id]
  );

  // Yêu cầu AI tạo / tạo lại bản tóm tắt ẩn cho 1 ảnh cụ thể
  const handleRegenerateAttachmentCaption = useCallback(
    async (attachId: string) => {
      const imageSource = activeMap.attachments?.[attachId];
      if (!imageSource) {
        alert('Không tìm thấy dữ liệu gốc của ảnh này!');
        return;
      }
      await generateCaptionForAttachment(
        activeMap.id,
        attachId,
        imageSource,
        selectedNode?.data.label || activeMap.name,
        true
      );
    },
    [activeMap.id, activeMap.attachments, activeMap.name, selectedNode, generateCaptionForAttachment]
  );

  // Save image attachment handler (Lưu file vào Desktop Vault nếu chạy Electron, hoặc tải lên Supabase CDN + Tự động tạo bản tóm tắt ẩn cho AI)
  const handleSaveAttachment = useCallback(
    async (attachId: string, base64: string) => {
      let finalUri = base64;

      // 1. Bản Desktop: Lưu thành file vật lý trong Documents\MindnoteVault\attachments\
      if (typeof window !== 'undefined' && window.mindnoteDesktop?.isDesktop) {
        try {
          const localAssetUrl = await window.mindnoteDesktop.saveAttachment(attachId, base64);
          if (localAssetUrl) {
            finalUri = localAssetUrl;
          }
        } catch (e) {
          console.warn('Lỗi khi lưu ảnh xuống máy tính:', e);
        }
      } else if (settings.supabaseUrl && settings.supabaseAnonKey) {
        // 2. Bản Web: Tải lên Supabase Storage CDN nếu có cấu hình
        try {
          const cdnUrl = await uploadAttachmentToSupabase(attachId, base64);
          if (cdnUrl) {
            finalUri = cdnUrl;
          }
        } catch (e) {
          console.warn('Không thể tải ảnh lên Supabase Storage, lưu tạm Base64:', e);
        }
      }

      const targetMapId = activeMap.id;
      setMaps((prevMaps) =>
        prevMaps.map((m) => {
          if (m.id === targetMapId) {
            return {
              ...m,
              attachments: {
                ...(m.attachments || {}),
                [attachId]: finalUri,
              },
              updatedAt: Date.now(),
            };
          }
          return m;
        })
      );

      // 3. Tự động gọi AI chạy ngầm để tạo bản tóm tắt ẩn cho bức ảnh vừa đính kèm (dùng base64 trực tiếp để nhanh & không phụ thuộc mạng tải lại)
      if (settings.aiApiKey?.trim()) {
        generateCaptionForAttachment(
          targetMapId,
          attachId,
          base64,
          selectedNode?.data.label || activeMap.name,
          false
        );
      }
    },
    [
      activeMap.id,
      activeMap.name,
      selectedNode,
      settings.supabaseUrl,
      settings.supabaseAnonKey,
      settings.aiApiKey,
      generateCaptionForAttachment,
    ]
  );

  // Auto-save maps to IndexedDB (Debounced 300ms)
  useEffect(() => {
    if (!isStorageReady || maps.length === 0) return;
    const timer = setTimeout(() => {
      StorageService.saveMaps(maps);
    }, 300);
    return () => clearTimeout(timer);
  }, [maps, isStorageReady]);

  // Tự động đồng bộ Map hiện tại lên Supabase Cloud (Debounced 1000ms để tối ưu băng thông)
  useEffect(() => {
    if (
      !isStorageReady ||
      settings.supabaseAutoSync === false ||
      !settings.supabaseUrl ||
      !settings.supabaseAnonKey
    ) {
      return;
    }
    const timer = setTimeout(() => {
      syncMapToSupabase(activeMap);
    }, 1000);
    return () => clearTimeout(timer);
  }, [activeMap, isStorageReady, settings.supabaseAutoSync, settings.supabaseUrl, settings.supabaseAnonKey]);

  // Lắng nghe kênh Realtime từ Supabase (Đồng bộ tức thì giữa máy tính và điện thoại qua WebSocket)
  useEffect(() => {
    if (
      !isStorageReady ||
      settings.supabaseRealtime === false ||
      !settings.supabaseUrl ||
      !settings.supabaseAnonKey
    ) {
      return;
    }

    const unsubscribe = subscribeToRemoteMaps(
      (remoteMap) => {
        setMaps((prev) => {
          const current = prev.find((m) => m.id === remoteMap.id);
          if (current) {
            // So sánh timestamp: Nếu bản đồ trên máy mới hơn (do người dùng vừa sửa lúc rớt mạng), BẢO TOÀN DỮ LIỆU TRÊN MÁY!
            if ((current.updatedAt || 0) > (remoteMap.updatedAt || 0)) {
              console.log('[Supabase Realtime] Bản đồ trên điện thoại mới hơn đám mây, bảo toàn và đẩy ngược lên mây:', current.name);
              syncMapToSupabase(current);
              return prev;
            }
            return prev.map((m) => (m.id === remoteMap.id ? remoteMap : m));
          } else {
            return [remoteMap, ...prev];
          }
        });
      },
      (deletedMapId) => {
        setMaps((prev) => prev.filter((m) => m.id !== deletedMapId));
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [isStorageReady, settings.supabaseRealtime, settings.supabaseUrl, settings.supabaseAnonKey]);

  // Auto-save settings (Debounced 300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      StorageService.saveSettings({ ...settings, activeMapId });
    }, 300);
    return () => clearTimeout(timer);
  }, [settings, activeMapId]);

  // Đồng bộ URL theo thời gian thực (để người dùng có thể copy luôn từ thanh URL trình duyệt)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (activeMapId) {
        url.searchParams.set('map', activeMapId);
      }
      if (selectedNodeId) {
        url.searchParams.set('note', selectedNodeId);
      } else {
        url.searchParams.delete('note');
      }
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      console.error(e);
    }
  }, [activeMapId, selectedNodeId]);

  // Chuyển hướng nội bộ khi click link map/note trong bài viết (Hỗ trợ cả ID lẫn Tên ô Wiki-link [[Tên ô]])
  const handleNavigateInternal = useCallback(
    (targetMapId?: string, targetNodeId?: string) => {
      let destinationMap = activeMap;

      if (targetMapId) {
        const foundMap = maps.find(
          (m) =>
            m.id === targetMapId ||
            m.name.trim().toLowerCase() === targetMapId.trim().toLowerCase()
        );
        if (foundMap) {
          destinationMap = foundMap;
          setActiveMapId(foundMap.id);
        }
      }

      if (targetNodeId) {
        const cleanTarget = targetNodeId.trim();
        const lowerTarget = cleanTarget.toLowerCase();

        // 1. Tìm trong bản đồ đích trước (theo ID chính xác -> Tên chính xác -> Tên gần đúng)
        let foundNode =
          destinationMap.nodes.find((n) => n.id === cleanTarget) ||
          destinationMap.nodes.find(
            (n) => (n.data.label || '').trim().toLowerCase() === lowerTarget
          ) ||
          destinationMap.nodes.find((n) =>
            (n.data.label || '').trim().toLowerCase().includes(lowerTarget)
          );

        // 2. Nếu chưa thấy, tìm xuyên qua tất cả các bản đồ khác
        if (!foundNode && !targetMapId) {
          for (const m of maps) {
            const candidate =
              m.nodes.find((n) => n.id === cleanTarget) ||
              m.nodes.find(
                (n) => (n.data.label || '').trim().toLowerCase() === lowerTarget
              );
            if (candidate) {
              foundNode = candidate;
              setActiveMapId(m.id);
              break;
            }
          }
        }

        const resolvedId = foundNode ? foundNode.id : cleanTarget;
        setSelectedNodeId(resolvedId);
        setFocusNodeId(resolvedId);
        setTimeout(() => setFocusNodeId(null), 150);
      }
    },
    [activeMap, maps]
  );

  // Lắng nghe sự kiện chuyển link từ bất kỳ đâu trên canvas
  useEffect(() => {
    const handleCanvasNav = (e: Event) => {
      const customEvent = e as CustomEvent<{ mapId?: string; noteId?: string }>;
      if (customEvent.detail) {
        handleNavigateInternal(customEvent.detail.mapId, customEvent.detail.noteId);
      }
    };
    window.addEventListener('canvas-navigate', handleCanvasNav);
    return () => window.removeEventListener('canvas-navigate', handleCanvasNav);
  }, [handleNavigateInternal]);

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

      pushUndoSnapshot(activeMap.id, activeMap.nodes, activeMap.edges);

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
    [activeMap.id, activeMap.nodes, activeMap.edges, pushUndoSnapshot, handleUpdateCurrentMap]
  );

  // Tách các ý phụ trong ô hiện tại sang các ô nhánh con mới và rút gọn ô gốc chỉ giữ lại ý chính
  const handleSplitNodeToBranches = useCallback(
    (parentNode: CustomNode, splitResult: SplitNodeResult) => {
      if (!splitResult || !splitResult.branches || splitResult.branches.length === 0) return;

      pushUndoSnapshot(activeMap.id, activeMap.nodes, activeMap.edges);

      const colors: NodeColor[] = ['cyan', 'emerald', 'amber', 'rose', 'indigo', 'purple', 'blue'];
      const newNodes: CustomNode[] = [];
      const newEdges: Edge[] = [];
      const total = splitResult.branches.length;

      splitResult.branches.forEach((b, idx) => {
        const newNodeId = `node-split-${Date.now()}-${idx}`;
        const posX = parentNode.position.x + 330;
        const posY = Math.round(parentNode.position.y + (idx - (total - 1) / 2) * 145);
        const color = b.color || colors[(idx + 1) % colors.length];
        const shape = b.shape || (b.content && b.content.length > 220 ? 'card' : 'pill');

        newNodes.push({
          id: newNodeId,
          type: 'mindmap',
          position: { x: posX, y: posY },
          data: {
            label: b.label,
            color,
            shape,
            content: b.content,
          },
        });

        const accentColor = COLOR_SCHEMES[parentNode.data.color || 'purple']?.accent || '#a855f7';
        newEdges.push({
          id: `e-${parentNode.id}-${newNodeId}-${Date.now()}-${idx}`,
          source: parentNode.id,
          target: newNodeId,
          type: 'custom',
          animated: true,
          style: {
            stroke: accentColor,
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: accentColor,
            width: 16,
            height: 16,
          },
        });
      });

      // Cập nhật nội dung ô gốc (chỉ giữ lại ý chính + Wiki-link tới các nhánh con) và thêm các ô nhánh mới
      const updatedExistingNodes = activeMap.nodes.map((n) => {
        if (n.id === parentNode.id) {
          return {
            ...n,
            data: {
              ...n.data,
              content: splitResult.remainingParentContent || n.data.content,
            },
          };
        }
        return n;
      });

      handleUpdateCurrentMap({
        nodes: [...updatedExistingNodes, ...newNodes],
        edges: [...activeMap.edges, ...newEdges],
      });

      try {
        confetti({
          particleCount: 55,
          spread: 65,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    },
    [activeMap.id, activeMap.nodes, activeMap.edges, pushUndoSnapshot, handleUpdateCurrentMap]
  );

  // Lưu danh sách Flashcard của bản đồ hiện tại
  const handleUpdateFlashcards = useCallback(
    (cards: FlashcardItem[]) => {
      handleUpdateCurrentMap({
        flashcards: cards,
      });
    },
    [handleUpdateCurrentMap]
  );

  // Apply batch changes generated by AI Agent (Create whole map or modify/add nodes and edges)
  const handleApplyAgentAction = useCallback(
    (action: AgentAction) => {
      if (!action || !action.nodes || action.nodes.length === 0) return;

      pushUndoSnapshot(activeMap.id, activeMap.nodes, activeMap.edges);

      const colors: NodeColor[] = ['purple', 'blue', 'emerald', 'amber', 'rose', 'cyan', 'indigo'];
      const nodeMap = new Map<string, string>(); // raw ID -> final ID
      const newCustomNodes: CustomNode[] = [];

      const centerX = 460;
      const centerY = 320;

      action.nodes.forEach((n, idx) => {
        const rawId = n.id ? String(n.id).trim() : `agent-node-${Date.now()}-${idx}`;
        const finalId = rawId.startsWith('node-') ? rawId : `node-${rawId}`;
        nodeMap.set(rawId, finalId);
        nodeMap.set(String(idx + 1), finalId); // Match 1-based indices like "1"
        nodeMap.set(n.label.toLowerCase().trim(), finalId);

        const color = n.color || colors[idx % colors.length];
        const shape = n.shape || (n.content && n.content.length > 200 ? 'card' : 'pill');

        newCustomNodes.push({
          id: finalId,
          type: 'mindmap',
          position: {
            x: n.position?.x !== undefined ? Math.round(n.position.x) : centerX,
            y: n.position?.y !== undefined ? Math.round(n.position.y) : centerY,
          },
          data: {
            label: n.label,
            color,
            shape,
            content: n.content || '',
          },
        });
      });

      // Generate clean Bezier connection edges
      const newCustomEdges: Edge[] = [];
      if (action.edges && action.edges.length > 0) {
        action.edges.forEach((e, edgeIdx) => {
          const rawSrc = String(e.source).trim();
          const rawTgt = String(e.target).trim();
          const finalSrc = nodeMap.get(rawSrc) || nodeMap.get(rawSrc.toLowerCase()) || rawSrc;
          const finalTgt = nodeMap.get(rawTgt) || nodeMap.get(rawTgt.toLowerCase()) || rawTgt;

          if (finalSrc && finalTgt && finalSrc !== finalTgt) {
            const srcNode =
              newCustomNodes.find((n) => n.id === finalSrc) ||
              activeMap.nodes.find((n) => n.id === finalSrc);
            const edgeColor = COLOR_SCHEMES[srcNode?.data.color || 'purple']?.accent || '#a855f7';

            newCustomEdges.push({
              id: e.id || `e-agent-${Date.now()}-${edgeIdx}`,
              source: finalSrc,
              target: finalTgt,
              type: 'custom',
              animated: true,
              style: { stroke: edgeColor, strokeWidth: 2 },
            });
          }
        });
      }

      if (action.type === 'create_map') {
        const treeLayoutNodes = computeHierarchicalTreeLayout(newCustomNodes, newCustomEdges, {
          x: centerX,
          y: centerY,
        });
        handleUpdateCurrentMap({
          nodes: treeLayoutNodes,
          edges: newCustomEdges,
        });
      } else {
        // modify_map: Merge with existing nodes
        const mergedNodes = [...activeMap.nodes];
        newCustomNodes.forEach((nn) => {
          const existingIdx = mergedNodes.findIndex(
            (en) => en.id === nn.id || en.data.label?.toLowerCase().trim() === nn.data.label?.toLowerCase().trim()
          );
          if (existingIdx >= 0) {
            mergedNodes[existingIdx] = {
              ...mergedNodes[existingIdx],
              data: {
                ...mergedNodes[existingIdx].data,
                ...nn.data,
              },
            };
          } else {
            mergedNodes.push(nn);
          }
        });

        // Merge edges
        const mergedEdges = [...activeMap.edges];
        newCustomEdges.forEach((ne) => {
          if (!mergedEdges.some((me) => me.source === ne.source && me.target === ne.target)) {
            mergedEdges.push(ne);
          }
        });

        const treeLayoutMergedNodes = computeHierarchicalTreeLayout(mergedNodes, mergedEdges, {
          x: centerX,
          y: centerY,
        });

        handleUpdateCurrentMap({
          nodes: treeLayoutMergedNodes,
          edges: mergedEdges,
        });
      }

      try {
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.5 },
        });
      } catch {
        // ignore
      }
    },
    [activeMap.id, activeMap.nodes, activeMap.edges, pushUndoSnapshot, handleUpdateCurrentMap]
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
        setIsImportModalOpen(false);
        setIsGoogleDriveModalOpen(false);
        setIsFlashcardModalOpen(false);
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

  // Export & Import Handlers
  const handleExportBackup = () => {
    StorageService.exportBackup(maps);
  };

  const handleExportSingleMap = (mapToExport: MapData) => {
    StorageService.exportSingleMap(mapToExport);
  };

  const handleExportGoogleDrive = async (mapToExport: MapData, isFullVault = false) => {
    if (!window.mindnoteDesktop?.isDesktop) {
      alert('Tính năng này dành cho bản Desktop đã kết nối Google Drive for Desktop.');
      return;
    }

    try {
      const res = await window.mindnoteDesktop.exportToGoogleDrive({
        map: mapToExport,
        maps: maps,
        isFullVault,
      });

      if (res.success) {
        confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
        alert(`🎉 Đã xuất thành công sang Google Drive!\n📁 File: ${res.fileName}\n📍 Thư mục: ${res.folder}\n\nGoogle Drive đang tự động đồng bộ lên đám mây.`);
      } else {
        alert(`Không thể lưu vào Google Drive: ${res.error || 'Lỗi không xác định'}`);
      }
    } catch (err: any) {
      alert(`Lỗi khi xuất sang Google Drive: ${err.message}`);
    }
  };

  const handlePickGoogleDrive = async () => {
    if (!window.mindnoteDesktop?.isDesktop) return;
    try {
      const rawData = await window.mindnoteDesktop.pickFromGoogleDrive();
      if (!rawData) return;
      const result = StorageService.parseImportData(rawData);
      setPendingImportResult(result);
      setIsImportModalOpen(true);
    } catch (e: unknown) {
      const err = e as Error;
      alert(`Lỗi khi đọc file từ Google Drive: ${err.message}`);
    }
  };

  const handleImportBackup = async (file: File) => {
    try {
      const result = await StorageService.importBackup(file);
      setPendingImportResult(result);
      setIsImportModalOpen(true);
    } catch (e: unknown) {
      const err = e as Error;
      alert(`Lỗi khi đọc file: ${err.message}`);
    }
  };

  const handleDesktopImport = async () => {
    if (!window.mindnoteDesktop?.isDesktop) return;
    try {
      const rawData = await window.mindnoteDesktop.importBackupDialog();
      if (!rawData) return; // Người dùng hủy chọn
      const result = StorageService.parseImportData(rawData);
      setPendingImportResult(result);
      setIsImportModalOpen(true);
    } catch (e: unknown) {
      const err = e as Error;
      alert(`Lỗi khi nạp file từ máy tính: ${err.message}`);
    }
  };

  // 1. Cập nhật đè lên Map hiện tại (Đồng thời tự động tạo bản lưu an toàn cho Map cũ)
  const handleConfirmUpdateExisting = async (importedMap: MapData, existingMapId: string) => {
    let finalMap = importedMap;
    if (window.mindnoteDesktop?.isDesktop) {
      try {
        finalMap = await window.mindnoteDesktop.normalizeImportedMap(importedMap);
      } catch (err) {
        console.warn('Lỗi normalize imported map:', err);
      }
    }

    const existingMap = maps.find((m) => m.id === existingMapId);
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    let updatedList: MapData[] = [];
    if (existingMap) {
      // Tự động sao lưu bản cũ vào kho để an toàn 100%
      const backupMap: MapData = {
        ...existingMap,
        id: `backup-${existingMap.id}-${now}`,
        name: `${existingMap.name} (Lưu dự phòng ${timeStr})`,
        updatedAt: now,
      };
      updatedList = maps.map((m) =>
        m.id === existingMapId ? { ...finalMap, id: existingMapId, updatedAt: now } : m
      );
      updatedList.push(backupMap);
    } else {
      updatedList = [...maps, { ...finalMap, id: existingMapId, updatedAt: now }];
    }

    setMaps(updatedList);
    setActiveMapId(existingMapId);
    setSelectedNodeId(null);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
  };

  // 2. Thêm thành Map mới độc lập
  const handleConfirmAddNewMap = async (importedMap: MapData) => {
    let finalMap = importedMap;
    if (window.mindnoteDesktop?.isDesktop) {
      try {
        finalMap = await window.mindnoteDesktop.normalizeImportedMap(importedMap);
      } catch (err) {
        console.warn('Lỗi normalize imported map:', err);
      }
    }

    const now = Date.now();
    const newId = `map-${now}`;
    const newName = maps.some(
      (m) => m.id === importedMap.id || m.name.trim().toLowerCase() === importedMap.name.trim().toLowerCase()
    )
      ? `${importedMap.name} (Bản mới)`
      : importedMap.name;

    const newMap: MapData = {
      ...finalMap,
      id: newId,
      name: newName,
      updatedAt: now,
    };

    setMaps((prev) => [...prev, newMap]);
    setActiveMapId(newId);
    setSelectedNodeId(null);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
  };

  // 3. Gộp file đa bản đồ vào kho hiện tại
  const handleConfirmMergeVault = async (importedMaps: MapData[]) => {
    let finalMaps = importedMaps;
    if (window.mindnoteDesktop?.isDesktop) {
      try {
        finalMaps = await Promise.all(
          importedMaps.map((m) => window.mindnoteDesktop!.normalizeImportedMap(m))
        );
      } catch (err) {
        console.warn('Lỗi normalize imported maps:', err);
      }
    }

    const mergedMap = new Map<string, MapData>();
    for (const m of maps) {
      mergedMap.set(m.id, m);
    }
    for (const m of finalMaps) {
      mergedMap.set(m.id, m);
    }

    const result = Array.from(mergedMap.values());
    setMaps(result);
    if (finalMaps.length > 0) {
      setActiveMapId(finalMaps[0].id);
      setSelectedNodeId(null);
    }
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.8 } });
  };

  // 4. Thay thế toàn bộ kho bằng file backup
  const handleConfirmReplaceVault = async (importedMaps: MapData[]) => {
    let finalMaps = importedMaps;
    if (window.mindnoteDesktop?.isDesktop) {
      try {
        finalMaps = await Promise.all(
          importedMaps.map((m) => window.mindnoteDesktop!.normalizeImportedMap(m))
        );
      } catch (err) {
        console.warn('Lỗi normalize imported maps:', err);
      }
    }

    setMaps(finalMaps);
    if (finalMaps.length > 0) {
      setActiveMapId(finalMaps[0].id);
      setSelectedNodeId(null);
    }
    confetti({ particleCount: 50, spread: 80, origin: { y: 0.8 } });
  };

  if (!isStorageReady) {
    return (
      <div className="w-screen h-screen bg-[#121215] flex flex-col items-center justify-center gap-3 select-none">
        <div className="w-9 h-9 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        <div className="text-xs font-medium text-zinc-400 tracking-wide">Đang nạp không gian ghi chú...</div>
      </div>
    );
  }

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
        onExportSingleMap={handleExportSingleMap}
        onExportGoogleDrive={handleExportGoogleDrive}
        onImportBackup={handleImportBackup}
        onDesktopImport={handleDesktopImport}
        onPickGoogleDrive={handlePickGoogleDrive}
        onOpenGoogleDriveModal={() => setIsGoogleDriveModalOpen(true)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenContextModal={() => setIsContextModalOpen(true)}
        hasContext={Boolean(activeMap.context?.trim())}
        hasSupabaseConfigured={Boolean(settings.supabaseUrl && settings.supabaseAnonKey)}
        hasDriveConfigured={Boolean(settings.googleDriveScriptUrl?.trim())}
        isAiOpen={isAiChatOpen}
        onToggleAi={() => setIsAiChatOpen((prev) => !prev)}
        onOpenFlashcardModal={() => setIsFlashcardModalOpen(true)}
        onAutoLayoutMap={handleAutoLayoutMap}
        canUndoMap={canUndoMap}
        onUndoMap={handleUndoMap}
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
            onNavigate={handleNavigateInternal}
            onDoubleClickedCanvas={handleAddNodeAtPosition}
            onAddNewNodeCenter={handleAddNodeCenter}
          />
        </ReactFlowProvider>
      </main>

      {/* Obsidian Note Detail Sidebar (Bottom Sheet on Mobile) */}
      <ErrorBoundary
        fallbackTitle="Không thể tải khung chi tiết ghi chú"
        onReset={() => setSelectedNodeId(null)}
      >
        <Sidebar
          selectedNode={selectedNode}
          activeMapId={activeMapId}
          allNodes={activeMap.nodes}
          edges={activeMap.edges}
          mapName={activeMap.name}
          mapContext={activeMap.context}
          onOpenContextModal={() => setIsContextModalOpen(true)}
          settings={settings}
          onAddBranchNodes={handleAddBranchNodes}
          onSplitNodeToBranches={handleSplitNodeToBranches}
          onOpenFlashcardModal={() => setIsFlashcardModalOpen(true)}
          onAddEdge={handleAddEdge}
          onDeleteEdge={handleDeleteEdge}
          onSelectNodeById={handleFocusNode}
          onNavigate={handleNavigateInternal}
          attachments={activeMap.attachments || {}}
          attachmentCaptions={activeMap.attachmentCaptions || {}}
          loadingCaptionIds={loadingCaptionIds}
          onUpdateAttachmentCaption={handleUpdateAttachmentCaption}
          onRegenerateAttachmentCaption={handleRegenerateAttachmentCaption}
          onUpdateSettings={handleSaveSettings}
          isMobile={isMobile}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onClose={() => setSelectedNodeId(null)}
          onSaveAttachment={handleSaveAttachment}
        />
      </ErrorBoundary>

      {/* Supabase Cloud Sync Modal */}
      <SupabaseSyncModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        maps={maps}
        onMapsLoaded={(loadedMaps) => {
          setMaps(loadedMaps);
          if (loadedMaps.length > 0) {
            const currentStillExists = loadedMaps.some((m) => m.id === activeMapId);
            if (!currentStillExists) {
              setActiveMapId(loadedMaps[0].id);
            }
            setSelectedNodeId(null);
          }
        }}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      {/* GitHub Gist Sync Modal */}
      <GistSyncModal
        isOpen={isGistModalOpen}
        onClose={() => setIsGistModalOpen(false)}
        maps={maps}
        onMapsLoaded={(loadedMaps) => {
          setMaps(loadedMaps);
          if (loadedMaps.length > 0) {
            const currentStillExists = loadedMaps.some((m) => m.id === activeMapId);
            if (!currentStillExists) {
              setActiveMapId(loadedMaps[0].id);
            }
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

      {/* AI Chat Panel (Floating on PC, Bottom sheet on Mobile, with AI Agent Mode) */}
      <AiChatPanel
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        activeMap={activeMap}
        settings={settings}
        isMobile={isMobile}
        onOpenSettings={() => setIsAiSettingsOpen(true)}
        onFocusNode={handleFocusNode}
        onAddNodeFromAi={handleAddNodeFromAi}
        onApplyAgentAction={handleApplyAgentAction}
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

      {/* Map Context / Knowledge Base Modal */}
      <MapContextModal
        isOpen={isContextModalOpen}
        mapName={activeMap.name}
        initialContext={activeMap.context || ''}
        onClose={() => setIsContextModalOpen(false)}
        onSaveContext={(ctx) => handleUpdateCurrentMap({ context: ctx })}
      />

      {/* Modal Xác Nhận Nhập Bản Đồ Đơn Lẻ / Khôi Phục Kho Thông Minh */}
      <ImportConfirmModal
        isOpen={isImportModalOpen}
        importResult={pendingImportResult}
        existingMaps={maps}
        onClose={() => {
          setIsImportModalOpen(false);
          setPendingImportResult(null);
        }}
        onUpdateExisting={handleConfirmUpdateExisting}
        onAddNewMap={handleConfirmAddNewMap}
        onMergeVault={handleConfirmMergeVault}
        onReplaceVault={handleConfirmReplaceVault}
      />

      {/* Modal Đồng Bộ Google Drive 1-Click (Web, Mobile & Desktop) */}
      <GoogleDriveImportModal
        isOpen={isGoogleDriveModalOpen}
        onClose={() => setIsGoogleDriveModalOpen(false)}
        maps={maps}
        activeMap={activeMap}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onSelectFromDevice={() => {
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          fileInput?.click();
        }}
        onDataLoaded={(result) => {
          setPendingImportResult(result);
          setIsImportModalOpen(true);
        }}
      />

      {/* Modal Ôn tập Flashcard & Tạo Flashcard AI từ nhiều ô */}
      <FlashcardModal
        isOpen={isFlashcardModalOpen}
        onClose={() => setIsFlashcardModalOpen(false)}
        activeMap={activeMap}
        selectedNodeId={selectedNodeId}
        settings={settings}
        onUpdateFlashcards={handleUpdateFlashcards}
        onFocusNode={handleFocusNode}
        onUpdateSettings={handleSaveSettings}
      />
    </div>
  );
}

export default App;
