import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  X,
  Send,
  Square,
  Settings,
  Trash2,
  ChevronDown,
  ChevronUp,
  Brain,
  MessageSquare,
  Minus,
  History,
  Plus,
  BookmarkPlus,
  Check,
  ToggleLeft,
  ToggleRight,
  Clock,
  GripHorizontal,
  RotateCcw,
  Wand2,
  Shuffle,
} from 'lucide-react';
import type { MapData, ChatMessage, ChatSession, AppSettings, AgentAction } from '../types';
import {
  AiService,
  cleanAiOutput,
  getRotationModels,
  getNextRotationModel,
} from '../services/aiService';
import { StorageService } from '../services/storage';
import { COLOR_SCHEMES } from '../constants/theme';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AiChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeMap: MapData;
  settings: AppSettings;
  isMobile?: boolean;
  onOpenSettings: () => void;
  onFocusNode: (nodeId: string) => void;
  onAddNodeFromAi?: (label: string, content: string) => void;
  onApplyAgentAction?: (action: AgentAction) => void;
  onUpdateSettings?: (updates: Partial<AppSettings>) => void;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  isOpen,
  onClose,
  activeMap,
  settings,
  isMobile = false,
  onOpenSettings,
  onFocusNode,
  onAddNodeFromAi,
  onApplyAgentAction,
  onUpdateSettings,
}) => {
  // Option: Save chat history enabled/disabled (default: true)
  const isHistoryEnabled = settings.saveChatHistory !== false;

  // AI Mode: 'chat' (Hỏi đáp, cố vấn) vs 'agent' (AI Agent tự động xây sửa map)
  const [chatMode, setChatMode] = useState<'chat' | 'agent'>('chat');
  const [autoApplyAgent, setAutoApplyAgent] = useState(false);

  // Multi-session state for this map
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // Current active session ID
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // UI state
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);

  // Model Rotation & Quick Switcher States
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [rotationToast, setRotationToast] = useState<string | null>(null);

  // Draggable Window State (Desktop)
  const [windowPos, setWindowPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  // Mouse drag handler on Desktop header
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    // Don't drag if user is clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, input, textarea, a, select, summary')) {
      return;
    }
    e.preventDefault();
    setIsDraggingWindow(true);

    const defaultWidth = 450;
    const defaultHeight = 640;
    const currentX = windowPos?.x ?? Math.max(20, window.innerWidth - defaultWidth - 24);
    const currentY = windowPos?.y ?? Math.max(70, window.innerHeight - defaultHeight - 24);

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentX,
      initialY: currentY,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      const deltaY = moveEvent.clientY - dragRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 460, dragRef.current.initialX + deltaX));
      const newY = Math.max(60, Math.min(window.innerHeight - 150, dragRef.current.initialY + deltaY));
      setWindowPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDraggingWindow(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResetPosition = () => {
    setWindowPos(null);
  };

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active session object
  const currentSession = sessions.find((s) => s.id === activeSessionId) || null;
  const messages = useMemo(() => currentSession?.messages || [], [currentSession?.messages]);

  // When activeMap changes, reload sessions for that map from IndexedDB
  useEffect(() => {
    let isMounted = true;
    StorageService.getChatSessions(activeMap.id).then((loaded) => {
      if (!isMounted) return;
      const cleaned = (loaded || []).map((sess) => ({
        ...sess,
        messages: (sess.messages || []).map((m) => ({
          ...m,
          content: cleanAiOutput(m.content),
        })),
      }));
      setSessions(cleaned);
      setActiveSessionId((prev) => (cleaned.some((s) => s.id === prev) ? prev : cleaned[0]?.id || null));
    });
    return () => {
      isMounted = false;
    };
  }, [activeMap.id]);

  // Auto-save sessions to IndexedDB if history is enabled
  useEffect(() => {
    if (isHistoryEnabled && sessions.length > 0) {
      StorageService.saveChatSessions(activeMap.id, sessions);
    }
  }, [sessions, activeMap.id, isHistoryEnabled]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, streamingReasoning]);

  if (!isOpen) return null;

  const currentModel = settings.aiModel || 'dungcsnd113/gemini-flash-3.8';
  const currentBaseUrl = settings.aiBaseUrl || 'https://api.xah.io/v1';
  const currentApiKey =
    settings.aiApiKey || 'sk-6e5bd68e2310d13bcf3747838f1cf8138d68e14e318e4e7e68cfb62a30aff59b';

  const rotationList = useMemo(
    () => getRotationModels(settings),
    [settings.preferredModels, settings.aiModel]
  );
  const nextRotationModel = useMemo(
    () => getNextRotationModel(currentModel, rotationList),
    [currentModel, rotationList]
  );

  const handleRotateModel = (targetModel?: string) => {
    const nextM = targetModel || nextRotationModel;
    onUpdateSettings?.({ aiModel: nextM });
    setIsModelDropdownOpen(false);
    setRotationToast(`Đã xoay vòng sang: ${nextM}`);
    setTimeout(() => setRotationToast(null), 2500);
  };

  // Helper to remove ```json:agent-action code block from natural text display (both complete & streaming)
  const stripAgentActionCodeBlock = (content: string): string => {
    return content
      .replace(/```(?:json:agent-action|json)[\s\S]*?```/gi, '')
      .replace(/```(?:json:agent-action)[\s\S]*$/gi, '\n\n> 🛠️ *AI Agent đang đóng gói cấu trúc các ô ghi chú & đường nối...*')
      .trim();
  };

  // Quick Prompt Prompts for Chat Mode
  const quickPrompts = [
    { label: '📊 Tóm tắt bản đồ', prompt: 'Hãy tóm tắt ngắn gọn các luận điểm cốt lõi trong sơ đồ tư duy này.' },
    { label: '🔍 Tìm điểm thiếu sót', prompt: 'Dựa trên sơ đồ hiện tại, bạn thấy tôi có đang bỏ quên khâu, định lý hoặc liên kết logic quan trọng nào không?' },
    { label: '📐 Soát công thức toán', prompt: 'Hãy kiểm tra lại các công thức toán học và định nghĩa trong các ô xem có chính xác chưa.' },
    { label: '💡 Gợi ý mở rộng', prompt: 'Hãy đề xuất cho tôi 3 ý tưởng/nhánh con mới có thể nối tiếp từ sơ đồ này.' },
  ];

  // Quick Prompt Prompts for Agent Mode (Xây dựng & Chỉnh sửa Mind Map)
  const agentQuickPrompts = [
    { label: '🚀 Tạo toàn bộ Map từ Đề cương', prompt: 'Hãy đọc kỹ đề cương/ngữ cảnh của bản đồ và xây dựng toàn bộ sơ đồ Mind Map hoàn chỉnh gồm các chủ đề chính, nhánh con và công thức KaTeX chi tiết.' },
    { label: '🌿 Thêm nhánh bài tập chuyên sâu', prompt: 'Dựa trên các ô hiện có trong bản đồ, hãy tạo thêm 3 ô nhánh bài tập vận dụng nâng cao và liên kết vào các chủ đề tương ứng.' },
    { label: '🔗 Tự động nối các ô liên quan', prompt: 'Hãy phân tích các ô hiện có trong bản đồ và tạo các đường liên kết logic giữa các khái niệm có mối tương quan mật thiết.' },
    { label: '📑 Hoàn thiện nội dung & Công thức', prompt: 'Hãy bổ sung và làm phong phú nội dung cho các ô hiện có, thêm công thức KaTeX, định nghĩa chuẩn xác và các ví dụ minh họa.' },
  ];

  // Apply Agent Action from a specific chat message
  const handleApplyMessageAction = (msg: ChatMessage) => {
    if (!msg.agentAction || !onApplyAgentAction) return;
    onApplyAgentAction(msg.agentAction);
    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === msg.id ? { ...m, isApplied: true } : m
        ),
      }))
    );
  };

  // Create a brand new chat session
  const handleCreateNewSession = () => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newSessionId,
      mapId: activeMap.id,
      title: 'Đoạn chat mới',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSessionId);
    setIsHistoryDrawerOpen(false);
  };

  // Delete a specific session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Xóa đoạn chat này khỏi lịch sử?')) {
      const nextSessions = sessions.filter((s) => s.id !== sessionId);
      setSessions(nextSessions);
      await StorageService.deleteChatSession(activeMap.id, sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(nextSessions[0]?.id || null);
      }
    }
  };

  // Clear all sessions
  const handleClearAllHistory = async () => {
    if (confirm('Bạn có chắc muốn xóa TOÀN BỘ lịch sử đoạn chat của bản đồ này?')) {
      setSessions([]);
      setActiveSessionId(null);
      await StorageService.clearAllChatSessions(activeMap.id);
      setIsHistoryDrawerOpen(false);
    }
  };

  // Toggle Save History mode
  const handleToggleHistoryMode = async () => {
    const nextVal = !isHistoryEnabled;
    onUpdateSettings?.({ saveChatHistory: nextVal });
    if (!nextVal) {
      if (confirm('Bạn đang tắt chế độ lưu lịch sử. Bạn có muốn xóa luôn các đoạn chat đã lưu trước đó không?')) {
        setSessions([]);
        setActiveSessionId(null);
        await StorageService.clearAllChatSessions(activeMap.id);
      }
    }
  };

  // Save an AI message directly as a new MindMap node
  const handleSaveToNode = (content: string, msgId: string) => {
    const cleanContent = cleanAiOutput(content);
    // Derive a nice label (first 35 chars or first line)
    const firstLine = cleanContent.split('\n')[0].replace(/^[#*\-•>\s]+/, '').trim();
    const label = firstLine.slice(0, 35) || 'Ghi chú AI';

    if (onAddNodeFromAi) {
      onAddNodeFromAi(label, cleanContent);
      setCopiedNodeId(msgId);
      setTimeout(() => setCopiedNodeId(null), 2500);
    }
  };

  // Send message
  const handleSendMessage = async (userTextToSend?: string) => {
    const text = (userTextToSend || input).trim();
    if (!text || isStreaming) return;

    if (!userTextToSend) {
      setInput('');
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };

    let targetSessionId = activeSessionId;
    let updatedSessions = [...sessions];

    // If no active session exists, create one automatically
    if (!targetSessionId || !sessions.some((s) => s.id === targetSessionId)) {
      targetSessionId = `session-${Date.now()}`;
      const newSession: ChatSession = {
        id: targetSessionId,
        mapId: activeMap.id,
        title: text.slice(0, 32),
        messages: [userMessage],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      updatedSessions = [newSession, ...updatedSessions];
      setActiveSessionId(targetSessionId);
    } else {
      updatedSessions = updatedSessions.map((s) => {
        if (s.id === targetSessionId) {
          const isFirstMessage = s.messages.length === 0;
          return {
            ...s,
            title: isFirstMessage ? text.slice(0, 32) : s.title,
            messages: [...s.messages, userMessage],
            updatedAt: Date.now(),
          };
        }
        return s;
      });
    }

    setSessions(updatedSessions);

    setIsStreaming(true);
    setStreamingContent('');
    setStreamingReasoning('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const systemPrompt = chatMode === 'agent'
        ? AiService.buildAgentSystemPrompt(activeMap)
        : AiService.buildMindMapSystemPrompt(activeMap);
      const activeSession = updatedSessions.find((s) => s.id === targetSessionId);
      const currentMessages = activeSession?.messages || [userMessage];

      const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...currentMessages.slice(-8).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      // Danh sách các model để thử (nếu bật tự động xoay vòng khi lỗi)
      const modelsToTry =
        settings.autoFallbackModel !== false
          ? [currentModel, ...rotationList.filter((m) => m !== currentModel).slice(0, 2)]
          : [currentModel];

      let lastError: Error | null = null;
      let result: { content: string; reasoning: string } | null = null;
      let modelActuallyUsed = currentModel;
      let wasAutoRotated = false;

      for (let i = 0; i < modelsToTry.length; i++) {
        const tryModel = modelsToTry[i];
        if (i > 0) {
          wasAutoRotated = true;
          setStreamingContent(
            `⚠️ Model \`${modelsToTry[i - 1]}\` ngắt kết nối. Đang tự động xoay vòng sang \`${tryModel}\`...`
          );
        }

        try {
          result = await AiService.streamChatCompletion({
            baseUrl: currentBaseUrl,
            apiKey: currentApiKey,
            model: tryModel,
            messages: apiMessages,
            signal: controller.signal,
            onChunk: (_chunk, fullContent) => {
              // Clean output in real-time to prevent Chinese telemetry leak
              setStreamingContent(cleanAiOutput(fullContent));
            },
            onReasoning: (_chunk, fullReasoning) => {
              setStreamingReasoning(fullReasoning);
            },
          });
          modelActuallyUsed = tryModel;
          lastError = null;
          break;
        } catch (tryErr: unknown) {
          const e = tryErr as Error;
          if (e.name === 'AbortError') throw e;
          lastError = e;
          console.warn(`[AI Chat] Thử model ${tryModel} thất bại:`, e.message);
        }
      }

      if (lastError || !result) {
        throw lastError || new Error('Không thể kết nối đến máy chủ AI.');
      }

      // Nếu đã tự động xoay vòng sang model dự phòng thành công, lưu lại cấu hình
      if (wasAutoRotated && onUpdateSettings) {
        onUpdateSettings({ aiModel: modelActuallyUsed });
      }

      let fullCleanContent = cleanAiOutput(result.content);
      if (wasAutoRotated) {
        fullCleanContent = `> 💡 *Model gốc \`${currentModel}\` bị gián đoạn, AI đã tự động xoay vòng sang \`${modelActuallyUsed}\`.*\n\n${fullCleanContent}`;
      }

      const detectedAction = chatMode === 'agent'
        ? AiService.extractAgentAction(fullCleanContent)
        : null;

      let appliedDirectly = false;
      if (detectedAction && autoApplyAgent && onApplyAgentAction) {
        onApplyAgentAction(detectedAction);
        appliedDirectly = true;
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: fullCleanContent || '(Không có phản hồi)',
        reasoningContent: result.reasoning || undefined,
        agentAction: detectedAction || undefined,
        isApplied: appliedDirectly,
        createdAt: Date.now(),
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: [...s.messages, assistantMessage],
              updatedAt: Date.now(),
            };
          }
          return s;
        })
      );
    } catch (e: unknown) {
      const err = e as Error;
      if (err.name !== 'AbortError') {
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content: `⚠️ **Lỗi kết nối Model (${settings.aiModel || 'Hiện tại'}):** ${err.message || 'Không thể kết nối đến AI. Hãy kiểm tra API Key hoặc xoay vòng sang Model khác.'}`,
          retryPrompt: text,
          failedModel: settings.aiModel,
          createdAt: Date.now(),
        };
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                messages: [...s.messages, errorMessage],
                updatedAt: Date.now(),
              };
            }
            return s;
          })
        );
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingReasoning('');
      abortControllerRef.current = null;
    }
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      if (streamingContent) {
        const stoppedMessage: ChatMessage = {
          id: `msg-${Date.now()}-stopped`,
          role: 'assistant',
          content: cleanAiOutput(streamingContent) + ' *(đã dừng)*',
          reasoningContent: streamingReasoning || undefined,
          createdAt: Date.now(),
        };
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === activeSessionId) {
              return {
                ...s,
                messages: [...s.messages, stoppedMessage],
                updatedAt: Date.now(),
              };
            }
            return s;
          })
        );
      }
      setStreamingContent('');
      setStreamingReasoning('');
    }
  };

  // Minimized Floating Pill View
  if (isMinimized) {
    return (
      <div
        style={{
          bottom: isMobile ? 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' : '1.5rem',
          right: '1.25rem',
        }}
        className="fixed z-40 animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-xs shadow-[0_8px_25px_rgba(124,58,237,0.5)] border border-purple-400/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
          <span>Hỏi đáp Mind Map</span>
          {sessions.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        left: !isMobile && windowPos ? `${windowPos.x}px` : undefined,
        top: !isMobile && windowPos ? `${windowPos.y}px` : undefined,
        bottom: isMobile ? '0px' : windowPos ? undefined : '1.5rem',
        right: isMobile ? '0px' : windowPos ? undefined : '1.5rem',
        maxHeight: isMobile ? '84vh' : '640px',
        width: isMobile ? '100%' : '450px',
        userSelect: isDraggingWindow ? 'none' : undefined,
      }}
      className={`fixed z-40 flex flex-col bg-[#14141e]/95 backdrop-blur-xl border border-[#2b2b3d] shadow-2xl transition-shadow duration-150 overflow-hidden ${
        isDraggingWindow ? 'ring-2 ring-purple-500/60 shadow-[0_25px_60px_rgba(0,0,0,0.9)]' : ''
      } ${isMobile ? 'rounded-t-3xl border-b-0' : 'rounded-2xl h-[640px]'}`}
    >
      {/* Mobile drag handle */}
      {isMobile && (
        <div className="w-full flex justify-center pt-2.5 pb-1 cursor-grab">
          <div className="w-12 h-1 bg-zinc-600 rounded-full" />
        </div>
      )}

      {/* Header (Draggable on Desktop) */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className={`flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-[#252535] bg-[#101018]/90 select-none ${
          !isMobile ? 'cursor-grab active:cursor-grabbing hover:bg-[#12121a]' : ''
        }`}
        title={!isMobile ? 'Nhấn giữ chuột và kéo để di chuyển cửa sổ AI khắp màn hình' : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!isMobile && (
            <div
              className="p-1 text-zinc-500 hover:text-purple-300 transition-colors"
              title="Kéo thả để di chuyển vị trí cửa sổ"
            >
              <GripHorizontal className="w-4 h-4" />
            </div>
          )}

          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-md shadow-purple-600/30 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-white tracking-wide truncate">
                Trợ lý Mind Map AI
              </h3>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            </div>

            {/* Model Pill & Quick Rotation Switcher */}
            <div className="relative flex items-center gap-1">
              <button
                onClick={() => setIsModelDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-purple-300 font-mono truncate max-w-[120px] sm:max-w-[150px] transition-colors cursor-pointer group"
                title="Nhấp để chọn nhanh Model trong danh sách xoay vòng"
              >
                <Brain className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                <span className="truncate">{currentModel}</span>
                <ChevronDown className="w-2.5 h-2.5 text-zinc-500 group-hover:text-purple-300 shrink-0" />
              </button>

              {/* Nút xoay vòng nhanh sang model tiếp theo */}
              <button
                onClick={() => handleRotateModel()}
                className="p-1 rounded text-zinc-400 hover:text-purple-200 hover:bg-purple-600/30 transition-all cursor-pointer"
                title={`Xoay vòng sang model tiếp theo: ${nextRotationModel}`}
              >
                <Shuffle className="w-2.5 h-2.5 text-purple-400" />
              </button>

              {/* Toast thông báo xoay vòng */}
              {rotationToast && (
                <div className="absolute top-6 left-0 z-50 px-2 py-0.5 rounded-lg bg-purple-950/95 border border-purple-500/60 text-purple-200 text-[10px] font-mono shadow-xl whitespace-nowrap animate-in fade-in duration-100">
                  {rotationToast}
                </div>
              )}

              {/* Popup Dropdown chọn nhanh model */}
              {isModelDropdownOpen && (
                <div className="absolute top-6 left-0 z-50 w-60 bg-[#161622] border border-[#2e2e42] rounded-xl shadow-2xl p-1.5 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 border-b border-zinc-800 flex items-center justify-between">
                    <span>DS Xoay vòng ({rotationList.length}):</span>
                    <button
                      onClick={() => {
                        setIsModelDropdownOpen(false);
                        onOpenSettings();
                      }}
                      className="text-purple-400 hover:underline cursor-pointer"
                    >
                      Cài đặt ⚙️
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {rotationList.map((m) => {
                      const isCurrent = m === currentModel;
                      return (
                        <button
                          key={m}
                          onClick={() => handleRotateModel(m)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-[11px] font-mono transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-purple-600/30 text-purple-200 font-bold border border-purple-500/40'
                              : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-white'
                          }`}
                        >
                          <span className="truncate pr-1">{m}</span>
                          {isCurrent && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1 border-t border-zinc-800">
                    <button
                      onClick={() => handleRotateModel()}
                      className="w-full py-1 px-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 font-medium text-center flex items-center justify-center gap-1.5 text-[10px] transition-colors cursor-pointer"
                    >
                      <Shuffle className="w-3 h-3" />
                      <span>Xoay vòng tiếp: {nextRotationModel}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Reset position button if window was moved */}
          {!isMobile && windowPos && (
            <button
              onClick={handleResetPosition}
              title="Đưa cửa sổ về vị trí góc dưới mặc định"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-purple-300 hover:bg-[#20202e] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* History Drawer Toggle Button */}
          <button
            onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
            title="Lịch sử các đoạn chat"
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
              isHistoryDrawerOpen
                ? 'bg-purple-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-[#20202e]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            {sessions.length > 0 && (
              <span className="text-[10px] font-semibold px-1 rounded-full bg-purple-500/30 text-purple-200">
                {sessions.length}
              </span>
            )}
          </button>

          {/* New Chat Button */}
          <button
            onClick={handleCreateNewSession}
            title="Bắt đầu đoạn chat mới"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#20202e] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Cài đặt API & Model"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#20202e] transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {!isMobile && (
            <button
              onClick={() => setIsMinimized(true)}
              title="Thu nhỏ cửa sổ"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#20202e] transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onClose}
            title="Đóng"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#20202e] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mode Switcher: Hỏi đáp (Chat) vs AI Agent (Xây & Sửa Map) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#101017] border-b border-[#252535] shrink-0 select-none">
        <div className="flex items-center gap-1 bg-[#181822] p-0.5 rounded-lg border border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => setChatMode('chat')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              chatMode === 'chat'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            <span>Hỏi đáp</span>
          </button>

          <button
            type="button"
            onClick={() => setChatMode('agent')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              chatMode === 'agent'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wand2 className="w-3 h-3 text-purple-300 animate-pulse" />
            <span>AI Agent (Xây sửa Map)</span>
          </button>
        </div>

        {chatMode === 'agent' ? (
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none hover:text-zinc-200">
            <input
              type="checkbox"
              checked={autoApplyAgent}
              onChange={(e) => setAutoApplyAgent(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span className="hidden sm:inline">Tự áp dụng vào Map</span>
          </label>
        ) : (
          <div className="text-[10px] text-zinc-500 italic hidden sm:block">
            Giải thích & cố vấn
          </div>
        )}
      </div>

      {/* History Drawer Overlay (when user clicks History button) */}
      {isHistoryDrawerOpen ? (
        <div className="flex-1 flex flex-col bg-[#12121a] overflow-hidden p-3.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white">Lịch sử các đoạn chat</span>
            </div>

            <button
              onClick={handleCreateNewSession}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Đoạn chat mới</span>
            </button>
          </div>

          {/* Auto-Save Toggle Option */}
          <div className="flex items-center justify-between py-2.5 px-2 my-2 bg-[#171722] rounded-xl border border-zinc-800/80">
            <div className="text-[11px]">
              <span className="font-semibold text-zinc-200">Lưu lịch sử đoạn chat</span>
              <p className="text-[10px] text-zinc-500">
                {isHistoryEnabled ? 'Đang bật lưu tự động trên trình duyệt' : 'Đang tắt (không lưu)'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleHistoryMode}
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              {isHistoryEnabled ? (
                <ToggleRight className="w-6 h-6 text-purple-500" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-zinc-600" />
              )}
            </button>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 py-1">
            {sessions.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-xs">
                Chưa có lịch sử đoạn chat nào cho bản đồ này.
              </div>
            ) : (
              sessions.map((sess) => {
                const isActive = sess.id === activeSessionId;
                return (
                  <div
                    key={sess.id}
                    onClick={() => {
                      setActiveSessionId(sess.id);
                      setIsHistoryDrawerOpen(false);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isActive
                        ? 'bg-purple-600/20 border-purple-500/40 text-purple-200 shadow-sm'
                        : 'bg-[#181824] border-[#29293a] text-zinc-300 hover:bg-[#202030] hover:text-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-xs font-medium truncate">{sess.title}</div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{new Date(sess.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>{sess.messages.length} tin nhắn</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteSession(sess.id, e)}
                      title="Xóa đoạn chat này"
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Clear all footer */}
          {sessions.length > 0 && (
            <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-[11px]">
              <button
                onClick={handleClearAllHistory}
                className="text-rose-400 hover:text-rose-300 transition-colors"
              >
                Xóa tất cả lịch sử
              </button>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Regular Chat Messages Body */
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
          {messages.length === 0 && (
            <div className="py-6 px-3 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 border border-purple-500/30 text-purple-300 flex items-center justify-center mx-auto shadow-inner">
                {chatMode === 'agent' ? <Wand2 className="w-6 h-6 animate-pulse" /> : <MessageSquare className="w-6 h-6" />}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-1">
                  {chatMode === 'agent'
                    ? `AI Agent Sẵn sàng Xây sửa "${activeMap.name}"`
                    : `Sẵn sàng giải đáp về "${activeMap.name}"`}
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  {chatMode === 'agent'
                    ? 'Bạn có thể dán đề cương vào Ngữ cảnh rồi yêu cầu: Agent sẽ tự động tạo các ô kiến thức, công thức KaTeX và nối đường liên kết logic!'
                    : `AI đã nạp cấu trúc gồm ${activeMap.nodes.length} ô ghi chú và các liên kết. 100% bằng tiếng Việt và hỗ trợ công thức toán học!`}
                </p>
              </div>

              {/* Quick action buttons */}
              <div className="flex flex-col gap-1.5 text-left pt-2">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1">
                  {chatMode === 'agent' ? 'Lệnh Agent mẫu:' : 'Gợi ý câu hỏi nhanh:'}
                </span>
                {(chatMode === 'agent' ? agentQuickPrompts : quickPrompts).map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q.prompt)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#1a1a26] hover:bg-[#222233] border border-[#2d2d3e] hover:border-purple-500/40 text-zinc-300 hover:text-white text-xs transition-colors group cursor-pointer text-left"
                  >
                    <span className="font-medium">{q.label}</span>
                    <span className="text-[10px] text-zinc-500 group-hover:text-purple-300">Chạy ➔</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl p-3 shadow-md ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs'
                    : 'bg-[#1b1b27] border border-[#2b2b3d] text-zinc-200 rounded-bl-xs'
                }`}
              >
                {/* Reasoning accordion if available */}
                {msg.reasoningContent && (
                  <div className="mb-2 pb-2 border-b border-zinc-700/50">
                    <details className="text-[11px] text-zinc-400">
                      <summary className="cursor-pointer text-purple-300 font-mono hover:text-purple-200 select-none flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        <span>Quá trình suy luận (Reasoning)</span>
                      </summary>
                      <div className="mt-1.5 p-2 rounded-lg bg-black/40 text-zinc-400 font-mono text-[10px] leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                        {msg.reasoningContent}
                      </div>
                    </details>
                  </div>
                )}

                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <>
                    <MarkdownRenderer
                      content={stripAgentActionCodeBlock(cleanAiOutput(msg.content))}
                      attachments={activeMap.attachments}
                      onNodeClick={onFocusNode}
                    />

                    {/* AI Agent Action Execution Card (Khung Áp dụng Thao tác Agent) */}
                    {msg.agentAction && (
                      <div className="mt-3 p-3 rounded-xl bg-[#13131c] border border-purple-500/40 shadow-lg space-y-2.5">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                            <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                            <span>
                              {msg.agentAction.type === 'create_map'
                                ? '🚀 Kế hoạch: Xây mới toàn bộ Bản đồ'
                                : '⚡ Kế hoạch: Cập nhật & Thêm nhánh'}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/30">
                            {msg.agentAction.nodes.length} ô • {(msg.agentAction.edges || []).length} đường nối
                          </span>
                        </div>

                        {msg.agentAction.summary && (
                          <p className="text-[11px] text-zinc-300 leading-relaxed font-medium">
                            {msg.agentAction.summary}
                          </p>
                        )}

                        {/* Visual Chips of Generated Nodes */}
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-semibold text-zinc-500">
                            Các ô sẽ được tạo / cập nhật:
                          </span>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto py-1">
                            {msg.agentAction.nodes.map((n, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1e1e2d] border border-zinc-700/60 text-[10px] text-zinc-200 font-medium"
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    COLOR_SCHEMES[n.color || 'purple']?.dot || 'bg-purple-400'
                                  }`}
                                />
                                <span className="truncate max-w-[130px]">{n.label}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Apply Button */}
                        {onApplyAgentAction && (
                          <div className="pt-1 flex items-center justify-end">
                            {msg.isApplied ? (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold py-1 px-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span>Đã áp dụng vào Bản đồ thành công</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleApplyMessageAction(msg)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition-all hover:scale-[1.02] cursor-pointer"
                              >
                                <Wand2 className="w-3.5 h-3.5" />
                                <span>⚡ Áp dụng vào Map ngay</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action: Create Node from this AI message */}
                    {onAddNodeFromAi && !msg.agentAction && !msg.retryPrompt && (
                      <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleSaveToNode(msg.content, msg.id)}
                          className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 px-2 py-1 rounded-lg border border-purple-500/25 transition-all cursor-pointer"
                          title="Tạo một ô ghi chú mới trên bản đồ từ phản hồi này"
                        >
                          {copiedNodeId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-300 font-semibold">Đã tạo ô note!</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3 h-3" />
                              <span>Tạo thành ô note trên sơ đồ</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Nút 1-click xoay vòng model & thử lại câu hỏi khi gặp lỗi */}
                    {msg.retryPrompt && (
                      <div className="mt-2.5 pt-2 border-t border-rose-500/20 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const nextM = getNextRotationModel(settings.aiModel, rotationList);
                            handleRotateModel(nextM);
                            setTimeout(() => handleSendMessage(msg.retryPrompt), 50);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-all shadow-sm cursor-pointer hover:scale-[1.02]"
                          title="Xoay sang model tiếp theo và tự động gửi lại câu hỏi"
                        >
                          <Shuffle className="w-3.5 h-3.5 text-purple-400" />
                          <span>
                            Xoay sang <strong>{nextRotationModel}</strong> & thử lại
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                        >
                          Cài đặt model...
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              <span className="text-[9px] text-zinc-500 mt-1 px-1">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {/* Live Streaming Message */}
          {isStreaming && (
            <div className="flex flex-col items-start animate-in fade-in duration-100">
              <div className="max-w-[92%] rounded-2xl rounded-bl-xs p-3 bg-[#1b1b27] border border-purple-500/40 text-zinc-200 shadow-lg">
                {/* Live Reasoning content */}
                {streamingReasoning && (
                  <div className="mb-2 pb-2 border-b border-zinc-700/50">
                    <button
                      onClick={() => setShowReasoning(!showReasoning)}
                      className="flex items-center gap-1 text-[11px] text-purple-300 font-mono hover:text-purple-200 cursor-pointer"
                    >
                      <Brain className="w-3 h-3 animate-pulse" />
                      <span>Đang suy luận...</span>
                      {showReasoning ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showReasoning && (
                      <div className="mt-1.5 p-2 rounded-lg bg-black/40 text-zinc-400 font-mono text-[10px] leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                        {streamingReasoning}
                      </div>
                    )}
                  </div>
                )}

                {streamingContent ? (
                  <MarkdownRenderer
                    content={stripAgentActionCodeBlock(cleanAiOutput(streamingContent))}
                    attachments={activeMap.attachments}
                    onNodeClick={onFocusNode}
                  />
                ) : (
                  <div className="flex items-center gap-2 py-1 text-zinc-400">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]" />
                    <span className="text-xs text-zinc-400">Đang đọc hiểu mind map...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Bar (hidden if history drawer is open) */}
      {!isHistoryDrawerOpen && (
        <div className="p-3 border-t border-[#252535] bg-[#101018]/95 space-y-2">
          <div className="relative flex items-end gap-1.5 bg-[#171722] border border-[#2b2b3d] focus-within:border-purple-500 rounded-xl p-1.5 transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                chatMode === 'agent'
                  ? 'Giao nhiệm vụ cho AI Agent (vd: Đọc đề cương và tạo toàn bộ map, thêm nhánh bài tập...)'
                  : 'Hỏi AI về các ô, công thức, liên kết... (Enter để gửi)'
              }
              className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 outline-none resize-none px-2 py-1.5 max-h-28 overflow-y-auto"
            />

            {isStreaming ? (
              <button
                onClick={handleStopStream}
                title="Dừng tạo phản hồi"
                className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white shrink-0 transition-colors shadow-sm"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => handleSendMessage()}
                disabled={!input.trim()}
                title={chatMode === 'agent' ? 'Chạy lệnh AI Agent' : 'Gửi câu hỏi'}
                className={`p-2 rounded-lg text-white shrink-0 transition-all shadow-md cursor-pointer disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none ${
                  chatMode === 'agent'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                }`}
              >
                {chatMode === 'agent' ? <Wand2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
            <span>Bấm nút <strong>Lịch sử</strong> ở trên để xem lại các cuộc trò chuyện</span>
            <span className="font-mono">Shift+Enter: Xuống dòng</span>
          </div>
        </div>
      )}
    </div>
  );
};
