import React, { useState, useEffect, useReducer, useRef } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import {
  SettingsSidebar,
  ModelItem,
  GenerationSettings,
  StudioTab
} from './components/SettingsSidebar';
import { PromptInput } from './components/PromptInput';
import { Canvas } from './components/Canvas';
import { CopilotChat } from './components/CopilotChat';
import { ConfirmationDialog, ConfirmationDetails } from './components/copilot/ConfirmationDialog';
import { CompareView } from './components/copilot/CompareView';
import { vscode } from './utils/vscode';
import { initialRunState, runReducer } from './state/runReducer';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  thought?: string;
  operation?: string;
  outputImageUri?: string;
  suggestions?: Array<{ label: string; reason: string }>;
}

interface ToastState {
  kind: 'success' | 'error' | 'info';
  message: string;
}

interface ConfirmationState extends ConfirmationDetails {
  token: string;
  provider: string;
  purpose: string;
  costEstimate?: string;
  isCloud?: boolean;
}

interface ChatSessionSummary {
  sessionId: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

interface HistoryNodeSummary {
  nodeId: string;
  parentId?: string;
  operation: string;
  operationLabel: string;
  timestamp: number;
  outputImageUri?: string;
}

export const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<StudioTab>('generate');

  // Connection state
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [comfyOnline, setComfyOnline] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>('http://127.0.0.1:9090');

  // Models state
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Prompt state
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');

  // Generation settings
  const [settings, setSettings] = useState<GenerationSettings>({
    width: 512,
    height: 512,
    steps: 25,
    cfgScale: 7.5,
    seed: Math.floor(Math.random() * 1000000),
    randomSeed: true
  });

  // Generation status
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPercentage, setProgressPercentage] = useState<number | undefined>(undefined);

  // Upscale status
  const [isUpscaling, setIsUpscaling] = useState<boolean>(false);

  // Action processing status (Edit & Dev Tools)
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [processingLabel, setProcessingLabel] = useState<string>('');

  // Active Image & Saved path
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | undefined>(undefined);
  const [snippetInserted, setSnippetInserted] = useState<boolean>(false);

  // Copilot Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatThinking, setIsChatThinking] = useState<boolean>(false);
  const [chatRun, dispatchChatRun] = useReducer(runReducer, initialRunState);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [history, setHistory] = useState<HistoryNodeSummary[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string>('');
  const activeSessionIdRef = useRef('');
  const currentNodeIdRef = useRef('');

  // Cloud AI Key status
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [apiKeyMasked, setApiKeyMasked] = useState<string>('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [previewState, setPreviewState] = useState<{
    previewUrl: string;
    originalUrl: string;
    operationLabel?: string;
    planId?: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.kind === 'error' ? 7000 : 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Handle messages from Extension Host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || (!message.command && !message.type)) return;

      const cmd = message.command || message.type;

      switch (cmd) {
        case 'pingResult':
          setIsOnline(message.isOnline);
          setComfyOnline(Boolean(message.comfyOnline));
          if (message.serverUrl) setServerUrl(message.serverUrl);
          break;

        case 'apiKeyStatus':
          setHasApiKey(Boolean(message.hasApiKey));
          setApiKeyMasked(message.apiKeyMasked || '');
          break;

        case 'confirmationRequested':
          if (message.confirmation?.token && message.confirmation?.provider && message.confirmation?.purpose) {
            setConfirmation(message.confirmation);
          }
          break;

        case 'modelsLoaded':
          if (Array.isArray(message.models)) {
            setModels(message.models);
            setSelectedModel((previous) => message.models.some((model: ModelItem) => model.key === previous)
              ? previous
              : message.models[0]?.key || '');
          }
          break;

        case 'setImage':
        case 'SET_CURRENT_IMAGE':
          setCurrentImageUrl(message.dataUrl || message.payload?.imageUri);
          setSavedPath(message.filePath || message.payload?.fileName);
          setSnippetInserted(false);
          setIsProcessingAction(false);
          break;

        case 'generationStarted':
          setIsGenerating(true);
          setProgressStatus('Starting generation...');
          setProgressPercentage(10);
          setSnippetInserted(false);
          break;

        case 'generationProgress':
          setProgressStatus(message.status);
          if (typeof message.percentage === 'number') {
            setProgressPercentage(message.percentage);
          }
          break;

        case 'generationComplete':
          setIsGenerating(false);
          const isCurrentGeneration = message.sessionId === activeSessionIdRef.current &&
            message.nodeId === currentNodeIdRef.current;
          if (isCurrentGeneration) {
            setCurrentImageUrl(message.dataUrl);
            setSavedPath(message.savedPath);
          }
          setSnippetInserted(isCurrentGeneration && Boolean(message.snippetInserted));
          setProgressPercentage(100);
          setToast({ kind: 'success', message: isCurrentGeneration
            ? (message.savedPath ? 'Đã tạo và lưu ảnh vào workspace.' : 'Đã tạo ảnh trong lịch sử Pixel Pilot.')
            : 'Ảnh mới đã được lưu ở một phiên khác trong danh sách.' });
          break;

        case 'generationError':
          setIsGenerating(false);
          setProgressStatus('');
          setProgressPercentage(undefined);
          setToast({ kind: 'error', message: message.message || 'Không thể tạo ảnh. Hãy kiểm tra model và máy chủ AI.' });
          break;

        case 'upscaleStarted':
          setIsUpscaling(true);
          break;

        case 'upscaleProgress':
          setProgressStatus(message.status);
          if (typeof message.percentage === 'number') {
            setProgressPercentage(message.percentage);
          }
          break;

        case 'upscaleComplete':
          setIsUpscaling(false);
          if (message.sessionId === activeSessionIdRef.current && message.nodeId === currentNodeIdRef.current) {
            setCurrentImageUrl(message.dataUrl);
            setSavedPath(message.savedPath);
          }
          setToast({ kind: 'success', message: 'Đã phóng to và lưu ảnh thành công.' });
          break;

        case 'upscaleError':
          setIsUpscaling(false);
          setToast({ kind: 'error', message: message.message || 'Không thể phóng to ảnh.' });
          break;

        case 'actionStarted':
        case 'UPDATE_AI_PROGRESS':
          setIsProcessingAction(true);
          setProcessingLabel(message.label || message.payload?.status || 'Đang xử lý AI...');
          break;

        case 'actionComplete':
        case 'AI_ACTION_SUCCESS':
          setIsProcessingAction(false);
          const isCurrentResult = !message.sessionId || (
            message.sessionId === activeSessionIdRef.current &&
            (!message.nodeId || message.nodeId === currentNodeIdRef.current)
          );
          if (isCurrentResult && (message.dataUrl || message.payload?.outputUri)) {
            setCurrentImageUrl(message.dataUrl || message.payload?.outputUri);
          }
          if (isCurrentResult && message.savedPath) {
            setSavedPath(message.savedPath);
          }
          setToast({ kind: 'success', message: isCurrentResult
            ? (message.message || 'Đã hoàn tất thao tác ảnh.')
            : 'Kết quả đã lưu vào phiên hoặc nhánh ảnh trước đó.' });
          break;

        case 'actionError':
        case 'AI_ACTION_ERROR':
          setIsProcessingAction(false);
          setToast({ kind: 'error', message: message.message || message.payload?.error || 'Không thể hoàn tất thao tác ảnh.' });
          break;

        case 'operationFailed':
          setIsProcessingAction(false);
          setIsChatThinking(false);
          dispatchChatRun({ type: 'fail', error: message.error || 'Agent could not complete the request.' });
          setToast({ kind: 'error', message: message.error || 'Agent không thể hoàn tất yêu cầu.' });
          break;

        case 'operationCompleted':
          setIsProcessingAction(false);
          setIsChatThinking(false);
          break;

        case 'copilotProgress':
        case 'step.progress':
          dispatchChatRun({
            type: 'progress',
            requestId: message.requestId,
            stage: message.stage || message.status || 'Đang xử lý...',
            fraction: typeof message.fraction === 'number' ? message.fraction : undefined,
            provider: message.provider
          });
          break;

        case 'previewReady':
        case 'plan.preview_ready':
          if (message.previewUrl || message.result?.outputImageUri) {
            setPreviewState({
              previewUrl: message.previewUrl || message.result?.outputImageUri,
              originalUrl: currentImageUrl || message.originalUrl || '',
              operationLabel: message.operationLabel || message.toolName || 'Chỉnh sửa ảnh',
              planId: message.planId
            });
          }
          break;

        case 'copilotCompleted':
          dispatchChatRun({
            type: 'succeed',
            requestId: message.requestId,
            metrics: message.metrics
          });
          setIsChatThinking(false);
          break;

        case 'copilotCancelled':
          dispatchChatRun({ type: 'cancel', requestId: message.requestId });
          setIsChatThinking(false);
          break;

        case 'copilotError':
          dispatchChatRun({ type: 'fail', requestId: message.requestId, error: message.error?.message || 'Agent could not complete the request.' });
          setIsChatThinking(false);
          setToast({ kind: 'error', message: message.error?.message || 'Agent could not complete the request.' });
          break;

        case 'chatReply':
          setIsChatThinking(false);
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', text: message.text, thought: message.thought }
          ]);
          if (message.updatedImage) {
            setCurrentImageUrl(message.updatedImage);
          }
          break;

        case 'sessionUpdated': {
          setSessions(Array.isArray(message.sessionsList) ? message.sessionsList : []);
          activeSessionIdRef.current = message.session?.sessionId || '';
          currentNodeIdRef.current = message.session?.currentNodeId || '';
          setActiveSessionId(message.session?.sessionId || '');
          setHistory(Array.isArray(message.history) ? message.history : []);
          setCurrentNodeId(message.session?.currentNodeId || '');
          const history = Array.isArray(message.session?.messages) ? message.session.messages : [];
          setChatMessages(history.filter((item: any) => item.sender === 'user' || item.sender === 'assistant').map((item: any) => ({
            id: item.id,
            role: item.sender,
            text: item.text,
            operation: item.operation,
            outputImageUri: item.outputImageUri,
            suggestions: item.suggestions
          })));
          setCurrentImageUrl(message.currentImage || null);
          setSavedPath(message.savedPath || undefined);
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Initial ping & fetch
    vscode.postMessage({ command: 'ping' });
    vscode.postMessage({ command: 'getModels' });
    vscode.postMessage({ command: 'getApiKeyStatus' });
    vscode.postMessage({ command: 'webviewReady' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Trigger Text-to-Image Generation
  const handleGenerate = () => {
    if (!prompt.trim() || isGenerating) return;

    const chosenModel = models.find((m) => m.key === selectedModel) || selectedModel;

    vscode.postMessage({
      command: 'generate',
      prompt: prompt.trim(),
      model: chosenModel,
      sessionId: activeSessionId,
      nodeId: currentNodeId,
      options: {
        negativePrompt: negativePrompt.trim(),
        width: settings.width,
        height: settings.height,
        steps: settings.steps,
        cfgScale: settings.cfgScale,
        seed: settings.seed,
      }
    });
  };

  // Trigger 2x Upscale on current image
  const handleUpscale = () => {
    if (!currentImageUrl || isUpscaling) return;

    vscode.postMessage({
      command: 'upscale',
      dataUrl: currentImageUrl,
      sessionId: activeSessionId,
      nodeId: currentNodeId,
      factor: 2
    });
  };

  // Trigger Unified AI Actions (Tách nền, Inpaint, Recolor, Vectorize, Dev tools)
  const handleApplyAction = (action: string, options?: any) => {
    if (action === 'openApiKeyPrompt') {
      vscode.postMessage({ command: 'openApiKeyPrompt' });
      return;
    }
    if (!currentImageUrl && action !== 'openImage') return;

    setIsProcessingAction(true);
    setProcessingLabel(`Đang thực hiện ${action}...`);

    vscode.postMessage({
      command: 'applyAction',
      action,
      dataUrl: currentImageUrl,
      sessionId: activeSessionId,
      nodeId: currentNodeId,
      options: options || {}
    });
  };

  // Open Image from disk
  const handleOpenImage = () => {
    vscode.postMessage({ command: 'browseImage' });
  };

  // Save Image to disk
  const handleSaveImage = () => {
    if (!currentImageUrl) return;
    vscode.postMessage({
      command: 'exportImage',
      dataUrl: currentImageUrl,
      savedPath
    });
  };

  // Send Copilot Chat Message
  const handleSendMessage = (text: string) => {
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setIsChatThinking(true);
    dispatchChatRun({ type: 'start', requestId, label: 'Agent is analysing your request' });

    vscode.postMessage({
      command: 'copilotRequest',
      request: { version: 2, requestId, command: 'chat', text, sessionId: activeSessionId || undefined }
    });
  };

  // Re-ping InvokeAI server
  const handlePing = () => {
    vscode.postMessage({ command: 'ping' });
    vscode.postMessage({ command: 'getModels' });
    vscode.postMessage({ command: 'getApiKeyStatus' });
  };

  // Insert code snippet manually
  const handleInsertSnippet = () => {
    if (savedPath) {
      vscode.postMessage({
        command: 'insertSnippet',
        relativePath: savedPath,
        altText: prompt ? prompt.substring(0, 30) : 'Generated Image'
      });
      setSnippetInserted(true);
    }
  };

  const canvasView = previewState ? (
    <CompareView
      originalUrl={previewState.originalUrl}
      previewUrl={previewState.previewUrl}
      operationLabel={previewState.operationLabel}
      onApply={() => {
        setCurrentImageUrl(previewState.previewUrl);
        vscode.postMessage({
          command: 'plan.apply',
          planId: previewState.planId,
          previewUrl: previewState.previewUrl
        });
        setPreviewState(null);
        setToast({ kind: 'success', message: 'Đã áp dụng kết quả chỉnh sửa vào Canvas.' });
      }}
      onDiscard={() => {
        vscode.postMessage({
          command: 'plan.discard',
          planId: previewState.planId
        });
        setPreviewState(null);
      }}
    />
  ) : (
    <Canvas
      imageUrl={currentImageUrl}
      isGenerating={isGenerating || isProcessingAction}
      progressStatus={isProcessingAction ? processingLabel : progressStatus}
      progressPercentage={progressPercentage}
      savedPath={savedPath}
      onInsertSnippet={handleInsertSnippet}
      snippetInserted={snippetInserted}
      onOpenImage={handleOpenImage}
      onSaveImage={handleSaveImage}
      onApplyAction={handleApplyAction}
    />
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* The tool sidebar is intentionally hidden in agent mode: the conversation
          needs a usable reading/writing width and exposes its own navigation. */}
      {activeTab !== 'chat' && <SettingsSidebar
        isOnline={isOnline}
        comfyOnline={comfyOnline}
        serverUrl={serverUrl}
        models={models}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        settings={settings}
        setSettings={setSettings}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        onRefreshModels={() => vscode.postMessage({ command: 'getModels' })}
        onPing={handlePing}
        hasActiveImage={Boolean(currentImageUrl)}
        onUpscale={handleUpscale}
        isUpscaling={isUpscaling}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onApplyAction={handleApplyAction}
        isProcessingAction={isProcessingAction}
        processingLabel={processingLabel}
        onOpenImage={handleOpenImage}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewSession={() => vscode.postMessage({ command: 'newSession' })}
        onSwitchSession={(sessionId) => vscode.postMessage({ command: 'switchSession', sessionId })}
        onRenameSession={(sessionId, title) => vscode.postMessage({ command: 'renameSession', sessionId, title })}
        onDeleteSession={(sessionId) => vscode.postMessage({ command: 'deleteSession', sessionId })}
        hasApiKey={hasApiKey}
        apiKeyMasked={apiKeyMasked}
      />}

      {/* Main Studio Canvas Area */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {activeTab === 'chat' ? (
          <div className={`grid h-full min-h-0 min-w-0 grid-cols-1 overflow-hidden ${currentImageUrl ? 'xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]' : ''}`}>
            <CopilotChat
              messages={chatMessages}
              isThinking={isChatThinking || chatRun.phase === 'executing' || chatRun.phase === 'processing'}
              runState={chatRun}
              hasImage={Boolean(currentImageUrl)}
              currentImageUrl={currentImageUrl}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSend={handleSendMessage}
              onOpenImage={handleOpenImage}
              onNewSession={() => vscode.postMessage({ command: 'newSession' })}
              onSwitchSession={(sessionId) => vscode.postMessage({ command: 'switchSession', sessionId })}
              history={history}
              currentNodeId={currentNodeId}
              onSelectNode={(nodeId) => vscode.postMessage({ command: 'rollbackNode', targetNodeId: nodeId })}
              onNavigate={setActiveTab}
              hasApiKey={hasApiKey}
              onConfigureApiKey={() => vscode.postMessage({ command: 'openApiKeyPrompt' })}
              onCancelRun={(requestId) =>
                vscode.postMessage({
                  command: 'copilotRequest',
                  request: { command: 'cancel', targetRequestId: requestId }
                })
              }
            />
            {currentImageUrl && <div className="hidden min-w-0 border-l border-slate-800 xl:flex">{canvasView}</div>}
          </div>
        ) : canvasView}

        {/* Bottom Prompt Bar (available in Generation and Edit mode) */}
        {activeTab !== 'chat' && (
          <PromptInput
            prompt={prompt}
            setPrompt={setPrompt}
            negativePrompt={negativePrompt}
            setNegativePrompt={setNegativePrompt}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        )}
      </main>

      {toast && (
        <div role="status" aria-live="polite" className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${toast.kind === 'error' ? 'border-rose-400/30 bg-rose-950/95 text-rose-100' : toast.kind === 'success' ? 'border-emerald-400/30 bg-emerald-950/95 text-emerald-100' : 'border-sky-400/30 bg-sky-950/95 text-sky-100'}`}>
          {toast.kind === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="leading-5">{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-1 rounded p-0.5 opacity-70 hover:bg-white/10 hover:opacity-100" aria-label="Đóng thông báo"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {confirmation && (
        <ConfirmationDialog
          details={confirmation}
          onRespond={(approved) => {
            vscode.postMessage({ command: 'confirmationResponse', token: confirmation.token, approved });
            setConfirmation(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
